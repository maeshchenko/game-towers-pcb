import { test, expect } from '@playwright/test'

// Boot smoke: the single most valuable e2e — does the shipped bundle start at all, on desktop
// and mobile viewports, without throwing? Everything downstream depends on this.
test('boots to an interactive title screen with no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/')

  // Boot splash is removed by boot() once Pixi is up — its disappearance means init succeeded.
  await expect(page.locator('#pcb-loading')).toBeHidden({ timeout: 30_000 })

  // The WebGL canvas mounted.
  await expect(page.locator('#app canvas')).toBeVisible()

  // The title screen's START control is present and clickable (proves UI layer rendered).
  const start = page.locator('.pcb-title-start')
  await expect(start).toBeVisible({ timeout: 15_000 })

  // No uncaught errors during boot. (A known-benign pixi texture warning would be type 'warning',
  // not 'error', so it won't trip this.)
  expect(errors, `console errors during boot:\n${errors.join('\n')}`).toEqual([])
})

test('clicking START advances past the title screen', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#pcb-loading')).toBeHidden({ timeout: 30_000 })
  const start = page.locator('.pcb-title-start')
  await start.click()
  // Fresh save → comic prologue; the title board is gone either way.
  await expect(page.locator('.pcb-title-board')).toHaveCount(0, { timeout: 10_000 })
})
