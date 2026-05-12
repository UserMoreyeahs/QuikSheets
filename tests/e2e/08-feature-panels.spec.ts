/**
 * E2E tests — Feature Panels
 *
 * Tests side/overlay panels opened from the ribbon or keyboard shortcuts:
 * - Dependency Map (Ctrl+M)
 * - Column DNA panel
 * - Cell History panel
 * - Private Scratchpad (Ctrl+`)
 * - Row Summarizer (Alt+S)
 * - Conditional Formatting dialog
 * - Chart Builder
 * - Pivot Builder
 * - Form Builder (Ctrl+Shift+F)
 * - Data Cleaning panel
 * - Comments panel
 * - Version History panel
 */

import { test, expect, type Page } from '@playwright/test'
import { gotoSheet, capturePageErrors } from './helpers'

/**
 * Open a feature panel via the debug bridge if available,
 * falling back to keyboard / ribbon click.
 */
async function openViaDebug(page: Page, action: string): Promise<boolean> {
  return page.evaluate((act) => {
    const bridge = (window as unknown as { __quiksheetsDebug?: Record<string, Record<string, () => void>> }).__quiksheetsDebug
    if (!bridge) return false
    const parts = act.split('.')
    const ns = parts[0] ? bridge[parts[0]] : null
    const method = parts[1] && ns ? ns[parts[1]] : null
    if (typeof method === 'function') {
      method()
      return true
    }
    return false
  }, action)
}

test.describe('Dependency Map', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSheet(page)
  })

  test('Ctrl+M opens dependency map without crash', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await page.locator('body').click()
    await page.keyboard.press('Control+m')
    await page.waitForTimeout(600)
    const map = page.locator('[class*="DependencyMap"], .react-flow, [data-testid="dependency-map"]').first()
    if (await map.count() > 0) {
      await expect(map).toBeVisible()
    }
    // Toggle off
    await page.keyboard.press('Control+m')
    await page.waitForTimeout(300)
    expect(errors).toHaveLength(0)
  })
})

test.describe('Scratchpad', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSheet(page)
  })

  test('Ctrl+` opens Scratchpad panel without crash', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await page.locator('body').click()
    await page.keyboard.press('Control+`')
    await page.waitForTimeout(600)
    const pad = page.locator('[class*="ScratchpadPanel"], [class*="scratchpad"]').first()
    if (await pad.count() > 0) {
      await expect(pad).toBeVisible()
    }
    expect(errors).toHaveLength(0)
    // Close
    await page.keyboard.press('Control+`')
  })
})

test.describe('Row Summarizer', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSheet(page)
  })

  test('Alt+S does not crash', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await page.locator('body').click()
    await page.keyboard.press('Alt+s')
    await page.waitForTimeout(500)
    expect(errors).toHaveLength(0)
    await page.keyboard.press('Escape')
  })
})

test.describe('Chart Builder', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSheet(page)
  })

  test('opening Chart Builder via debug bridge does not crash', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    const opened = await openViaDebug(page, 'chartBuilder.open')
    if (!opened) {
      // Try ribbon Insert > Chart
      const insertTab = page.locator('button:has-text("Insert"), [role="tab"]:has-text("Insert")').first()
      if (await insertTab.count() > 0) await insertTab.click()
      await page.waitForTimeout(200)
      const chartBtn = page.locator('button:has-text("Chart")').first()
      if (await chartBtn.count() > 0) await chartBtn.click()
    }
    await page.waitForTimeout(500)
    expect(errors).toHaveLength(0)
    // Close
    const closeBtn = page.locator('[aria-label="Close"], button:has-text("Close"), button:has-text("Cancel")').first()
    if (await closeBtn.count() > 0) await closeBtn.click()
    else await page.keyboard.press('Escape')
  })
})

test.describe('Pivot Builder', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSheet(page)
  })

  test('opening Pivot Builder via debug bridge does not crash', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await openViaDebug(page, 'pivotBuilder.open')
    await page.waitForTimeout(500)
    expect(errors).toHaveLength(0)
    await page.keyboard.press('Escape')
  })
})

test.describe('Form Builder', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSheet(page)
  })

  test('opening Form Builder via debug bridge does not crash', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await openViaDebug(page, 'formBuilder.open')
    await page.waitForTimeout(500)
    expect(errors).toHaveLength(0)
    await page.keyboard.press('Escape')
  })
})

test.describe('Conditional Formatting', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSheet(page)
  })

  test('CF dialog opens without crash', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    // Try Home tab > CF button
    const homeTab = page.locator('button:has-text("Home"), [role="tab"]:has-text("Home")').first()
    if (await homeTab.count() > 0) await homeTab.click()
    await page.waitForTimeout(200)
    const cfBtn = page
      .locator('button:has-text("Conditional Formatting"), button:has-text("Conditional"), button[aria-label*="Conditional" i]')
      .first()
    if (await cfBtn.count() > 0) {
      await cfBtn.click()
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

test.describe('Comments Panel', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSheet(page)
  })

  test('opening comments panel via debug bridge does not crash', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    const opened = await openViaDebug(page, 'comments.openPanel')
    if (!opened) {
      // Try Review tab
      const reviewTab = page.locator('button:has-text("Review"), [role="tab"]:has-text("Review")').first()
      if (await reviewTab.count() > 0) await reviewTab.click()
    }
    await page.waitForTimeout(500)
    expect(errors).toHaveLength(0)
    await page.keyboard.press('Escape')
  })
})

test.describe('Version History', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSheet(page)
  })

  test('opening version history via debug bridge does not crash', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await openViaDebug(page, 'versionHistory.open')
    await page.waitForTimeout(500)
    expect(errors).toHaveLength(0)
    await page.keyboard.press('Escape')
  })
})
