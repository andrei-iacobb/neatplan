import { test, expect } from '@playwright/test'

test.describe('NeatPlan auth page', () => {
  test('loads login form', async ({ page }) => {
    await page.goto('http://localhost:3030/auth')
    await expect(page.getByPlaceholder('Email address')).toBeVisible()
    await expect(page.getByPlaceholder('Password')).toBeVisible()
  })
})
