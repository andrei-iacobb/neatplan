import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  findRoom: vi.fn(),
  updateRoom: vi.fn(),
}))

vi.mock('next-auth/next', () => ({ getServerSession: mocks.getServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/db', () => ({ prisma: {
  room: { findUnique: mocks.findRoom, update: mocks.updateRoom },
} }))

import { PUT } from '@/app/api/rooms/[id]/route'

const context = { params: Promise.resolve({ id: 'room-1' }) }
const roomFields = { name: 'Laundry', type: 'SERVICE_AREA', floor: 'Ground' }

function update(body: unknown) {
  return PUT(new Request('http://localhost/api/rooms/room-1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }), context)
}

function signIn(role = 'DIRECTOR', siteId: string | null = null, isAdmin = true) {
  mocks.getServerSession.mockResolvedValue({ user: { id: 'user-1', role, siteId, isAdmin } })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-13T23:30:00Z'))
  signIn()
  mocks.findRoom.mockResolvedValue({
    siteId: 'site-a', type: 'SERVICE_AREA', _count: { storedEquipment: 0 },
  })
  mocks.updateRoom.mockResolvedValue({ id: 'room-1', ...roomFields, siteId: 'site-b' })
})

afterEach(() => vi.useRealTimers())

describe('room site transfer', () => {
  it('removes map links and clears current/future allocations in the same transfer write', async () => {
    const response = await update({ ...roomFields, siteId: 'site-b' })

    expect(response.status).toBe(200)
    expect(mocks.updateRoom).toHaveBeenCalledExactlyOnceWith({
      where: { id: 'room-1' },
      data: {
        ...roomFields,
        description: undefined,
        siteId: 'site-b',
        floorPlanRegions: { deleteMany: {} },
        workAssignments: {
          updateMany: {
            where: { workDate: { gte: new Date('2026-09-14T00:00:00Z') } },
            data: { siteId: 'site-b', assigneeId: null, assigneeName: null, revision: { increment: 1 } },
          },
        },
      },
    })
    expect(await response.json()).toMatchObject({ id: 'room-1', siteId: 'site-b' })
  })

  it.each([
    { label: 'explicit same site', body: { ...roomFields, siteId: 'site-a' } },
    { label: 'omitted site', body: { ...roomFields, name: 'Renamed laundry' } },
  ])('retains floor plan markers for an edit with $label', async ({ body }) => {
    const response = await update(body)

    expect(response.status).toBe(200)
    expect(mocks.updateRoom).toHaveBeenCalledExactlyOnceWith({
      where: { id: 'room-1' },
      data: { ...body, description: undefined },
    })
  })

  it('rejects a cleaner before looking up or changing the room', async () => {
    signIn('CLEANER', 'site-a', false)

    expect((await update({ ...roomFields, siteId: 'site-b' })).status).toBe(403)
    expect(mocks.findRoom).not.toHaveBeenCalled()
    expect(mocks.updateRoom).not.toHaveBeenCalled()
  })

  it('rejects an anonymous request before changing any links', async () => {
    mocks.getServerSession.mockResolvedValue(null)

    expect((await update({ ...roomFields, siteId: 'site-b' })).status).toBe(401)
    expect(mocks.findRoom).not.toHaveBeenCalled()
    expect(mocks.updateRoom).not.toHaveBeenCalled()
  })

  it('prevents a pinned manager from moving their room to another site', async () => {
    signIn('MANAGER', 'site-a')

    const response = await update({ ...roomFields, siteId: 'site-b' })

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'You cannot move a room to that site' })
    expect(mocks.updateRoom).not.toHaveBeenCalled()
  })

  it('hides another site room from a manager attempting to move it', async () => {
    signIn('MANAGER', 'site-b')

    const response = await update({ ...roomFields, siteId: 'site-b' })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Room not found' })
    expect(mocks.updateRoom).not.toHaveBeenCalled()
  })

  it('keeps rejecting a service area transfer while it stores equipment', async () => {
    mocks.findRoom.mockResolvedValue({
      siteId: 'site-a', type: 'SERVICE_AREA', _count: { storedEquipment: 1 },
    })

    const response = await update({ ...roomFields, siteId: 'site-b' })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'Move the stored equipment out of this service area before changing its type or site',
    })
    expect(mocks.updateRoom).not.toHaveBeenCalled()
  })
})
