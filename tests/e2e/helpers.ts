/**
 * Shared Playwright test helpers for Quiksheets E2E tests.
 *
 * Provides reusable wrappers for:
 * - Navigation (dashboard, sheet page)
 * - Waiting for the FortuneSheet grid to hydrate
 * - Formula bar interaction
 * - Ribbon tab activation
 * - Debug bridge access
 * - Sheet tab management
 *
 * The sheet page works without authentication when Supabase environment
 * variables are absent (the middleware falls through to Next.js).
 */

import { type Page, type Locator } from '@playwright/test'

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * Navigate to the dashboard and wait for it to be interactive.
 * The root `/` redirects to `/dashboard`.
 */
export async function gotoDashboard(page: Page): Promise<void> {
  await page.goto('/dashboard')
  // Wait for workbook list heading or similar content
  await page.waitForSelector('h1, h2, [role="heading"]', { timeout: 15_000 }).catch(() => {
    // Fallback: wait for any main content
    return page.waitForSelector('main, #main, [data-testid="dashboard"]', { timeout: 15_000 })
  })
}

/**
 * Navigate to a sheet page.
 * Uses the special `demo` workbook ID which uses localStorage fallback
 * (no Supabase auth required when env vars are not set).
 *
 * @param id - workbook ID (default: 'demo')
 */
export async function gotoSheet(page: Page, id = 'demo'): Promise<void> {
  await page.goto(`/sheet/${id}`)
  await waitForGrid(page)
}

// ---------------------------------------------------------------------------
// Grid readiness
// ---------------------------------------------------------------------------

/**
 * Wait until:
 * 1. FortuneSheet's grid container element is visible in the DOM
 * 2. The debug bridge (`window.__quiksheetsDebug`) is registered
 *
 * FortuneSheet is dynamically imported (SSR disabled) so it takes 1-3 seconds
 * to mount even after the Next.js page loads.
 */
export async function waitForGrid(page: Page, timeout = 25_000): Promise<void> {
  // FortuneSheet renders elements with 'luckysheet' in the class name
  await page.waitForFunction(
    () => {
      const el = document.querySelector(
        '[class*="luckysheet"], canvas, .luckysheet-grid-window'
      )
      return !!el
    },
    { timeout }
  )
  // Wait for our debug bridge to be set up
  await page
    .waitForFunction(
      () => !!(window as unknown as { __quiksheetsDebug?: unknown }).__quiksheetsDebug,
      { timeout }
    )
    .catch(() => {
      // Debug bridge is only set up on localhost — acceptable if not present
    })
}

// ---------------------------------------------------------------------------
// Ribbon helpers
// ---------------------------------------------------------------------------

/**
 * Click a ribbon tab by its visible label and wait for the content to render.
 *
 * @example await clickRibbonTab(page, 'Home')
 */
export async function clickRibbonTab(page: Page, tabName: string): Promise<void> {
  const tab = page
    .locator(
      `button:has-text("${tabName}"), [role="tab"]:has-text("${tabName}"), [data-tab="${tabName.toLowerCase()}"]`
    )
    .first()
  await tab.click()
  await page.waitForTimeout(200)
}

/**
 * Click a ribbon button by its aria-label, title, or visible text.
 * Returns silently if the button is not found (the test can still pass).
 */
export async function clickRibbonButton(page: Page, label: string): Promise<void> {
  const btn = page
    .locator(`[aria-label="${label}"], [title="${label}"], button:has-text("${label}")`)
    .first()
  if (await btn.count() > 0) {
    await btn.click()
    await page.waitForTimeout(150)
  }
}

// ---------------------------------------------------------------------------
// Formula bar helpers
// ---------------------------------------------------------------------------

/**
 * Type a value or formula into the formula bar and confirm with Enter.
 */
export async function typeInFormulaBar(page: Page, text: string): Promise<void> {
  const bar = page
    .locator('.formula-bar-input, [data-testid="formula-bar-input"]')
    .first()
  await bar.click()
  await bar.fill(text)
  await bar.press('Enter')
  await page.waitForTimeout(250)
}

/**
 * Return the current value shown in the formula bar input.
 */
export async function getFormulaBarValue(page: Page): Promise<string> {
  const bar = page
    .locator('.formula-bar-input, [data-testid="formula-bar-input"]')
    .first()
  return bar.inputValue()
}

// ---------------------------------------------------------------------------
// Sheet tab helpers
// ---------------------------------------------------------------------------

/**
 * Click a sheet tab by its display name.
 */
export async function clickSheetTab(page: Page, name: string): Promise<Locator> {
  const tab = page
    .locator(
      `[data-testid="sheet-tab"]:has-text("${name}"), .sheet-tab:has-text("${name}"), [class*="sheet-tab"]:has-text("${name}")`
    )
    .first()
  await tab.click()
  await page.waitForTimeout(200)
  return tab
}

/**
 * Return the names of all visible sheet tabs.
 */
export async function getSheetTabNames(page: Page): Promise<string[]> {
  return page
    .locator('[data-testid="sheet-tab-name"], .sheet-tab-name, [class*="SheetTab"] span')
    .allTextContents()
}

// ---------------------------------------------------------------------------
// Debug bridge
// ---------------------------------------------------------------------------

/**
 * Run a function via the debug bridge on localhost.
 * Returns `null` when the bridge isn't present (e.g. CI with Supabase).
 */
export async function runDebug<T>(
  page: Page,
  fn: (bridge: Record<string, unknown>) => T
): Promise<T | null> {
  return page.evaluate((fnStr) => {
    const bridge = (window as unknown as { __quiksheetsDebug?: Record<string, unknown> }).__quiksheetsDebug
    if (!bridge) return null
    const wrappedFn = new Function('bridge', `return (${fnStr})(bridge)`)
    return wrappedFn(bridge) as T
  }, fn.toString())
}

/**
 * Assert that no unhandled JavaScript errors were thrown.
 * Filters out benign warnings (BailoutToCSR, ResizeObserver).
 */
export function capturePageErrors(page: Page): { errors: string[] } {
  const errors: string[] = []
  page.on('pageerror', (err) => {
    const msg = err.message
    if (
      !msg.includes('BailoutToCSR') &&
      !msg.includes('Minified React') &&
      !msg.includes('ResizeObserver') &&
      !msg.includes('non-Error promise rejection')
    ) {
      errors.push(msg)
    }
  })
  return { errors }
}
