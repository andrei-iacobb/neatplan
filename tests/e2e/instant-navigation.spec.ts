import { expect, test } from '@playwright/test'
import { instant } from '@next/playwright'

test.describe('instant navigation', () => {
  test('serves the demo shell on the initial load', async ({ page, baseURL }) => {
    const url = new URL('/demo', baseURL).toString()

    await instant(
      page,
      async () => {
        await page.goto(url)
        await expect(
          page.getByRole('heading', { name: 'Welcome to NeatPlan' }),
        ).toBeVisible()
      },
      { baseURL: new URL(url).origin },
    )
  })

  test('commits the demo shell during client navigation', async ({ page }) => {
    await page.goto('/demo/view')
    const trigger = page.getByRole('link', { name: 'Back to demo' })
    await expect(trigger).toBeVisible()

    await instant(page, async () => {
      await trigger.click()
      await expect(
        page.getByRole('heading', { name: 'Welcome to NeatPlan' }),
      ).toBeVisible()
    })
  })

  test('keeps the demo shell instant at a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/demo/view')
    const trigger = page.getByRole('link', { name: 'Back to demo' })

    await instant(page, async () => {
      await trigger.click()
      await expect(
        page.getByRole('heading', { name: 'Welcome to NeatPlan' }),
      ).toBeVisible()
    })
  })

  test('uses the prefetched demo shell while offline without changing visible UI', async ({
    context,
    page,
  }) => {
    const demoPrefetch = page.waitForResponse((response) => {
      const request = response.request()
      const url = new URL(request.url())
      return (
        url.pathname === '/demo' &&
        request.headers()['next-router-segment-prefetch'] === '/demo/__PAGE__'
      )
    })

    await page.goto('/demo/view')
    const prefetchResponse = await demoPrefetch
    expect(prefetchResponse.ok()).toBe(true)
    expect(await prefetchResponse.finished()).toBeNull()

    await context.setOffline(true)
    await expect(page.locator('html')).toHaveAttribute('data-offline', '')
    await page.getByRole('link', { name: 'Back to demo' }).click()
    await expect(page).toHaveURL(/\/demo$/)
    await expect(
      page.getByRole('heading', { name: 'Welcome to NeatPlan' }),
    ).toBeVisible()

    await context.setOffline(false)
    await expect(page.locator('html')).not.toHaveAttribute('data-offline')
  })
})
