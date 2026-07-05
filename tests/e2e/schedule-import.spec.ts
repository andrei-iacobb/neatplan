import { test, expect } from '@playwright/test'
import path from 'path'

/**
 * End-to-end test of the AI schedule import flow with a REAL extraction call:
 * login as admin -> Schedule -> Edit Mode -> upload a schedule image ->
 * editable preview -> Save -> schedule appears -> cleanup via API.
 *
 * Requires the dev server (localhost:3030), the database, and a working AI
 * provider. When SCHEDULE_AI_PROVIDER=ollama (or no OpenAI key is set) it
 * needs Ollama on 127.0.0.1:11434 and Tesseract installed; the suite skips
 * itself when no provider is reachable so CI without AI stays green.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'cleaning-schedule.png')
const EXPECTED_TITLE = 'Bedroom Deep Cleaning Schedule'

async function ollamaReachable(): Promise<boolean> {
  try {
    const res = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

test.describe('AI schedule import (real extraction)', () => {
  test('upload image -> preview -> save -> visible in schedules', async ({ page }) => {
    test.setTimeout(300_000) // local model call can take a couple of minutes cold

    const localAI = process.env.SCHEDULE_AI_PROVIDER !== 'openai'
    if (localAI && !(await ollamaReachable())) {
      test.skip(true, 'Ollama not reachable on 127.0.0.1:11434 - skipping real-extraction e2e')
    }

    // Login as seeded admin
    await page.goto('/auth')
    await page.getByPlaceholder('Email address').fill('admin@neatplan.com')
    await page.getByPlaceholder('Password').fill('admin123')
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60_000 })

    // Schedule page -> Edit Mode -> import section.
    // In dev mode the first click can land before React hydrates the button, so
    // retry the toggle until the import section actually appears.
    await page.goto('/schedule')
    await page.waitForLoadState('networkidle')
    const importHeading = page.getByText('Import from a document')
    await expect(async () => {
      if (!(await importHeading.isVisible())) {
        await page
          .getByRole('button', { name: 'Edit Mode', exact: true })
          .click({ timeout: 2_000 })
          .catch(() => {})
      }
      await expect(importHeading).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 30_000 })

    // Upload the fixture through the hidden file input
    await page.locator('input[type="file"]').setInputFiles(FIXTURE)

    // Real extraction happens here - wait for the editable preview
    const firstTask = page.getByLabel('Task 1 description')
    await expect(firstTask).toBeVisible({ timeout: 240_000 })
    await expect(firstTask).not.toHaveValue('')

    // The fixture has 9 tasks; extraction must find a sensible number of them
    const taskInputs = page.locator('input[aria-label$="description"]')
    expect(await taskInputs.count()).toBeGreaterThanOrEqual(5)

    // Pin the title so save + cleanup are deterministic
    await page.getByLabel('Schedule title').fill(EXPECTED_TITLE)

    await page.getByRole('button', { name: 'Save schedule' }).click()

    // Saved schedule appears in the schedules list after refetch
    await expect(page.getByText(EXPECTED_TITLE).first()).toBeVisible({ timeout: 30_000 })

    // Cleanup: delete the created schedule via the API using the browser session
    const schedules = await page.request.get('/api/schedules').then((r) => r.json())
    const created = (Array.isArray(schedules) ? schedules : schedules.schedules || []).find(
      (s: { id: string; title: string }) => s.title === EXPECTED_TITLE,
    )
    if (created) {
      const del = await page.request.delete(`/api/schedules/${created.id}`)
      expect(del.ok()).toBeTruthy()
    }
  })
})
