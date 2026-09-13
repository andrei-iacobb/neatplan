import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../src/generated/prisma/client'
import { randomBytes, randomUUID } from 'node:crypto'
import { hash } from 'bcryptjs'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

interface Fixture {
  db: PrismaClient
  siteId: string
  roomId: string
  equipmentId: string
  cleaner: { id: string; email: string }
  otherCleaner: { id: string; email: string }
  foreignCleaner: { id: string; email: string }
  manager: { id: string; email: string }
  password: string
}

const test = base.extend<{ fixture: Fixture }>({
  fixture: async ({ baseURL }, runWithFixture) => {
    const database = new URL(process.env.DATABASE_URL || 'invalid:')
    const app = new URL(baseURL || 'invalid:')
    const local = ['localhost', '127.0.0.1', '[::1]']
    if (!local.includes(database.hostname) || database.pathname !== '/neatplan_stress' ||
      !['postgres:', 'postgresql:'].includes(database.protocol) ||
      [...database.searchParams.keys()].some(key => key !== 'schema') ||
      !local.includes(app.hostname) || app.protocol !== 'http:') {
      throw new Error('Completion photo E2E fixtures require a local app and the disposable neatplan_stress database.')
    }
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }, { schema: database.searchParams.get('schema') || 'public' }) })
    const prefix = `photo-e2e-${randomUUID()}`
    const siteId = `${prefix}-site`
    const otherSiteId = `${prefix}-foreign-site`
    const password = randomBytes(24).toString('base64url')
    const passwordHash = await hash(password, 10)
    const users: string[] = []
    const schedules: string[] = []
    try {
      await db.site.createMany({ data: [{ id: siteId, name: `${prefix} Home` }, { id: otherSiteId, name: `${prefix} Other home` }] })
      async function actor(suffix: string, role: 'CLEANER' | 'MANAGER', site = siteId) {
        const id = `${prefix}-${suffix}`
        users.push(id)
        return db.user.create({ data: { id, email: `${id}@example.invalid`, name: 'Photo Test Cleaner', password: passwordHash, siteId: site, role, isAdmin: role === 'MANAGER' }, select: { id: true, email: true } })
      }
      const cleaner = await actor('cleaner', 'CLEANER')
      const otherCleaner = await actor('other-cleaner', 'CLEANER')
      const foreignCleaner = await actor('foreign-cleaner', 'CLEANER', otherSiteId)
      const manager = await actor('manager', 'MANAGER')
      const room = await db.room.create({ data: { name: 'Photo test laundry', siteId, type: 'SERVICE_AREA', floor: 'Ground' } })
      const equipment = await db.equipment.create({ data: { name: 'Photo test trolley', siteId, type: 'OTHER' } })
      for (const kind of ['room-a', 'room-b', 'equipment']) {
        const id = `${prefix}-${kind}`
        schedules.push(id)
        await db.schedule.create({ data: {
          id, title: `${kind} cleaning`, sites: { connect: { id: siteId } }, tasks: { create: [{ description: 'Wipe the surfaces' }] },
          ...(kind === 'equipment' ? { equipment: { create: { equipmentId: equipment.id, frequency: 'DAILY', nextDue: new Date(Date.now() - 86_400_000) } } } : { rooms: { create: { roomId: room.id, frequency: 'DAILY', nextDue: new Date(Date.now() - 86_400_000) } } }),
        } })
      }
      await runWithFixture({ db, siteId, roomId: room.id, equipmentId: equipment.id, cleaner, otherCleaner, foreignCleaner, manager, password })
    } finally {
      try {
        const photos = await db.completionPhoto.findMany({ where: { siteId: { in: [siteId, otherSiteId] } }, select: { imagePath: true } })
        await db.completionPhoto.deleteMany({ where: { siteId: { in: [siteId, otherSiteId] } } })
        await db.roomScheduleCompletionLog.deleteMany({ where: { siteId: { in: [siteId, otherSiteId] } } })
        await db.equipmentScheduleCompletionLog.deleteMany({ where: { siteId: { in: [siteId, otherSiteId] } } })
        await db.schedule.deleteMany({ where: { id: { in: schedules } } })
        await db.user.deleteMany({ where: { id: { in: users } } })
        await db.site.deleteMany({ where: { id: { in: [siteId, otherSiteId] } } })
        const photoRoot = path.resolve(process.env.NEATPLAN_DATA_DIR || path.join(process.cwd(), 'data'), 'completion-photos')
        for (const photo of photos) {
          if (!path.resolve(photo.imagePath).startsWith(`${photoRoot}${path.sep}`)) throw new Error('Fixture photo is outside the configured photo directory; refusing filesystem cleanup.')
          await rm(photo.imagePath, { force: true })
        }
      } finally { await db.$disconnect() }
    }
  },
})

