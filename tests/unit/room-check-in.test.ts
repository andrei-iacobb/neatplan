import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  roomScheduleFindUnique: vi.fn(),
  roomScheduleFindMany: vi.fn(),
  roomScheduleUpdateMany: vi.fn(),
  completionLogCreate: vi.fn(),
  checkInFindFirst: vi.fn(),
  checkInUpdate: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    roomSchedule: {
      findUnique: mocks.roomScheduleFindUnique,
      findMany: mocks.roomScheduleFindMany,
      updateMany: mocks.roomScheduleUpdateMany,
    },
    roomScheduleCompletionLog: { create: mocks.completionLogCreate },
    roomCheckIn: { findFirst: mocks.checkInFindFirst, update: mocks.checkInUpdate },
    $transaction: mocks.transaction,
  },
}))

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/authz', () => ({ canAccessSite: vi.fn().mockReturnValue(true) }))
vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: async () => data,
      status: init?.status,
    }),
  },
}))

import { getServerSession } from 'next-auth'
import { POST } from '@/app/api/cleaner/rooms/[roomId]/complete/route'

const SIGNATURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const session = {
  user: { id: 'cleaner-1', role: 'CLEANER', siteId: 'site-1', isAdmin: false },
}

/** The room carries label version 4; a check-in from an older label is stale. */
const roomSchedule = {
  id: 'room-schedule-1',
  roomId: 'room-1',
  scheduleId: 'schedule-1',
  frequency: 'DAILY',
  status: 'PENDING',
  lastCompleted: null,
  nextDue: new Date('2026-09-10'),
  room: { name: 'Room 1', siteId: 'site-1', locationTokenVersion: 4 },
  schedule: { id: 'schedule-1', title: 'Daily clean', tasks: [{ id: 'task-1' }] },
}

function request(body: Record<string, unknown>) {
  return POST(
    new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) }),
    { params: Promise.resolve({ roomId: 'room-1' }) } as never
  )
}

const validBody = {
  scheduleId: 'schedule-1',
  completedTasks: ['task-1'],
  signature: SIGNATURE,
  signedName: 'Sam Cleaner',
}

/** The captured `data` of the completion log the route wrote. */
function writtenLog() {
  return mocks.completionLogCreate.mock.calls[0][0].data
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getServerSession).mockResolvedValue(session as never)
  mocks.roomScheduleFindUnique.mockResolvedValue(roomSchedule)
  mocks.roomScheduleFindMany.mockResolvedValue([])
  mocks.roomScheduleUpdateMany.mockResolvedValue({ count: 1 })
  mocks.completionLogCreate.mockResolvedValue({ id: 'log-1' })
  mocks.checkInUpdate.mockResolvedValue({})
  mocks.checkInFindFirst.mockResolvedValue(null)

  // Run the transaction body against the same mocks.
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      roomSchedule: { updateMany: mocks.roomScheduleUpdateMany },
      roomScheduleCompletionLog: { create: mocks.completionLogCreate },
      roomCheckIn: { update: mocks.checkInUpdate },
    })
  )
})

describe('completion without a scan', () => {
  it('records the clean as manual and asks the database nothing about check-ins', async () => {
    await request(validBody)

    expect(mocks.checkInFindFirst).not.toHaveBeenCalled()
    expect(writtenLog().verificationMethod).toBe('MANUAL')
    expect(writtenLog().checkInId).toBeNull()
  })

  it('treats an empty check-in id as no scan at all', async () => {
    await request({ ...validBody, checkInId: '   ' })
    expect(mocks.checkInFindFirst).not.toHaveBeenCalled()
    expect(writtenLog().verificationMethod).toBe('MANUAL')
  })
})

