/**
 * E2E — partial-feature verification pass (Phase 4).
 *
 * Exercises every feature panel that the MVP audit flagged as "partial"
 * by toggling it via the `window.__quiksheetsDebug` bridge. Each test
 * confirms:
 *   1. The panel opens without throwing
 *   2. No console-error chunk fires inside the next 500ms
 *   3. The panel closes cleanly
 *
 * These are no-crash smoke tests, not deep functional ones. Their job
 * is to catch the kind of bug we hit earlier today (NameManagerDialog
 * infinite loop, NavigatorLock auth error) before it reaches users.
 *
 * Tests SKIP themselves automatically when the debug bridge is absent
 * (CI without Supabase, production builds, etc.) so they never block
 * the green-tests gate.
 */

import { test, expect, type Page } from '@playwright/test'
import { gotoSheet, capturePageErrors } from './helpers'

async function hasDebugBridge(page: Page): Promise<boolean> {
  return page.evaluate(
    () => typeof (window as unknown as { __quiksheetsDebug?: unknown }).__quiksheetsDebug === 'object',
  )
}

async function callDebug(page: Page, dotted: string): Promise<boolean> {
  return page.evaluate((path) => {
    const bridge = (window as unknown as { __quiksheetsDebug?: Record<string, Record<string, () => void>> }).__quiksheetsDebug
    if (!bridge) return false
    const [ns, method] = path.split('.')
    if (!ns || !method) return false
    const target = bridge[ns]?.[method]
    if (typeof target !== 'function') return false
    try {
      target()
      return true
    } catch {
      return false
    }
  }, dotted)
}

test.describe('Phase 4 — partial feature verification', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSheet(page)
  })

  test('debug bridge is registered on localhost', async ({ page }) => {
    const present = await hasDebugBridge(page)
    test.skip(!present, 'Debug bridge absent (running against non-localhost or production build)')
    expect(present).toBe(true)
  })

  // Each panel: open, wait 500ms, assert no errors, close.
  // Loop kept simple so failures point at the specific feature.

  test('Chart Builder opens without errors', async ({ page }) => {
    if (!(await hasDebugBridge(page))) test.skip(true, 'No debug bridge')
    const { errors } = capturePageErrors(page)
    expect(await callDebug(page, 'chartBuilder.open')).toBe(true)
    await page.waitForTimeout(500)
    await callDebug(page, 'chartBuilder.close')
    expect(errors).toHaveLength(0)
  })

  test('Pivot Builder opens without errors', async ({ page }) => {
    if (!(await hasDebugBridge(page))) test.skip(true, 'No debug bridge')
    const { errors } = capturePageErrors(page)
    expect(await callDebug(page, 'pivotBuilder.open')).toBe(true)
    await page.waitForTimeout(500)
    await callDebug(page, 'pivotBuilder.close')
    expect(errors).toHaveLength(0)
  })

  test('Form Builder opens without errors', async ({ page }) => {
    if (!(await hasDebugBridge(page))) test.skip(true, 'No debug bridge')
    const { errors } = capturePageErrors(page)
    expect(await callDebug(page, 'formBuilder.open')).toBe(true)
    await page.waitForTimeout(500)
    await callDebug(page, 'formBuilder.close')
    expect(errors).toHaveLength(0)
  })

  test('Clean Data panel opens without errors', async ({ page }) => {
    if (!(await hasDebugBridge(page))) test.skip(true, 'No debug bridge')
    const { errors } = capturePageErrors(page)
    expect(await callDebug(page, 'cleanData.open')).toBe(true)
    await page.waitForTimeout(500)
    await callDebug(page, 'cleanData.close')
    expect(errors).toHaveLength(0)
  })

  test('Forecast panel opens without errors', async ({ page }) => {
    if (!(await hasDebugBridge(page))) test.skip(true, 'No debug bridge')
    const { errors } = capturePageErrors(page)
    expect(await callDebug(page, 'forecast.open')).toBe(true)
    await page.waitForTimeout(500)
    await callDebug(page, 'forecast.close')
    expect(errors).toHaveLength(0)
  })

  test('Comments panel opens without errors', async ({ page }) => {
    if (!(await hasDebugBridge(page))) test.skip(true, 'No debug bridge')
    const { errors } = capturePageErrors(page)
    expect(await callDebug(page, 'comments.openPanel')).toBe(true)
    await page.waitForTimeout(500)
    await callDebug(page, 'comments.closePanel')
    expect(errors).toHaveLength(0)
  })

  test('Version History panel opens without errors', async ({ page }) => {
    if (!(await hasDebugBridge(page))) test.skip(true, 'No debug bridge')
    const { errors } = capturePageErrors(page)
    expect(await callDebug(page, 'versionHistory.open')).toBe(true)
    await page.waitForTimeout(500)
    await callDebug(page, 'versionHistory.close')
    expect(errors).toHaveLength(0)
  })

  test('Share dialog opens without errors', async ({ page }) => {
    if (!(await hasDebugBridge(page))) test.skip(true, 'No debug bridge')
    const { errors } = capturePageErrors(page)
    expect(await callDebug(page, 'share.open')).toBe(true)
    await page.waitForTimeout(500)
    await callDebug(page, 'share.close')
    expect(errors).toHaveLength(0)
  })

  test('Protected Ranges dialog opens without errors', async ({ page }) => {
    if (!(await hasDebugBridge(page))) test.skip(true, 'No debug bridge')
    const { errors } = capturePageErrors(page)
    expect(await callDebug(page, 'protectedRanges.open')).toBe(true)
    await page.waitForTimeout(500)
    await callDebug(page, 'protectedRanges.close')
    expect(errors).toHaveLength(0)
  })

  test('opening all panels in sequence does not corrupt state', async ({ page }) => {
    if (!(await hasDebugBridge(page))) test.skip(true, 'No debug bridge')
    const { errors } = capturePageErrors(page)

    // Sequence: open each, close each.
    const flow: [string, string][] = [
      ['chartBuilder.open', 'chartBuilder.close'],
      ['pivotBuilder.open', 'pivotBuilder.close'],
      ['formBuilder.open', 'formBuilder.close'],
      ['cleanData.open', 'cleanData.close'],
      ['forecast.open', 'forecast.close'],
      ['versionHistory.open', 'versionHistory.close'],
      ['share.open', 'share.close'],
      ['protectedRanges.open', 'protectedRanges.close'],
    ]
    for (const [openCmd, closeCmd] of flow) {
      await callDebug(page, openCmd)
      await page.waitForTimeout(150)
      await callDebug(page, closeCmd)
      await page.waitForTimeout(100)
    }
    expect(errors).toHaveLength(0)
  })
})
