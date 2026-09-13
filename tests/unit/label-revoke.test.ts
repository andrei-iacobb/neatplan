import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  roomUpdateMany: vi.fn(),
  equipmentUpdateMany: vi.fn(),
  requireRole: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    room: { updateMany: mocks.roomUpdateMany },
    equipment: { updateMany: mocks.equipmentUpdateMany },
  },
}))

vi.mock('@/lib/authz', async () => {
  const actual = await vi.importActual<typeof import('@/lib/authz')>('@/lib/authz')
  return { ...actual, requireRole: mocks.requireRole }
})

vi.mock('next/server', () => ({
  connection: async () => undefined,
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}))

const { POST } = await import('@/app/api/labels/revoke/route')

const MAPLE = 'site_maple'

function asUser(role: string, siteId: string | null = null) {
  return { user: { id: 'u1', role, siteId } }
}

function post(body: unknown) {
  return POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) })) as Promise<{
    json: () => Promise<{ revoked?: number; requested?: number; error?: string }>
    status: number
  }>
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireRole.mockResolvedValue(asUser('MANAGER', MAPLE))
  mocks.roomUpdateMany.mockResolvedValue({ count: 1 })
  mocks.equipmentUpdateMany.mockResolvedValue({ count: 1 })
})

describe('authorization', () => {
  it('is gated at the role that manages the labels on the wall', async () => {
    await post({ kind: 'room', ids: ['room_1'] })
    expect(mocks.requireRole).toHaveBeenCalledWith('HEAD_OF_HOUSEKEEPING')
  })

  it('passes the guard refusal straight back', async () => {
    const refusal = { error: { json: async () => ({ error: 'Forbidden' }), status: 403 } }
    mocks.requireRole.mockResolvedValue(refusal)

    const response = (await post({ kind: 'room', ids: ['room_1'] })) as unknown as { status: number }
    expect(response.status).toBe(403)
    expect(mocks.roomUpdateMany).not.toHaveBeenCalled()
  })
})

describe('site scoping', () => {
  it('puts the caller site in the WHERE rather than checking it first', async () => {
    await post({ kind: 'room', ids: ['room_1', 'room_2'] })

    const where = mocks.roomUpdateMany.mock.calls[0][0].where
    expect(where.AND).toContainEqual({ id: { in: ['room_1', 'room_2'] } })
    expect(where.AND).toContainEqual({ siteId: MAPLE })
  })

  it('silently revokes nothing for an id at another site', async () => {
    // Scoping in the WHERE means an id from elsewhere updates no rows. The count
    // comes back lower than requested rather than erroring, so the response
    // cannot be used to probe which ids exist at other sites.
    mocks.roomUpdateMany.mockResolvedValue({ count: 0 })

    const body = await (await post({ kind: 'room', ids: ['room_at_other_site'] })).json()
    expect(body).toEqual({ revoked: 0, requested: 1 })
  })

  it('leaves an all-sites role unfiltered', async () => {
    mocks.requireRole.mockResolvedValue(asUser('DIRECTOR', null))

    await post({ kind: 'room', ids: ['room_1'] })
    expect(mocks.roomUpdateMany.mock.calls[0][0].where.AND).toContainEqual({})
  })
})

describe('revocation', () => {
  it('advances the version so every printed label stops verifying', async () => {
    await post({ kind: 'room', ids: ['room_1'] })

    expect(mocks.roomUpdateMany.mock.calls[0][0].data).toEqual({
      locationTokenVersion: { increment: 1 },
    })
  })

  it('revokes equipment labels through the equipment table', async () => {
    await post({ kind: 'equipment', ids: ['equip_1'] })

    expect(mocks.equipmentUpdateMany).toHaveBeenCalled()
    expect(mocks.roomUpdateMany).not.toHaveBeenCalled()
    expect(mocks.equipmentUpdateMany.mock.calls[0][0].data).toEqual({
      locationTokenVersion: { increment: 1 },
    })
  })

  it('collapses a repeated id so the count reports targets, not requests', async () => {
    await post({ kind: 'room', ids: ['room_1', 'room_1', 'room_1'] })

    const where = mocks.roomUpdateMany.mock.calls[0][0].where
    expect(where.AND).toContainEqual({ id: { in: ['room_1'] } })
  })
})

describe('input handling', () => {
  it('refuses an empty selection', async () => {
    const response = await post({ kind: 'room', ids: [] })
    expect(response.status).toBe(400)
    expect(mocks.roomUpdateMany).not.toHaveBeenCalled()
  })

  it('refuses an unknown kind rather than guessing', async () => {
    const response = await post({ kind: 'building', ids: ['x'] })
    expect(response.status).toBe(400)
  })

  it('refuses a request past the one-sheet ceiling', async () => {
    const response = await post({
      kind: 'room',
      ids: Array.from({ length: 241 }, (_, i) => `room_${i}`),
    })
    expect(response.status).toBe(400)
    expect(mocks.roomUpdateMany).not.toHaveBeenCalled()
  })

  it('refuses a malformed body without throwing', async () => {
    const response = (await POST(
      new Request('http://localhost', { method: 'POST', body: 'not json' })
    )) as unknown as { status: number }
    expect(response.status).toBe(400)
  })
})