async function login(request: APIRequestContext, actor: { id: string; email: string }, password: string) {
  const csrf = await (await request.get('/api/auth/csrf')).json()
  const response = await request.post('/api/auth/callback/credentials', { form: { email: actor.email, password, csrfToken: csrf.csrfToken, json: 'true' } })
  expect(response.status()).toBe(200)
  const session = await (await request.get('/api/auth/session')).json()
  expect(session.user.id, 'the HTTP app must use this fixture database').toBe(actor.id)
}

async function sign(page: Page) {
  await page.getByLabel('Printed name').fill('Photo Test Cleaner')
  const canvas = page.getByRole('application', { name: /Sign to confirm/ })
  await canvas.scrollIntoViewIfNeeded()
  const bounds = await canvas.boundingBox()
  if (!bounds) throw new Error('Signature canvas is not visible')
  await page.mouse.move(bounds.x + 20, bounds.y + 50)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 100, bounds.y + 100, { steps: 20 })
  await page.mouse.move(bounds.x + 160, bounds.y + 40, { steps: 20 })
  await page.mouse.up()
}

async function photoBytes() {
  return sharp({ create: { width: 200, height: 140, channels: 3, background: { r: 80, g: 110, b: 120 } } })
    .withExif({ IFD0: { Make: 'TestPhone', Copyright: 'Remove this metadata' } }).jpeg().toBuffer()
}

for (const kind of ['room', 'equipment'] as const) {
  test(`${kind}: retry photos after failed upload without signing off twice`, async ({ page, browser, fixture }) => {
    test.setTimeout(60_000)
    await login(page.request, fixture.cleaner, fixture.password)
    const itemId = kind === 'room' ? fixture.roomId : fixture.equipmentId
    const completePath = `/api/cleaner/${kind === 'room' ? 'rooms' : 'equipment'}/${itemId}/complete`
    let completionPosts = 0
    let uploadAttempts = 0
    const batches: string[] = []
    page.on('request', request => { if (new URL(request.url()).pathname === completePath && request.method() === 'POST') completionPosts++ })
    await page.route('**/api/completion-photos', async route => {
      uploadAttempts++
      const batch = route.request().postDataBuffer()?.toString().match(/name="batchId"\r\n\r\n([^\r]+)/)?.[1]
      if (batch) batches.push(batch)
      if (uploadAttempts === 1) await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Test upload failure. Retry the photos.' }) })
      else await route.continue()
    })
    await page.goto(kind === 'room' ? `/clean/${itemId}` : `/clean/equipment/${itemId}`)
    const task = page.getByRole('button', { name: 'Mark complete: Wipe the surfaces' })
    await expect(task).toBeVisible()
    await task.click()
    const bytes = await photoBytes()
    expect((await sharp(bytes).metadata()).exif).toBeDefined()
    await page.getByLabel('Choose photos (up to 3, 12 MB each)').setInputFiles([1, 2, 3].map(index => ({ name: `surface-${index}.jpg`, mimeType: 'image/jpeg', buffer: bytes })))
    await page.getByLabel('Photo caption (optional)').fill('Cleaned surfaces')
    await sign(page)
    const savedResponse = page.waitForResponse(response => new URL(response.url()).pathname === completePath && response.request().method() === 'POST', { timeout: 15_000 })
    await page.getByRole('button', { name: kind === 'room' ? /Complete Room/ : /Complete Schedule/ }).click()
    expect((await savedResponse).status(), 'Cleaning must be saved before attaching photos').toBe(200)
    await expect(page.getByText('Cleaning saved. Photos were not uploaded.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue without photos' })).toBeVisible()
    await expect(page.getByRole('img', { name: /Selected photo:/ })).toHaveCount(3)
    expect(completionPosts).toBe(1)
    expect(await fixture.db.completionPhoto.count({ where: { siteId: fixture.siteId } })).toBe(0)
    const retryResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/completion-photos' && response.request().method() === 'POST', { timeout: 15_000 })
    await page.getByRole('button', { name: 'Retry photo upload' }).click()
    expect((await retryResponse).status(), 'The retry must persist the photos').toBe(201)
    // The worklist consumes and removes the success query parameter on mount.
    await expect(page).toHaveURL(/\/clean(?:\?completed=true)?$/, { timeout: 15_000 })
    expect(completionPosts).toBe(1)
    expect(uploadAttempts).toBe(2)
    expect(batches).toHaveLength(2)
    expect(batches[0]).toBe(batches[1])
    const photos = await fixture.db.completionPhoto.findMany({ where: { siteId: fixture.siteId }, include: { roomLogs: true, equipmentLogs: true } })
    expect(photos).toHaveLength(3)
    const logs = kind === 'room' ? photos[0].roomLogs : photos[0].equipmentLogs
    expect(logs).toHaveLength(kind === 'room' ? 2 : 1)
    for (const photo of photos) {
      expect((kind === 'room' ? photo.roomLogs : photo.equipmentLogs).map(log => log.id).sort()).toEqual(logs.map(log => log.id).sort())
      const served = await page.request.get(`/api/completion-photos/${photo.id}`)
      expect(served.status()).toBe(200)
      expect(served.headers()['cache-control']).toBe('private, no-store')
      const metadata = await sharp(await served.body()).metadata()
      expect(metadata.format).toBe('webp')
      expect(metadata.exif).toBeUndefined()
    }
    const managerContext = await browser.newContext()
    try {
      await login(managerContext.request, fixture.manager, fixture.password)
      const history = await managerContext.request.get('/api/admin/completion-history')
      expect(history.status()).toBe(200)
      const body = await history.json()
      const serialized = JSON.stringify(body)
      expect(serialized).toContain(`/api/completion-photos/${photos[0].id}`)
      expect(serialized).not.toMatch(/imagePath|\/completion-photos\/.*\.webp/)
      const audit = await managerContext.newPage()
      await audit.goto('/audit')
      await audit.getByRole('button', { name: /Show completion details for Photo test/ }).first().click()
      await expect(audit.getByRole('img', { name: 'Cleaned surfaces' })).toHaveCount(3)
    } finally { await managerContext.close() }
  })
}

