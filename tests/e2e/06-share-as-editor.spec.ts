/**
 * MVP golden path 6 — Share as editor (T011 regression).
 *
 * Covers test T019 from the MVP test plan and the T011 regression
 * pinned in `tests/unit/permissions/sheetApi.spec.ts`. An owner
 * creates a workbook, opens the Share dialog, and invites Editor B
 * by email. Editor B logs in in an isolated browser context, opens
 * the workbook from their dashboard, types into a cell, reloads,
 * and the edit persists.
 *
 * This flow requires two Supabase-backed accounts AND a service-role
 * key to bypass email confirmation. When those aren't available we
 * skip with a clear reason — the same test runs in CI against the
 * staging Supabase project where both are configured.
 *
 * The unit test at `tests/unit/permissions/sheetApi.spec.ts`
 * already pins the owner/editor/viewer/stranger × load/save matrix
 * deterministically; this e2e is the live-stack version that catches
 * RLS / session-cookie regressions the unit test cannot see.
 */
import { test, expect, type Browser, type Page, type APIRequestContext } from '@playwright/test'
import {
  hasSupabaseEnv,
  isSupabaseLive,
  signUpViaUI,
  loginAs,
  uniqueTestEmail,
  TEST_PASSWORD,
  adminConfirmUser,
} from './helpers/auth'

async function waitForGrid(page: Page, timeout = 25_000): Promise<void> {
  await page.waitForFunction(
    () => !!document.querySelector('[class*="luckysheet"], canvas'),
    { timeout }
  )
}

async function provisionUser(
  browser: Browser,
  request: APIRequestContext,
  label: string
): Promise<{ email: string; ctx: Awaited<ReturnType<Browser['newContext']>> }> {
  const email = uniqueTestEmail(label)
  // Use a throwaway context purely for signup; the test contexts are
  // separate so cookies don't leak between owner and editor.
  const signupCtx = await browser.newContext()
  const signupPage = await signupCtx.newPage()
  await signUpViaUI(signupPage, email, TEST_PASSWORD)
  await adminConfirmUser(request, email)
  await signupCtx.close()

  // Build a fresh, isolated context for the actual test session.
  const ctx = await browser.newContext()
  return { email, ctx }
}

