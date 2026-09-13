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
const { weekBounds, dayBounds } = await import('@/lib/export/datasets/work')

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

  it('explains allocation and cover on the document', async () => {
    prismaMocks.user.findFirst.mockResolvedValue({ name: 'Sam', email: 's@x' })

    const result = await resolveDataset('worklist', user('CLEANER', MAPLE), new URLSearchParams())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.dataset.note).toContain('colleagues may cover work')
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

describe('completion sources', () => {
  it('drops equipment from both rows and total when filtering by room', async () => {
    // Equipment completions have no room, so a room filter cannot apply to them.
    // If the count still ran, the document would report a total larger than the
    // rows it contains and appear to have been truncated when it was not.
    prismaMocks.roomScheduleCompletionLog.count.mockResolvedValue(4)
    prismaMocks.roomScheduleCompletionLog.findMany.mockResolvedValue([])

    const result = await resolveDataset('completions', user('OP'), new URLSearchParams('roomId=room_1'))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(prismaMocks.equipmentScheduleCompletionLog.count).not.toHaveBeenCalled()
    expect(prismaMocks.equipmentScheduleCompletionLog.findMany).not.toHaveBeenCalled()
    expect(result.dataset.summary).toContainEqual({ label: 'Completions', value: '4' })
  })

  it('includes equipment when no room filter is applied', async () => {
    await resolveDataset('completions', user('OP'), new URLSearchParams())

    expect(prismaMocks.equipmentScheduleCompletionLog.count).toHaveBeenCalled()
    expect(prismaMocks.equipmentScheduleCompletionLog.findMany).toHaveBeenCalled()
  })

  it('still includes equipment when filtering by person, who can clean both', async () => {
    await resolveDataset('completions', user('OP'), new URLSearchParams('userId=u9'))

    expect(prismaMocks.equipmentScheduleCompletionLog.findMany).toHaveBeenCalled()
  })
})

describe('week and day anchors', () => {
  it('starts a week on Monday', () => {
    // Wednesday 16 Sep 2026.
    const { start, end } = weekBounds(new Date(2026, 8, 16, 13, 0))
    expect(start.getDay()).toBe(1)
    expect(start.getDate()).toBe(14)
    expect(end.getDate()).toBe(21)
  })

  it('treats Sunday as the END of its week, not the start of the next', () => {
    // The classic off-by-one: getDay() is 0 for Sunday, so a naive shift lands a
    // week early or a week late depending on which way it is written.
    const { start } = weekBounds(new Date(2026, 8, 20, 10, 0)) // Sunday 20 Sep
    expect(start.getDate()).toBe(14) // Monday 14 Sep
    expect(start.getMonth()).toBe(8)
  })

  it('crosses a month boundary correctly', () => {
    const { start } = weekBounds(new Date(2026, 9, 1, 9, 0)) // Thursday 1 Oct
    expect(start.getMonth()).toBe(8) // September
    expect(start.getDate()).toBe(28)
  })

  it('crosses a year boundary correctly', () => {
    const { start } = weekBounds(new Date(2027, 0, 1, 9, 0)) // Friday 1 Jan 2027
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(11)
    expect(start.getDate()).toBe(28)
  })

  it('makes a day window exactly one local day', () => {
    const { start, end } = dayBounds(new Date(2026, 8, 16, 23, 30))
    expect(start.getHours()).toBe(0)
    expect(start.getDate()).toBe(16)
    expect(end.getDate()).toBe(17)
  })
})

describe('calendar-day anchors survive the trip to the server', () => {
  it('reads a bare YYYY-MM-DD as that local day, not as UTC midnight', async () => {
    // Monday 14 Sep 2026. Parsed as UTC midnight this is Sunday evening anywhere
    // west of Greenwich, which would roll the anchor back a full week.
    const result = await resolveDataset('diary', user('OP'), new URLSearchParams('date=2026-09-14'))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const week = result.dataset.filters.find((f) => f.label === 'Week')
    expect(week?.value).toBe('2026-09-14 to 2026-09-20')
  })

  it('anchors a Sunday to the Monday that opened its week', async () => {
    const result = await resolveDataset('diary', user('OP'), new URLSearchParams('date=2026-09-20'))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.dataset.filters.find((f) => f.label === 'Week')?.value).toBe(
      '2026-09-14 to 2026-09-20'
    )
  })

  it('reports a single day window for a day-scoped worklist', async () => {
    prismaMocks.user.findFirst.mockResolvedValue({ name: 'Sam', email: 's@x' })

    const result = await resolveDataset(
      'worklist',
      user('CLEANER', MAPLE),
      new URLSearchParams('scope=day&date=2026-09-16')
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.dataset.filters.find((f) => f.label === 'Day')?.value).toBe('2026-09-16')
  })

  it('falls back to now for an unparseable date rather than throwing', async () => {
    const result = await resolveDataset('diary', user('OP'), new URLSearchParams('date=garbage'))
    expect(result.ok).toBe(true)
  })
})
