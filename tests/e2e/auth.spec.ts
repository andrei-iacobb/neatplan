import { test, expect } from '@playwright/test'

test.describe('NeatPlan auth page', () => {
  test('loads login form', async ({ page }) => {
    await page.goto('/auth')
    await expect(page.getByPlaceholder('Email or username')).toBeVisible()
    await expect(page.getByPlaceholder('Password')).toBeVisible()
  })
})
