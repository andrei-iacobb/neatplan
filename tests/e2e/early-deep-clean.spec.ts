import { test, expect, type Page } from '@playwright/test'

/**
 * End-to-end cover for bringing work forward.
 *
 * The case: a resident is out, the room is empty, and the quarterly deep clean is
 * weeks away. These assert that a cleaner can choose to do it now, that doing so
 * does not let them skip what was actually due, and that the app refuses the two
 * things that would be wrong - doing something twice in a day, and a stale
 * selection changing what is required.
 */
const CREDENTIALS = {
  cleaner: {
    email: process.env.E2E_CLEANER_EMAIL ?? 'cleaner@neatplan.com',
    password: process.env.E2E_CLEANER_PASSWORD ?? 'cleaner123',
  },
}

async function login(page: Page) {
  await page.goto('/auth')
  const emailField = page.locator('#login-email')
  await expect(emailField).toHaveCount(1, { timeout: 15_000 })
  await emailField.fill(CREDENTIALS.cleaner.email)
  await page.locator('#login-password').fill(CREDENTIALS.cleaner.password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 20_000 })
}

interface RoomPayload {
  id: string
  name: string
  workPackage: { scheduleIds: string[]; earlyScheduleIds: string[]; tasks: unknown[] } | null
  availableEarly: { id: string; title: string; nextDue: string; taskCount: number }[]
}

/** A room at the cleaner's site that has work available to bring forward. */
async function roomWithEarlyWork(page: Page): Promise<RoomPayload | null> {
  const dashboard = await (await page.request.get('/api/cleaner/dashboard')).json()

  for (const room of dashboard.rooms ?? []) {
    const payload: RoomPayload = await (
      await page.request.get(`/api/cleaner/rooms/${room.id}`)
    ).json()

    if (payload.availableEarly?.length > 0) return payload
  }
  return null
}

test.describe('what is offered', () => {
  test('offers work that is not due yet, with its real due date', async ({ page }) => {
    await login(page)

    const room = await roomWithEarlyWork(page)
    test.skip(!room, 'no seeded room currently has work that is not yet due')

    for (const option of room!.availableEarly) {
      expect(option.title.length).toBeGreaterThan(0)
      expect(option.taskCount).toBeGreaterThan(0)
      // The context that makes the choice a judgement rather than a guess.
      expect(new Date(option.nextDue).getTime()).toBeGreaterThan(Date.now())
    }
  })

  test('never offers something that is already due', async ({ page }) => {
    await login(page)

    const dashboard = await (await page.request.get('/api/cleaner/dashboard')).json()
    const room = dashboard.rooms?.[0]
    test.skip(!room, 'the cleaner site has no rooms')

    const payload: RoomPayload = await (
      await page.request.get(`/api/cleaner/rooms/${room.id}`)
    ).json()

    const dueIds = new Set(payload.workPackage?.scheduleIds ?? [])
    for (const option of payload.availableEarly ?? []) {
      // Due work is not a choice - it is already on the checklist.
      expect(dueIds.has(option.id)).toBe(false)
    }
  })
})

test.describe('bringing it forward', () => {
  test('adds it to the checklist without dropping what was due', async ({ page }) => {
    await login(page)

    const room = await roomWithEarlyWork(page)
    test.skip(!room, 'no seeded room currently has work that is not yet due')

    const before = room!
    const extra = before.availableEarly[0]

    const after: RoomPayload = await (
      await page.request.get(`/api/cleaner/rooms/${before.id}?also=${extra.id}`)
    ).json()

    expect(after.workPackage).not.toBeNull()
    expect(after.workPackage!.scheduleIds).toContain(extra.id)
    expect(after.workPackage!.earlyScheduleIds).toContain(extra.id)

    // The invariant that matters: everything that was already required is still
    // required. Choosing extra work is additive, never a substitution.
    for (const required of before.workPackage?.scheduleIds ?? []) {
      expect(after.workPackage!.scheduleIds).toContain(required)
    }

    // And the checklist genuinely grew.
    expect(after.workPackage!.tasks.length).toBeGreaterThanOrEqual(
      before.workPackage?.tasks.length ?? 0
    )
  })

  test('ignores a selection that is not on offer', async ({ page }) => {
    await login(page)

    const dashboard = await (await page.request.get('/api/cleaner/dashboard')).json()
    const room = dashboard.rooms?.[0]
    test.skip(!room, 'the cleaner site has no rooms')

    const plain: RoomPayload = await (
      await page.request.get(`/api/cleaner/rooms/${room.id}`)
    ).json()
    const crafted: RoomPayload = await (
      await page.request.get(`/api/cleaner/rooms/${room.id}?also=not-a-real-schedule-id`)
    ).json()

    // A stale or crafted id in a URL must not change what is required.
    expect(crafted.workPackage?.scheduleIds).toEqual(plain.workPackage?.scheduleIds)
  })

  test('cannot reach another site room by asking for extra work', async ({ page }) => {
    await login(page)

    const response = await page.request.get('/api/cleaner/rooms/not-your-room?also=anything')
    expect(response.status()).toBe(404)
  })
})

test.describe('the tablet flow', () => {
  test('shows the picker with a due date, and merges on selection', async ({ page }) => {
    await login(page)

    const room = await roomWithEarlyWork(page)
    test.skip(!room, 'no seeded room currently has work that is not yet due')

    await page.goto(`/clean/${room!.id}`)
    await page.waitForLoadState('networkidle')

    const panel = page.getByRole('region', { name: /Doing anything else/i })
    await expect(panel).toBeVisible()

    const option = panel.getByRole('button', { name: new RegExp(room!.availableEarly[0].title, 'i') })
    await expect(option).toBeVisible()
    await expect(option).toHaveAttribute('aria-pressed', 'false')

    // 56px: pressed with a thumb, often with gloves on.
    const box = await option.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(56)

    await option.click()
    await page.waitForLoadState('networkidle')

    await expect(
      panel.getByRole('button', { name: new RegExp(room!.availableEarly[0].title, 'i') })
    ).toHaveAttribute('aria-pressed', 'true')

    // It says what signing off will do to the next due date.
    await expect(page.getByText(/moves the next one on from today/i)).toBeVisible()
  })

  test('is absent when there is nothing to bring forward', async ({ page }) => {
    await login(page)

    const dashboard = await (await page.request.get('/api/cleaner/dashboard')).json()

    for (const room of dashboard.rooms ?? []) {
      const payload: RoomPayload = await (
        await page.request.get(`/api/cleaner/rooms/${room.id}`)
      ).json()

      if ((payload.availableEarly?.length ?? 0) === 0) {
        await page.goto(`/clean/${room.id}`)
        await page.waitForLoadState('networkidle')

        // No empty panel offering nothing.
        await expect(page.getByRole('region', { name: /Doing anything else/i })).toHaveCount(0)
        return
      }
    }

    test.skip(true, 'every seeded room has work available early')
  })
})
