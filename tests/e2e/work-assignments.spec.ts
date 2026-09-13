import { randomUUID } from 'node:crypto'
import { test, expect, type Page } from '@playwright/test'
import { prisma } from '../../src/lib/db'
import { localDateKey } from '../../src/lib/digest/week'
import type { AssignmentBoard } from '../../src/lib/work-assignments/policy'

const signature =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function requireDisposableDatabase() {
  const database = new URL(process.env.DATABASE_URL || 'http://missing')
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname) ||
    database.pathname !== '/neatplan_stress'
  ) {
    throw new Error('Assignment regression fixtures require a loopback neatplan_stress database')
  }
}

async function login(page: Page, role: 'ADMIN' | 'CLEANER') {
  const prefix = role.toLowerCase()
  await page.goto('/auth')
  const email = page.locator('#login-email')
  await expect(email).toHaveCount(1)
  await email.fill(process.env[`E2E_${role}_EMAIL`] || `${prefix}@neatplan.com`)
  await page.locator('#login-password').fill(process.env[`E2E_${role}_PASSWORD`] || `${prefix}123`)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'))
}

test('allocates tablet rounds, records cover, and rejects concurrent stale or transferred assignments', async ({
  browser,
}) => {
  test.setTimeout(180_000)
  requireDisposableDatabase()
  const adminContext = await browser.newContext({ viewport: { width: 800, height: 1280 } })
  const cleanerContext = await browser.newContext({ viewport: { width: 800, height: 1280 } })
  const admin = await adminContext.newPage()
  const cleanerPage = await cleanerContext.newPage()
  const token = randomUUID()
  const roomId = `allocation-room-${token}`
  const equipmentId = `allocation-equipment-${token}`
  const personId = `allocation-cleaner-${token}`
  const otherSiteId = `allocation-site-${token}`
  const scheduleId = `allocation-schedule-${token}`
  const earlyTemplateId = `allocation-early-${token}`
  const name = `Allocation room ${token}`
  const date = localDateKey(new Date())
  let releaseLock: (() => void) | undefined
  let lockTransaction: Promise<unknown> | undefined
  const pending: Promise<unknown>[] = []
  try {
    await Promise.all([login(admin, 'ADMIN'), login(cleanerPage, 'CLEANER')])
    const session = await (await cleanerPage.request.get('/api/auth/session')).json()
    const siteId = session.user.siteId as string
    expect(siteId).toBeTruthy()
    await prisma.site.create({ data: { id: otherSiteId, name: `Allocation other site ${token}` } })
    await prisma.user.create({
      data: {
        id: personId,
        name: `Assigned colleague ${token}`,
        email: `${token}@allocation.example.test`,
        password: 'unusable-fixture-password',
        role: 'CLEANER',
        siteId,
      },
    })
    await prisma.schedule.create({
      data: {
        id: scheduleId,
        title: `Allocation cleaning ${token}`,
        suggestedFrequency: 'DAILY',
        sites: { connect: { id: siteId } },
        tasks: { create: { description: 'Wipe the work surface' } },
      },
    })
    await prisma.schedule.create({
      data: {
        id: earlyTemplateId,
        title: `Allocation quarterly ${token}`,
        suggestedFrequency: 'QUARTERLY',
        sites: { connect: { id: siteId } },
        tasks: { create: { description: 'Clean the window frames' } },
      },
    })
    await prisma.room.create({
      data: {
        id: roomId,
        name,
        siteId,
        type: 'OFFICE',
        schedules: {
          create: [
            {
              scheduleId,
              frequency: 'DAILY',
              nextDue: new Date(Date.now() - 86_400_000),
              status: 'OVERDUE',
            },
            {
              scheduleId: earlyTemplateId,
              frequency: 'QUARTERLY',
              nextDue: new Date(Date.now() + 30 * 86_400_000),
              status: 'PENDING',
            },
          ],
        },
      },
    })
    await prisma.equipment.create({
      data: {
        id: equipmentId,
        name: `Allocation hoover ${token}`,
        siteId,
        schedules: {
          create: {
            scheduleId,
            frequency: 'DAILY',
            nextDue: new Date(Date.now() - 86_400_000),
            status: 'OVERDUE',
          },
        },
      },
    })

    await admin.goto('/diary')
    await admin.getByText('Allocate daily and weekly work', { exact: true }).click()
    const assignee = admin.getByRole('combobox', { name: `Assign ${name} on ${date}`, exact: true })
    await expect(assignee).toBeVisible()
    await assignee.selectOption(session.user.id)
    const row = assignee.locator('..')
    await row.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(assignee).toHaveValue(session.user.id)
    await expect
      .poll(async () => (await prisma.workAssignment.findFirst({ where: { roomId } }))?.assigneeId)
      .toBe(session.user.id)
    expect(
      await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)

    await cleanerPage.goto('/clean')
    await expect(cleanerPage.getByRole('button', { name: /^My work \(/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(cleanerPage.getByRole('heading', { name, exact: true })).toBeVisible()
    const csv = await cleanerPage.request.get(`/api/export/worklist?allocation=person&date=${date}`)
    expect(csv.ok()).toBe(true)
    expect(await csv.text()).toContain(name)
    await cleanerPage.getByText('Daily and weekly planned work', { exact: true }).click()
    await cleanerPage.getByRole('combobox', { name: 'Allocation period' }).selectOption('week')
    await expect(
      cleanerPage
        .getByRole('region', { name: 'My planned work' })
        .getByText(name, { exact: false })
        .first(),
    ).toBeVisible()

    const first = await prisma.workAssignment.findFirstOrThrow({ where: { roomId } })
    const race = await Promise.all(
      Array.from({ length: 8 }, () =>
        admin.request.put('/api/work-assignments', {
          data: {
            kind: 'room',
            targetId: roomId,
            date,
            assigneeId: personId,
            revision: first.revision,
          },
        }),
      ),
    )
    expect(race.map((response) => response.status()).sort()).toEqual([
      200, 409, 409, 409, 409, 409, 409, 409,
    ])
    const otherCsv = await cleanerPage.request.get(
      `/api/export/worklist?allocation=person&date=${date}`,
    )
    expect(await otherCsv.text()).not.toContain(name)
    const allCsv = await cleanerPage.request.get(`/api/export/worklist?allocation=all&date=${date}`)
    expect(await allCsv.text()).toContain(name)

    const initialDetail = await (
      await cleanerPage.request.get(`/api/cleaner/rooms/${roomId}`)
    ).json()
    expect(initialDetail.availableEarly).toHaveLength(1)
    const earlyId = initialDetail.availableEarly[0].id
    const detail = await (
      await cleanerPage.request.get(`/api/cleaner/rooms/${roomId}?also=${earlyId}`)
    ).json()
    expect(detail.workPackage.scheduleIds).toHaveLength(2)
    expect(detail.workPackage.earlyScheduleIds).toContain(earlyId)
    const completed = await cleanerPage.request.post(`/api/cleaner/rooms/${roomId}/complete`, {
      data: {
        scheduleIds: detail.workPackage.scheduleIds,
        completedTasks: detail.workPackage.tasks.map((task: { taskRefs: unknown }) => ({
          taskRefs: task.taskRefs,
        })),
        signature,
        signedName: 'Cover cleaner',
      },
    })
    expect(completed.status(), await completed.text()).toBe(200)
    const log = await prisma.roomScheduleCompletionLog.findFirstOrThrow({
      where: { roomSchedule: { roomId } },
    })
    expect(log.completedByUserId).toBe(session.user.id)
    expect(log.plannedAssigneeId).toBe(personId)
    expect(log.plannedAssigneeName).toBe(`Assigned colleague ${token}`)

    const createdEquipment = await Promise.all(
      Array.from({ length: 8 }, () =>
        admin.request.put('/api/work-assignments', {
          data: {
            kind: 'equipment',
            targetId: equipmentId,
            date,
            assigneeId: personId,
            revision: 0,
          },
        }),
      ),
    )
    expect(createdEquipment.map((response) => response.status()).sort()).toEqual([
      200, 409, 409, 409, 409, 409, 409, 409,
    ])
    const equipmentSchedule = await prisma.equipmentSchedule.findFirstOrThrow({
      where: { equipmentId },
      include: { schedule: { include: { tasks: true } } },
    })
    const equipmentCompletion = await cleanerPage.request.post(
      `/api/cleaner/equipment/${equipmentId}/complete`,
      {
        data: {
          scheduleId: equipmentSchedule.id,
          completedTasks: equipmentSchedule.schedule.tasks.map((task) => task.id),
          signature,
          signedName: 'Cover cleaner',
        },
      },
    )
    expect(equipmentCompletion.status(), await equipmentCompletion.text()).toBe(200)
    const equipmentLog = await prisma.equipmentScheduleCompletionLog.findFirstOrThrow({
      where: { equipmentScheduleId: equipmentSchedule.id },
    })
    expect(equipmentLog.completedByUserId).toBe(session.user.id)
    expect(equipmentLog.plannedAssigneeId).toBe(personId)

    // Hold the person row, queue the real transfer route first, then queue an
    // allocation. Waiting for PostgreSQL's blocker graph avoids timing guesses.
    let locked!: (pid: number) => void
    const acquired = new Promise<number>((resolve) => {
      locked = resolve
    })
    const gate = new Promise<void>((resolve) => {
      releaseLock = resolve
    })
    lockTransaction = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${personId} FOR UPDATE`
        const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`
        locked(backend.pid)
        await gate
      },
      { timeout: 30_000 },
    )
    const pid = await acquired
    const transfer = admin.request.put(`/api/users/${personId}`, { data: { siteId: otherSiteId } })
    pending.push(transfer)
    const blockedCount = async () => {
      const [result] = await prisma.$queryRaw<
        { count: number }[]
      >`SELECT count(*)::int AS count FROM pg_stat_activity WHERE ${pid} = ANY(pg_blocking_pids(pid))`
      return result.count
    }
    await expect.poll(blockedCount).toBeGreaterThanOrEqual(1)
    const allocationAttempt = admin.request.put('/api/work-assignments', {
      data: { kind: 'equipment', targetId: equipmentId, date, assigneeId: personId, revision: 0 },
    })
    pending.push(allocationAttempt)
    await expect.poll(blockedCount).toBeGreaterThanOrEqual(2)
    releaseLock?.()
    await lockTransaction
    expect((await transfer).status()).toBe(200)
    expect((await allocationAttempt).status()).toBe(400)
    expect(
      (await prisma.workAssignment.findFirstOrThrow({ where: { equipmentId } })).assigneeId,
    ).toBeNull()
    const cleared = await prisma.workAssignment.findFirstOrThrow({ where: { roomId } })
    expect(cleared.assigneeId).toBeNull()
    expect(
      (await prisma.roomScheduleCompletionLog.findUniqueOrThrow({ where: { id: log.id } }))
        .plannedAssigneeName,
    ).toBe(`Assigned colleague ${token}`)

    // A room transfer invalidates today's allocation and can be allocated again
    // at its new site using the retained revision.
    const moved = await admin.request.put(`/api/rooms/${roomId}`, {
      data: { name, type: 'OFFICE', siteId: otherSiteId },
    })
    expect(moved.status(), await moved.text()).toBe(200)
    const board: AssignmentBoard = await (
      await admin.request.get(`/api/work-assignments?site=${otherSiteId}&date=${date}`)
    ).json()
    const movedRow = board.rows.find((item) => item.targetId === roomId)!
    expect(movedRow.assignment.assigneeId).toBeNull()
    const reassigned = await admin.request.put('/api/work-assignments', {
      data: {
        kind: 'room',
        targetId: roomId,
        date,
        assigneeId: personId,
        revision: movedRow.assignment.revision,
      },
    })
    expect(reassigned.status(), await reassigned.text()).toBe(200)
    expect(
      (
        await cleanerPage.request.put('/api/work-assignments', {
          data: { kind: 'room', targetId: roomId, date, assigneeId: null, revision: 1 },
        })
      ).status(),
    ).toBe(403)
  } finally {
    releaseLock?.()
    if (lockTransaction) await lockTransaction.catch(() => undefined)
    await Promise.allSettled(pending)
    await prisma.roomScheduleCompletionLog.deleteMany({ where: { roomSchedule: { roomId } } })
    await prisma.equipmentScheduleCompletionLog.deleteMany({
      where: { equipmentSchedule: { equipmentId } },
    })
    await prisma.room.deleteMany({ where: { id: roomId } })
    await prisma.equipment.deleteMany({ where: { id: equipmentId } })
    await prisma.schedule.deleteMany({ where: { id: { in: [scheduleId, earlyTemplateId] } } })
    await prisma.user.deleteMany({ where: { id: personId } })
    await prisma.site.deleteMany({ where: { id: otherSiteId } })
    await adminContext.close()
    await cleanerContext.close()
  }
})
