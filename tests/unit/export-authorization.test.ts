import { describe, it, expect, beforeEach, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => {
  const model = () => ({ findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() })
  return {
    room: model(),
    equipment: model(),
    site: model(),
    user: model(),
    floorPlan: model(),
    schedule: model(),
    roomSchedule: model(),
    equipmentSchedule: model(),
    roomScheduleCompletionLog: model(),
    equipmentScheduleCompletionLog: model(),
  }
})

vi.mock('@/lib/db', () => ({ prisma: prismaMocks }))

const { resolveDataset, canExport, exportableDatasets, DATASETS } = await import('@/lib/export/registry')
const { DATASET_MIN_ROLE, roleCanExport } = await import('@/lib/export/permissions')

const MAPLE = 'site_maple'
const OTHER = 'site_other'
const NO_SITE = '__no_site__'

const user = (role: string, siteId: string | null = null) =>
  ({ id: 'u1', email: 'u1@example.com', role, siteId }) as never

function resetPrisma() {
  for (const model of Object.values(prismaMocks)) {
    model.findMany.mockReset().mockResolvedValue([])
    model.count.mockReset().mockResolvedValue(0)
    model.findUnique.mockReset().mockResolvedValue({ name: 'Beech House' })
    model.findFirst.mockReset().mockResolvedValue({ name: 'Beech House', email: 'x@y' })
  }
}

beforeEach(resetPrisma)

describe('registry integrity', () => {
  it('has a permission entry for every dataset and vice versa', () => {
    expect(Object.keys(DATASETS).sort()).toEqual(Object.keys(DATASET_MIN_ROLE).sort())
  })

  it('never exposes a dataset the client cannot evaluate the permission for', () => {
    for (const id of Object.keys(DATASETS)) {
      expect(roleCanExport(id, 'OP')).toBe(true)
    }
  })
})

describe('canExport', () => {
  it('lets a cleaner pull their own worklist and nothing else', () => {
    const cleaner = user('CLEANER', MAPLE)
    expect(canExport('worklist', cleaner)).toBe(true)
    expect(canExport('rooms', cleaner)).toBe(false)
    expect(canExport('completions', cleaner)).toBe(false)
    expect(canExport('people', cleaner)).toBe(false)
    expect(exportableDatasets(cleaner)).toEqual(['worklist'])
  })

  it('keeps the staff roster above the housekeeping line', () => {
    const hoh = user('HEAD_OF_HOUSEKEEPING', MAPLE)
    expect(canExport('rooms', hoh)).toBe(true)
    expect(canExport('completions', hoh)).toBe(true)
    // A Head of Housekeeping runs cleaning, not the staff roster.
    expect(canExport('people', hoh)).toBe(false)
    expect(canExport('people', user('MANAGER', MAPLE))).toBe(true)
  })

  it('refuses an unknown dataset rather than falling through', () => {
    expect(canExport('secrets', user('OP'))).toBe(false)
  })
})

describe('resolveDataset authorization', () => {
  it('returns 404-shaped failure for an unknown dataset', async () => {
    const result = await resolveDataset('nope', user('OP'), new URLSearchParams())
    expect(result).toEqual({ ok: false, failure: { kind: 'not-found' } })
  })

  it('refuses before touching the database', async () => {
    const result = await resolveDataset('people', user('CLEANER', MAPLE), new URLSearchParams())

    expect(result).toEqual({ ok: false, failure: { kind: 'forbidden' } })
    // The point: an unauthorised caller must not cause a query at all, so a
    // refusal can never be confused with an empty result set.
    expect(prismaMocks.user.findMany).not.toHaveBeenCalled()
    expect(prismaMocks.user.count).not.toHaveBeenCalled()
  })
})

describe('site scoping', () => {
  async function whereFor(datasetId: string, actor: ReturnType<typeof user>, params = '') {
    await resolveDataset(datasetId, actor, new URLSearchParams(params))
    return prismaMocks
  }

  it('pins a MANAGER to their own site even when they ask for another', async () => {
    await whereFor('rooms', user('MANAGER', MAPLE), `site=${OTHER}`)

    const where = prismaMocks.room.findMany.mock.calls[0][0].where
    const clauses = JSON.stringify(where)
    expect(clauses).toContain(MAPLE)
    expect(clauses).not.toContain(OTHER)
  })

  it('lets a DIRECTOR narrow to a requested site', async () => {
    await whereFor('rooms', user('DIRECTOR'), `site=${OTHER}`)

    const where = prismaMocks.room.findMany.mock.calls[0][0].where
    expect(JSON.stringify(where)).toContain(OTHER)
  })

  it('leaves a DIRECTOR unfiltered when no site is requested', async () => {
    await whereFor('rooms', user('DIRECTOR'))

    const where = prismaMocks.room.findMany.mock.calls[0][0].where
    expect(where.AND[0]).toEqual({})
    expect(where.AND[1]).toEqual({})
  })

  it('fails closed for a pinned role with no site assigned', async () => {
    await whereFor('equipment', user('HEAD_OF_HOUSEKEEPING', null))

    const where = prismaMocks.equipment.findMany.mock.calls[0][0].where
    expect(JSON.stringify(where)).toContain(NO_SITE)
  })

  it('scopes completion logs through the room relation, two levels deep', async () => {
    await whereFor('completions', user('MANAGER', MAPLE))

    const where = prismaMocks.roomScheduleCompletionLog.findMany.mock.calls[0][0].where
    // RoomSchedule has no siteId of its own; the scope has to walk to the room.
    expect(where.AND[0]).toEqual({ roomSchedule: { room: { siteId: MAPLE } } })
  })

  it('scopes equipment completion logs through the equipment relation', async () => {
    await whereFor('completions', user('MANAGER', MAPLE))

    const where = prismaMocks.equipmentScheduleCompletionLog.findMany.mock.calls[0][0].where
    expect(where.AND[0]).toEqual({ equipmentSchedule: { equipment: { siteId: MAPLE } } })
  })

  it('hides the owner account from the people export', async () => {
    await whereFor('people', user('OP'))

    const where = prismaMocks.user.findMany.mock.calls[0][0].where
    expect(where.AND).toContainEqual({ isHidden: false })
  })
})

