import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  siteFindUnique: vi.fn(),
  roomScheduleFindMany: vi.fn(),
  equipmentScheduleFindMany: vi.fn(),
  roomLogCount: vi.fn(),
  equipmentLogCount: vi.fn(),
  deliveryFindMany: vi.fn(),
  deliveryCreate: vi.fn(),
  deliveryUpdate: vi.fn(),
  deliveryUpdateMany: vi.fn(),
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
      create: mocks.deliveryCreate,
      update: mocks.deliveryUpdate,
      updateMany: mocks.deliveryUpdateMany,
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
  // The claim succeeds by default: no row existed for this person and week.
  mocks.deliveryCreate.mockResolvedValue({})
  mocks.deliveryUpdate.mockResolvedValue({})
  mocks.deliveryUpdateMany.mockResolvedValue({ count: 0 })
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
  /** Reject a claim the way Prisma does when the unique constraint bites. */
  async function conflict() {
    const { Prisma } = await import('@/generated/prisma/client')
    return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    })
  }

  it('skips somebody whose week is already claimed', async () => {
    mocks.deliveryCreate.mockRejectedValue(await conflict())
    // Nothing to take over: the existing row is SENT or freshly PENDING.
    mocks.deliveryUpdateMany.mockResolvedValue({ count: 0 })

    const result = await runWeeklyDigest({
      now: MONDAY_MORNING,
      timeZone: LONDON,
      transport: capturingTransport,
    })

    expect(capturingTransport).not.toHaveBeenCalled()
    expect(result.skipped).toBe(1)
  })

  it('takes over a week whose last attempt failed', async () => {
    mocks.deliveryCreate.mockRejectedValue(await conflict())
    mocks.deliveryUpdateMany.mockResolvedValue({ count: 1 })

    const result = await runWeeklyDigest({
      now: MONDAY_MORNING,
      timeZone: LONDON,
      transport: capturingTransport,
    })

    expect(capturingTransport).toHaveBeenCalledTimes(1)
    expect(result.sent).toBe(1)

    const where = mocks.deliveryUpdateMany.mock.calls[0][0].where
    // Only a failed row, or one left PENDING by a process that died.
    expect(where.OR).toEqual([
      { status: 'FAILED' },
      { status: 'PENDING', updatedAt: { lt: expect.any(Date) } },
    ])
  })

  it('claims BEFORE sending, not after', async () => {
    // This ordering is the whole defence. Claiming afterwards means two
    // concurrent runners both find no row, both send, and only then write.
    const order: string[] = []
    mocks.deliveryCreate.mockImplementation(async () => {
      order.push('claim')
      return {}
    })
    capturingTransport.mockImplementation(async () => {
      order.push('send')
      return true
    })

    await runWeeklyDigest({ now: MONDAY_MORNING, timeZone: LONDON, transport: capturingTransport })
    expect(order).toEqual(['claim', 'send'])
  })

  it('lets only one of two concurrent runs send', async () => {
    // The in-process scheduler and the external cron endpoint both call this and
    // nothing stops them landing in the same minute. The unique constraint on
    // (userId, weekStart) is what decides between them.
    let claims = 0
    mocks.deliveryCreate.mockImplementation(async () => {
      claims += 1
      if (claims === 1) return {}
      throw await conflict()
    })
    mocks.deliveryUpdateMany.mockResolvedValue({ count: 0 })

    const [first, second] = await Promise.all([
      runWeeklyDigest({ now: MONDAY_MORNING, timeZone: LONDON, transport: capturingTransport }),
      runWeeklyDigest({ now: MONDAY_MORNING, timeZone: LONDON, transport: capturingTransport }),
    ])

    expect(first.sent + second.sent).toBe(1)
    expect(first.skipped + second.skipped).toBe(1)
    expect(capturingTransport).toHaveBeenCalledTimes(1)
  })

  it('claims the week under the local Monday, not a UTC one', async () => {
    await runWeeklyDigest({ now: MONDAY_MORNING, timeZone: LONDON, transport: capturingTransport })

    expect(mocks.deliveryCreate.mock.calls[0][0].data).toMatchObject({
      userId: 'manager-1',
      weekStart: '2026-09-14',
      status: 'PENDING',
    })
  })

  it('gives every day of the week the same claim', async () => {
    const keys = new Set<string>()
    for (const day of [14, 15, 16, 17, 18, 19, 20]) {
      mocks.deliveryCreate.mockClear()
      await runWeeklyDigest({
        now: new Date(`2026-09-${day}T10:00:00Z`),
        timeZone: LONDON,
        transport: capturingTransport,
      })
      keys.add(mocks.deliveryCreate.mock.calls[0][0].data.weekStart)
    }

    expect([...keys]).toEqual(['2026-09-14'])
  })
})

describe('when something goes wrong', () => {
  it('records a refusal as FAILED so a later tick retries it', async () => {
    capturingTransport.mockResolvedValue(false)

    const result = await runWeeklyDigest({
      now: MONDAY_MORNING,
      timeZone: LONDON,
      transport: capturingTransport,
    })

    expect(result.failed).toBe(1)
    expect(mocks.deliveryUpdate.mock.calls[0][0].data.status).toBe('FAILED')
  })

  it('never marks a digest that WAS delivered as failed', async () => {
    // The email already left. Recording FAILED would make the week retryable and
    // send the same person a second copy - the exact thing the claim prevents.
    capturingTransport.mockResolvedValue(true)
    mocks.deliveryUpdate
      .mockRejectedValueOnce(new Error('database down'))
      .mockResolvedValue({})

    const result = await runWeeklyDigest({
      now: MONDAY_MORNING,
      timeZone: LONDON,
      transport: capturingTransport,
    })

    expect(result.sent).toBe(1)
    const recovery = mocks.deliveryUpdate.mock.calls[1][0].data
    expect(recovery.status).toBe('SENT')
    expect(recovery.status).not.toBe('FAILED')
  })

  it('leaves the claim PENDING when the status write cannot be made at all', async () => {
    // Both writes fail. The row stays PENDING and becomes retryable on its own
    // after the stale window - an at-least-once window, narrow and deliberate.
    capturingTransport.mockResolvedValue(true)
    mocks.deliveryUpdate.mockRejectedValue(new Error('database down'))

    await expect(
      runWeeklyDigest({ now: MONDAY_MORNING, timeZone: LONDON, transport: capturingTransport })
    ).resolves.toMatchObject({ sent: 1 })
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
    capturingTransport.mockRejectedValue(new Error('relay access denied'))

    await runWeeklyDigest({ now: MONDAY_MORNING, timeZone: LONDON, transport: capturingTransport })

    expect(mocks.deliveryUpdate.mock.calls[0][0].data.error).toContain('relay access denied')
  })

  it('surfaces a claim failure that is not a conflict', async () => {
    // A database that is actually down should not look like a week already sent.
    mocks.deliveryCreate.mockRejectedValue(new Error('connection refused'))

    await expect(
      runWeeklyDigest({ now: MONDAY_MORNING, timeZone: LONDON, transport: capturingTransport })
    ).rejects.toThrow('connection refused')
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
    expect(mocks.deliveryCreate).not.toHaveBeenCalled()
  })
})
