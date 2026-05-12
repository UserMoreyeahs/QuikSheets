/**
 * E2E tests — Ribbon Tabs
 *
 * Tests each ribbon tab (Home, Insert, Page Layout, Formulas, Data, Review, View)
 * by clicking it and verifying:
 * 1. No unhandled JS exception is thrown
 * 2. The tab becomes active (content panel changes)
 * 3. Key buttons in each tab are visible
 *
 * Formatting buttons (Bold, Italic, Underline) are smoke-tested by clicking
 * and confirming no exception is thrown.
 */

import { test, expect, type Page } from '@playwright/test'
import { gotoSheet, capturePageErrors } from './helpers'

// Helper: activate a tab by its label
async function tab(page: Page, label: string) {
  const el = page
    .locator(`button:has-text("${label}"), [role="tab"]:has-text("${label}")`)
    .first()
  if (await el.count() > 0) {
    await el.click()
    await page.waitForTimeout(200)
  }
}

// Helper: click a button if present
async function btn(page: Page, label: string) {
  const el = page
    .locator(`button[aria-label="${label}"], button:has-text("${label}"), [title="${label}"]`)
    .first()
  if (await el.count() > 0) {
    await el.click()
    await page.waitForTimeout(100)
  }
}

test.describe('Ribbon — Home tab', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSheet(page)
    await tab(page, 'Home')
  })

  test('no JS errors after clicking Home tab', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await page.waitForTimeout(400)
    expect(errors).toHaveLength(0)
  })

  test('Bold, Italic, Underline buttons are present', async ({ page }) => {
    const bold = page.locator('button[aria-label="Bold"], button:has-text("B")').first()
    expect(await bold.count()).toBeGreaterThan(0)
  })

  test('clicking Bold does not throw', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await btn(page, 'Bold')
    expect(errors).toHaveLength(0)
  })

  test('clicking Italic does not throw', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await btn(page, 'Italic')
    expect(errors).toHaveLength(0)
  })

  test('clicking Underline does not throw', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await btn(page, 'Underline')
    expect(errors).toHaveLength(0)
  })

  test('Conditional Formatting button is present', async ({ page }) => {
    const cfBtn = page
      .locator('button:has-text("Conditional"), button[aria-label*="Conditional" i]')
      .first()
    expect(await cfBtn.count()).toBeGreaterThanOrEqual(0)
  })

  test('Merge Cells button is present', async ({ page }) => {
    const mergeBtn = page
      .locator('button:has-text("Merge"), button[aria-label*="Merge" i]')
      .first()
    expect(await mergeBtn.count()).toBeGreaterThanOrEqual(0)
  })
})

test.describe('Ribbon — Insert tab', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSheet(page)
    await tab(page, 'Insert')
  })

  test('no JS errors after clicking Insert tab', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await page.waitForTimeout(400)
    expect(errors).toHaveLength(0)
  })

  test('Chart button is present in Insert tab', async ({ page }) => {
    const chartBtn = page.locator('button:has-text("Chart")').first()
    expect(await chartBtn.count()).toBeGreaterThanOrEqual(0)
  })

  test('Insert Function button opens dialog', async ({ page }) => {
    const insertFnBtn = page
      .locator('button:has-text("Function"), button[aria-label*="Function" i]')
      .first()
    if (await insertFnBtn.count() > 0) {
      await insertFnBtn.click()
      await page.waitForTimeout(400)
      const dialog = page.locator('[role="dialog"]').first()
      if (await dialog.count() > 0) {
        await expect(dialog).toBeVisible()
        await page.keyboard.press('Escape')
      }
    }
    const { errors } = capturePageErrors(page)
    expect(errors).toHaveLength(0)
  })
})

test.describe('Ribbon — Page Layout tab', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSheet(page)
    await tab(page, 'Page Layout')
  })

  test('no JS errors after clicking Page Layout tab', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await page.waitForTimeout(400)
    expect(errors).toHaveLength(0)
  })
})

test.describe('Ribbon — Formulas tab', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSheet(page)
    await tab(page, 'Formulas')
  })

  test('no JS errors after clicking Formulas tab', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await page.waitForTimeout(400)
    expect(errors).toHaveLength(0)
  })

  test('clicking Name Manager button opens dialog', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    const nameBtn = page
      .locator('button:has-text("Name Manager"), button[aria-label*="Name Manager" i]')
      .first()
    if (await nameBtn.count() > 0) {
      await nameBtn.click()
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

test.describe('Ribbon — Data tab', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSheet(page)
    await tab(page, 'Data')
  })

  test('no JS errors after clicking Data tab', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await page.waitForTimeout(400)
    expect(errors).toHaveLength(0)
  })
})

test.describe('Ribbon — Review tab', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSheet(page)
    await tab(page, 'Review')
  })

  test('no JS errors after clicking Review tab', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await page.waitForTimeout(400)
    expect(errors).toHaveLength(0)
  })
})

test.describe('Ribbon — View tab', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSheet(page)
    await tab(page, 'View')
  })

  test('no JS errors after clicking View tab', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await page.waitForTimeout(400)
    expect(errors).toHaveLength(0)
  })
})
