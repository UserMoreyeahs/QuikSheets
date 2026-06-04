/**
 * Font size (ribbon Home tab) — regression for the user-reported
 * "can't increase/decrease font size".
 *
 * Root cause: font size DID apply (fs landed + canvas repainted) but the row
 * height never grew, so larger text was clipped by the default ~19px row and on
 * empty cells the change was invisible — so it READ as "not working". Fix: the
 * format path now grows the affected rows to fit the font (grow-only).
 *
 * Pins: (1) the Increase Font Size button raises the selected cell's fs;
 *       (2) applying a large font grows the row height (the fix).
 * Real Chromium; no-auth demo.
 */
import { test, expect, type Page } from '@playwright/test'
import { gotoSheet } from './helpers'

async function clickCell(page: Page, x: number, y: number): Promise<void> {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('canvas') as HTMLCanvasElement | null
      return !!el && el.offsetWidth > 100 && el.offsetHeight > 100
    },
    { timeout: 25_000 },
  )
  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('no canvas box')
  await page.mouse.click(box.x + x, box.y + y)
  await page.waitForTimeout(400)
}

async function act(page: Page, body: string): Promise<void> {
  await page.evaluate((b) => {
    const w = window as unknown as { __quiksheetsDebug?: { getSheetState: () => Record<string, unknown> } }
    new Function('s', b)(w.__quiksheetsDebug!.getSheetState())
  }, body)
}

test('Increase Font Size button raises the selected cell font size', async ({ page }) => {
  await gotoSheet(page, 'demo')
  await page.waitForTimeout(1000)
  await clickCell(page, 140, 95)

  const inc = page.locator('[aria-label="Increase Font Size"], [title="Increase Font Size"]').first()
  await expect(inc).toHaveCount(1)
  await inc.click()
  await page.waitForTimeout(500)

  const fs = await page.evaluate(() => {
    const w = window as unknown as { __quiksheetsDebug?: { getSheetState: () => Record<string, unknown> } }
    const s = w.__quiksheetsDebug!.getSheetState()
    const cell = s.selectedCell as { row: number; col: number } | null
    const sheets = (s.gridSheets as Array<{ status?: number; data?: Array<Array<{ fs?: number } | null>> }>) ?? []
    const sh = sheets.find((x) => x.status === 1) ?? sheets[0]
    return cell ? sh?.data?.[cell.row]?.[cell.col]?.fs : undefined
  })
  expect(fs, 'selected cell should have a larger font size after clicking Increase').toBeGreaterThan(11)
})

test('applying a large font grows the row height (no clipping)', async ({ page }) => {
  await gotoSheet(page, 'demo')
  await page.waitForTimeout(1200)

  await act(page, "s.gridInstance.setCellValue(1,1,'SizeTest')")
  await page.waitForTimeout(300)

  const rowHeightBefore = await page.evaluate(() => {
    const w = window as unknown as { __quiksheetsDebug?: { getSheetState: () => Record<string, unknown> } }
    const inst = w.__quiksheetsDebug!.getSheetState().gridInstance as { getRowHeight?: (r: number[]) => Record<number, number> }
    return inst.getRowHeight?.([1])?.[1] ?? 19
  })

  await act(page, "s.setSelectedCell({row:1,col:1}); s.setSelectedRange(null); s.applyFormatToSelection({fontSize:48})")
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'test-results/font-fixed.png' })

  const rowHeightAfter = await page.evaluate(() => {
    const w = window as unknown as { __quiksheetsDebug?: { getSheetState: () => Record<string, unknown> } }
    const inst = w.__quiksheetsDebug!.getSheetState().gridInstance as { getRowHeight?: (r: number[]) => Record<number, number> }
    return inst.getRowHeight?.([1])?.[1] ?? 19
  })

  expect(rowHeightAfter, `row should grow to fit font 48 (was ${rowHeightBefore})`).toBeGreaterThan(rowHeightBefore)
  expect(rowHeightAfter).toBeGreaterThan(50)
})