describe('completion with a valid scan', () => {
  const checkedInAt = new Date('2026-09-13T09:00:00Z')

  beforeEach(() => {
    mocks.checkInFindFirst.mockResolvedValue({
      id: 'check-in-1',
      checkedInAt,
      method: 'QR',
      locationTokenVersion: 4,
    })
  })

  it('records how the room was identified', async () => {
    await request({ ...validBody, checkInId: 'check-in-1' })

    expect(writtenLog().verificationMethod).toBe('QR')
    expect(writtenLog().checkedInAt).toEqual(checkedInAt)
    expect(writtenLog().checkInId).toBe('check-in-1')
  })

  it('consumes the check-in so the same scan cannot back a second clean', async () => {
    await request({ ...validBody, checkInId: 'check-in-1' })

    expect(mocks.checkInUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'check-in-1' } })
    )
    expect(mocks.checkInUpdate.mock.calls[0][0].data.consumedAt).toBeInstanceOf(Date)
  })

  it('binds the lookup to this person, this room, unconsumed and unexpired', async () => {
    await request({ ...validBody, checkInId: 'check-in-1' })

    const where = mocks.checkInFindFirst.mock.calls[0][0].where
    expect(where.userId).toBe('cleaner-1')
    expect(where.roomId).toBe('room-1')
    expect(where.consumedAt).toBeNull()
    expect(where.expiresAt.gt).toBeInstanceOf(Date)
  })

  it('links only the first log when one visit covers several schedules', async () => {
    // checkInId is unique on the log, so a second link would violate it. The scan
    // describes the visit, not each individual schedule.
    mocks.roomScheduleFindMany.mockResolvedValue([
      { ...roomSchedule, id: 'room-schedule-2', scheduleId: 'schedule-2' },
    ])

    await request({
      signature: SIGNATURE,
      signedName: 'Sam Cleaner',
      scheduleIds: ['room-schedule-1', 'room-schedule-2'],
      // The route requires a completed task from every included schedule, and a
      // merged row can satisfy several at once - which is exactly the case a
      // single scan is meant to cover.
      completedTasks: [
        {
          taskRefs: [
            { scheduleId: 'room-schedule-1', taskId: 'task-1' },
            { scheduleId: 'room-schedule-2', taskId: 'task-1' },
          ],
        },
      ],
      checkInId: 'check-in-1',
    })

    const links = mocks.completionLogCreate.mock.calls.map((call) => call[0].data.checkInId)
    expect(links.filter(Boolean)).toHaveLength(1)
    // Every log still records the method, because they all describe one visit.
    const methods = mocks.completionLogCreate.mock.calls.map((call) => call[0].data.verificationMethod)
    expect(methods).toEqual(['QR', 'QR'])
  })
})

describe('a scan that should not count', () => {
  it('ignores a check-in taken from a label that has since been replaced', async () => {
    // The sticker was revoked (room moved to version 4); this scan was version 3.
    mocks.checkInFindFirst.mockResolvedValue({
      id: 'check-in-old',
      checkedInAt: new Date(),
      method: 'QR',
      locationTokenVersion: 3,
    })

    await request({ ...validBody, checkInId: 'check-in-old' })

    expect(writtenLog().verificationMethod).toBe('MANUAL')
    expect(writtenLog().checkInId).toBeNull()
    expect(mocks.checkInUpdate).not.toHaveBeenCalled()
  })

  it('ignores a check-in the database does not match', async () => {
    // Covers expired, consumed, another person's, and another room's in one -
    // all four are expressed as the WHERE returning nothing.
    mocks.checkInFindFirst.mockResolvedValue(null)

    await request({ ...validBody, checkInId: 'someone-elses' })

    expect(writtenLog().verificationMethod).toBe('MANUAL')
    expect(writtenLog().checkInId).toBeNull()
  })

  it('still records the clean rather than refusing it', async () => {
    mocks.checkInFindFirst.mockResolvedValue(null)

    const response = await request({ ...validBody, checkInId: 'bogus' })

    // The invariant: a scan describes HOW the room was identified. It is never a
    // permission, so a bad one must never cost a cleaner the work they just did.
    expect((response as { status?: number }).status).not.toBe(403)
    expect(mocks.completionLogCreate).toHaveBeenCalled()
  })
})

describe('two submissions racing for the same check-in', () => {
  it('drops the link and still records the clean, instead of failing with a 500', async () => {
    // checkInId is unique on the log. Two concurrent completions in the same room
    // carrying the same ?checkIn= mean the loser violates that constraint - for
    // work that was perfectly valid. The clean is what matters; how the room was
    // identified is not worth failing over.
    const { Prisma } = await import('@/generated/prisma/client')

    mocks.checkInFindFirst.mockResolvedValue({
      id: 'check-in-1',
      checkedInAt: new Date(),
      method: 'QR',
      locationTokenVersion: 4,
    })

    let attempt = 0
    mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      attempt += 1
      if (attempt === 1) {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        })
      }
      return fn({
        roomSchedule: { updateMany: mocks.roomScheduleUpdateMany },
        roomScheduleCompletionLog: { create: mocks.completionLogCreate },
        roomCheckIn: { update: mocks.checkInUpdate },
      })
    })

    const response = await request({ ...validBody, checkInId: 'check-in-1' })

    expect(attempt).toBe(2)
    expect((response as { status?: number }).status).toBeUndefined()
    // The retry records the clean without the contested link.
    expect(writtenLog().checkInId).toBeNull()
    expect(writtenLog().verificationMethod).toBe('MANUAL')
  })

  it('does not retry a unique violation that has nothing to do with a check-in', async () => {
    const { Prisma } = await import('@/generated/prisma/client')

    mocks.checkInFindFirst.mockResolvedValue(null)
    let attempt = 0
    mocks.transaction.mockImplementation(async () => {
      attempt += 1
      throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      })
    })

    // No check-in was in play, so a P2002 here is a real failure. It surfaces as
    // the route's own 500 rather than being swallowed by a pointless retry.
    const response = await request({ ...validBody, checkInId: 'nope' })

    expect((response as { status?: number }).status).toBe(500)
    expect(attempt).toBe(1)
  })
})