test.describe('T011 — Share as editor', () => {
  test('owner invites Editor B, Editor B sees + edits the workbook', async ({
    browser,
    request,
    page,
  }) => {
    const live = await isSupabaseLive(page)
    test.skip(
      !live || !hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY,
      'T011 requires Supabase + SERVICE_ROLE_KEY for two-user setup. Unit test at tests/unit/permissions/sheetApi.spec.ts already pins the contract.'
    )

    // Provision both users up-front.
    const owner = await provisionUser(browser, request, 'owner')
    const editor = await provisionUser(browser, request, 'editor')

    // ---- Owner: create workbook, type content, invite editor. ----
    const ownerPage = await owner.ctx.newPage()
    await loginAs(ownerPage, owner.email, TEST_PASSWORD)
    await ownerPage.waitForURL(/\/dashboard/, { timeout: 10_000 })

    await ownerPage.getByRole('button', { name: /new workbook/i }).first().click()
    await ownerPage.waitForURL(/\/sheet\/[^/]+/, { timeout: 15_000 })
    await waitForGrid(ownerPage)
    const sheetUrl = ownerPage.url()
    const workbookId = sheetUrl.match(/\/sheet\/([^/?#]+)/)?.[1]
    expect(workbookId, 'workbook id parseable').toBeTruthy()

    // Type a marker into A1 the editor can verify.
    await ownerPage.locator('body').click()
    await ownerPage.keyboard.press('Control+Home')
    await ownerPage.waitForTimeout(150)
    const ownerBar = ownerPage
      .locator('.formula-bar-input, [data-testid="formula-bar-input"]')
      .first()
    await ownerBar.click()
    await ownerBar.fill('owner-mark')
    await ownerBar.press('Enter')
    await ownerPage.keyboard.press('Control+s')
    await ownerPage.waitForTimeout(800)

    // Open Share dialog via the keyboard-driven debug bridge — the
    // ribbon's Share button has shifted locations across releases.
    await ownerPage.evaluate(() => {
      const w = window as unknown as {
        __quiksheetsDebug?: { share?: { open?: () => void } }
      }
      w.__quiksheetsDebug?.share?.open?.()
    })
    await ownerPage.waitForTimeout(400)

    const shareDialog = ownerPage.locator('[role="dialog"], [class*="ShareDialog"]').first()
    await expect(shareDialog).toBeVisible({ timeout: 8_000 })

    // Fill the invitee form. The collaboration ShareDialog uses an
    // email input + role select + submit button.
    await shareDialog.locator('input[type="email"]').first().fill(editor.email)
    // Role defaults to "editor"; no need to change.
    await shareDialog.locator('button[type="submit"], button:has-text("Invite")').first().click()
    await ownerPage.waitForTimeout(1500)

    // ---- Editor: log in, open workbook, edit, reload. ----
    const editorPage = await editor.ctx.newPage()
    await loginAs(editorPage, editor.email, TEST_PASSWORD)
    await editorPage.waitForURL(/\/dashboard/, { timeout: 10_000 })

    // The shared workbook should appear on Editor B's dashboard.
    // Click it directly via its URL — the dashboard grid is async
    // and using the URL avoids a flake while membership rows
    // propagate.
    await editorPage.goto(sheetUrl)
    await waitForGrid(editorPage)

    // Editor B should see the owner-mark in A1.
    await editorPage.waitForTimeout(1200)
    const seenByEditor = await editorPage.evaluate(() => {
      const w = window as unknown as {
        __quiksheetsDebug?: { getSheetState: () => unknown }
      }
      const state = w.__quiksheetsDebug?.getSheetState() as
        | undefined
        | { gridSheets: Array<{ status?: number; data?: unknown[][] }> }
      const sheets = state?.gridSheets ?? []
      const active = sheets.find((s) => s.status === 1) ?? sheets[0]
      const cell = active?.data?.[0]?.[0] as undefined | { v?: unknown; m?: unknown } | null
      return cell ? String(cell.m ?? cell.v ?? '') : ''
    })
    expect(seenByEditor).toContain('owner-mark')

    // Editor B types into B1 and reloads.
    await editorPage.locator('body').click()
    await editorPage.keyboard.press('Control+Home')
    await editorPage.keyboard.press('ArrowRight') // → B1
    await editorPage.waitForTimeout(150)
    const editorBar = editorPage
      .locator('.formula-bar-input, [data-testid="formula-bar-input"]')
      .first()
    await editorBar.click()
    await editorBar.fill('editor-mark')
    await editorBar.press('Enter')
    await editorPage.keyboard.press('Control+s')
    await editorPage.waitForTimeout(1500)

    await editorPage.goto(sheetUrl)
    await waitForGrid(editorPage)
    await editorPage.waitForTimeout(1500)

    const editorAfterReload = await editorPage.evaluate(() => {
      const w = window as unknown as {
        __quiksheetsDebug?: { getSheetState: () => unknown }
      }
      const state = w.__quiksheetsDebug?.getSheetState() as
        | undefined
        | { gridSheets: Array<{ status?: number; data?: unknown[][] }> }
      const sheets = state?.gridSheets ?? []
      const active = sheets.find((s) => s.status === 1) ?? sheets[0]
      const cell = active?.data?.[0]?.[1] as undefined | { v?: unknown; m?: unknown } | null
      return cell ? String(cell.m ?? cell.v ?? '') : ''
    })
    expect(editorAfterReload).toContain('editor-mark')

    await owner.ctx.close()
    await editor.ctx.close()
  })
})
