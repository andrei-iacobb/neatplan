import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const model = () => ({
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findFirstOrThrow: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  })
  const tx = {
    site: model(),
    user: model(),
    room: model(),
    equipment: model(),
    workAssignment: model(),
    $queryRaw: vi.fn(),
  }
  return { tx, transaction: vi.fn(), role: vi.fn() }
})
vi.mock('@/lib/db', () => ({ prisma: { ...mocks.tx, $transaction: mocks.transaction } }))
vi.mock('@/lib/authz', async (original) => ({
  ...(await original<typeof import('@/lib/authz')>()),
  requireRole: mocks.role,
}))
import {
  allocationInput,
  assignmentDates,
  assignmentDayStart,
  calendarDate,
  eligibleAssignee,
} from '@/lib/work-assignments/policy'
import {
  loadAssignmentBoard,
  plannedAssigneeSnapshot,
  saveAssignment,
} from '@/lib/work-assignments/server'
import { GET, PUT } from '@/app/api/work-assignments/route'
import { worklistDataset } from '@/lib/export/datasets/work'

const now = new Date('2026-09-14T10:00:00Z')
const manager = { id: 'head', role: 'HEAD_OF_HOUSEKEEPING', siteId: 'site-a', name: 'Head' }
const cleaner = {
  id: 'sam',
  name: 'Sam',
  email: 'sam@example.test',
  role: 'CLEANER',
  siteId: 'site-a',
  isBlocked: false,
  isHidden: false,
}
const input = {
  kind: 'room' as const,
  targetId: 'room-a',
  date: '2026-09-14',
  assigneeId: 'sam',
  revision: 0,
}
const allocation = {
  id: 'allocation',
  siteId: 'site-a',
  workDate: calendarDate(input.date),
  assigneeId: 'sam',
  assigneeName: 'Sam',
  revision: 1,
  assignee: cleaner,
}
const room = {
  id: 'room-a',
  name: 'Kitchen',
  floor: 'Ground',
  siteId: 'site-a',
  site: { name: 'Maple' },
  schedules: [
    {
      status: 'PENDING',
      nextDue: new Date('2026-09-14T00:00:00Z'),
      schedule: { title: 'Daily clean' },
      completionLogs: [],
    },
  ],
  workAssignments: [allocation],
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transaction.mockImplementation((fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx))
  mocks.tx.$queryRaw.mockResolvedValue([{ id: 'room-a', siteId: 'site-a' }])
  mocks.tx.site.findUnique.mockResolvedValue({ name: 'Maple' })
  mocks.tx.user.findUnique.mockResolvedValue(cleaner)
  mocks.tx.user.findMany.mockResolvedValue([cleaner])
  mocks.tx.user.findFirst.mockResolvedValue(cleaner)
  mocks.tx.room.findMany.mockResolvedValue([room])
  mocks.tx.room.count.mockResolvedValue(1)
  mocks.tx.equipment.findMany.mockResolvedValue([])
  mocks.tx.equipment.count.mockResolvedValue(0)
  mocks.tx.workAssignment.create.mockResolvedValue(allocation)
  mocks.tx.workAssignment.updateMany.mockResolvedValue({ count: 1 })
  mocks.tx.workAssignment.findFirstOrThrow.mockResolvedValue(allocation)
  mocks.tx.workAssignment.findFirst.mockResolvedValue(allocation)
  mocks.role.mockResolvedValue({ user: manager })
})

describe('calendar allocations', () => {
  it.each(['2026-02-30', '2026-13-01', '2026-9-14', 'not-a-date', '2026-09-14T00:00Z'])(
    'rejects invalid day %s',
    (date) => {
      expect(allocationInput.safeParse({ ...input, date }).success).toBe(false)
    },
  )
  it('builds Monday-start weeks without timezone day shifts', () => {
    expect(assignmentDates('2026-09-20', 'week')).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ])
  })
  it('uses London midnight on both sides of a BST change', () => {
    expect(assignmentDayStart('2026-03-29').toISOString()).toBe('2026-03-29T00:00:00.000Z')
    expect(assignmentDayStart('2026-03-30').toISOString()).toBe('2026-03-29T23:00:00.000Z')
    expect(assignmentDayStart('2026-10-26').toISOString()).toBe('2026-10-26T00:00:00.000Z')
  })
  it.each([{ role: 'MANAGER' }, { siteId: 'site-b' }, { isBlocked: true }, { isHidden: true }])(
    'rejects an unavailable assignee %o',
    (change) => {
      expect(eligibleAssignee({ ...cleaner, ...change }, 'site-a')).toBe(false)
    },
  )
  it('allows a head of housekeeping to take a round', () =>
    expect(eligibleAssignee({ ...cleaner, role: 'HEAD_OF_HOUSEKEEPING' }, 'site-a')).toBe(true))
})

