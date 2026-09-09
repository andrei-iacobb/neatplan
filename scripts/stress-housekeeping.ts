import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { hash } from 'bcryptjs'
import sharp from 'sharp'
import { prisma } from '../src/lib/db'
import type { UserRole } from '../src/generated/prisma/enums'

// Run only against the disposable database and its local app:
// pnpm exec tsx scripts/stress-housekeeping.ts
const runId = `stress-${randomUUID()}`
const siteIds = [`${runId}-site-a`, `${runId}-site-b`]
const userIds: string[] = []
const scheduleIds: string[] = []
const checks: string[] = []
let stage = 'validate targets'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function record(value: unknown): Record<string, unknown> {
  assert(isRecord(value), 'Expected a JSON object')
  return value
}

function textField(value: unknown, field: string): string {
  const result = record(value)[field]
  assert(typeof result === 'string' && result.length > 0, `Expected string field ${field}`)
  return result
}

function numberField(value: unknown, field: string): number {
  const result = record(value)[field]
  assert(typeof result === 'number' && Number.isFinite(result), `Expected numeric field ${field}`)
  return result
}

function floorPlanPdf() {
  const drawing = '0.9 g 0 0 200 100 re f\n0 G 4 w 10 10 180 80 re S\n0 g 30 30 40 40 re f\n'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Resources << >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(drawing)} >>\nstream\n${drawing}endstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  }
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}

function targets() {
  const database = new URL(process.env.DATABASE_URL ?? 'invalid:')
  const app = new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'invalid:')
  const loopback = new Set(['127.0.0.1', 'localhost', '[::1]'])
  assert(['postgres:', 'postgresql:'].includes(database.protocol), 'DATABASE_URL must use PostgreSQL')
  assert(loopback.has(database.hostname), 'DATABASE_URL must use loopback')
  assert.equal(database.pathname, '/neatplan_stress', 'Database must be exactly neatplan_stress')
  assert([...database.searchParams.keys()].every(key => key === 'schema'), 'Database URL cannot override the connection target')
  assert.equal(app.protocol, 'http:', 'Stress app must use local HTTP')
  assert(loopback.has(app.hostname), 'Stress app must use loopback')
  assert(!app.username && !app.password && !app.search && !app.hash && app.pathname === '/', 'Use a bare local app origin')
  return app
}

class Client {
  private readonly cookies = new Map<string, string>()

  constructor(private readonly app: URL) {}

  async request(route: string, init: RequestInit = {}) {
    const url = new URL(route, this.app)
    assert.equal(url.origin, this.app.origin, 'Requests must remain on the local app')
    const headers = new Headers(init.headers)
    headers.set('Origin', this.app.origin)
    headers.set('Referer', `${this.app.origin}/`)
    headers.set('Cookie', [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; '))
    const started = performance.now()
    const response = await fetch(url, {
      ...init, headers, redirect: 'manual', signal: AbortSignal.timeout(30_000),
    })
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';', 1)[0]
      const separator = pair.indexOf('=')
      if (separator < 1) continue
      const name = pair.slice(0, separator)
      if (/;\s*Max-Age=0(?:;|$)/i.test(cookie)) this.cookies.delete(name)
      else this.cookies.set(name, pair.slice(separator + 1))
    }
    const contentType = response.headers.get('content-type') ?? ''
    const bytes = new Uint8Array(await response.arrayBuffer())
    let body: unknown = null
    if (contentType.includes('application/json')) {
      body = JSON.parse(new TextDecoder().decode(bytes))
    }
    return { status: response.status, body, bytes, contentType, elapsedMs: performance.now() - started }
  }