describe('sensitive fields', () => {
  it('never selects a credential or a secret on the people export', async () => {
    await resolveDataset('people', user('OP'), new URLSearchParams())

    const select = prismaMocks.user.findMany.mock.calls[0][0].select
    for (const forbidden of [
      'password',
      'totpSecret',
      'totpEnabled',
      'settings',
      'failedLoginCount',
      'lastFailedLoginAt',
      'notificationEmail',
      'sessions',
    ]) {
      expect(select).not.toHaveProperty(forbidden)
    }
  })

  it('never selects the server filesystem path of a floor plan image', async () => {
    await resolveDataset('floor-plans', user('OP'), new URLSearchParams())

    const select = prismaMocks.floorPlan.findMany.mock.calls[0][0].select
    expect(select).not.toHaveProperty('imagePath')
  })

  it('never selects the drawn signature bitmap on a completion export', async () => {
    await resolveDataset('completions', user('OP'), new URLSearchParams())

    const select = prismaMocks.roomScheduleCompletionLog.findMany.mock.calls[0][0].select
    expect(select).not.toHaveProperty('signatureDataUrl')
    // The printed name is the auditable part and is kept.
    expect(select).toHaveProperty('signedName', true)
  })

  it('never exposes locationTokenVersion, which backs check-in tokens', async () => {
    await resolveDataset('rooms', user('OP'), new URLSearchParams())

    const select = prismaMocks.room.findMany.mock.calls[0][0].select
    expect(select).not.toHaveProperty('locationTokenVersion')
  })

  it('declares no export column reading a sensitive field name', () => {
    const forbidden = /password|token|secret|signatureDataUrl|sessionToken|imagePath/i
    for (const [id, definition] of Object.entries(DATASETS)) {
      for (const column of definition.columns) {
        expect(`${id}.${column.key}`).not.toMatch(forbidden)
      }
    }
  })
})

describe('bounded exports', () => {
  it('reports truncation rather than dropping rows silently', async () => {
    prismaMocks.room.count.mockResolvedValue(12_345)
    prismaMocks.room.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        name: `Room ${i}`,
        floor: null,
        type: 'BEDROOM',
        description: null,
        site: { name: 'Beech House' },
        schedules: [],
      }))
    )

    const result = await resolveDataset('rooms', user('OP'), new URLSearchParams())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.dataset.truncated).toEqual({ cap: DATASETS.rooms.cap, total: 12_345 })
  })

  it('reports no truncation when every matching row fitted', async () => {
    prismaMocks.room.count.mockResolvedValue(2)
    prismaMocks.room.findMany.mockResolvedValue([
      { name: 'A', floor: null, type: 'BEDROOM', description: null, site: { name: 'X' }, schedules: [] },
      { name: 'B', floor: null, type: 'BEDROOM', description: null, site: { name: 'X' }, schedules: [] },
    ])

    const result = await resolveDataset('rooms', user('OP'), new URLSearchParams())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.dataset.truncated).toBeUndefined()
  })

  it('applies the cap as the query take, so memory is bounded at the database', async () => {
    await resolveDataset('rooms', user('OP'), new URLSearchParams())
    expect(prismaMocks.room.findMany.mock.calls[0][0].take).toBe(DATASETS.rooms.cap)
  })

  it('ignores the on-screen page parameter entirely', async () => {
    // The whole point of an export: it covers every matching row, not the page
    // the operator happens to be looking at.
    await resolveDataset('completions', user('OP'), new URLSearchParams('page=3&limit=25'))

    const call = prismaMocks.roomScheduleCompletionLog.findMany.mock.calls[0][0]
    expect(call.skip).toBeUndefined()
    expect(call.take).toBe(DATASETS.completions.cap)
  })
})

