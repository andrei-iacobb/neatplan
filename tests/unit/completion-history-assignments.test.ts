import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  roomFind: vi.fn(),
  roomCount: vi.fn(),
  equipmentFind: vi.fn(),
  equipmentCount: vi.fn(),
}))
vi.mock('next-auth', () => ({ getServerSession: mocks.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/server', async (original) => ({
  ...(await original<typeof import('next/server')>()),
  connection: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    roomScheduleCompletionLog: { findMany: mocks.roomFind, count: mocks.roomCount },
    equipmentScheduleCompletionLog: { findMany: mocks.equipmentFind, count: mocks.equipmentCount },
  },
}))
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/admin/completion-history/route'

const equipmentLog = {
  id: 'equipment-log',
  completedAt: new Date('2026-09-14T10:00:00Z'),
  equipmentName: 'Hoover',
  scheduleTitle: 'Daily clean',
  equipmentSchedule: null,
  completedBy: { id: 'cover-cleaner', name: 'Cover account', email: 'cover@example.test' },
  signedName: 'Signed Cover Cleaner',
  plannedAssigneeName: 'Planned Cleaner',
  assignmentDate: new Date('2026-09-14'),
  completedTasks: [],
  photos: [],
  notes: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.session.mockResolvedValue({
    user: { id: 'head', role: 'HEAD_OF_HOUSEKEEPING', isAdmin: true, siteId: 'site-a' },
  })
  mocks.roomFind.mockResolvedValue([])
  mocks.roomCount.mockResolvedValue(0)
  mocks.equipmentFind.mockResolvedValue([equipmentLog])
  mocks.equipmentCount.mockResolvedValue(1)
})

describe('planned and actual cleaning history', () => {
  it('includes equipment in an actual-cleaner filter without replacing the signer with the assignee', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/admin/completion-history?userId=cover-cleaner'),
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.items).toHaveLength(1)
    expect(body.items[0]).toMatchObject({
      type: 'equipment',
      completedBy: { name: 'Cover account' },
      signedName: 'Signed Cover Cleaner',
      plannedAssigneeName: 'Planned Cleaner',
      assignmentDate: '2026-09-14',
    })
    const where = mocks.equipmentFind.mock.calls[0][0].where
    expect(where.completedByUserId).toBe('cover-cleaner')
    expect(JSON.stringify(where)).toContain('site-a')
    expect(JSON.stringify(where)).not.toContain('Planned Cleaner')
  })

  it('still excludes equipment for a room-specific filter', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/admin/completion-history?roomId=room-a'),
    )
    expect(response.status).toBe(200)
    expect(mocks.equipmentFind).not.toHaveBeenCalled()
    expect((await response.json()).items).toEqual([])
  })

  it('keeps the signed-name snapshot when the original account no longer exists', async () => {
    mocks.equipmentFind.mockResolvedValue([{ ...equipmentLog, completedBy: null }])
    const response = await GET(new NextRequest('http://localhost/api/admin/completion-history'))
    expect((await response.json()).items[0]).toMatchObject({
      completedBy: null,
      signedName: 'Signed Cover Cleaner',
      plannedAssigneeName: 'Planned Cleaner',
    })
  })

  it('refuses a cleaner access to staff audit history', async () => {
    mocks.session.mockResolvedValue({
      user: { id: 'cleaner', role: 'CLEANER', isAdmin: false, siteId: 'site-a' },
    })
    expect(
      (await GET(new NextRequest('http://localhost/api/admin/completion-history'))).status,
    ).toBe(401)
    expect(mocks.equipmentFind).not.toHaveBeenCalled()
  })
})