  json(route: string, method: string, body: unknown) {
    return this.request(route, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
  }

  async login(user: { id: string; email: string }, password: string) {
    const csrf = await this.request('/api/auth/csrf')
    expectStatus(csrf, 200, 'CSRF request')
    const response = await this.request('/api/auth/callback/credentials', {
      method: 'POST',
      body: new URLSearchParams({
        email: user.email, password, csrfToken: textField(csrf.body, 'csrfToken'),
        callbackUrl: this.app.origin, json: 'true',
      }),
    })
    expectStatus(response, 200, 'Credential sign-in')
    const session = await this.request('/api/auth/session')
    expectStatus(session, 200, 'Session verification')
    assert.equal(textField(record(session.body).user, 'id'), user.id, 'HTTP app must authenticate the fixture in the stress database')
  }
}

type HttpResult = Awaited<ReturnType<Client['request']>>

async function verifyRenderedImage(response: HttpResult, plan: unknown, label: string) {
  expectStatus(response, 200, label)
  assert.equal(response.contentType, 'image/png', `${label} must serve PNG`)
  assert.deepEqual([...response.bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  const image = sharp(response.bytes)
  const metadata = await image.metadata()
  assert.equal(metadata.format, 'png')
  assert.equal(metadata.width, numberField(plan, 'imageWidth'), `${label} width must match its record`)
  assert.equal(metadata.height, numberField(plan, 'imageHeight'), `${label} height must match its record`)
  assert(metadata.width > 0 && metadata.width <= 2400 && metadata.height > 0 && metadata.height <= 2400)
  const stats = await image.stats()
  assert(stats.channels.slice(0, 3).some(channel => channel.max - channel.min > 100), `${label} must contain the fixture drawing`)
  return { width: metadata.width, height: metadata.height }
}

function expectStatus(response: HttpResult, expected: number, label: string) {
  // Report only the error field, never credentials, cookies, or whole response bodies.
  const body = response.body
  const error = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
    ? body.error.replace(/[^\w .,:'-]/g, '').slice(0, 160)
    : response.contentType
  assert.equal(response.status, expected, `${label}: expected ${expected}, received ${response.status} (${error})`)
}

function expectRace(results: HttpResult[], label: string) {
  assert.equal(results.filter(result => result.status === 200).length, 1, `${label}: exactly one request must win`)
  for (const result of results) {
    if (result.status !== 200) expectStatus(result, 409, `${label} losing request`)
  }
}

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (reason: unknown) => void }

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((settle, fail) => { resolve = settle; reject = fail })
  return { promise, resolve, reject }
}

async function pollUntil<T>(read: () => Promise<T | null>, budgetMs: number, label: string) {
  const deadline = performance.now() + budgetMs
  for (;;) {
    const value = await read()
    if (value !== null) return value
    assert(performance.now() < deadline, `${label} did not happen within ${budgetMs}ms`)
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

// Backends waiting on a lock this backend holds. Lets a race assert on observed
// interleaving instead of trusting that two requests happened to overlap.
async function backendsBlockedBy(pid: number) {
  const rows = await prisma.$queryRaw<{ pid: number }[]>`
    SELECT pid::int AS pid FROM pg_stat_activity
    WHERE datname = current_database() AND ${pid}::int = ANY(pg_blocking_pids(pid))
  `
  return rows.length > 0 ? rows.map((row) => row.pid) : null
}

async function finishRequests(requests: Promise<HttpResult>[]) {
  // Let every mutation finish before a failed request can enter fixture cleanup.
  const results = await Promise.allSettled(requests)
  return results.map(result => {
    assert(result.status === 'fulfilled', 'Concurrent HTTP request did not return a complete response')
    return result.value
  })
}

async function main() {
  const app = targets()
  const started = performance.now()
  const password = randomBytes(24).toString('base64url')
  const passwordHash = await hash(password, 10)
  let receipt: Record<string, unknown> | undefined
  try {
    stage = 'create isolated fixtures'
    for (const [index, id] of siteIds.entries()) {
      await prisma.site.create({ data: { id, name: `${runId} site ${index}` } })
    }
    async function actor(name: string, role: UserRole, siteId: string | null) {
      const id = `${runId}-${name}`
      userIds.push(id)
      const user = await prisma.user.create({ data: {
        id, email: `${id}@example.invalid`, name: `Stress ${name}`, password: passwordHash,
        role, siteId, isAdmin: role !== 'CLEANER',
      }, select: { id: true, email: true } })
      const client = new Client(app)
      await client.login(user, password)
      return client
    }
    const admin = await actor('admin', 'OP', null)
    const head = await actor('head-a', 'HEAD_OF_HOUSEKEEPING', siteIds[0])
    const cleaner = await actor('cleaner-a', 'CLEANER', siteIds[0])
    const otherHead = await actor('head-b', 'HEAD_OF_HOUSEKEEPING', siteIds[1])
    const otherCleaner = await actor('cleaner-b', 'CLEANER', siteIds[1])
    const manager = await actor('manager', 'MANAGER', siteIds[0])
    const unassigned = await actor('unassigned', 'HEAD_OF_HOUSEKEEPING', null)
    const room = await prisma.room.create({ data: {
      id: `${runId}-room-a`, name: `${runId} Laundry`, siteId: siteIds[0], type: 'SERVICE_AREA', floor: 'Ground',
    } })
    const otherRoom = await prisma.room.create({ data: {
      id: `${runId}-room-b`, name: `${runId} Other laundry`, siteId: siteIds[1], type: 'SERVICE_AREA', floor: 'Ground',
    } })
    const png = await readFile(path.join(process.cwd(), 'tests/e2e/fixtures/cleaning-schedule.png'))
    function uploadForm(siteId: string, floor = 'Ground', file = new File([new Uint8Array(png)], 'floor.png', { type: 'image/png' })) {
      const form = new FormData()
      form.set('name', `${runId} plan`)
      form.set('floor', floor)
      form.set('siteId', siteId)
      form.set('file', file)
      return form
    }

    stage = 'floor plan upload authorization'
    expectStatus(await cleaner.request('/api/floor-plans', { method: 'POST', body: uploadForm(siteIds[0]) }), 403, 'Cleaner upload')
    expectStatus(await unassigned.request('/api/floor-plans', { method: 'POST', body: uploadForm(siteIds[0]) }), 400, 'Unassigned upload')
    const uploaded = await head.request('/api/floor-plans', { method: 'POST', body: uploadForm(siteIds[1]) })
    expectStatus(uploaded, 201, 'Head of Housekeeping upload with forged site')
    const planId = textField(uploaded.body, 'id')
    assert.equal(textField(uploaded.body, 'siteId'), siteIds[0])
    assert.equal((await prisma.floorPlan.findUniqueOrThrow({ where: { id: planId } })).siteId, siteIds[0])
    expectStatus(await manager.request('/api/floor-plans', { method: 'POST', body: uploadForm(siteIds[1], 'First') }), 201, 'Manager upload')
    expectStatus(await cleaner.request(`/api/floor-plans/${planId}/image`), 404, 'Cleaner draft access')
    expectStatus(await otherHead.request(`/api/floor-plans/${planId}/image`), 404, 'Other site draft access')
    checks.push('upload role and site isolation')

    stage = 'PDF floor plan rendering'
    const pdfUpload = await head.request('/api/floor-plans', {
      method: 'POST', body: uploadForm(siteIds[0], 'PDF floor', new File([floorPlanPdf()], 'floor.pdf', { type: 'application/pdf' })),
    })
    expectStatus(pdfUpload, 201, 'PDF floor plan upload')
    const pdfId = textField(pdfUpload.body, 'id')
    assert.equal(textField(pdfUpload.body, 'sourceFileName'), 'floor.pdf')
    assert.equal(textField(pdfUpload.body, 'imageMimeType'), 'image/png')
    const pdfDimensions = await verifyRenderedImage(await head.request(`/api/floor-plans/${pdfId}/image`), pdfUpload.body, 'Rendered PDF image')
    assert.deepEqual(pdfDimensions, { width: 2400, height: 1200 }, 'PDF rendering must preserve the 2:1 page dimensions')
    const malformedPdf = await head.request('/api/floor-plans', {
      method: 'POST', body: uploadForm(siteIds[0], 'Invalid PDF floor', new File(['%PDF-1.4\nnot a PDF document\n'], 'broken.pdf', { type: 'application/pdf' })),
    })
    expectStatus(malformedPdf, 400, 'Malformed PDF upload')
    assert.equal(textField(malformedPdf.body, 'error'), 'The first PDF page could not be rendered.')
    assert.equal(await prisma.floorPlan.count({ where: { siteId: siteIds[0], floor: 'Invalid PDF floor' } }), 0)
    checks.push('PDF renders a nonblank PNG with matching dimensions', 'malformed PDF returns a friendly 400 without persistence')

    stage = 'floor plan revision races and publication'
    const planRoute = `/api/floor-plans/${planId}`
    const region = { label: 'Laundry', roomId: room.id, x: 0.1, y: 0.1, width: 0.2, height: 0.2 }
    expectStatus(await head.json(`${planRoute}/regions`, 'PUT', {
      revision: 1, regions: [{ ...region, roomId: otherRoom.id }],
    }), 400, 'Foreign room marker')
    const saved = await head.json(`${planRoute}/regions`, 'PUT', { revision: 1, regions: [region] })
    expectStatus(saved, 200, 'Save floor plan marker')
    const revision = numberField(saved.body, 'revision')
    expectStatus(await head.json(planRoute, 'PATCH', { action: 'publish', revision: 1 }), 409, 'Stale publication')
    expectStatus(await head.json(planRoute, 'PATCH', { action: 'publish', revision }), 200, 'Publish floor plan')
    const visible = await cleaner.request(`${planRoute}/image`)
    const pngDimensions = await verifyRenderedImage(visible, uploaded.body, 'Published PNG image')
    expectStatus(await otherCleaner.request(`${planRoute}/image`), 404, 'Foreign published image')
    const published = await prisma.floorPlan.findUniqueOrThrow({ where: { id: planId } })
    const regionRace = await finishRequests(Array.from({ length: 8 }, (_, index) =>
      head.json(`${planRoute}/regions`, 'PUT', {
        revision: published.revision, regions: [{ ...region, label: `Concurrent marker ${index}` }],
      })
    ))
    expectRace(regionRace, 'Concurrent region save')
    const afterRace = await prisma.floorPlan.findUniqueOrThrow({ where: { id: planId }, include: { regions: true } })
    assert.equal(afterRace.revision, published.revision + 1)
    assert.equal(afterRace.isPublished, false)
    assert.equal(afterRace.regions.length, 1)
    expectStatus(await cleaner.request(`${planRoute}/image`), 404, 'Edited plan becomes private draft')
    checks.push('published image isolation', 'eight concurrent region saves produce one update')

    stage = 'room transfer during an in-flight region save'
    // Holding the plan row parks the save just after its membership read. Old code
    // rejected that safely: the roomId foreign key check raised a serialization
    // conflict. A save that locks its rooms makes the transfer wait, and both finish.
    const transferRoom = await prisma.room.create({ data: {
      id: `${runId}-room-transfer`, name: `${runId} Transfer store`, siteId: siteIds[0], type: 'SERVICE_AREA', floor: 'PDF floor',
    } })
    expectStatus(await admin.request(`/api/rooms/${transferRoom.id}`), 200, 'Transfer room preload')
    const pdfPlan = await prisma.floorPlan.findUniqueOrThrow({ where: { id: pdfId }, select: { revision: true } })
    class ProbeRollback extends Error {}
    const lockHeld = deferred<number>()
    const releaseLock = deferred<void>()
    let probeFailure: unknown = null
    const probe = prisma.$transaction(async (transaction) => {
      const [backend] = await transaction.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid()::int AS pid`
      await transaction.$queryRaw`SELECT id FROM floor_plans WHERE id = ${pdfId} FOR UPDATE`
      lockHeld.resolve(backend.pid)
      await releaseLock.promise
      // Roll back: the probe only ever holds a lock, it never writes.
      throw new ProbeRollback()
    }, { timeout: 30_000, maxWait: 5_000 }).catch((error: unknown) => {
      if (error instanceof ProbeRollback) return
      probeFailure = error
      lockHeld.reject(error)
    })
    const inFlight: Promise<HttpResult>[] = []
    let overlap = ''
    try {
      const probePid = await lockHeld.promise
      inFlight.push(head.json(`/api/floor-plans/${pdfId}/regions`, 'PUT', {
        revision: pdfPlan.revision,
        regions: [{ label: 'Transferred store', roomId: transferRoom.id, x: 0.3, y: 0.3, width: 0.2, height: 0.2 }],
      }))
      const parked = await pollUntil(() => backendsBlockedBy(probePid), 2_000, 'Region save parking on the plan row')
      assert.equal(parked.length, 1, 'Exactly one backend may wait on the probe lock')
      let transferSettled = false
      inFlight.push(admin.json(`/api/rooms/${transferRoom.id}`, 'PUT', {
        name: transferRoom.name, floor: 'PDF floor', type: 'SERVICE_AREA', siteId: siteIds[1],
      }).then((result) => { transferSettled = true; return result }))
      // Either the transfer lands while the save is parked, or the save holds a row
      // lock the transfer must wait for. The save's transaction times out after
      // five seconds, so both budgets together (2s + 1.5s) stay under it.
      overlap = await pollUntil(async () => {
        if (await backendsBlockedBy(parked[0]) !== null) return 'transfer waits on the save'
        return transferSettled ? 'transfer committed while the save was parked' : null
      }, 1_500, 'Room transfer reaching the room row')
    } finally {
      releaseLock.resolve()
      await probe
      // Never enter cleanup, or the next assertion, with a live mutation in flight.
      await Promise.allSettled(inFlight)
    }
    assert.equal(probeFailure, null, 'Plan row probe could not hold its lock')
    const [transferSave, transferResult] = await finishRequests(inFlight)
    assert.equal(overlap, 'transfer waits on the save',
      'The transfer changed the room while the save was parked: the save does not lock the rooms it links')
    expectStatus(transferResult, 200, 'Room transfer during region save')
    // 400 stays acceptable: a separate serialization abort can retry after the
    // transfer has committed, at which point the room really is not in this site.
    assert([200, 400].includes(transferSave.status),
      `Region save answered ${transferSave.status}; expected 200, or 400 on retry after the transfer ` +
      '(409 = lost the room to a serialization failure instead of locking it, 500 = its transaction timed out)')
    assert.equal((await prisma.room.findUniqueOrThrow({ where: { id: transferRoom.id } })).siteId, siteIds[1])
    const pdfRegions = await prisma.floorPlanRegion.findMany({
      where: { floorPlanId: pdfId }, select: { label: true, room: { select: { siteId: true } } },
    })
    const crossSite = pdfRegions.filter((entry) => entry.room !== null && entry.room.siteId !== siteIds[0])
    assert.equal(crossSite.length, 0, `Floor plan kept ${crossSite.length} marker(s) linked to a room in another site`)
    const transferRace = { overlap, saveStatus: transferSave.status, transferStatus: transferResult.status, markers: pdfRegions.length, crossSiteMarkers: crossSite.length }
    checks.push('a mid-save room transfer waits on the save and leaves no cross-site marker')

    stage = 'combined completion fixtures'
    const due = new Date(Date.now() - 48 * 60 * 60 * 1000)
    async function schedule(suffix: string) {
      const id = `${runId}-schedule-${suffix}`
      scheduleIds.push(id)
      return prisma.schedule.create({ data: {
        id, title: `${runId} ${suffix}`, sites: { connect: { id: siteIds[0] } },
        tasks: { create: [{ description: 'Clean windows and ledges' }, { description: 'Empty bins' }] },
        rooms: { create: { roomId: room.id, frequency: 'DAILY', nextDue: due, status: 'PENDING' } },
      }, include: { tasks: { orderBy: { description: 'asc' } }, rooms: true } })
    }
    const scheduleA = await schedule('a')
    const scheduleB = await schedule('b')
    const roomScheduleIds = [scheduleA.rooms[0].id, scheduleB.rooms[0].id]
    const completedTasks = scheduleA.tasks.map((task, index) => ({ taskRefs: [
      { scheduleId: roomScheduleIds[0], taskId: task.id },
      { scheduleId: roomScheduleIds[1], taskId: scheduleB.tasks[index].id },
    ] }))
    const signature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const completion = { scheduleIds: roomScheduleIds, completedTasks, signature, signedName: 'Stress Cleaner' }
    const completeRoute = `/api/cleaner/rooms/${room.id}/complete`
    const checklist = await cleaner.request(`/api/cleaner/rooms/${room.id}`)
    expectStatus(checklist, 200, 'Combined room checklist')
    const workPackage = record(record(checklist.body).workPackage)
    assert(Array.isArray(workPackage.tasks) && workPackage.tasks.length === 2, 'Overlapping schedules must render two merged checklist tasks')
    assert(Array.isArray(workPackage.scheduleIds), 'Combined checklist must identify its source schedules')
    assert.deepEqual(new Set(workPackage.scheduleIds), new Set(roomScheduleIds))
    stage = 'combined completion failure paths'
    expectStatus(await cleaner.json(completeRoute, 'POST', { ...completion, signature: undefined }), 400, 'Unsigned completion')
    expectStatus(await cleaner.json(completeRoute, 'POST', { ...completion, completedTasks: completedTasks.slice(0, 1) }), 400, 'Partial completion')
    expectStatus(await otherCleaner.json(completeRoute, 'POST', completion), 404, 'Foreign completion')
    expectStatus(await cleaner.json(`/api/cleaner/rooms/${otherRoom.id}/complete`, 'POST', completion), 400, 'Schedule on wrong room')
    const unchanged = await prisma.roomSchedule.findMany({ where: { id: { in: roomScheduleIds } } })
    assert.equal(unchanged.length, 2)
    for (const item of unchanged) {
      assert.equal(item.lastCompleted, null)
      assert.equal(item.nextDue.getTime(), due.getTime())
    }
    assert.equal(await prisma.roomScheduleCompletionLog.count({ where: { roomScheduleId: { in: roomScheduleIds } } }), 0)
    checks.push('unsigned, partial and foreign completion leave no changes')

    stage = 'reversed combined completion race'
    const completionRace = await finishRequests(Array.from({ length: 8 }, (_, index) =>
      cleaner.json(completeRoute, 'POST', {
        ...completion, scheduleIds: index % 2 === 0 ? roomScheduleIds : [...roomScheduleIds].reverse(),
      })
    ))
    expectRace(completionRace, 'Concurrent combined sign-off')
    const advanced = await prisma.roomSchedule.findMany({ where: { id: { in: roomScheduleIds } } })
    assert.equal(advanced.length, 2)
    const completedAt = advanced[0].lastCompleted
    assert(completedAt !== null, 'Winning sign-off must advance both schedules')
    for (const item of advanced) {
      assert.equal(item.lastCompleted?.getTime(), completedAt.getTime(), 'Both schedules must commit together')
      assert(item.nextDue > due)
    }
    const logs = await prisma.roomScheduleCompletionLog.findMany({ where: { roomScheduleId: { in: roomScheduleIds } } })
    assert.equal(logs.length, 2, 'Exactly one audit log per schedule')
    assert.deepEqual(new Set(logs.map(log => log.roomScheduleId)), new Set(roomScheduleIds))
    for (const log of logs) {
      assert.equal(log.signedName, 'Stress Cleaner')
      assert.equal(log.signatureDataUrl, signature)
      assert(Array.isArray(log.completedTasks) && log.completedTasks.length === 2, 'Audit log must retain all source tasks')
    }
    expectStatus(await cleaner.json(completeRoute, 'POST', completion), 409, 'Completed package replay')
    checks.push('eight reversed-order sign-offs produce two audit logs and one atomic advancement')

    stage = 'mixed read load'
    const loadRoutes = [
      { client: admin, route: `/api/rooms?site=${siteIds[0]}`, array: true },
      { client: head, route: `/api/floor-plans?site=${siteIds[1]}`, array: true },
      { client: cleaner, route: `/api/cleaner/rooms/${room.id}`, array: false },
      { client: cleaner, route: `/api/cleaner/service-areas/${room.id}`, array: false },
      { client: otherCleaner, route: `/api/cleaner/service-areas/${otherRoom.id}`, array: false },
    ]
    const latencies: number[] = []
    const failures: string[] = []
    let nextRequest = 0
    await Promise.all(Array.from({ length: 12 }, async () => {
      while (nextRequest < 200) {
        const index = nextRequest++
        const entry = loadRoutes[index % loadRoutes.length]
        try {
          const response = await entry.client.request(entry.route)
          latencies.push(response.elapsedMs)
          expectStatus(response, 200, 'Mixed read')
          if (entry.array) {
            assert(Array.isArray(response.body) && response.body.length > 0, 'Expected nonempty fixture list')
            for (const item of response.body) assert.equal(textField(item, 'siteId'), siteIds[0], 'Read crossed site boundary')
          } else {
            assert.equal(textField(response.body, 'id'), entry.client === otherCleaner ? otherRoom.id : room.id)
          }
        } catch {
          failures.push(`${index}:${entry.route.split('?')[0]}`)
        }
      }
    }))
    latencies.sort((a, b) => a - b)
    const percentile = (fraction: number) => Math.round(latencies[Math.ceil(latencies.length * fraction) - 1] ?? 0)
    const load = { requests: 200, concurrency: 12, failures: failures.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95), maxMs: percentile(1) }
    assert.equal(failures.length, 0, `Mixed reads failed: ${failures.slice(0, 5).join(', ')}`)
    checks.push('200 mixed reads preserve site boundaries')
    receipt = { ok: true, checks, rendering: { png: pngDimensions, pdf: pdfDimensions }, regionRace: { winners: 1, conflicts: 7 }, transferRace, completionRace: { winners: 1, conflicts: 7, logs: logs.length }, load, elapsedMs: Math.round(performance.now() - started) }
  } finally {
    const failedStage = stage
    stage = 'fixture cleanup'
    try {
      const plans = await prisma.floorPlan.findMany({ where: { siteId: { in: siteIds } }, select: { id: true } })
      await prisma.roomScheduleCompletionLog.deleteMany({ where: {
        OR: [{ completedByUserId: { in: userIds } }, { roomSchedule: { room: { siteId: { in: siteIds } } } }],
      } })
      await prisma.schedule.deleteMany({ where: { id: { in: scheduleIds } } })
      await prisma.site.deleteMany({ where: { id: { in: siteIds } } })
      await prisma.user.deleteMany({ where: { id: { in: userIds } } })
      const imageRoot = path.resolve(process.env.NEATPLAN_DATA_DIR || path.join(process.cwd(), 'data'), 'floor-plans')
      for (const plan of plans) {
        assert(/^[a-zA-Z0-9-]+$/.test(plan.id), 'Refusing to remove an invalid plan directory')
        await rm(path.join(imageRoot, plan.id), { recursive: true, force: true })
      }
      stage = failedStage
    } finally {
      await prisma.$disconnect()
    }
  }
  console.log(JSON.stringify(receipt))
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    ok: false, stage,
    error: error instanceof assert.AssertionError ? error.message : 'Unexpected failure; sensitive runtime details suppressed',
  }))
  process.exitCode = 1
})
