import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  findUser: vi.fn(),
  updateUser: vi.fn(),
  transaction: vi.fn(),
  txUpdateUser: vi.fn(),
  clearAssignments: vi.fn(),
}))
vi.mock('next-auth/next', () => ({ getServerSession: mocks.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: mocks.findUser, update: mocks.updateUser },
    $transaction: mocks.transaction,
  },
}))
import { PUT } from '@/app/api/users/[id]/route'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-13T23:30:00Z'))
  mocks.session.mockResolvedValue({ user: { id: 'director', role: 'DIRECTOR', isAdmin: true } })
  mocks.findUser.mockResolvedValue({
    id: 'cleaner',
    role: 'CLEANER',
    siteId: 'site-a',
    isHidden: false,
  })
  mocks.txUpdateUser.mockResolvedValue({
    id: 'cleaner',
    siteId: 'site-b',
    password: 'private-hash',
  })
  mocks.updateUser.mockResolvedValue({ id: 'cleaner', siteId: 'site-a', password: 'private-hash' })
  mocks.clearAssignments.mockResolvedValue({ count: 2 })
  mocks.transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn({
      user: { update: mocks.txUpdateUser },
      workAssignment: { updateMany: mocks.clearAssignments },
    }),
  )
})
afterEach(() => vi.useRealTimers())

function update(body: unknown) {
  return PUT(
    new Request('http://localhost/api/users/cleaner', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: 'cleaner' }) },
  )
}

describe('user allocation invalidation', () => {
  it.each([{ siteId: 'site-b' }, { role: 'MANAGER' }, { isBlocked: true }])(
    'clears current/future allocations atomically for %o',
    async (change) => {
      const response = await update(change)
      expect(response.status).toBe(200)
      expect(mocks.transaction).toHaveBeenCalledOnce()
      expect(mocks.txUpdateUser.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.clearAssignments.mock.invocationCallOrder[0],
      )
      expect(mocks.clearAssignments).toHaveBeenCalledExactlyOnceWith({
        where: { assigneeId: 'cleaner', workDate: { gte: new Date('2026-09-14T00:00:00Z') } },
        data: { assigneeId: null, assigneeName: null, revision: { increment: 1 } },
      })
      expect(mocks.txUpdateUser.mock.calls[0][0].data).not.toHaveProperty('workAssignments')
      expect(await response.json()).not.toHaveProperty('password')
    },
  )

  it.each([{ name: 'Renamed cleaner' }, { siteId: 'site-a' }, { isBlocked: false }])(
    'preserves allocations for %o',
    async (change) => {
      expect((await update(change)).status).toBe(200)
      expect(mocks.clearAssignments).not.toHaveBeenCalled()
      expect(mocks.transaction).not.toHaveBeenCalled()
    },
  )
})