describe('allocation writes', () => {
  it('saves a named cleaner with the actor and date snapshots', async () => {
    await saveAssignment(manager, input, now)
    expect(mocks.tx.workAssignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        roomId: 'room-a',
        workDate: calendarDate(input.date),
        siteId: 'site-a',
        assigneeId: 'sam',
        assigneeName: 'Sam',
        assignedById: 'head',
      }),
    })
  })
  it('locks current membership before writing an allocation', async () => {
    await saveAssignment(manager, input, now)
    const sql = mocks.tx.$queryRaw.mock.calls.map(([query]) => query.strings.join('?'))
    expect(sql).toEqual([
      'SELECT id FROM users WHERE id = ? FOR SHARE',
      'SELECT id, "siteId" FROM rooms WHERE id = ? FOR SHARE',
    ])
    expect(mocks.tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.tx.workAssignment.create.mock.invocationCallOrder[0],
    )
  })
  it('rejects a room outside the manager site', async () => {
    mocks.tx.$queryRaw.mockResolvedValue([{ id: 'room-a', siteId: 'site-b' }])
    await expect(saveAssignment(manager, input, now)).rejects.toMatchObject({ status: 404 })
    expect(mocks.tx.workAssignment.create).not.toHaveBeenCalled()
  })
  it('rejects a person who moved sites before the transaction checked them', async () => {
    mocks.tx.user.findUnique.mockResolvedValue({ ...cleaner, siteId: 'site-b' })
    await expect(saveAssignment(manager, input, now)).rejects.toMatchObject({ status: 400 })
    expect(mocks.tx.workAssignment.create).not.toHaveBeenCalled()
  })
  it('clears without deleting the version used by concurrent editors', async () => {
    await saveAssignment(manager, { ...input, assigneeId: null, revision: 4 }, now)
    expect(mocks.tx.workAssignment.updateMany).toHaveBeenCalledWith({
      where: { roomId: 'room-a', workDate: calendarDate(input.date), revision: 4 },
      data: expect.objectContaining({
        assigneeId: null,
        assigneeName: null,
        revision: { increment: 1 },
      }),
    })
  })
  it('returns a conflict when an editor saved an old revision', async () => {
    mocks.tx.workAssignment.updateMany.mockResolvedValue({ count: 0 })
    await expect(saveAssignment(manager, { ...input, revision: 1 }, now)).rejects.toMatchObject({
      status: 409,
    })
  })
  it('does not rewrite historical allocation records', async () => {
    await expect(
      saveAssignment(manager, { ...input, date: '2026-09-13' }, now),
    ).rejects.toMatchObject({ status: 400 })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
  it('bounds planning to one year', async () => {
    await expect(
      saveAssignment(manager, { ...input, date: '2030-01-01' }, now),
    ).rejects.toMatchObject({ status: 400 })
  })
  it('records equipment independently of its storage room', async () => {
    await saveAssignment(manager, { ...input, kind: 'equipment', targetId: 'hoover' }, now)
    expect(mocks.tx.workAssignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ equipmentId: 'hoover' }),
    })
  })
})

