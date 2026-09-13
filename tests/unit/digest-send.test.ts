import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  siteFindUnique: vi.fn(),
  roomScheduleFindMany: vi.fn(),
  equipmentScheduleFindMany: vi.fn(),
  roomLogCount: vi.fn(),
  equipmentLogCount: vi.fn(),
  deliveryFindMany: vi.fn(),
  deliveryUpsert: vi.fn(),
  sendRawEmail: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findMany: mocks.userFindMany },
    site: { findUnique: mocks.siteFindUnique },
    roomSchedule: { findMany: mocks.roomScheduleFindMany },
    equipmentSchedule: { findMany: mocks.equipmentScheduleFindMany },
    roomScheduleCompletionLog: { count: mocks.roomLogCount },
    equipmentScheduleCompletionLog: { count: mocks.equipmentLogCount },
    weeklyDigestDelivery: {
      findMany: mocks.deliveryFindMany,
      upsert: mocks.deliveryUpsert,
    },
  },
}))

/**
 * The real mail service is replaced outright. Nothing in this file may be able
 * to reach a mail server even by accident - a test suite that can send email is
 * one bad mock away from writing to somebody's inbox.
 */
vi.mock('@/lib/email', () => ({
  emailService: { sendRawEmail: mocks.sendRawEmail, isReady: () => true },
}))

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }))

const { runWeeklyDigest } = await import('@/lib/digest/send')
const { digestEnabled } = await import('@/lib/digest/build')

const LONDON = 'Europe/London'
/** Monday 14 September 2026, 09:00 local - a digest is due. */
const MONDAY_MORNING = new Date('2026-09-14T08:00:00Z')
/** Monday 14 September 2026, 03:00 local - too early. */
const MONDAY_NIGHT = new Date('2026-09-14T02:00:00Z')

const optedIn = { notifications: { weeklyDigest: true } }

function user(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    email: `${id}@example.com`,
    notificationEmail: null,
    name: id,
    siteId: 'site-1',
    settings: optedIn,
    ...overrides,
  }
}

/** Captures what would have been sent, and reports success. */
const capturingTransport =
  vi.fn<(recipient: { id: string; email: string }, message: unknown) => Promise<boolean>>(
    async () => true
  )

beforeEach(() => {
  vi.clearAllMocks()
  capturingTransport.mockClear()
  capturingTransport.mockResolvedValue(true)

  mocks.userFindMany.mockResolvedValue([user('manager-1')])
  mocks.siteFindUnique.mockResolvedValue({ name: 'Maple Care Home' })
  mocks.roomScheduleFindMany.mockResolvedValue([])
  mocks.equipmentScheduleFindMany.mockResolvedValue([])
  mocks.roomLogCount.mockResolvedValue(0)
  mocks.equipmentLogCount.mockResolvedValue(0)
  mocks.deliveryFindMany.mockResolvedValue([])
  mocks.deliveryUpsert.mockResolvedValue({})
})

