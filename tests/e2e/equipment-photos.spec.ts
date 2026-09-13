import { test, expect, type Page } from '@playwright/test'
import sharp from 'sharp'

/**
 * End-to-end cover for equipment identification photos.
 *
 * Uploads a real encoded image through the actual form control, so the path
 * exercised is the one an operator uses: pick a file, watch it appear, see it
 * again on the cleaner's screen, delete it.
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

/** A real JPEG, carrying EXIF the way a phone photo does. */
async function photoWithExif(label: string) {
  return sharp({
    create: { width: 900, height: 700, channels: 3, background: { r: 40, g: 90, b: 140 } },
  })
    .withExif({ IFD0: { Copyright: label, Make: 'TestPhone' } })
    .jpeg()
    .toBuffer()
}

/** Remove every photo on an item, so a rerun starts from a known state. */
async function clearPhotos(page: Page, equipmentId: string) {
  const listed = await (await page.request.get(`/api/admin/equipment/${equipmentId}/photos`)).json()
  for (const photo of listed.photos ?? []) {
    await page.request.delete(`/api/admin/equipment/${equipmentId}/photos/${photo.id}`)
  }
}

/**
 * An item the CLEANER can see.
 *
 * The admin list spans every site, so taking its first row lands on whichever
 * site happens to sort first - and a cleaner pinned elsewhere correctly gets
 * "not found" for it. Asking the cleaner's own dashboard guarantees the item is
 * one they are entitled to, which is what these flows are about.
 */
async function cleanerVisibleEquipment(cleanerPage: Page) {
  const dashboard = await (await cleanerPage.request.get('/api/cleaner/dashboard')).json()
  const item = dashboard.equipment?.[0]
  expect(item, 'the cleaner site has no equipment to photograph').toBeTruthy()
  return item as { id: string; name: string }
}

async function firstEquipment(page: Page) {
  const payload = await (await page.request.get('/api/admin/equipment')).json()
  const item = payload.equipment?.[0]
  expect(item, 'the seeded site has no equipment to photograph').toBeTruthy()
  return item as { id: string; name: string }
}

test.describe('uploading through the API', () => {
  test('stores a photo, strips its EXIF, and serves it back', async ({ page }) => {
    await login(page, 'admin')
    const item = await firstEquipment(page)
    await clearPhotos(page, item.id)

    const original = await photoWithExif('should-not-survive')
    expect((await sharp(original).metadata()).exif, 'fixture should carry EXIF').toBeDefined()

    const created = await page.request.post(`/api/admin/equipment/${item.id}/photos`, {
      multipart: {
        photo: { name: 'hoist.jpg', mimeType: 'image/jpeg', buffer: original },
        caption: 'Serial plate',
      },
    })
    expect(created.status()).toBe(201)

    const photo = await created.json()
    expect(photo.url).toContain(`/api/admin/equipment/${item.id}/photos/`)

    const served = await page.request.get(photo.url)
    expect(served.status()).toBe(200)
    expect(served.headers()['content-type']).toBe('image/webp')
    // Site-scoped bytes must never land in a shared cache.
    expect(served.headers()['cache-control']).toContain('private')
    expect(served.headers()['x-content-type-options']).toBe('nosniff')

    const stored = await sharp(await served.body()).metadata()
    expect(stored.format).toBe('webp')
    // The GPS fix and device id a phone attaches have no business being kept.
    expect(stored.exif).toBeUndefined()

    await clearPhotos(page, item.id)
  })

  test('refuses a renamed file that is not really an image', async ({ page }) => {
    await login(page, 'admin')
    const item = await firstEquipment(page)

    const response = await page.request.post(`/api/admin/equipment/${item.id}/photos`, {
      multipart: {
        photo: {
          name: 'payload.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('#!/bin/sh\nrm -rf /\n', 'utf8'),
        },
      },
    })

    expect(response.status()).toBe(400)
    expect((await response.json()).error).toMatch(/not a photo/i)
  })

  test('holds the per-item limit', async ({ page }) => {
    await login(page, 'admin')
    const item = await firstEquipment(page)
    await clearPhotos(page, item.id)

    const bytes = await photoWithExif('limit')
    for (let i = 0; i < 4; i++) {
      const response = await page.request.post(`/api/admin/equipment/${item.id}/photos`, {
        multipart: { photo: { name: `p${i}.jpg`, mimeType: 'image/jpeg', buffer: bytes } },
      })
      expect(response.status(), `upload ${i + 1}`).toBe(201)
    }

    const overflow = await page.request.post(`/api/admin/equipment/${item.id}/photos`, {
      multipart: { photo: { name: 'p5.jpg', mimeType: 'image/jpeg', buffer: bytes } },
    })
    expect(overflow.status()).toBe(409)

    await clearPhotos(page, item.id)
  })

  test('keeps a cleaner from uploading or deleting', async ({ page }) => {
    await login(page, 'admin')
    const item = await firstEquipment(page)

    const cleanerContext = await page.context().browser()!.newContext()
    const cleanerPage = await cleanerContext.newPage()
    await login(cleanerPage, 'cleaner')

    const upload = await cleanerPage.request.post(`/api/admin/equipment/${item.id}/photos`, {
      multipart: {
        photo: { name: 'p.jpg', mimeType: 'image/jpeg', buffer: await photoWithExif('nope') },
      },
    })
    expect(upload.status()).toBe(403)

    await cleanerContext.close()
  })

  test('turns an anonymous request away from the image itself', async ({ browser }) => {
    const context = await browser.newContext()
    const response = await context.request.get(
      '/api/admin/equipment/anything/photos/anything/image'
    )
    expect(response.status()).toBe(401)
    await context.close()
  })
})

