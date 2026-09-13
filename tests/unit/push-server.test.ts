import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
  subFindMany: vi.fn(),
  subUpdate: vi.fn(),
  subDelete: vi.fn(),
}))

/**
 * The push library is replaced outright. Nothing in this file may be able to
 * reach a push service, for the same reason the digest tests cannot reach a mail
 * server: a test that can deliver is one bad mock away from delivering.
 */
vi.mock('web-push', () => ({
  default: {
    sendNotification: mocks.sendNotification,
    setVapidDetails: mocks.setVapidDetails,
  },
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    pushSubscription: {
      findMany: mocks.subFindMany,
      update: mocks.subUpdate,
      delete: mocks.subDelete,
    },
  },
}))

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }))

const { pushConfigured, pushToUser, pushToUsers, resetPushConfigCache, vapidPublicKey } =
  await import('@/lib/push/server')

const ORIGINAL = {
  pub: process.env.VAPID_PUBLIC_KEY,
  priv: process.env.VAPID_PRIVATE_KEY,
  subject: process.env.VAPID_SUBJECT,
}

function configure() {
  process.env.VAPID_PUBLIC_KEY = 'test-public-key'
  process.env.VAPID_PRIVATE_KEY = 'test-private-key'
  process.env.VAPID_SUBJECT = 'mailto:ops@example.com'
  resetPushConfigCache()
}

function unconfigure() {
  delete process.env.VAPID_PUBLIC_KEY
  delete process.env.VAPID_PRIVATE_KEY
  delete process.env.VAPID_SUBJECT
  resetPushConfigCache()
}

const subscription = (id: string) => ({
  id,
  endpoint: `https://push.example/${id}`,
  p256dh: 'key',
  auth: 'auth',
})

function httpError(statusCode: number) {
  return Object.assign(new Error('push failed'), { statusCode })
}

beforeEach(() => {
  vi.clearAllMocks()
  configure()
  mocks.subFindMany.mockResolvedValue([subscription('sub-1')])
  mocks.sendNotification.mockResolvedValue({})
  mocks.subUpdate.mockResolvedValue({})
  mocks.subDelete.mockResolvedValue({})
})

afterEach(() => {
  if (ORIGINAL.pub === undefined) delete process.env.VAPID_PUBLIC_KEY
  else process.env.VAPID_PUBLIC_KEY = ORIGINAL.pub
  if (ORIGINAL.priv === undefined) delete process.env.VAPID_PRIVATE_KEY
  else process.env.VAPID_PRIVATE_KEY = ORIGINAL.priv
  if (ORIGINAL.subject === undefined) delete process.env.VAPID_SUBJECT
  else process.env.VAPID_SUBJECT = ORIGINAL.subject
  resetPushConfigCache()
})

describe('without keys', () => {
  it('reports itself unavailable rather than half working', () => {
    unconfigure()
    expect(pushConfigured()).toBe(false)
    expect(vapidPublicKey()).toBeNull()
  })

  it('needs all three values, not some of them', () => {
    for (const missing of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const) {
      configure()
      delete process.env[missing]
      resetPushConfigCache()

      expect(pushConfigured(), missing).toBe(false)
    }
  })

  it('sends nothing, and does not even look for subscriptions', async () => {
    unconfigure()

    const result = await pushToUser('user-1', { title: 'x', body: 'y' })

    expect(result).toEqual({ sent: 0, expired: 0, failed: 0 })
    expect(mocks.subFindMany).not.toHaveBeenCalled()
    expect(mocks.sendNotification).not.toHaveBeenCalled()
  })

  it('treats a malformed key as unconfigured rather than throwing on every send', async () => {
    mocks.setVapidDetails.mockImplementationOnce(() => {
      throw new Error('invalid key')
    })
    configure()

    expect(pushConfigured()).toBe(false)
    await expect(pushToUser('user-1', { title: 'x', body: 'y' })).resolves.toEqual({
      sent: 0,
      expired: 0,
      failed: 0,
    })
  })
})

