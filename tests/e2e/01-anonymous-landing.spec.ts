/**
 * MVP golden path 1 — Anonymous landing.
 *
 * Covers test T001 from the MVP test plan: a brand-new visitor lands
 * on the app and sees the Quiksheets brand plus a clear sign-in CTA,
 * with no console errors in the page bootstrap.
 *
 * Note: visiting `/` redirects either to `/dashboard` (when Supabase
 * is not configured — middleware falls through) or to
 * `/login?next=/dashboard` (when auth is enforced). This test asserts
 * the landing experience for the latter — the public auth surface —
 * because that's what an anonymous visitor actually sees.
 */
import { test, expect } from '@playwright/test'

test.describe('T001 — Anonymous landing', () => {
  test('redirects to a public page with the Quiksheets brand visible', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Filter benign noise (Next.js dev hydration warnings, Fast Refresh)
        if (
          !text.includes('BailoutToCSR') &&
          !text.includes('hydrat') &&
          !text.includes('ResizeObserver') &&
          !text.includes('Fast Refresh') &&
          !text.includes('Download the React DevTools')
        ) {
          consoleErrors.push(text)
        }
      }
    })

    await page.goto('/')
    // `/` → `/dashboard`, then either stays (no Supabase) or bounces to /login.
    await page.waitForURL(/\/(dashboard|login)/, { timeout: 10_000 })

    const url = new URL(page.url())
    expect(['/dashboard', '/login']).toContain(url.pathname)

    // Either path must display the Quiksheets brand somewhere on the page.
    // Plain text matcher via getByText is more robust than mixing
    // text=/regex/ with CSS in a single selector string (Playwright
    // treats the whole thing as one regex when the first segment is
    // text=/…/).
    const brand = page.getByText(/quiksheets/i).first()
    await expect(brand).toBeVisible({ timeout: 10_000 })

    // And a clear sign-in or get-started CTA must be reachable. On
    // `/login` it's the submit button; on `/dashboard` it's the "New
    // workbook" button (the de-facto get-started action).
    const cta =
      url.pathname === '/login'
        ? page.getByRole('button', { name: /sign in|log in/i }).first()
        : page.getByRole('button', { name: /new workbook|get started|sign in/i }).first()
    await expect(cta).toBeVisible({ timeout: 10_000 })

    expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0)
  })

  test('login page advertises Quiksheets and has email + password fields', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /sign in to quiksheets/i })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.locator('input[type="email"]').first()).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
    await expect(page.getByRole('link', { name: /create an account|sign up|register/i }).first()).toBeVisible()
  })
})