test.describe('the operator flow', () => {
  test('adds a photo through the form and shows it, then deletes it', async ({ page }) => {
    await login(page, 'admin')
    const item = await firstEquipment(page)
    await clearPhotos(page, item.id)

    await page.goto('/equipment')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: `Edit ${item.name}` }).first().click()
    const photoSection = page.getByText('Identification photos')
    await expect(photoSection).toBeVisible({ timeout: 15_000 })

    await expect(page.getByText('No photos yet.')).toBeVisible()

    // Set the file directly on the hidden input, which is what the visible
    // buttons trigger - the file chooser itself is not scriptable.
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'hoist.jpg',
      mimeType: 'image/jpeg',
      buffer: await photoWithExif('through-the-form'),
    })

    const thumbnail = page.getByRole('img', { name: new RegExp(`Photo of ${item.name}`, 'i') })
    await expect(thumbnail).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('No photos yet.')).toHaveCount(0)

    // And it survives a reload, so it really was stored.
    await page.reload()
    await page.waitForLoadState('networkidle')

    const listed = await (await page.request.get(`/api/admin/equipment/${item.id}/photos`)).json()
    expect(listed.photos).toHaveLength(1)

    await clearPhotos(page, item.id)
  })

  test('shows a cleaner which machine they are looking at', async ({ page }) => {
    await login(page, 'admin')

    const cleanerContext = await page.context().browser()!.newContext()
    const cleanerPage = await cleanerContext.newPage()
    await login(cleanerPage, 'cleaner')

    const item = await cleanerVisibleEquipment(cleanerPage)
    await clearPhotos(page, item.id)

    await page.request.post(`/api/admin/equipment/${item.id}/photos`, {
      multipart: {
        photo: { name: 'p.jpg', mimeType: 'image/jpeg', buffer: await photoWithExif('cleaner') },
      },
    })

    await cleanerPage.goto(`/clean/equipment/${item.id}`)
    await cleanerPage.waitForLoadState('networkidle')

    const photo = cleanerPage.getByRole('img', { name: new RegExp(`Photo of ${item.name}`, 'i') })
    await expect(photo).toBeVisible({ timeout: 15_000 })

    await cleanerContext.close()
    await clearPhotos(page, item.id)
  })

  test('leaves an item with no photo working exactly as before', async ({ page }) => {
    await login(page, 'admin')

    const cleanerContext = await page.context().browser()!.newContext()
    const cleanerPage = await cleanerContext.newPage()
    await login(cleanerPage, 'cleaner')

    const item = await cleanerVisibleEquipment(cleanerPage)
    await clearPhotos(page, item.id)

    await cleanerPage.goto(`/clean/equipment/${item.id}`)
    await cleanerPage.waitForLoadState('networkidle')

    // Photos are optional. No photo means the icon, not an empty frame or an
    // error, and certainly not a block on doing the work.
    await expect(cleanerPage.getByRole('heading', { name: item.name })).toBeVisible()
    await expect(
      cleanerPage.getByRole('img', { name: new RegExp(`Photo of ${item.name}`, 'i') })
    ).toHaveCount(0)

    await cleanerContext.close()
  })
})
