/**
 * Workbook-switch isolation (Stage 2 — cross-workbook state-leak fix).
 *
 * Bug: switching workbooks from inside the sheet page (the WorkbookSidebar
 * rows, the "New workbook" action) used a client-side router.push to another
 * /sheet/[id]. Because the route SEGMENT is reused, React did NOT remount the
 * page, so the global Zustand singletons (grid data, filters, undo, …) carried
 * the PREVIOUS workbook's state into the newly-opened one — and the load-on-
 * open hook (empty deps) never re-ran, so the new workbook's own data wasn't
 * fetched. Net effect: open B, still see A.
 *
 * Fix: those same-segment switches are now FULL navigations
 * (window.location.assign), which reload the document → clean slate + every
 * mount hook re-runs.
 *
 * This test drives the no-auth "New workbook" path (creates a local wb_<ts>
 * and navigates to it) and asserts:
 *   1. the switch is a FULL navigation — a window sentinel set before the
 *      switch does NOT survive it (a client router.push WOULD preserve it);
 *   2. the freshly-opened workbook does NOT show the previous workbook's data.
 *
 * Real Chromium; no-auth demo (start dev with NEXT_PUBLIC_SUPABASE_URL unset).
 */
import { test, expect, type Page } from '@playwright/test'
import { gotoSheet, waitForGrid } from './helpers'

async function focusCell(page: Page, xOffset = 90, yOffset = 70): Promise<void> {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('canvas') as HTMLCanvasElement | null
      return !!el && el.offsetWidth > 100 && el.offsetHeight > 100
    },
    { timeout: 25_000 },
  )
  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('grid canvas has no bounding box')
  await page.mouse.click(box.x + xOffset, box.y + yOffset)
  await page.waitForTimeout(400)
}

/** Scan column 0 of the active sheet (via the store mirror) for a value. */
async function columnZeroHas(page: Page, value: string): Promise<boolean> {
  return page.evaluate((wanted) => {
    const w = window as unknown as { __quiksheetsDebug?: { getSheetState: () => unknown } }
    const state = w.__quiksheetsDebug?.getSheetState() as
      | undefined
      | { gridSheets: Array<{ status?: number; data?: unknown[][] }> }
    const sheets = state?.gridSheets ?? []
    const active = sheets.find((s) => s.status === 1) ?? sheets[0]
    const data = active?.data ?? []
    for (let r = 0; r < Math.min(data.length, 30); r++) {
      const cell = data[r]?.[0] as { v?: unknown; m?: unknown } | null | undefined
      const out = cell ? (cell.m ?? cell.v) : null
      if (out != null && String(out) === wanted) return true
    }
    return false
  }, value)
}

/** Click the "New workbook" action, expanding the sidebar first if needed. */
async function clickNewWorkbook(page: Page): Promise<void> {
  let btn = page.getByRole('button', { name: /new workbook/i })
  if ((await btn.count()) === 0 || !(await btn.first().isVisible().catch(() => false))) {
    const expand = page.locator('[aria-label="Expand sidebar"]')
    if ((await expand.count()) > 0) {
      await expand.first().click()
      await page.waitForTimeout(300)
    }
    btn = page.getByRole('button', { name: /new workbook/i })
  }
  await btn.first().click()
}

test.describe('Workbook switch does not leak the previous workbook', () => {
  test('"New workbook" is a full navigation and opens a clean grid', async ({ page }) => {
    await gotoSheet(page, 'demo')
    await focusCell(page)

    // Put a distinctive canary into the demo workbook and persist it.
    await page.keyboard.type('LEAKCANARY', { delay: 50 })
    await page.keyboard.press('Enter')
    await page.keyboard.press('Control+s')
    await page.waitForTimeout(1000)
    expect(await columnZeroHas(page, 'LEAKCANARY')).toBe(true)

    // Sentinel that only survives a CLIENT navigation, not a full reload.
    await page.evaluate(() => {
      ;(window as unknown as { __fullNavProbe?: boolean }).__fullNavProbe = true
    })

    await clickNewWorkbook(page)

    // The fix makes this a full document navigation to a new local workbook.
    await page.waitForURL(/\/sheet\/wb_/, { timeout: 15_000 })

    // 1) Full-navigation proof: the sentinel must be GONE (a router.push would
    //    have preserved it because the document never reloaded).
    const probeSurvived = await page.evaluate(
      () => (window as unknown as { __fullNavProbe?: boolean }).__fullNavProbe === true,
    )
    expect(
      probeSurvived,
      'workbook switch must be a FULL navigation (clean slate), not a client router.push',
    ).toBe(false)

    // 2) No-leak proof: the freshly-opened workbook must not show the canary.
    await waitForGrid(page)
    await page.waitForTimeout(1200)
    expect(
      await columnZeroHas(page, 'LEAKCANARY'),
      'a newly-opened workbook must not inherit the previous workbook\'s cells',
    ).toBe(false)
  })
})