describe('filter handling', () => {
  it('drops an unrecognised room type instead of passing it to Prisma', async () => {
    await resolveDataset('rooms', user('OP'), new URLSearchParams('type=DROP TABLE rooms'))

    const where = prismaMocks.room.findMany.mock.calls[0][0].where
    expect(JSON.stringify(where)).not.toContain('DROP TABLE')
  })

  it('accepts a real room type case-insensitively', async () => {
    await resolveDataset('rooms', user('OP'), new URLSearchParams('type=bedroom'))

    const where = prismaMocks.room.findMany.mock.calls[0][0].where
    expect(where.AND).toContainEqual({ type: 'BEDROOM' })
  })

  it('searches every matching row server-side, not just a fetched page', async () => {
    await resolveDataset('completions', user('OP'), new URLSearchParams('q=lounge'))

    const where = prismaMocks.roomScheduleCompletionLog.findMany.mock.calls[0][0].where
    expect(JSON.stringify(where)).toContain('lounge')
  })

  it('orders deterministically so two exports of unchanged data match', async () => {
    await resolveDataset('rooms', user('OP'), new URLSearchParams())
    expect(prismaMocks.room.findMany.mock.calls[0][0].orderBy).toEqual([
      { name: 'asc' },
      { id: 'asc' },
    ])
  })
})

describe('worklist allocation', () => {
  it('lets a cleaner name only themselves', async () => {
    prismaMocks.user.findFirst.mockResolvedValue({ name: 'Sam', email: 's@x' })

    await resolveDataset('worklist', user('CLEANER', MAPLE), new URLSearchParams('userId=someone_else'))

    // A cleaner passing another person's id gets their own sheet, matching the
    // convention the write side already uses for site ids.
    const where = prismaMocks.user.findFirst.mock.calls[0][0].where
    expect(where.AND).toContainEqual({ id: 'u1' })
    expect(JSON.stringify(where)).not.toContain('someone_else')
  })

  it('lets a manager pull a named person at a site they can already see', async () => {
    prismaMocks.user.findFirst.mockResolvedValue({ name: 'Sam', email: 's@x' })

    await resolveDataset('worklist', user('MANAGER', MAPLE), new URLSearchParams('userId=cleaner_7'))

    const where = prismaMocks.user.findFirst.mock.calls[0][0].where
    expect(where.AND).toContainEqual({ id: 'cleaner_7' })
  })

  it('scopes the person lookup so a header cannot name someone at another site', async () => {
    // The row set was always scoped. The leak this guards is narrower: a MANAGER
    // at site A passing a site-B employee's id would get an empty table under a
    // header carrying that person's real name and email.
    await resolveDataset('worklist', user('MANAGER', MAPLE), new URLSearchParams('userId=cleaner_7'))

    const where = prismaMocks.user.findFirst.mock.calls[0][0].where
    expect(where.AND).toContainEqual({ siteId: MAPLE })
    expect(where.AND).toContainEqual({ isHidden: false })
  })

  it('falls back to a site sheet when the named person is not visible', async () => {
    prismaMocks.user.findFirst.mockResolvedValue(null)

    const result = await resolveDataset('worklist', user('MANAGER', MAPLE), new URLSearchParams('userId=stranger'))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.dataset.filters.some((f) => f.label === 'For')).toBe(false)
    expect(result.dataset.subtitle).toBe('Beech House')
  })

  it('states the per-site allocation basis on the document', async () => {
    prismaMocks.user.findFirst.mockResolvedValue({ name: 'Sam', email: 's@x' })

    const result = await resolveDataset('worklist', user('CLEANER', MAPLE), new URLSearchParams())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.dataset.note).toContain('allocated per site')
  })
})

describe('filter chip label lookups', () => {
  it('scopes the room label so a header cannot name another site\'s room', async () => {
    await resolveDataset('completions', user('HEAD_OF_HOUSEKEEPING', MAPLE), new URLSearchParams('roomId=room_at_other_site'))

    const where = prismaMocks.room.findFirst.mock.calls[0][0].where
    expect(where.AND).toContainEqual({ id: 'room_at_other_site' })
    expect(where.AND).toContainEqual({ siteId: MAPLE })
  })

  it('fails closed when the room is not visible', async () => {
    prismaMocks.room.findFirst.mockResolvedValue(null)

    const result = await resolveDataset('completions', user('MANAGER', MAPLE), new URLSearchParams('roomId=elsewhere'))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.dataset.filters).toContainEqual({ label: 'Room', value: 'Unknown room' })
  })

  it('scopes the person label on the completions header too', async () => {
    await resolveDataset('completions', user('MANAGER', MAPLE), new URLSearchParams('userId=someone'))

    const where = prismaMocks.user.findFirst.mock.calls[0][0].where
    expect(where.AND).toContainEqual({ siteId: MAPLE })
    expect(where.AND).toContainEqual({ isHidden: false })
  })

  it('leaves an all-sites role able to resolve any label', async () => {
    await resolveDataset('completions', user('OP'), new URLSearchParams('roomId=any_room'))

    const where = prismaMocks.room.findFirst.mock.calls[0][0].where
    // An empty scope fragment, not a site filter.
    expect(where.AND).toContainEqual({})
  })
})
