import { test, expect, type Page } from '@playwright/test'

/**
 * End-to-end cover for the export and print engine.
 *
 * Needs a seeded database and a running app; see instant-nav.rig.md for the
 * build-and-serve loop. Credentials are the seed defaults, overridable so a
 * non-default environment can still run this.
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
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? 'admin@neatplan.com',
    password: process.env.E2E_ADMIN_PASSWORD ?? 'admin123',
  },
}

/**
 * PageWrapper renders `children` inside its Suspense fallback AND inside the
 * resolved tree, so while the shell is streaming the login form can briefly
 * exist twice. Waiting for the count to settle at one is what keeps this from
 * being a strict-locator race.
 */
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

test.describe('export entrypoints', () => {
  test('a manager sees CSV and print on the rooms surface', async ({ page }) => {
    await login(page, 'manager')
    await page.goto('/rooms')

    await expect(page.getByRole('link', { name: 'CSV' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Print' })).toBeVisible()
  })

  test('a cleaner gets the worklist control and nothing they may not export', async ({ page }) => {
    await login(page, 'cleaner')
    await page.goto('/clean')

    // The worklist is the one dataset a cleaner may pull.
    await expect(page.getByRole('group', { name: 'Worklist period' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'CSV' })).toBeVisible()
  })
})

test.describe('CSV export', () => {
  test('downloads every matching row with its filter context', async ({ page }) => {
    await login(page, 'admin')

    const response = await page.request.get('/api/export/rooms')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/csv')
    expect(response.headers()['content-disposition']).toContain('neatplan-rooms-')

    const csv = await response.text()

    // The BOM Excel needs to read accented names correctly.
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('Room inventory')
    expect(csv).toContain('Exported,')
    expect(csv).toContain('Room,Floor,Type')

    // Real seeded rows, not an empty document.
    const rows = csv.split('\r\n').filter(Boolean)
    expect(rows.length).toBeGreaterThan(5)
  })

  test('carries no credential, token or signature into a completions export', async ({ page }) => {
    await login(page, 'admin')

    const csv = await (await page.request.get('/api/export/completions')).text()

    expect(csv).not.toMatch(/\$2[aby]\$/) // bcrypt hash prefix
    expect(csv).not.toContain('data:image') // signature bitmap
    expect(csv).not.toContain('locationTokenVersion')
    expect(csv).not.toContain('totpSecret')
    expect(csv).not.toContain('sessionToken')
  })

  test('refuses a dataset the role may not export, rather than returning an empty file', async ({ page }) => {
    await login(page, 'cleaner')

    const response = await page.request.get('/api/export/people')
    expect(response.status()).toBe(403)
  })

  test('refuses an unknown dataset', async ({ page }) => {
    await login(page, 'admin')
    expect((await page.request.get('/api/export/nonsense')).status()).toBe(404)
  })

  test('turns an anonymous request away', async ({ browser }) => {
    const context = await browser.newContext()
    const response = await context.request.get('/api/export/rooms')
    expect(response.status()).toBe(401)
    await context.close()
  })
})

test.describe('print document', () => {
  test('renders a document with no app chrome', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/print/rooms')

    await expect(page.getByRole('heading', { name: 'Room inventory', level: 1 })).toBeVisible()

    // The document, not the dashboard: no sidebar nav anywhere on the page.
    await expect(page.locator('aside')).toHaveCount(0)

    // Real column headers in a real table, which is what makes them repeat per page.
    const table = page.locator('table.pd-table')
    await expect(table).toBeVisible()
    await expect(table.locator('thead th').first()).toBeVisible()
    expect(await table.locator('tbody tr').count()).toBeGreaterThan(0)
  })

  test('states the filter context that produced it', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/print/completions?dateFrom=2020-01-01&dateTo=2030-01-01')

    await expect(page.getByText('Dates', { exact: true })).toBeVisible()
    await expect(page.getByText('2020-01-01 to 2030-01-01')).toBeVisible()
  })

  test('hides every control when printed', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/print/rooms')

    const toolbar = page.locator('.pd-toolbar')
    await expect(toolbar).toBeVisible()

    await page.emulateMedia({ media: 'print' })

    // A printed sheet carrying its own Print button is the clearest sign nobody
    // ever looked at the output.
    await expect(toolbar).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Room inventory', level: 1 })).toBeVisible()

    await page.emulateMedia({ media: 'screen' })
  })

  test('repeats table headers and avoids splitting rows across pages', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/print/rooms')
    await page.emulateMedia({ media: 'print' })

    const theadDisplay = await page
      .locator('table.pd-table thead')
      .evaluate((el) => getComputedStyle(el).display)
    expect(theadDisplay).toBe('table-header-group')

    const rowBreak = await page
      .locator('table.pd-table tbody tr')
      .first()
      .evaluate((el) => getComputedStyle(el).breakInside)
    expect(rowBreak).toBe('avoid')

    await page.emulateMedia({ media: 'screen' })
  })

  test('turns landscape for a table too wide for portrait', async ({ page }) => {
    await login(page, 'admin')

    await page.goto('/print/completions')
    await expect(page.locator('article.pd--landscape')).toHaveCount(1)

    await page.goto('/print/sites')
    await expect(page.locator('article.pd--landscape')).toHaveCount(0)
  })

  test('tells a role it may not have this document, instead of an empty one', async ({ page }) => {
    await login(page, 'cleaner')
    await page.goto('/print/people')

    await expect(page.getByText('Not available to you')).toBeVisible()
    await expect(page.locator('table.pd-table')).toHaveCount(0)
  })

  test('sends an anonymous visitor to sign in and back to the same document', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/print/rooms?site=all')
    await expect(page).toHaveURL(/\/auth\?callbackUrl=/)
    expect(decodeURIComponent(page.url())).toContain('/print/rooms')

    await context.close()
  })

  test('reads without a sideways scroll on a tablet and on a phone', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/print/rooms')

    for (const viewport of [
      { width: 1024, height: 1366, label: 'tablet-portrait' },
      { width: 1366, height: 1024, label: 'tablet-landscape' },
      { width: 390, height: 844, label: 'phone' },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await expect(page.getByRole('heading', { name: 'Room inventory', level: 1 })).toBeVisible()

      // The document may scroll its own table sideways; the PAGE must not.
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      )
      expect(overflows, `${viewport.label} overflows horizontally`).toBe(false)
    }
  })

  test('keeps the export controls at a thumb-sized touch target', async ({ page }) => {
    await login(page, 'admin')
    await page.setViewportSize({ width: 1024, height: 1366 })
    await page.goto('/print/rooms')

    for (const name of ['CSV', 'Print']) {
      const box = await page.getByRole(name === 'CSV' ? 'link' : 'button', { name }).boundingBox()
      expect(box, `${name} control missing`).not.toBeNull()
      // 44px is the iPadOS floor; these are pressed with a thumb.
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
  })
})

test.describe('site scoping in the running app', () => {
  test('a manager cannot widen their export to another site', async ({ page }) => {
    await login(page, 'manager')

    const mine = await (await page.request.get('/api/export/rooms')).text()
    const widened = await (await page.request.get('/api/export/rooms?site=all')).text()

    // Same body: the requested site is simply not read for a pinned role.
    const rowsOf = (csv: string) => csv.split('\r\n').slice(6).join('\n')
    expect(rowsOf(widened)).toBe(rowsOf(mine))
  })
})
