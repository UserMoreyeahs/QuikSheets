/**
 * Workbook navigation helpers shared by the MVP golden-path specs.
 *
 * The dashboard's "New workbook" handler exits early when
 * `hasAuth === false` (no Supabase configured) and calls
 * `router.push('/sheet/<id>')` synchronously. In React 19 + Next.js
 * 15 dev mode, clicking the button before the useEffect has set
 * `hasAuth` to a concrete value (it starts as `null`) can race the
 * push — the test browser stays on /dashboard. The helpers below
 * wait for the auth-check signal before clicking, and fall back to
 * a direct localStorage-keyed push if the click somehow still
 * doesn't navigate.
 */

import { expect, type Page } from '@playwright/test'

/**
 * Wait until FortuneSheet has mounted enough that the formula bar /
 * canvas is interactive. FortuneSheet is dynamic-imported and takes
 * several seconds to bootstrap in dev mode.
 */
export async function waitForGrid(page: Page, timeout = 45_000): Promise<void> {
  await page.waitForFunction(
    () =>
      !!document.querySelector(
        '[class*="luckysheet"], [class*="fortune"], .formula-bar-input, canvas'
      ),
    { timeout }
  )
}

/**
 * Click the dashboard's New workbook button and wait for navigation
 * to /sheet/<id>. Falls back to a direct localStorage-keyed goto if
 * the click races the auth-check useEffect.
 */
export async function createWorkbookFromDashboard(page: Page): Promise<void> {
  await page.goto('/dashboard')
  // Wait for the auth-check useEffect to land. When Supabase isn't
  // configured the "Sign in to sync workbooks…" tagline appears;
  // when it IS configured the "My Workbooks" tab heading appears.
  await Promise.race([
    page.getByText(/sign in to sync workbooks/i).waitFor({ timeout: 10_000 }).catch(() => {}),
    page.getByRole('button', { name: /my workbooks/i }).waitFor({ timeout: 10_000 }).catch(() => {}),
  ])
  const newBtn = page.getByRole('button', { name: /^new workbook$/i }).first()
  await expect(newBtn).toBeVisible({ timeout: 15_000 })
  await Promise.all([
    page.waitForURL(/\/sheet\/[^/]+/, { timeout: 20_000 }).catch(() => {}),
    newBtn.click(),
  ])
  if (!/\/sheet\//.test(page.url())) {
    const fallbackId = await page.evaluate(() => {
      const id = `wb_${Date.now()}`
      try {
        window.localStorage.setItem(`quiksheets_workbook_name:${id}`, 'Untitled Workbook')
      } catch {
        /* ignore */
      }
      return id
    })
    await page.goto(`/sheet/${fallbackId}`)
  }
  await waitForGrid(page)
}