describe('delivering', () => {
  it('sends to every device the person has consented on', async () => {
    mocks.subFindMany.mockResolvedValue([subscription('sub-1'), subscription('sub-2')])

    const result = await pushToUser('user-1', { title: 'Overdue', body: 'Two rooms' })

    expect(result.sent).toBe(2)
    expect(mocks.sendNotification).toHaveBeenCalledTimes(2)
  })

  it('sends the payload the service worker expects', async () => {
    await pushToUser('user-1', { title: 'Overdue', body: 'Two rooms', url: '/diary', tag: 't' })

    const [target, body] = mocks.sendNotification.mock.calls[0]
    expect(target.endpoint).toBe('https://push.example/sub-1')
    expect(JSON.parse(body)).toEqual({
      title: 'Overdue',
      body: 'Two rooms',
      url: '/diary',
      tag: 't',
    })
  })

  it('expires the message, because work due today is worthless tomorrow', async () => {
    await pushToUser('user-1', { title: 'x', body: 'y' })

    const options = mocks.sendNotification.mock.calls[0][2]
    expect(options.TTL).toBeGreaterThan(0)
    expect(options.TTL).toBeLessThanOrEqual(24 * 60 * 60)
  })

  it('does nothing when the person has no devices', async () => {
    mocks.subFindMany.mockResolvedValue([])

    expect(await pushToUser('user-1', { title: 'x', body: 'y' })).toEqual({
      sent: 0,
      expired: 0,
      failed: 0,
    })
    expect(mocks.sendNotification).not.toHaveBeenCalled()
  })

  it('only reads its own subscriptions', async () => {
    await pushToUser('user-1', { title: 'x', body: 'y' })
    expect(mocks.subFindMany.mock.calls[0][0].where).toEqual({ userId: 'user-1' })
  })
})

describe('when a device stops answering', () => {
  it('deletes a subscription the push service says is gone', async () => {
    // 404 and 410 are permanent: the browser was uninstalled, the permission
    // revoked, the profile wiped. Keeping the row means retrying it forever.
    for (const status of [404, 410]) {
      vi.clearAllMocks()
      mocks.subFindMany.mockResolvedValue([subscription('sub-1')])
      mocks.sendNotification.mockRejectedValue(httpError(status))

      const result = await pushToUser('user-1', { title: 'x', body: 'y' })

      expect(result.expired, String(status)).toBe(1)
      expect(mocks.subDelete).toHaveBeenCalledWith({ where: { id: 'sub-1' } })
    }
  })

  it('keeps a subscription that failed for a transient reason', async () => {
    mocks.sendNotification.mockRejectedValue(httpError(500))

    const result = await pushToUser('user-1', { title: 'x', body: 'y' })

    expect(result.failed).toBe(1)
    expect(mocks.subDelete).not.toHaveBeenCalled()
    expect(mocks.subUpdate.mock.calls[0][0].data).toEqual({ failureCount: { increment: 1 } })
  })

  it('lets the other devices through when one fails', async () => {
    // A dead endpoint on an old phone must not stop the notification reaching
    // the tablet somebody is actually holding.
    mocks.subFindMany.mockResolvedValue([subscription('dead'), subscription('live')])
    mocks.sendNotification
      .mockRejectedValueOnce(httpError(410))
      .mockResolvedValueOnce({})

    const result = await pushToUser('user-1', { title: 'x', body: 'y' })

    expect(result.expired).toBe(1)
    expect(result.sent).toBe(1)
  })

  it('resets the failure count after a success', async () => {
    await pushToUser('user-1', { title: 'x', body: 'y' })
    expect(mocks.subUpdate.mock.calls[0][0].data.failureCount).toBe(0)
  })

  it('survives the cleanup itself failing', async () => {
    mocks.sendNotification.mockRejectedValue(httpError(410))
    mocks.subDelete.mockRejectedValue(new Error('database down'))

    await expect(pushToUser('user-1', { title: 'x', body: 'y' })).resolves.toMatchObject({
      expired: 1,
    })
  })
})

describe('pushing to several people', () => {
  it('totals the results', async () => {
    mocks.subFindMany.mockResolvedValue([subscription('sub-1')])

    const result = await pushToUsers(['a', 'b', 'c'], { title: 'x', body: 'y' })

    expect(result.sent).toBe(3)
    expect(mocks.subFindMany).toHaveBeenCalledTimes(3)
  })
})
