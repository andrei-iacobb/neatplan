import { beforeEach, describe, expect, it, vi } from 'vitest'

const { transaction, siteFindUnique, scheduleFindMany, scheduleCreate, scheduleUpdate } = vi.hoisted(() => {
  const siteFindUnique = vi.fn()
  const scheduleFindMany = vi.fn()
  const scheduleCreate = vi.fn()
  const scheduleUpdate = vi.fn()
  const tx = {
    site: { findUnique: siteFindUnique },
    schedule: { findMany: scheduleFindMany, create: scheduleCreate, update: scheduleUpdate },
  }
  const transaction = vi.fn(async (run: (client: typeof tx) => Promise<unknown>) => run(tx))
  return { transaction, siteFindUnique, scheduleFindMany, scheduleCreate, scheduleUpdate }
})

vi.mock('dotenv/config', () => ({}))
vi.mock('@/lib/db', () => ({
  prisma: { $transaction: transaction, $disconnect: vi.fn() },
}))

import { importSchedules } from '../../scripts/import-cleaning-schedules'

describe('cleaning template import', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    siteFindUnique.mockResolvedValue({ id: 'target-site' })
    scheduleFindMany.mockResolvedValue([])
  })

  it('rejects a shared template before replacing any task IDs or creating other schedules', async () => {
    scheduleFindMany
      .mockResolvedValueOnce([{ id: 'bedroom-template', sites: [{ id: 'target-site' }] }])
      .mockResolvedValueOnce([{
        id: 'shared-office-template',
        sites: [{ id: 'target-site' }, { id: 'other-site' }],
      }])

    await expect(importSchedules('Target Home')).rejects.toThrow(
      'Cannot import "Office - Daily Cleaning" into Target Home: the existing template is shared with another site. ' +
      'Separate it into site-specific templates before importing. No schedules were changed.',
    )

    expect(scheduleUpdate).not.toHaveBeenCalled()
    expect(scheduleCreate).not.toHaveBeenCalled()
  })

  it('updates an exclusively owned template and creates the remaining templates at the target site', async () => {
    scheduleFindMany.mockResolvedValueOnce([{
      id: 'bedroom-template',
      sites: [{ id: 'target-site' }],
    }])

    await expect(importSchedules('Target Home')).resolves.toMatchObject({ updated: 1, created: 17 })
    expect(scheduleUpdate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      where: { id: 'bedroom-template' },
      data: expect.objectContaining({ suggestedFrequency: 'DAILY' }),
    }))
    expect(scheduleCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sites: { connect: { id: 'target-site' } } }),
    }))
  })

  it('rejects duplicate templates before changing any schedules', async () => {
    scheduleFindMany.mockResolvedValueOnce([
      { id: 'first-template', sites: [{ id: 'target-site' }] },
      { id: 'duplicate-template', sites: [{ id: 'target-site' }] },
    ])

    await expect(importSchedules('Target Home')).rejects.toThrow('resolve duplicates before importing')
    expect(scheduleUpdate).not.toHaveBeenCalled()
    expect(scheduleCreate).not.toHaveBeenCalled()
  })

  it('rejects a missing target site before looking up or changing templates', async () => {
    siteFindUnique.mockResolvedValue(null)

    await expect(importSchedules('Missing Home')).rejects.toThrow('Site not found: Missing Home')
    expect(scheduleFindMany).not.toHaveBeenCalled()
    expect(scheduleUpdate).not.toHaveBeenCalled()
    expect(scheduleCreate).not.toHaveBeenCalled()
  })
})
