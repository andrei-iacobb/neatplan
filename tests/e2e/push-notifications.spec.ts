import { test, expect, type Page } from '@playwright/test'

/**
 * End-to-end cover for push notifications.
 *
 * This deployment has no VAPID keys, which is the useful case to assert: the
 * feature has to be honestly unavailable rather than half working. A switch that
 * moves and saves a value nothing reads is exactly what this change removes, so
 * the tests are mostly about what is NOT offered.
 */
const CREDENTIALS = {
  manager: {
    email: process.env.E2E_MANAGER_EMAIL ?? 'manager@neatplan.com',
    password: process.env.E2E_MANAGER_PASSWORD ?? 'manager123',
  },
  cleaner: {
    email: process.env.E2E_CLEANER_EMAIL ?? 'cleaner@neatplan.com',
    password: process.env.E2E_CLEANER_PASSWORD ?? 'cleaner123',
  },
}

async function login(page: Page, who: keyof typeof CREDENTIALS = 'manager') {
  const { email, password } = CREDENTIALS[who]
  await page.goto('/auth')

  const emailField = page.locator('#login-email')
  await expect(emailField).toHaveCount(1, { timeout: 15_000 })
  await emailField.fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 20_000 })
}

test.describe('what the server reports', () => {
  test('says push is unconfigured rather than pretending otherwise', async ({ page }) => {
    await login(page)

    const response = await page.request.get('/api/push/subscribe')
    expect(response.status()).toBe(200)

    const data = await response.json()
    // No VAPID keys on this deployment.
    expect(data.configured).toBe(false)
    expect(data.publicKey).toBeNull()
  })

  test('refuses a subscription when it cannot deliver, and says why', async ({ page }) => {
    await login(page)

    const response = await page.request.post('/api/push/subscribe', {
      data: {
        endpoint: 'https://push.example.com/endpoint-abc',
        keys: { p256dh: 'key', auth: 'auth' },
      },
    })

    // Storing a subscription that can never be delivered to would be the same
    // fake-active state this change removes.
    expect(response.status()).toBe(503)
    expect((await response.json()).error).toMatch(/not set up/i)
  })

  test('turns an anonymous request away', async ({ browser }) => {
    const context = await browser.newContext()

    expect((await context.request.get('/api/push/subscribe')).status()).toBe(401)
    expect(
      (
        await context.request.post('/api/push/subscribe', {
          data: { endpoint: 'https://push.example.com/x', keys: { p256dh: 'a', auth: 'b' } },
        })
      ).status()
    ).toBe(401)
    expect((await context.request.delete('/api/push/subscribe')).status()).toBe(401)

    await context.close()
  })

  test('refuses a malformed subscription', async ({ page }) => {
    await login(page)

    for (const bad of [
      {},
      { endpoint: 'not-a-url', keys: { p256dh: 'a', auth: 'b' } },
      { endpoint: 'https://push.example.com/x' },
      { endpoint: 'https://push.example.com/x', keys: { p256dh: 'a' } },
    ]) {
      const response = await page.request.post('/api/push/subscribe', { data: bad })
      // 503 when push is off entirely, 400 when the body is the problem. Either
      // way nothing is stored.
      expect([400, 503]).toContain(response.status())
    }
  })

  test('lets anyone remove their own subscriptions without error', async ({ page }) => {
    await login(page, 'cleaner')

    // Idempotent: turning it off on a device you no longer have should not fail.
    const response = await page.request.delete('/api/push/subscribe')
    expect(response.status()).toBe(200)
    expect((await response.json()).removed).toBe(0)
  })
})

test.describe('what the settings page shows', () => {
  test('explains that push is not set up, and offers no switch', async ({ page }) => {
    await login(page)
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Notifications' }).click()

    await expect(page.getByText('Push notifications', { exact: true })).toBeVisible()
    await expect(page.getByText(/Not set up on this server/i)).toBeVisible()
    await expect(page.getByText('Unavailable', { exact: true })).toBeVisible()

    // The point of the change: no control that moves and does nothing.
    await expect(page.getByRole('switch', { name: 'Push notifications' })).toHaveCount(0)
  })

  test('no longer stores push as a preference that nothing reads', async ({ page }) => {
    await login(page)
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Notifications' }).click()

    // The old toggle was rendered from the settings object alongside the others.
    // Only one "Push notifications" row should exist now, and it is the real one.
    await expect(page.getByText('Push notifications', { exact: true })).toHaveCount(1)
  })
})

test.describe('the service worker', () => {
  test('is served and handles push and clicks', async ({ page }) => {
    await login(page)

    const response = await page.request.get('/sw.js')
    expect(response.status()).toBe(200)

    const source = await response.text()
    // Without these the subscription would be accepted and nothing would ever
    // appear on the device.
    expect(source).toContain("addEventListener('push'")
    expect(source).toContain("addEventListener('notificationclick'")
    // A push service can rotate a subscription unprompted; without this the
    // endpoint silently dies while the user believes they are subscribed.
    expect(source).toContain("addEventListener('pushsubscriptionchange'")
  })

  test('points its notification icon at an asset that exists', async ({ page }) => {
    const source = await (await page.request.get('/sw.js')).text()
    const match = source.match(/icon: '([^']+)'/)
    expect(match).not.toBeNull()

    expect((await page.request.get(match![1])).status()).toBe(200)
  })

  test('registers in a real browser', async ({ page }) => {
    await login(page)
    await page.goto('/settings')

    const registered = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      return Boolean(registration.active || registration.installing || registration.waiting)
    })

    expect(registered).toBe(true)
  })
})
