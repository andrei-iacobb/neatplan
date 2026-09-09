import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScheduleFrequency, ScheduleStatus } from '@/generated/prisma/enums'

const mocks = vi.hoisted(() => ({
  session: vi.fn(), roomFindMany: vi.fn(), roomFindUnique: vi.fn(),
  equipmentFindMany: vi.fn(), floorPlanFindMany: vi.fn(),
  roomCompletionCount: vi.fn(), equipmentCompletionCount: vi.fn(),
}))

vi.mock('next-auth', () => ({ getServerSession: mocks.session }))
vi.mock('next-auth/next', () => ({ getServerSession: mocks.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/server', () => ({
  connection: async () => undefined,
  NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) },
}))
vi.mock('@/lib/db', () => ({ prisma: {
  room: { findMany: mocks.roomFindMany, findUnique: mocks.roomFindUnique },
  equipment: { findMany: mocks.equipmentFindMany },
  floorPlan: { findMany: mocks.floorPlanFindMany },
  roomScheduleCompletionLog: { count: mocks.roomCompletionCount },
  equipmentScheduleCompletionLog: { count: mocks.equipmentCompletionCount },
} }))

import { GET as dashboard } from '@/app/api/cleaner/dashboard/route'
import { GET as roomDetail } from '@/app/api/cleaner/rooms/[roomId]/route'

const now = new Date('2026-09-08T12:00:00Z')
const due = new Date('2026-09-07T08:00:00Z')
const tomorrow = new Date('2026-09-09T12:00:00Z')
const room = { id: 'kitchen', name: 'Kitchen', siteId: 'site-a', type: 'KITCHEN', floor: 'Ground', description: null }

function schedule(
  id: string,
  descriptions: string[],
  options: { nextDue?: Date; lastCompleted?: Date; status?: ScheduleStatus; frequency?: ScheduleFrequency } = {},
) {
  return {
    id, roomId: room.id, nextDue: options.nextDue ?? due,
    lastCompleted: options.lastCompleted ?? null,
    status: options.status ?? 'PENDING', frequency: options.frequency ?? 'DAILY',
    schedule: { title: id, tasks: descriptions.map((description, index) => ({ id: `${id}-${index}`, description })) },
  }
}

// The two routes query different rows, so `detailSchedules` stands in for the
// room detail route's narrower where clause when that difference matters.
function setRoomSchedules(
  schedules: ReturnType<typeof schedule>[],
  detailSchedules: ReturnType<typeof schedule>[] = schedules,
) {
  mocks.roomFindMany.mockResolvedValue([{ ...room, schedules }])
  mocks.roomFindUnique.mockResolvedValue({ ...room, schedules: detailSchedules })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('Expected JSON object')
  return value
}

