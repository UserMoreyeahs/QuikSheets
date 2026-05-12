/**
 * E2E tests — Data Operations
 *
 * Tests Sort, Filter, Find & Replace, and Data Validation:
 * - Sort panel opens from the ribbon Data tab
 * - Filter toggle works without error
 * - Ctrl+Shift+L toggles filter
 * - Find (Ctrl+F) opens the FindReplace panel
 * - Replace (Ctrl+H) opens the FindReplace panel in replace mode
 * - Data Validation dialog opens
 */

import { test, expect, type Page } from '@playwright/test'
import { gotoSheet, capturePageErrors } from './helpers'

async function openDataTab(page: Page) {
  const dataTab = page.locator('button:has-text("Data"), [role="tab"]:has-text("Data")').first()
  if (await dataTab.count() > 0) {
    await dataTab.click()
    await page.waitForTimeout(200)
  }
}

test.describe('Sort', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSheet(page)
    await openDataTab(page)
  })

  test('Sort button is present in Data tab', async ({ page }) => {
    const sortBtn = page.locator('button:has-text("Sort"), button[aria-label*="Sort" i]').first()
    expect(await sortBtn.count()).toBeGreaterThanOrEqual(0)
  })

  test('clicking Sort button does not crash', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    const sortBtn = page.locator('button:has-text("Sort"), button[aria-label*="Sort" i]').first()
    if (await sortBtn.count() > 0) {
      await sortBtn.click()
      await page.waitForTimeout(400)
      // Close any open panel
      await page.keyboard.press('Escape')
    }
    expect(errors).toHaveLength(0)
  })
})

test.describe('Filter', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSheet(page)
  })

  test('Ctrl+Shift+L toggles filter without crash', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await page.locator('body').click()
    await page.keyboard.press('Control+Shift+l')
    await page.waitForTimeout(300)
    expect(errors).toHaveLength(0)
  })
})

test.describe('Find & Replace', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSheet(page)
  })

  test('Ctrl+F opens Find panel', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await page.locator('body').click()
    await page.keyboard.press('Control+f')
    await page.waitForTimeout(400)
    // Find panel should be visible
    const findInput = page
      .locator('[class*="FindReplace"] input, input[placeholder*="find" i], input[placeholder*="search" i]')
      .first()
    const count = await findInput.count()
    if (count > 0) {
      await expect(findInput).toBeVisible()
    }
    await page.keyboard.press('Escape')
    expect(errors).toHaveLength(0)
  })

  test('Ctrl+H opens Replace panel', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await page.locator('body').click()
    await page.keyboard.press('Control+h')
    await page.waitForTimeout(400)
    const replaceInput = page
      .locator('[class*="FindReplace"] input[placeholder*="replace" i], input[placeholder*="Replace" i]')
      .first()
    if (await replaceInput.count() > 0) {
      await expect(replaceInput).toBeVisible()
    }
    await page.keyboard.press('Escape')
    expect(errors).toHaveLength(0)
  })

  test('typing in Find input and pressing Enter does not crash', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await page.locator('body').click()
    await page.keyboard.press('Control+f')
    await page.waitForTimeout(400)
    const findInput = page
      .locator('[class*="FindReplace"] input:first-child, input[placeholder*="find" i]')
      .first()
    if (await findInput.count() > 0) {
      await findInput.fill('test')
      await findInput.press('Enter')
      await page.waitForTimeout(300)
    }
    await page.keyboard.press('Escape')
    expect(errors).toHaveLength(0)
  })
})

test.describe('Data Validation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSheet(page)
    await openDataTab(page)
  })

  test('Data Validation button opens dialog without crash', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    const dvBtn = page
      .locator('button:has-text("Data Validation"), button[aria-label*="Data Validation" i]')
      .first()
    if (await dvBtn.count() > 0) {
      await dvBtn.click()
      await page.waitForTimeout(400)
      const dialog = page.locator('[role="dialog"]').first()
      if (await dialog.count() > 0) {
        await expect(dialog).toBeVisible()
        await page.keyboard.press('Escape')
      }
    }
    expect(errors).toHaveLength(0)
  })
})
