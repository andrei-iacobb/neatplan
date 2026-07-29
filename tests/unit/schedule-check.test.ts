import { describe, it, expect, beforeEach, vi } from 'vitest'

const {
  transaction,
  queryRaw,
  roomFindMany,
  roomUpdateMany,
  equipFindMany,
  equipUpdateMany,
  rearmRoomUpdateMany,
  userFindMany,
  sendSystemAlert,
  cleanupStaleSessions,
} =
  vi.hoisted(() => ({
    transaction: vi.fn(),
    queryRaw: vi.fn(),
    roomFindMany: vi.fn(),
    roomUpdateMany: vi.fn(),
    equipFindMany: vi.fn(),
    equipUpdateMany: vi.fn(),
    rearmRoomUpdateMany: vi.fn(),
    userFindMany: vi.fn(),
    sendSystemAlert: vi.fn(),
    cleanupStaleSessions: vi.fn(),
  }))

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: transaction,
    user: { findMany: userFindMany },
  },
}))
vi.mock('@/lib/email', () => ({ emailService: { sendSystemAlert } }))
vi.mock('@/lib/session-cleanup', () => ({ cleanupStaleSessions }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { runScheduleCheck } from '@/lib/schedule-check'

describe('runScheduleCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryRaw.mockResolvedValue([{ locked: true }])
    roomFindMany.mockResolvedValue([])
    equipFindMany.mockResolvedValue([])
    rearmRoomUpdateMany.mockResolvedValue({ count: 0 })
    transaction.mockImplementation(async (callback) => {
      let roomUpdateCall = 0
      return callback({
        $queryRaw: queryRaw,
        roomSchedule: {
          findMany: roomFindMany,
          updateMany: vi.fn((args) => {
            roomUpdateCall++
            return roomUpdateCall === 1
              ? roomUpdateMany(args)
              : rearmRoomUpdateMany(args)
          }),
        },
        equipmentSchedule: {
          findMany: equipFindMany,
          updateMany: equipUpdateMany,
        },
      })
    })
    cleanupStaleSessions.mockResolvedValue(0)
    userFindMany.mockResolvedValue([{ email: 'admin@example.com', name: 'Admin' }])
  })

  it('only transitions schedules that are not already OVERDUE (alert on transition, not every tick)', async () => {
    roomUpdateMany.mockResolvedValue({ count: 0 })
    equipUpdateMany.mockResolvedValue({ count: 0 })

    await runScheduleCheck()

    // The status filter must exclude already-OVERDUE rows so re-marking never happens.
    const roomWhere = roomUpdateMany.mock.calls[0][0].where
    expect(roomWhere.status).toEqual({ notIn: ['COMPLETED', 'OVERDUE'] })
    const equipWhere = equipUpdateMany.mock.calls[0][0].where
    expect(equipWhere.status).toEqual({ notIn: ['COMPLETED', 'OVERDUE'] })
  })

  it('does NOT email when nothing newly went overdue', async () => {
    roomUpdateMany.mockResolvedValue({ count: 0 })
    equipUpdateMany.mockResolvedValue({ count: 0 })

    const result = await runScheduleCheck()

    expect(sendSystemAlert).not.toHaveBeenCalled()
    expect(result.totalOverdue).toBe(0)
    expect(result.emailsSent).toBe(0)
  })

  it('emails each admin once when schedules newly transition to overdue', async () => {
    roomUpdateMany.mockResolvedValue({ count: 2 })
    equipUpdateMany.mockResolvedValue({ count: 1 })
    userFindMany.mockResolvedValue([
      { email: 'a@example.com', name: 'A' },
      { email: 'b@example.com', name: 'B' },
    ])

    const result = await runScheduleCheck()

    expect(result.totalOverdue).toBe(3)
    expect(sendSystemAlert).toHaveBeenCalledTimes(2) // one per admin, once
    expect(result.emailsSent).toBe(2)
    expect(result.emailsFailed).toBe(0)
  })

  it('counts a failed send without aborting the run', async () => {
    roomUpdateMany.mockResolvedValue({ count: 1 })
    equipUpdateMany.mockResolvedValue({ count: 0 })
    userFindMany.mockResolvedValue([
      { email: 'a@example.com', name: 'A' },
      { email: 'b@example.com', name: 'B' },
    ])
    sendSystemAlert.mockRejectedValueOnce(new Error('smtp down')).mockResolvedValueOnce(undefined)

    const result = await runScheduleCheck()

    expect(result.emailsFailed).toBe(1)
    expect(result.emailsSent).toBe(1)
  })
})
