import { test, expect, type Page } from '@playwright/test'
import jsQR from 'jsqr'

/**
 * End-to-end cover for QR labels, the scan flow and revocation.
 *
 * The centrepiece is `decodeFirstLabel`: it reads the QR actually rendered in the
 * browser, decodes it with a real decoder, and then follows the address it
 * contains. That is the only way to show the loop genuinely closes - a label
 * whose code does not resolve to its own room is worthless no matter how good it
 * looks on screen.
 */
const CREDENTIALS = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? 'admin@neatplan.com',
    password: process.env.E2E_ADMIN_PASSWORD ?? 'admin123',
  },
  cleaner: {
    email: process.env.E2E_CLEANER_EMAIL ?? 'cleaner@neatplan.com',
    password: process.env.E2E_CLEANER_PASSWORD ?? 'cleaner123',
  },
  manager: {
    email: process.env.E2E_MANAGER_EMAIL ?? 'manager@neatplan.com',
    password: process.env.E2E_MANAGER_PASSWORD ?? 'manager123',
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

/** Wait for the hydration handoff, as in the export spec. */
async function settled(page: Page) {
  await page.waitForLoadState('networkidle')
  await expect(page.locator('.pd-shell')).toHaveCount(1, { timeout: 15_000 })
}

interface DecodedLabel {
  url: string
  name: string
  code: string
}

/**
 * Read the nth rendered label, decode its QR, and return what a camera would see.
 */
async function decodeLabel(page: Page, index = 0): Promise<DecodedLabel> {
  const label = page.locator('.lb').nth(index)
  await expect(label).toBeVisible()

  const { d, size } = await label.locator('svg path').evaluate((path) => ({
    d: path.getAttribute('d') ?? '',
    size: Number(
      (path.closest('svg')?.getAttribute('viewBox') ?? '0 0 1 1').split(' ')[2]
    ),
  }))

  const scale = 4
  const quiet = 4
  const side = (size + quiet * 2) * scale
  const pixels = new Uint8ClampedArray(side * side * 4).fill(255)

  for (const [, xs, ys, ws] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    const x0 = Number(xs)
    const y0 = Number(ys)
    for (let moduleX = x0; moduleX < x0 + Number(ws); moduleX++) {
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const px = (((y0 + quiet) * scale + y) * side + ((moduleX + quiet) * scale + x)) * 4
          pixels[px] = 0
          pixels[px + 1] = 0
          pixels[px + 2] = 0
        }
      }
    }
  }

  const decoded = jsQR(pixels, side, side)
  expect(decoded, 'the rendered QR could not be decoded').not.toBeNull()

  return {
    url: decoded!.data,
    name: (await label.locator('.lb__name').textContent())?.trim() ?? '',
    code: (await label.locator('.lb__code').textContent())?.replace('Code', '').trim() ?? '',
  }
}

test.describe('label sheets', () => {
  test('renders labels a real decoder can read', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/print/labels?kind=room')
    await settled(page)

    await expect(page.getByRole('heading', { name: 'Location labels', level: 1 })).toBeVisible()
    expect(await page.locator('.lb').count()).toBeGreaterThan(0)

    const label = await decodeLabel(page)
    expect(label.url).toContain('/c/')
    expect(label.name.length).toBeGreaterThan(0)
    expect(label.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/)
  })

  test('a scan of a rendered label opens that exact room', async ({ page, baseURL }) => {
    await login(page, 'cleaner')

    // Print as a manager, scan as the cleaner - which is how it works in the building.
    const managerPage = await page.context().browser()!.newPage()
    await managerPage.goto(`${baseURL}/auth`)
    await managerPage.locator('#login-email').fill(CREDENTIALS.admin.email)
    await managerPage.locator('#login-password').fill(CREDENTIALS.admin.password)
    await managerPage.getByRole('button', { name: /sign in/i }).click()
    await managerPage.waitForURL((url) => !url.pathname.startsWith('/auth'))
    await managerPage.goto(`${baseURL}/print/labels?kind=room`)
    await settled(managerPage)

    const label = await decodeLabel(managerPage)
    await managerPage.close()

    // Follow the decoded address on the cleaner's own session, the way a camera would.
    const path = new URL(label.url).pathname
    await page.goto(path)

    await expect(page).toHaveURL(/\/clean\/[^/?]+\?checkIn=/)
    await expect(page.getByText(label.name, { exact: false }).first()).toBeVisible()
  })

  test('keeps label printing out of a cleaner hands', async ({ page }) => {
    await login(page, 'cleaner')
    await page.goto('/print/labels?kind=room')
    await settled(page)

    await expect(page.getByText('Not available to you')).toBeVisible()
    await expect(page.locator('.lb')).toHaveCount(0)
  })

  test('hides the controls and the NFC toggle when printed', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/print/labels?kind=room')
    await settled(page)

    await expect(page.locator('.pd-toolbar')).toBeVisible()
    await page.emulateMedia({ media: 'print' })

    await expect(page.locator('.pd-toolbar')).toBeHidden()
    await expect(page.locator('.pd-nfc-toggle')).toBeHidden()
    await expect(page.locator('.lb').first()).toBeVisible()

    await page.emulateMedia({ media: 'screen' })
  })

  test('offers the NFC addresses as a separate sheet, off by default', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/print/labels?kind=room')
    await settled(page)

    await expect(page.getByRole('heading', { name: 'NFC tag addresses' })).toHaveCount(0)

    await page.getByRole('link', { name: /NFC writing sheet/i }).click()
    await settled(page)

    await expect(page.getByRole('heading', { name: 'NFC tag addresses' })).toBeVisible()
    // The address on the writing sheet has to be the same one in the QR.
    await expect(page.locator('.pd-table').getByText(/\/c\//).first()).toBeVisible()
  })

  test('keeps a label whole rather than splitting it across a page', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/print/labels?kind=room')
    await settled(page)
    await page.emulateMedia({ media: 'print' })

    const breakInside = await page
      .locator('.lb')
      .first()
      .evaluate((el) => getComputedStyle(el).breakInside)
    expect(breakInside).toBe('avoid')

    await page.emulateMedia({ media: 'screen' })
  })
})