describe('who gets one', () => {
  it('asks only for roles that act on a single site', async () => {
    await runWeeklyDigest({ now: MONDAY_MORNING, timeZone: LONDON, transport: capturingTransport })

    const where = mocks.userFindMany.mock.calls[0][0].where
    expect(where.role).toEqual({ in: ['MANAGER', 'HEAD_OF_HOUSEKEEPING'] })
    // A digest covering every site at once is not a digest, so a site-spanning
    // role is excluded at the query rather than filtered later.
    expect(where.siteId).toEqual({ not: null })
    expect(where.isBlocked).toBe(false)
    expect(where.isHidden).toBe(false)
  })

  it('sends to nobody who has not opted in', async () => {
    mocks.userFindMany.mockResolvedValue([
      user('never-set', { settings: null }),
      user('empty-settings', { settings: {} }),
      user('other-prefs', { settings: { notifications: { email: true } } }),
      user('explicitly-off', { settings: { notifications: { weeklyDigest: false } } }),
      user('string-truthy', { settings: { notifications: { weeklyDigest: 'yes' } } }),
    ])

    const result = await runWeeklyDigest({
      now: MONDAY_MORNING,
      timeZone: LONDON,
      transport: capturingTransport,
    })

    // Every one of these is a way an existing account could be read as consent.
    expect(capturingTransport).not.toHaveBeenCalled()
    expect(result.sent).toBe(0)
    expect(result.considered).toBe(0)
  })

  it('reads consent strictly', () => {
    expect(digestEnabled({ notifications: { weeklyDigest: true } })).toBe(true)
    expect(digestEnabled({ notifications: { weeklyDigest: 'true' } })).toBe(false)
    expect(digestEnabled({ notifications: { weeklyDigest: 1 } })).toBe(false)
    expect(digestEnabled({ notifications: {} })).toBe(false)
    expect(digestEnabled({})).toBe(false)
    expect(digestEnabled(null)).toBe(false)
    expect(digestEnabled('nonsense')).toBe(false)
  })

  it('prefers the notification address over the login one', async () => {
    mocks.userFindMany.mockResolvedValue([
      user('manager-1', { notificationEmail: 'rota@example.com' }),
    ])

    await runWeeklyDigest({ now: MONDAY_MORNING, timeZone: LONDON, transport: capturingTransport })
    expect(capturingTransport.mock.calls[0][0].email).toBe('rota@example.com')
  })

  it('falls back to the login address when the other is blank', async () => {
    mocks.userFindMany.mockResolvedValue([user('manager-1', { notificationEmail: '   ' })])

    await runWeeklyDigest({ now: MONDAY_MORNING, timeZone: LONDON, transport: capturingTransport })
    expect(capturingTransport.mock.calls[0][0].email).toBe('manager-1@example.com')
  })
})

describe('when it runs', () => {
  it('does nothing before the send hour on Monday', async () => {
    const result = await runWeeklyDigest({
      now: MONDAY_NIGHT,
      timeZone: LONDON,
      transport: capturingTransport,
    })

    expect(result.due).toBe(false)
    expect(capturingTransport).not.toHaveBeenCalled()
    // Not even a query - a tick that is not due should cost nothing.
    expect(mocks.userFindMany).not.toHaveBeenCalled()
  })

  it('sends once the hour arrives', async () => {
    const result = await runWeeklyDigest({
      now: MONDAY_MORNING,
      timeZone: LONDON,
      transport: capturingTransport,
    })

    expect(result.due).toBe(true)
    expect(result.sent).toBe(1)
  })

  it('can be forced past the schedule for a preview or a test', async () => {
    const result = await runWeeklyDigest({
      now: MONDAY_NIGHT,
      timeZone: LONDON,
      transport: capturingTransport,
      force: true,
    })

    expect(result.due).toBe(true)
    expect(capturingTransport).toHaveBeenCalledTimes(1)
  })
})

describe('sending it only once', () => {
  it('skips somebody who already had this week', async () => {
    mocks.deliveryFindMany.mockResolvedValue([{ userId: 'manager-1', status: 'SENT' }])

    const result = await runWeeklyDigest({
      now: MONDAY_MORNING,
      timeZone: LONDON,
      transport: capturingTransport,
    })

    expect(capturingTransport).not.toHaveBeenCalled()
    expect(result.skipped).toBe(1)
    expect(result.sent).toBe(0)
  })

  it('retries somebody whose last attempt failed', async () => {
    // A failed week must not be marked done, or it is lost in silence.
    mocks.deliveryFindMany.mockResolvedValue([{ userId: 'manager-1', status: 'FAILED' }])

    const result = await runWeeklyDigest({
      now: MONDAY_MORNING,
      timeZone: LONDON,
      transport: capturingTransport,
    })

    expect(capturingTransport).toHaveBeenCalledTimes(1)
    expect(result.sent).toBe(1)
  })

  it('claims the week under the local Monday, not a UTC one', async () => {
    await runWeeklyDigest({ now: MONDAY_MORNING, timeZone: LONDON, transport: capturingTransport })

    expect(mocks.deliveryUpsert.mock.calls[0][0].where).toEqual({
      userId_weekStart: { userId: 'manager-1', weekStart: '2026-09-14' },
    })
  })

  it('gives every day of the week the same claim', async () => {
    // Otherwise Tuesday's tick would not recognise Monday's delivery and would
    // send the whole thing again.
    const keys = new Set<string>()
    for (const day of [14, 15, 16, 17, 18, 19, 20]) {
      mocks.deliveryUpsert.mockClear()
      await runWeeklyDigest({
        now: new Date(`2026-09-${day}T10:00:00Z`),
        timeZone: LONDON,
        transport: capturingTransport,
      })
      keys.add(mocks.deliveryUpsert.mock.calls[0][0].where.userId_weekStart.weekStart)
    }

    expect([...keys]).toEqual(['2026-09-14'])
  })

  it('claims the week AFTER the send, not before', async () => {
    // Claiming first loses somebody's digest for the week if the process dies in
    // between, with nothing to notice it. A duplicate is the lesser failure.
    const order: string[] = []
    capturingTransport.mockImplementation(async () => {
      order.push('send')
      return true
    })
    mocks.deliveryUpsert.mockImplementation(async () => {
      order.push('claim')
      return {}
    })

    await runWeeklyDigest({ now: MONDAY_MORNING, timeZone: LONDON, transport: capturingTransport })
    expect(order).toEqual(['send', 'claim'])
  })
})