describe('board and sign-off snapshots', () => {
  it('includes an unassigned room alongside an assigned one', async () => {
    mocks.tx.room.findMany.mockResolvedValue([
      room,
      { ...room, id: 'other', name: 'Office', workAssignments: [] },
    ])
    const board = await loadAssignmentBoard(manager, new URLSearchParams('date=2026-09-14'), now)
    expect(board.rows.map((row) => row.assignment.assigneeId)).toEqual(['sam', null])
    expect(board.rows[1].due).toEqual(['Daily clean'])
  })
  it('never treats tomorrow’s plan as today’s allocation', async () => {
    const board = await loadAssignmentBoard(manager, new URLSearchParams('date=2026-09-15'), now)
    expect(board.rows[0].assignment.assigneeId).toBeNull()
  })
  it('exposes blocked or transferred cleaners as unassigned today', async () => {
    mocks.tx.room.findMany.mockResolvedValue([
      { ...room, workAssignments: [{ ...allocation, assignee: { ...cleaner, isBlocked: true } }] },
    ])
    const board = await loadAssignmentBoard(manager, new URLSearchParams('date=2026-09-14'), now)
    expect(board.rows[0].assignment.assigneeId).toBeNull()
    expect(board.rows[0].assignment.revision).toBe(1)
  })
  it('does not expose previous-site allocation names through a transferred asset', async () => {
    mocks.tx.room.findMany.mockResolvedValue([
      { ...room, workAssignments: [{ ...allocation, siteId: 'old-site' }] },
    ])
    const board = await loadAssignmentBoard(manager, new URLSearchParams('date=2026-09-14'), now)
    expect(board.rows[0].assignment.assigneeName).toBeNull()
    expect(board.rows[0].assignment.revision).toBe(1)
  })
  it('retains a completed visit and its actual signer in the personal day list', async () => {
    mocks.tx.room.findMany.mockResolvedValue([
      {
        ...room,
        schedules: [
          {
            ...room.schedules[0],
            nextDue: new Date('2026-09-15'),
            completionLogs: [{ completedAt: now, signedName: 'Cover cleaner' }],
          },
        ],
      },
    ])
    const board = await loadAssignmentBoard(manager, new URLSearchParams('date=2026-09-14'), now)
    expect(board.rows[0]).toMatchObject({
      due: [],
      completed: ['Daily clean (Cover cleaner)'],
      assignment: { assigneeName: 'Sam' },
    })
  })
  it('captures the planned person without changing the actual cleaner', async () => {
    const snapshot = await plannedAssigneeSnapshot(
      mocks.tx as never,
      'room',
      'room-a',
      'site-a',
      now,
    )
    expect(snapshot).toEqual({
      plannedAssigneeId: 'sam',
      plannedAssigneeName: 'Sam',
      assignmentDate: calendarDate(input.date),
    })
    expect(snapshot).not.toHaveProperty('completedByUserId')
  })
  it('ignores an invalid current assignment during sign-off', async () => {
    mocks.tx.workAssignment.findFirst.mockResolvedValue({
      ...allocation,
      assignee: { ...cleaner, siteId: 'site-b' },
    })
    expect(
      await plannedAssigneeSnapshot(mocks.tx as never, 'equipment', 'item-a', 'site-a', now),
    ).toEqual({})
  })
})

describe('route boundaries', () => {
  it('refuses cleaner mutation before processing the request', async () => {
    mocks.role.mockResolvedValue({ error: Response.json({ error: 'Forbidden' }, { status: 403 }) })
    const response = await PUT(
      new Request('http://localhost/api/work-assignments', {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    )
    expect(response.status).toBe(403)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
  it('returns 400 for impossible calendar days', async () => {
    expect(
      (await GET(new Request('http://localhost/api/work-assignments?date=2026-02-30'))).status,
    ).toBe(400)
  })
  it('returns 400 for malformed JSON', async () => {
    expect(
      (
        await PUT(
          new Request('http://localhost/api/work-assignments', { method: 'PUT', body: '{' }),
        )
      ).status,
    ).toBe(400)
  })
})

describe('personal export rows', () => {
  it('filters actual assignments rather than only changing the header', async () => {
    mocks.tx.room.findMany.mockResolvedValue([
      room,
      {
        ...room,
        id: 'someone-else',
        workAssignments: [{ ...allocation, assigneeId: 'alex', assigneeName: 'Alex' }],
      },
      { ...room, id: 'unassigned', workAssignments: [] },
    ])
    const exported = await worklistDataset.load(
      {
        user: cleaner,
        params: new URLSearchParams('date=2026-09-14&allocation=person&userId=another-person'),
      },
      7000,
    )
    expect(exported.rows.map((row) => row.targetId)).toEqual(['room-a'])
    expect(exported.subtitle).toBe('Sam - Maple')
  })
  it('returns no rows or foreign name for an inaccessible requested person', async () => {
    mocks.tx.user.findFirst.mockResolvedValue(null)
    const exported = await worklistDataset.load(
      {
        user: manager,
        params: new URLSearchParams('date=2026-09-14&allocation=person&userId=foreign'),
      },
      7000,
    )
    expect(exported.rows).toEqual([])
    expect(exported.subtitle).toBe('Maple')
    expect(mocks.tx.room.findMany).not.toHaveBeenCalled()
  })
  it('keeps due unassigned work in the site export', async () => {
    mocks.tx.room.findMany.mockResolvedValue([{ ...room, workAssignments: [] }])
    const exported = await worklistDataset.load(
      { user: cleaner, params: new URLSearchParams('date=2026-09-14&allocation=all') },
      7000,
    )
    expect(exported.rows[0].assignment.assigneeId).toBeNull()
    expect(exported.rows[0].due).toEqual(['Daily clean'])
  })
})
