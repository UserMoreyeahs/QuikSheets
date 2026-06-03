/**
 * Persistence — the user-reported bug: "data I add disappears next time I
 * open the workbook." Root cause was that the sheet page never LOADED saved
 * data on open (only saved it), and local saves collided on a shared
 * name-based key. Fixed by id-keyed saves + useLoadWorkbookDataOnMount.
 *
 * Real Chromium (the headless preview can't paint the canvas). No-auth demo
 * workbook (start the dev server with NEXT_PUBLIC_SUPABASE_URL unset).
 *
 * Flow: type a value → Ctrl+S (immediate save; autosave is 30s-debounced) →
 * RELOAD the page → assert the value is still there.
 */
import { test, expect, type Page } from '@playwright/test'
import { gotoSheet } from './helpers'

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

test.describe('Workbook data persists across reload', () => {
  test('typed value survives an immediate save + full page reload', async ({ page }) => {
    await gotoSheet(page, 'demo')
    await focusCell(page)

    await page.keyboard.type('PERSISTME', { delay: 50 })
    await page.keyboard.press('Enter')
    await page.waitForTimeout(400)

    // Immediate save (autosave is 30s-debounced; Ctrl+S flushes now).
    await page.keyboard.press('Control+s')
    await page.waitForTimeout(1200)

    // Sanity: it's in the store before reload.
    expect(await columnZeroHas(page, 'PERSISTME')).toBe(true)

    // The actual test: reload the page and confirm the load-on-open hook
    // restored the saved data.
    await page.reload()
    await gotoSheet(page, 'demo') // re-wait for grid + debug bridge
    await page.waitForTimeout(1500) // allow the async load hook to hydrate

    expect(
      await columnZeroHas(page, 'PERSISTME'),
      'saved value should be restored after reload',
    ).toBe(true)
  })

  test('typed value persists via autosave (no Ctrl+S) after a short pause', async ({ page }) => {
    await gotoSheet(page, 'demo')
    await focusCell(page, 90, 95)

    await page.keyboard.type('AUTOSAVED', { delay: 50 })
    await page.keyboard.press('Enter')

    // No Ctrl+S — just wait past the 2s autosave debounce, then reload.
    await page.waitForTimeout(3200)
    await page.reload()
    await gotoSheet(page, 'demo')
    await page.waitForTimeout(1500)

    expect(
      await columnZeroHas(page, 'AUTOSAVED'),
      'autosaved value should survive reload without an explicit save',
    ).toBe(true)
  })
})