test('concurrent uploads and retries enforce three photos and keep foreign users out', async ({ page, browser, fixture }) => {
  test.setTimeout(60_000)
  await login(page.request, fixture.cleaner, fixture.password)
  const schedule = await fixture.db.roomSchedule.findFirstOrThrow({ where: { roomId: fixture.roomId } })
  const log = await fixture.db.roomScheduleCompletionLog.create({ data: { roomScheduleId: schedule.id, completedByUserId: fixture.cleaner.id, completedAt: new Date(), siteId: fixture.siteId, completedTasks: [] } })
  const bytes = await photoBytes()
  function upload(batch: string = randomUUID(), request = page.request) {
    return request.post('/api/completion-photos', { multipart: { kind: 'room', completionIds: JSON.stringify([log.id]), batchId: batch, files: { name: 'surface.jpg', mimeType: 'image/jpeg', buffer: bytes } } })
  }
  const invalid = await page.request.post('/api/completion-photos', { multipart: { kind: 'room', completionIds: JSON.stringify([log.id]), batchId: randomUUID(), files: { name: 'fake.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('<html>not an image</html>') } } })
  expect(invalid.status()).toBe(400)
  expect(await fixture.db.completionPhoto.count({ where: { siteId: fixture.siteId } })).toBe(0)
  const outcomes = await Promise.allSettled(Array.from({ length: 6 }, () => upload()))
  const responses = outcomes.map(result => { if (result.status === 'rejected') throw result.reason; return result.value })
  expect(responses.map(response => response.status()).sort()).toEqual([201, 201, 201, 409, 409, 409])
  const photos = await fixture.db.completionPhoto.findMany({ where: { siteId: fixture.siteId } })
  expect(photos).toHaveLength(3)
  const retryOutcomes = await Promise.allSettled([upload(photos[0].batchId), upload(photos[0].batchId)])
  const retries = retryOutcomes.map(result => { if (result.status === 'rejected') throw result.reason; return result.value })
  expect(retries.map(response => response.status())).toEqual([200, 200])
  expect(await fixture.db.completionPhoto.count({ where: { siteId: fixture.siteId } })).toBe(3)
  for (const actor of [fixture.otherCleaner, fixture.foreignCleaner]) {
    const context = await browser.newContext()
    try {
      await login(context.request, actor, fixture.password)
      expect((await upload(randomUUID(), context.request)).status()).toBe(404)
      expect((await upload(photos[0].batchId, context.request)).status()).toBe(409)
      if (actor.id === fixture.foreignCleaner.id) expect((await context.request.get(`/api/completion-photos/${photos[0].id}`)).status()).toBe(404)
    } finally { await context.close() }
  }
  const anonymous = await browser.newContext()
  try { expect((await anonymous.request.get(`/api/completion-photos/${photos[0].id}`)).status()).toBe(401) }
  finally { await anonymous.close() }
})
