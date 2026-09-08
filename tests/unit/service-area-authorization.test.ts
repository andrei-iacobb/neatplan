import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getServerSession: vi.fn(), findRoom: vi.fn() }))

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }))
vi.mock('next-auth/next', () => ({ getServerSession: mocks.getServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/db', () => ({ prisma: { room: { findFirst: mocks.findRoom } } }))

import { GET } from '@/app/api/cleaner/service-areas/[roomId]/route'

const request = new Request('http://localhost/api/cleaner/service-areas/service-area-1')
const context = { params: Promise.resolve({ roomId: 'service-area-1' }) }

function signIn(role = 'CLEANER', siteId: string | null = 'site-a') {
  mocks.getServerSession.mockResolvedValue({ user: { id: 'user-1', role, siteId } })
}

beforeEach(() => {
  vi.resetAllMocks()
  signIn()
  mocks.findRoom.mockResolvedValue(null)
})

describe('service area authorization', () => {
  it('requires authentication before looking up a service area', async () => {
    mocks.getServerSession.mockResolvedValue(null)

    expect((await GET(request, context)).status).toBe(401)
    expect(mocks.findRoom).not.toHaveBeenCalled()
  })

  it.each(['MANAGER', 'DIRECTOR', 'OP'])('rejects %s without cleaning portal access', async (role) => {
    signIn(role)

    expect((await GET(request, context)).status).toBe(403)
    expect(mocks.findRoom).not.toHaveBeenCalled()
  })

  it.each(['CLEANER', 'HEAD_OF_HOUSEKEEPING'])('limits the %s query to service areas in their own site', async (role) => {
    signIn(role)

    const response = await GET(request, context)

    expect(response.status).toBe(404)
    expect(mocks.findRoom).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'service-area-1', type: 'SERVICE_AREA', siteId: 'site-a' },
    }))
  })

  it('does not expose another site service area even if the lookup returns it', async () => {
    mocks.findRoom.mockResolvedValue({ id: 'service-area-1', siteId: 'site-b', name: 'Private store' })

    const response = await GET(request, context)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Service area not found' })
  })

  it('fails closed when a cleaner has no assigned site', async () => {
    signIn('CLEANER', null)

    expect((await GET(request, context)).status).toBe(404)
    expect(mocks.findRoom).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'service-area-1', type: 'SERVICE_AREA', siteId: '__no_site__' },
    }))
  })

  it('allows Head of Housekeeping to read their site service area and equipment totals', async () => {
    signIn('HEAD_OF_HOUSEKEEPING')
    mocks.findRoom.mockResolvedValue({
      id: 'service-area-1', siteId: 'site-a', name: 'Laundry', description: null, floor: 'Ground',
      schedules: [],
      storedEquipment: [{
        id: 'equipment-1', name: 'Trolley', description: null, type: 'OTHER', assetCode: 'T1',
        schedules: [{
          status: 'PENDING', lastCompleted: null, nextDue: new Date('2026-01-01T12:00:00Z'),
          schedule: { tasks: [{ id: 'task-1' }, { id: 'task-2' }] },
        }],
      }],
    })

    const response = await GET(request, context)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      id: 'service-area-1', name: 'Laundry', ownCleaning: null,
      summary: { itemCount: 1, itemsWithCleaningWork: 1, totalTasks: 2 },
      equipment: [{ id: 'equipment-1', scheduleCount: 1, totalTasks: 2 }],
    })
  })
})
