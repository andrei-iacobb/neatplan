import { test, expect } from '@playwright/test'

test.describe('NeatPlan auth page', () => {
  test('loads login form', async ({ page }) => {
    await page.goto('/auth')
    await expect(page.getByRole('main')).toHaveCount(1)
    await expect(page.getByLabel('Email or username', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
  })
})
