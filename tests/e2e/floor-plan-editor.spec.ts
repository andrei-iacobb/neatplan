import { expect, test } from '@playwright/test'

const room = { id: 'audit-room', name: 'Cleaning cupboard', floor: 'Ground', type: 'SERVICE_AREA', siteId: 'mapped-site' }
const plan = {
  id: 'audit-plan', name: 'Audit floor', floor: 'Ground', siteId: 'mapped-site',
  site: { id: 'mapped-site', name: 'Mapped site' },
  imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  imageWidth: 1000, imageHeight: 600, sourceFileName: 'plan.png',
  isPublished: false, revision: 1, updatedAt: '2026-09-04T00:00:00Z',
  regions: [{ id: 'audit-region', label: room.name, roomId: room.id, x: 0.4, y: 0.4, width: 0.2, height: 0.2, room }],
}

test.beforeEach(async ({ page }) => {
  await page.goto('/auth')
  await expect(page.getByRole('main')).toHaveCount(1)
  await page.getByLabel('Email or username', { exact: true }).fill('admin@neatplan.com')
  await page.getByLabel('Password', { exact: true }).fill('admin123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL('/')

  // Isolate editor interactions from stored plans: these tests never save real data.
  await page.route('**/api/sites', route => route.fulfill({ json: [
    { id: 'empty-site', name: 'Empty site' }, plan.site,
  ] }))
  await page.route('**/api/rooms', route => route.fulfill({ json: [room] }))
  await page.route('**/api/floor-plans', route => route.fulfill({ json: [plan] }))
  await page.goto('/floor-plans')
  await expect(page.getByRole('combobox', { name: 'Site', exact: true })).toHaveValue('empty-site')
})

test('a site without a floor plan never opens another site’s editor', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Upload a floor plan' })).toBeVisible()
  await expect(page.getByRole('heading', { name: plan.name })).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Site', exact: true }).selectOption('mapped-site')
  await expect(page.getByRole('heading', { name: plan.name })).toBeVisible()
  await page.getByRole('combobox', { name: 'Site', exact: true }).selectOption('empty-site')
  await expect(page.getByRole('heading', { name: 'Upload a floor plan' })).toBeVisible()
  await expect(page.getByRole('button', { name: room.name, exact: true })).toHaveCount(0)
})

test('markers support pixel nudges, dragging and click-away deselection', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Site', exact: true }).selectOption('mapped-site')
  const marker = page.getByRole('button', { name: room.name, exact: true })
  const position = () => marker.evaluate(el => {
    const box = el.getBoundingClientRect()
    const parent = el.parentElement!.getBoundingClientRect()
    return { x: box.x - parent.x, y: box.y - parent.y }
  })
  await marker.click()
  const before = await position()
  await marker.press('ArrowRight')
  await marker.press('ArrowDown')
  const after = await position()
  expect(after.x - before.x).toBeCloseTo(1, 1)
  expect(after.y - before.y).toBeCloseTo(1, 1)
  const box = await marker.boundingBox()
  if (!box) throw new Error('Marker is not visible')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 10, { steps: 5 })
  await page.mouse.up()
  const dragged = await position()
  expect(dragged.x - after.x).toBeCloseTo(20, 1)
  expect(dragged.y - after.y).toBeCloseTo(10, 1)
  await page.getByRole('img', { name: 'Audit floor, Ground' }).click({ position: { x: 5, y: 5 } })
  await expect(marker).toHaveAttribute('aria-pressed', 'false')
  await marker.click()
  await marker.press('Escape')
  await expect(marker).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText('Horizontal position', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Vertical position', { exact: true })).toHaveCount(0)
})

test('a pending save locks edits and site changes until the saved draft is returned', async ({ page }) => {
  let finishSave: (() => void) | undefined
  const saveGate = new Promise<void>(resolve => { finishSave = resolve })
  await page.route('**/api/floor-plans/audit-plan/regions', async route => {
    const body = route.request().postDataJSON() as { regions: typeof plan.regions }
    await saveGate
    await route.fulfill({ json: { ...plan, revision: 2, regions: body.regions } })
  })
  await page.getByRole('combobox', { name: 'Site', exact: true }).selectOption('mapped-site')
  const marker = page.getByRole('button', { name: room.name, exact: true })
  await marker.click()
  await marker.press('ArrowRight')
  const saveRequest = page.waitForRequest('**/api/floor-plans/audit-plan/regions')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await saveRequest
  try {
    await expect(marker).toBeDisabled()
    await expect(page.getByRole('combobox', { name: 'Site', exact: true })).toBeDisabled()
    await expect(page.getByRole('slider', { name: /Marker width/ })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Add Floor Plan', exact: true })).toBeDisabled()
  } finally {
    finishSave?.()
  }
  await expect(marker).toBeEnabled()
  await expect(page.getByText('Saved draft', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toBeDisabled()
})