test.describe('scanning', () => {
  test('sends an anonymous scan through sign-in and back to the same label', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/c/some-token-value')
    await expect(page).toHaveURL(/\/auth\?callbackUrl=/)
    expect(decodeURIComponent(page.url())).toContain('/c/some-token-value')

    await context.close()
  })

  test('refuses a forged token without saying why', async ({ page }) => {
    await login(page, 'cleaner')
    await page.goto('/c/bm90LWEtcmVhbC10b2tlbg.AAAAAAAAAAAAAAAAAAAAAA')

    await expect(page.getByText('That code could not be read')).toBeVisible()
    // Every dead end offers a way to carry on working.
    await expect(page.getByRole('link', { name: /Find it by name or code/i })).toBeVisible()
  })

  test('lets a cleaner find a location by its printed code', async ({ page, baseURL }) => {
    await login(page, 'admin')
    await page.goto('/print/labels?kind=room')
    await settled(page)
    const label = await decodeLabel(page)

    const cleanerContext = await page.context().browser()!.newContext()
    const cleanerPage = await cleanerContext.newPage()
    await cleanerPage.goto(`${baseURL}/auth`)
    await cleanerPage.locator('#login-email').fill(CREDENTIALS.cleaner.email)
    await cleanerPage.locator('#login-password').fill(CREDENTIALS.cleaner.password)
    await cleanerPage.getByRole('button', { name: /sign in/i }).click()
    await cleanerPage.waitForURL((url) => !url.pathname.startsWith('/auth'))

    await cleanerPage.goto(`${baseURL}/c`)
    // Typed without the hyphen and in lower case, as somebody reading off a wall would.
    await cleanerPage
      .getByLabel('Search by name, floor or label code')
      .fill(label.code.replace('-', '').toLowerCase())

    await expect(cleanerPage.getByText(label.name, { exact: false }).first()).toBeVisible()
    await cleanerContext.close()
  })
})

test.describe('revocation', () => {
  test('a replaced label stops working, and a fresh one takes over', async ({ page, baseURL }) => {
    await login(page, 'admin')

    // Pick a room and capture the label currently printed for it.
    const rooms = await (await page.request.get('/api/rooms')).json()
    const room = rooms[0]
    expect(room, 'the seeded site has no rooms to label').toBeTruthy()

    await page.goto(`/print/labels?kind=room&ids=${room.id}`)
    await settled(page)
    const original = await decodeLabel(page)

    // It resolves today.
    await page.goto(new URL(original.url).pathname)
    await expect(page).not.toHaveURL(/\/c\//)

    // Replace the label.
    const revoked = await page.request.post('/api/labels/revoke', {
      data: { kind: 'room', ids: [room.id] },
    })
    expect(revoked.status()).toBe(200)
    expect((await revoked.json()).revoked).toBe(1)

    // The sticker on the wall is now dead, and says so rather than failing silently.
    await page.goto(new URL(original.url).pathname)
    await expect(page.getByText('That label has been replaced')).toBeVisible()

    // A freshly printed one works, and carries a different code.
    await page.goto(`/print/labels?kind=room&ids=${room.id}`)
    await settled(page)
    const replacement = await decodeLabel(page)

    expect(replacement.url).not.toBe(original.url)
    expect(replacement.code).not.toBe(original.code)

    await page.goto(new URL(replacement.url).pathname)
    await expect(page).not.toHaveURL(/\/c\//)
  })

  test('a cleaner cannot replace a label', async ({ page }) => {
    await login(page, 'cleaner')

    const response = await page.request.post('/api/labels/revoke', {
      data: { kind: 'room', ids: ['anything'] },
    })
    expect(response.status()).toBe(403)
  })

  test('a manager cannot replace another site labels', async ({ page }) => {
    await login(page, 'admin')
    const sites = await (await page.request.get('/api/sites')).json()
    const otherSite = sites.find((site: { name: string }) => site.name !== 'Maple Care Home')
    test.skip(!otherSite, 'needs a second seeded site')

    const otherRooms = await (await page.request.get(`/api/rooms?site=${otherSite.id}`)).json()
    test.skip(otherRooms.length === 0, 'the second site has no rooms')

    const managerContext = await page.context().browser()!.newContext()
    const managerPage = await managerContext.newPage()
    await managerPage.goto('/auth')
    await managerPage.locator('#login-email').fill(CREDENTIALS.manager.email)
    await managerPage.locator('#login-password').fill(CREDENTIALS.manager.password)
    await managerPage.getByRole('button', { name: /sign in/i }).click()
    await managerPage.waitForURL((url) => !url.pathname.startsWith('/auth'))

    const response = await managerPage.request.post('/api/labels/revoke', {
      data: { kind: 'room', ids: [otherRooms[0].id] },
    })

    // Scoped in the WHERE: accepted, but nothing was theirs to revoke.
    expect(response.status()).toBe(200)
    expect((await response.json()).revoked).toBe(0)

    await managerContext.close()
  })
})
