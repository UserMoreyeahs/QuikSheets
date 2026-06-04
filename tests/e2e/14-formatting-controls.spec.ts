/**
 * Ribbon Home-tab formatting controls — real-browser smoke suite.
 *
 * Fills the coverage gap that hid the font-size bug: automated tests never
 * clicked these controls. Each test selects a valued cell, clicks the REAL
 * ribbon button, and asserts the corresponding FortuneSheet cell attribute
 * landed in the store (bl/it/un/cl/ht/ct). Catches any control that silently
 * no-ops.
 *
 * Real Chromium; no-auth demo.
 */
import { test, expect, type Page } from '@playwright/test'
import { gotoSheet } from './helpers'

async function act(page: Page, body: string): Promise<void> {
  await page.evaluate((b) => {
    const w = window as unknown as { __quiksheetsDebug?: { getSheetState: () => Record<string, unknown> } }
    new Function('s', b)(w.__quiksheetsDebug!.getSheetState())
  }, body)
}

/** Read C3 (row 2, col 2) cell object from the store mirror. */
async function readC3(page: Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => {
    const w = window as unknown as { __quiksheetsDebug?: { getSheetState: () => Record<string, unknown> } }
    const sheets = (w.__quiksheetsDebug!.getSheetState().gridSheets as Array<{ status?: number; data?: Array<Array<Record<string, unknown> | null>> }>) ?? []
    const sh = sheets.find((x) => x.status === 1) ?? sheets[0]
    return sh?.data?.[2]?.[2] ?? null
  })
}

async function clickFormat(page: Page, label: string): Promise<void> {
  // Re-assert the selection (clicking a control must not require it, but keep
  // it deterministic), then click the real ribbon button.
  await act(page, 's.setSelectedCell({row:2,col:2}); s.setSelectedRange(null)')
  const btn = page.locator(`[aria-label="${label}"], [title="${label}"]`).first()
  await expect(btn, `"${label}" button should exist`).toHaveCount(1)
  await btn.click()
  await page.waitForTimeout(350)
}

test('Home-tab formatting controls apply to the selected cell', async ({ page }) => {
  await gotoSheet(page, 'demo')
  await page.waitForTimeout(1200)
  await act(page, "s.gridInstance.setCellValue(2,2,'FmtTest')")
  await page.waitForTimeout(300)

  await clickFormat(page, 'Bold')
  expect((await readC3(page))?.bl, 'Bold → bl').toBeTruthy()

  await clickFormat(page, 'Italic')
  expect((await readC3(page))?.it, 'Italic → it').toBeTruthy()

  await clickFormat(page, 'Underline')
  expect((await readC3(page))?.un, 'Underline → un').toBeTruthy()

  await clickFormat(page, 'Strikethrough')
  expect((await readC3(page))?.cl, 'Strikethrough → cl').toBeTruthy()

  // Align right → ht === 2 (left=1, center=0, right=2).
  await clickFormat(page, 'Align right')
  expect((await readC3(page))?.ht, 'Align right → ht=2').toBe(2)

  // Percent style → ct (number format object) present.
  await clickFormat(page, 'Percent Style')
  const ct = (await readC3(page))?.ct as { fa?: string } | undefined
  expect(ct?.fa, 'Percent Style → ct.fa set').toBeTruthy()
})
