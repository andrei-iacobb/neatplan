import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireAdmin, resolveWriteSiteIds, scheduleCreate } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  resolveWriteSiteIds: vi.fn(),
  scheduleCreate: vi.fn(),
}))

vi.mock('@/lib/authz', () => ({
  requireAdmin,
  requireAuth: vi.fn(),
  resolveWriteSiteIds,
  m2mSiteScopeWhere: vi.fn(),
  m2mReadSiteWhere: vi.fn(),
  resolveReadSiteId: vi.fn(),
  visibleSiteRelationWhere: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    schedule: {
      create: scheduleCreate,
      findMany: vi.fn(),
    },
  },
}))

import { POST } from '@/app/api/schedules/route'

const completeBody = {
  title: 'Weekly Kitchen Deep Clean',
  detectedFrequency: 'weekly',
  suggestedFrequency: 'WEEKLY',
  siteIds: ['site-1'],
  tasks: [{ description: 'Clean extraction canopy', frequency: null, additionalNotes: null }],
}

describe('POST /api/schedules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdmin.mockResolvedValue({ user: { id: 'admin-1', role: 'OP', siteId: null } })
    resolveWriteSiteIds.mockReturnValue(['site-1'])
  })

  it.each([
    ['title', { ...completeBody, title: '' }],
    ['frequency', { ...completeBody, suggestedFrequency: null }],
    ['tasks', { ...completeBody, tasks: [] }],
  ])('blocks persistence while imported %s is unresolved', async (_field, body) => {
    const response = await POST(
      new Request('http://localhost/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('Complete the title, frequency'),
    })
    expect(scheduleCreate).not.toHaveBeenCalled()
  })

  it('persists a fully reviewed import', async () => {
    scheduleCreate.mockResolvedValue({ id: 'schedule-1', ...completeBody })

    const response = await POST(
      new Request('http://localhost/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completeBody),
      }),
    )

    expect(response.status).toBe(200)
    expect(scheduleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: completeBody.title,
          suggestedFrequency: 'WEEKLY',
        }),
      }),
    )
  })
})
