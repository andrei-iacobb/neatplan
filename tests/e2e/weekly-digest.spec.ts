import { test, expect, type Page } from '@playwright/test'

/**
 * End-to-end cover for the weekly digest.
 *
 * These run against a deployment with no SMTP server configured, which is the
 * point: the assertions are about what does NOT happen. Nothing here can put a
 * message in front of a real person, and the one path that sends anything at all
 * refuses outright when mail is unconfigured rather than failing quietly.
 */
const CREDENTIALS = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? 'admin@neatplan.com',
    password: process.env.E2E_ADMIN_PASSWORD ?? 'admin123',
  },
  manager: {
    email: process.env.E2E_MANAGER_EMAIL ?? 'manager@neatplan.com',
    password: process.env.E2E_MANAGER_PASSWORD ?? 'manager123',
  },
  cleaner: {
    email: process.env.E2E_CLEANER_EMAIL ?? 'cleaner@neatplan.com',
    password: process.env.E2E_CLEANER_PASSWORD ?? 'cleaner123',
  },
}

async function login(page: Page, who: keyof typeof CREDENTIALS) {
  const { email, password } = CREDENTIALS[who]
  await page.goto('/auth')

  const emailField = page.locator('#login-email')
  await expect(emailField).toHaveCount(1, { timeout: 15_000 })
  await emailField.fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 20_000 })
}

test.describe('previewing', () => {
  test('renders a real digest for a site without sending anything', async ({ page }) => {
    await login(page, 'manager')

    const response = await page.request.get('/api/admin/digest/preview')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/html')
    // A preview is a point-in-time render; a cached one would be misleading.
    expect(response.headers()['cache-control']).toContain('no-store')

    const html = await response.text()
    expect(html).toContain('weekly digest')
    expect(html).toContain('Due this week')
    // It says how to stop receiving it, which is what makes an opt-in honest.
    expect(html).toContain('Settings')
  })

  test('names the manager own site, and only that site', async ({ page }) => {
    await login(page, 'manager')

    const html = await (await page.request.get('/api/admin/digest/preview')).text()

    // A pinned role previews their own site whatever they ask for.
    const widened = await (await page.request.get('/api/admin/digest/preview?site=all')).text()
    expect(widened).toBe(html)
  })

  test('asks a site-spanning role which site they mean', async ({ page }) => {
    await login(page, 'admin')

    const response = await page.request.get('/api/admin/digest/preview')
    expect(response.status()).toBe(400)
    expect((await response.json()).error).toMatch(/one site at a time/i)
  })

  test('renders the site an all-sites role asks for', async ({ page }) => {
    await login(page, 'admin')

    const sites = await (await page.request.get('/api/sites')).json()
    expect(sites.length).toBeGreaterThan(0)

    const response = await page.request.get(`/api/admin/digest/preview?site=${sites[0].id}`)
    expect(response.status()).toBe(200)
    expect(await response.text()).toContain(sites[0].name)
  })

  test('keeps a cleaner out', async ({ page }) => {
    await login(page, 'cleaner')
    expect((await page.request.get('/api/admin/digest/preview')).status()).toBe(403)
  })

  test('turns an anonymous request away', async ({ browser }) => {
    const context = await browser.newContext()
    expect((await context.request.get('/api/admin/digest/preview')).status()).toBe(401)
    await context.close()
  })
})

test.describe('the test send', () => {
  test('refuses outright when no mail server is configured', async ({ page }) => {
    await login(page, 'manager')

    const response = await page.request.post('/api/admin/digest/test')

    // This deployment has no SMTP host. The right behaviour is to say so, not to
    // report success for a message that went nowhere.
    expect(response.status()).toBe(503)
    expect((await response.json()).error).toMatch(/not configured/i)
  })

  test('keeps a cleaner out', async ({ page }) => {
    await login(page, 'cleaner')
    expect((await page.request.post('/api/admin/digest/test')).status()).toBe(403)
  })

  test('turns an anonymous request away', async ({ browser }) => {
    const context = await browser.newContext()
    expect((await context.request.post('/api/admin/digest/test')).status()).toBe(401)
    await context.close()
  })
})

test.describe('the switch', () => {
  test('is offered to a manager, and starts off', async ({ page }) => {
    await login(page, 'manager')
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Notifications' }).click()

    await expect(page.getByText('Weekly digest', { exact: true })).toBeVisible()

    // Off until somebody turns it on. Nobody starts receiving a weekly email
    // because a version shipped.
    const toggle = page.getByRole('switch', { name: 'Weekly digest' })
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  test('is not offered to a role that spans every site', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Notifications' }).click()
    await expect(page.getByText('Email', { exact: false }).first()).toBeVisible()

    // Drawing a switch that silently does nothing is the kind of fake setting
    // this work removes rather than adds.
    await expect(page.getByText('Weekly digest', { exact: true })).toHaveCount(0)
  })

  test('reveals the preview and test controls once it is on', async ({ page }) => {
    await login(page, 'manager')
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Notifications' }).click()

    const toggle = page.getByRole('switch', { name: 'Weekly digest' })
    await expect(toggle).toBeVisible()
    await toggle.click()

    await expect(page.getByRole('link', { name: 'Preview' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Send me a test/i })).toBeVisible()
    // The control says where it goes, because that is the reassurance that matters.
    await expect(page.getByText(/your address only/i)).toBeVisible()

    // Put it back, so a rerun starts from the documented default.
    await toggle.click()
    await expect(page.getByRole('link', { name: 'Preview' })).toHaveCount(0)
  })
})

test.describe('reaching the switch without a mouse', () => {
  test('is operable from the keyboard and announces its own state', async ({ page }) => {
    await login(page, 'manager')
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Notifications' }).click()

    const toggle = page.getByRole('switch', { name: 'Weekly digest' })
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')

    // These were bare divs with an onClick: unreachable by keyboard and
    // announced as nothing at all.
    await toggle.focus()
    await page.keyboard.press('Space')
    await expect(toggle).toHaveAttribute('aria-checked', 'true')

    await page.keyboard.press('Enter')
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
  })
})
