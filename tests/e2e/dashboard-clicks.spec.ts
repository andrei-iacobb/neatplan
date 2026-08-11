import { instant } from '@next/playwright'
import { expect, test } from '@playwright/test'

test('dashboard links are clickable', async ({ page }) => {
  await page.goto('/auth')
  await page.fill('input[name=email]', 'admin@neatplan.com')
  await page.fill('input[name=password]', 'admin123')
  await page.click('button[type=submit]')
  await page.waitForURL('/')

  // Wait for dashboard to load (not spinner)
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible({ timeout: 15000 })

  const roomsStat = page.locator('a[href="/rooms"]').filter({ hasText: 'Total Rooms' })
  await expect(roomsStat).toBeVisible()
  await instant(page, async () => {
    await roomsStat.click()
    await expect(page).toHaveURL(/\/rooms/)
    await expect(page.getByRole('status', { name: 'Loading rooms' })).toBeVisible()
  })

  await expect(page.getByRole('heading', { name: 'Room Management' })).toBeVisible()
})