async function expectRoomWork(count: number, duration: string) {
  const [dashboardResponse, detailResponse] = await Promise.all([
    dashboard(),
    roomDetail(new Request('http://localhost/api/cleaner/rooms/kitchen'), { params: Promise.resolve({ roomId: room.id }) }),
  ])
  expect(dashboardResponse.status).toBe(200)
  expect(detailResponse.status).toBe(200)
  const dashboardBody: unknown = await dashboardResponse.json()
  const detailBody: unknown = await detailResponse.json()
  const work = record(record(detailBody).workPackage)
  expect(work.tasks).toHaveLength(count)
  expect(work.estimatedDuration).toBe(duration)
  expect(dashboardBody).toMatchObject({
    rooms: [{ id: room.id, summary: { totalTasks: count, estimatedDuration: duration } }],
    floorPlans: [{ regions: [{ room: { id: room.id }, totalTasks: count }] }],
    stats: { totalTasks: count },
  })
  return dashboardBody
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(now)
  mocks.session.mockResolvedValue({ user: { id: 'cleaner', role: 'CLEANER', siteId: 'site-a' } })
  mocks.equipmentFindMany.mockResolvedValue([])
  mocks.roomCompletionCount.mockResolvedValue(0)
  mocks.equipmentCompletionCount.mockResolvedValue(0)
  mocks.floorPlanFindMany.mockResolvedValue([{
    id: 'plan', name: 'Ground floor', floor: 'Ground', revision: 1, imageWidth: 980, imageHeight: 820,
    regions: [{ id: 'marker', label: 'Kitchen', x: 0.1, y: 0.1, width: 0.2, height: 0.2, room }],
  }])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('cleaner dashboard room work counts', () => {
  it('shows five due tasks instead of including six tasks scheduled for tomorrow', async () => {
    setRoomSchedules([
      schedule('Daily Food Hygiene', ['Counters', 'Floors', 'Bins', 'Sinks', 'Doors', 'Handles'], { nextDue: tomorrow }),
      schedule('Kitchen Deep Clean', ['Oven', 'Fridge', 'Freezer', 'Extractor', 'Shelves'], { status: 'OVERDUE', frequency: 'MONTHLY' }),
    ])

    const body = await expectRoomWork(5, '25min')

    expect(body).toMatchObject({ rooms: [{
      priority: 'OVERDUE',
      summary: { totalSchedules: 2, overdueCount: 1, pendingCount: 1, completedCount: 0 },
      schedules: [{ tasksCount: 6 }, { tasksCount: 5 }],
    }] })
  })

  it('counts merged checklist rows and uses the checklist duration minimum', async () => {
    setRoomSchedules([
      schedule('Daily windows', ['Clean windows and ledges', 'Empty bins']),
      schedule('Deep Clean', ['Windows and ledges', 'Bins'], { frequency: 'MONTHLY' }),
    ])

    const body = await expectRoomWork(2, '15min')

    expect(body).toMatchObject({ rooms: [{
      summary: { totalSchedules: 2 }, schedules: [{ tasksCount: 2 }, { tasksCount: 2 }],
    }] })
  })

  it('uses the room detail daily sign-off even if its next due date remains overdue', async () => {
    setRoomSchedules([schedule('Already signed today', ['Clean worktops'], { lastCompleted: now })])

    const detailResponse = await roomDetail(new Request('http://localhost'), { params: Promise.resolve({ roomId: room.id }) })
    expect(await detailResponse.json()).toMatchObject({ workPackage: null })
    const response = await dashboard()

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      rooms: [{ summary: { totalTasks: 0, estimatedDuration: '0min', totalSchedules: 1 } }],
      floorPlans: [{ regions: [{ totalTasks: 0 }] }],
      stats: { totalTasks: 0 },
    })
  })

  it('ignores a schedule completed before today that the dashboard query still loads', async () => {
    const staleCompleted = schedule('Signed off last week', ['Descale kettle', 'Wash bins'], {
      status: 'COMPLETED', lastCompleted: new Date('2026-09-01T09:00:00Z'),
    })
    const upcoming = schedule('Daily kitchen', ['Counters', 'Floors'], { nextDue: tomorrow })
    setRoomSchedules([staleCompleted, upcoming], [upcoming])

    const body = await expectRoomWork(2, '15min')

    expect(body).toMatchObject({ rooms: [{
      priority: 'UPCOMING',
      summary: { totalSchedules: 2, completedCount: 1 },
    }] })
  })

  it('preserves equipment task totals and their contribution to dashboard statistics', async () => {
    setRoomSchedules([schedule('Kitchen due work', ['Clean oven'])])
    mocks.equipmentFindMany.mockResolvedValue([{
      id: 'equipment', name: 'Trolley', type: 'OTHER', serviceAreaId: null,
      schedules: [schedule('Equipment tomorrow', ['Wipe handles', 'Wash shelves', 'Clean wheels'], { nextDue: tomorrow })],
    }])

    const response = await dashboard()

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      rooms: [{ summary: { totalTasks: 1, estimatedDuration: '15min' } }],
      equipment: [{ id: 'equipment', summary: { totalTasks: 3, estimatedDuration: '15min' } }],
      stats: { totalTasks: 4 },
    })
  })
})