describe('when something goes wrong', () => {
  it('records a refusal as FAILED so the next tick retries it', async () => {
    capturingTransport.mockResolvedValue(false)

    const result = await runWeeklyDigest({
      now: MONDAY_MORNING,
      timeZone: LONDON,
      transport: capturingTransport,
    })

    expect(result.failed).toBe(1)
    expect(mocks.deliveryUpsert.mock.calls[0][0].create.status).toBe('FAILED')
  })

  it('lets the rest of the round through when one recipient throws', async () => {
    mocks.userFindMany.mockResolvedValue([user('bad'), user('good')])
    capturingTransport.mockImplementation(async (recipient: { id: string }) => {
      if (recipient.id === 'bad') throw new Error('mailbox full')
      return true
    })

    const result = await runWeeklyDigest({
      now: MONDAY_MORNING,
      timeZone: LONDON,
      transport: capturingTransport,
    })

    expect(result.failed).toBe(1)
    expect(result.sent).toBe(1)
  })

  it('keeps the reason, so an operator can see what broke', async () => {
    mocks.userFindMany.mockResolvedValue([user('bad')])
    capturingTransport.mockRejectedValue(new Error('relay access denied'))

    await runWeeklyDigest({ now: MONDAY_MORNING, timeZone: LONDON, transport: capturingTransport })

    expect(mocks.deliveryUpsert.mock.calls[0][0].create.error).toContain('relay access denied')
  })

  it('does not let a failed bookkeeping write take the run down', async () => {
    capturingTransport.mockRejectedValue(new Error('smtp down'))
    mocks.deliveryUpsert.mockRejectedValue(new Error('database down'))

    // If the database is what broke, the next tick tries everything again
    // anyway; throwing here would take the overdue sweep with it.
    await expect(
      runWeeklyDigest({ now: MONDAY_MORNING, timeZone: LONDON, transport: capturingTransport })
    ).resolves.toMatchObject({ failed: 1 })
  })
})

describe('what it costs', () => {
  it('builds the content once per site, not once per recipient', async () => {
    mocks.userFindMany.mockResolvedValue([
      user('manager-1', { siteId: 'site-1' }),
      user('hoh-1', { siteId: 'site-1' }),
      user('manager-2', { siteId: 'site-2' }),
    ])

    await runWeeklyDigest({ now: MONDAY_MORNING, timeZone: LONDON, transport: capturingTransport })

    expect(capturingTransport).toHaveBeenCalledTimes(3)
    // Two sites, so two builds - not three.
    expect(mocks.siteFindUnique).toHaveBeenCalledTimes(2)
  })

  it('asks for nothing at all when nobody has opted in', async () => {
    mocks.userFindMany.mockResolvedValue([])

    await runWeeklyDigest({ now: MONDAY_MORNING, timeZone: LONDON, transport: capturingTransport })
    expect(mocks.siteFindUnique).not.toHaveBeenCalled()
    expect(mocks.deliveryFindMany).not.toHaveBeenCalled()
  })
})
