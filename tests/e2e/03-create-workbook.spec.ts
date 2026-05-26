/**
 * MVP golden path 3 — Create + persist a workbook.
 *
 * Covers test T005 from the MVP test plan: a (logged-in) user creates
 * a new workbook from the dashboard, lands on the sheet page with the
 * grid visible, and enters a value into A1.
 *
 * When Supabase is not configured, the dashboard short-circuits the
 * "New workbook" action to a localStorage-backed workbook. That path
 * is what we exercise here — it's the same UX a paying user would see
 * if their browser temporarily lost connectivity to Supabase.
 *
 * Note on reload-persistence: cell data only round-trips when Supabase
 * is configured AND the user is logged in. The localStorage fallback
 * in `saveService.saveWorkbook` writes the workbook payload, but the
 * sheet page's load path (`/sheet/[id]`) only re-hydrates cell data
 * via Supabase or via the template-injection localStorage key — there
 * is no localStorage-driven cell rehydration today. The reload-after-
 * save contract is pinned by
 * `tests/unit/saveService/saveService.spec.ts`. The second e2e test
 * here therefore validates the in-grid edit + the save round-trip
 * (no error toast) rather than re-fetching after a navigation.
 */
import { test, expect, type Page } from '@playwright/test'
import { createWorkbookFromDashboard } from './helpers/workbook'

/**
 * Type a value into A1 via the formula bar. The formula bar is the
 * most reliable input surface — clicking the canvas directly is
 * coordinate-dependent and brittle across viewports.
 *
 * We click the canvas FIRST so FortuneSheet's
 * `afterSelectionChange` populates Zustand's `selectedCell`. The
 * formula bar's commitValue path bails out when selectedCell is
 * null, which is the default state right after a fresh grid mount.
 */
async function typeInA1(page: Page, value: string): Promise<void> {
  // Click into the canvas at approximate A1 coordinates.
  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  if (box) {
    await page.mouse.click(box.x + 80, box.y + 60)
    await page.waitForTimeout(400)
  }
  // Sync Zustand's selectedCell explicitly — afterSelectionChange may
  // not fire for synthetic mouse clicks on FortuneSheet's canvas in
  // headless dev mode.
  await page.evaluate(() => {
    const w = window as unknown as {
      __qsGrid?: {
        setSelection?: (
          ranges: Array<{ row: [number, number]; column: [number, number] }>,
          opts?: { id?: string }
        ) => void
      }
      __quiksheetsDebug?: {
        getWorkbookState: () => { activeSheetId?: string }
        getSheetState: () => {
          activeSheetIndex: number
          setSelectedCell: (
            cell: { sheet: number; row: number; col: number } | null
          ) => void
        }
      }
    }
    const sid = w.__quiksheetsDebug?.getWorkbookState().activeSheetId
    w.__qsGrid?.setSelection?.([{ row: [0, 0], column: [0, 0] }], sid ? { id: sid } : undefined)
    const sheetState = w.__quiksheetsDebug?.getSheetState()
    sheetState?.setSelectedCell({ sheet: sheetState.activeSheetIndex ?? 0, row: 0, col: 0 })
  })
  await page.waitForTimeout(250)

  const bar = page.locator('.formula-bar-input, [data-testid="formula-bar-input"]').first()
  await bar.click()
  await bar.fill(value)
  await bar.press('Enter')
  await page.waitForTimeout(500)
}

test.describe('T005 — Create + persist a workbook', () => {
  test('clicking New workbook lands on /sheet/<id> with the grid visible', async ({ page }) => {
    await createWorkbookFromDashboard(page)
    expect(page.url()).toMatch(/\/sheet\/[^/]+$/)
  })

  test('values typed into A1 appear in the grid and survive a hot save', async ({ page }) => {
    await createWorkbookFromDashboard(page)
    await typeInA1(page, 'hello')

    // Trigger an explicit save and verify the SaveStatus chip stays
    // out of the error state. We don't assert "Saved" because the
    // chip transitions through several intermediates and we don't
    // want a flake on tight timing.
    await page.keyboard.press('Control+s')
    await page.waitForTimeout(1000)
    const saveStatus = page
      .locator('[class*="SaveStatus"], [data-testid="save-status"]')
      .first()
    if ((await saveStatus.count()) > 0) {
      const statusText = (await saveStatus.textContent()) ?? ''
      expect(statusText.toLowerCase()).not.toMatch(/error|failed/)
    }

    // Re-select A1 and assert the value lives in the Zustand mirror.
    // The grid renders into a canvas so we can't query the cell text
    // directly; the debug bridge is the documented inspection surface.
    await page.locator('body').click()
    await page.keyboard.press('Control+Home')
    await page.waitForTimeout(300)
    const cellValue = await page.evaluate(() => {
      const w = window as unknown as {
        __quiksheetsDebug?: { getSheetState: () => unknown }
      }
      const state = w.__quiksheetsDebug?.getSheetState() as
        | undefined
        | { gridSheets: Array<{ status?: number; data?: unknown[][] }> }
      const sheets = state?.gridSheets ?? []
      const active = sheets.find((s) => s.status === 1) ?? sheets[0]
      const cell = active?.data?.[0]?.[0] as
        | undefined
        | { v?: unknown; m?: unknown }
        | null
      return cell ? String(cell.m ?? cell.v ?? '') : ''
    })
    expect(cellValue.toLowerCase()).toContain('hello')
  })
})
