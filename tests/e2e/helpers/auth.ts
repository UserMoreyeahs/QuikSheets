/**
 * Auth helpers for MVP golden-path E2E tests.
 *
 * The Quiksheets middleware lets requests through when
 * NEXT_PUBLIC_SUPABASE_URL is not set, so local dev can drive the
 * authenticated UI without ever hitting Supabase. The helpers below
 * are written to work in BOTH modes:
 *
 *  - Supabase configured: real signup/login via the server actions.
 *  - Supabase NOT configured: the dashboard / sheet pages are
 *    reachable directly, and `loginAs` is a no-op that just navigates.
 *
 * Tests that *require* a real Supabase round-trip should call
 * `requireSupabase()` in a `beforeAll` and skip when it returns false.
 */

import { type Page, type APIRequestContext } from '@playwright/test'

/**
 * Returns true if NEXT_PUBLIC_SUPABASE_URL + ANON_KEY are present in
 * the current process environment. Tests that need Supabase round-trip
 * should `test.skip(!hasSupabaseEnv(), 'requires Supabase')`.
 */
export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

/**
 * Detects whether the running dev server has Supabase configured by
 * probing the login page. When Supabase is absent the login form is
 * still rendered (it just never has a session to consume), so this
 * function instead probes the dashboard: if visiting `/dashboard`
 * lands on `/login`, Supabase IS configured and auth is enforced.
 */
export async function isSupabaseLive(page: Page): Promise<boolean> {
  await page.goto('/dashboard')
  // Give middleware time to redirect
  await page
    .waitForURL(/\/(dashboard|login)/, { timeout: 5_000 })
    .catch(() => {
      /* fall through */
    })
  return /\/login/.test(page.url())
}

/**
 * Sign up a new user via the public signup form. Works against the
 * real Supabase project when env vars are set; otherwise the form
 * submission succeeds against a stub (the action returns ok: true
 * even when Supabase is not configured, so the test still drives
 * the UI without erroring).
 *
 * Returns `{ submitted: true, confirmShown }` where `confirmShown` is
 * true when the post-submit "Check your email" confirmation panel
 * appeared.
 */
export async function signUpViaUI(
  page: Page,
  email: string,
  password: string
): Promise<{ submitted: boolean; confirmShown: boolean; errorText?: string }> {
  await page.goto('/signup')
  await page.locator('input[type="email"]').first().fill(email)
  await page.locator('input[type="password"]').first().fill(password)
  await page.getByRole('button', { name: /create account/i }).click()
  // Wait briefly for either the confirmation panel or an inline error
  await page.waitForTimeout(1500)
  const confirm = page.getByText(/check your email/i)
  const errorBanner = page.locator('p.text-red-600').first()
  const confirmShown = (await confirm.count()) > 0
  const errorText =
    (await errorBanner.count()) > 0 ? (await errorBanner.textContent()) ?? '' : ''
  return {
    submitted: true,
    confirmShown,
    ...(errorText ? { errorText } : {}),
  }
}

/**
 * Sign in a user via the public login form. Returns `{ landedOn }`
 * — the path the page is on after the submit completes (e.g.
 * `/dashboard` on success, `/login` on failure).
 *
 * When Supabase isn't configured, the form simply submits without
 * doing anything and the page stays on `/login`.
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string
): Promise<{ landedOn: string; errorText?: string }> {
  await page.goto('/login')
  await page.locator('input[type="email"]').first().fill(email)
  await page.locator('input[type="password"]').first().fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  // Either redirect to /dashboard OR stay on /login with error
  await page
    .waitForURL(/\/(dashboard|login)/, { timeout: 8_000 })
    .catch(() => {
      /* not navigated — page stayed on /login */
    })
  const errorBanner = page.locator('p.text-red-600').first()
  const errorText = (await errorBanner.count()) > 0 ? (await errorBanner.textContent()) ?? undefined : undefined
  return {
    landedOn: new URL(page.url()).pathname,
    ...(errorText ? { errorText } : {}),
  }
}

/**
 * Generate a unique-per-test email so signup/login tests are
 * repeatable when re-run against the same Supabase project.
 */
export function uniqueTestEmail(label = 'e2e'): string {
  return `test+${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@quiksheets-e2e.local`
}

/**
 * Default test password (>=8 chars, satisfies the signup form's
 * minLength constraint).
 */
export const TEST_PASSWORD = 'Testpass123!'

/**
 * Confirm the user via Supabase admin API. Only works when
 * SUPABASE_SERVICE_ROLE_KEY is set. No-op otherwise.
 *
 * Quiksheets signup sends a confirmation email; in test mode we
 * skip the email round-trip by either disabling confirmation in
 * the Supabase project settings OR using the admin API to mark
 * the user confirmed. This helper does the latter.
 */
export async function adminConfirmUser(
  request: APIRequestContext,
  email: string
): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return false
  // Look up user id via admin list endpoint
  const list = await request.get(`${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  })
  if (!list.ok()) return false
  const body = await list.json().catch(() => ({}))
  const u = (body.users ?? [])[0]
  if (!u?.id) return false
  const upd = await request.put(`${url}/auth/v1/admin/users/${u.id}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    data: { email_confirm: true },
  })
  return upd.ok()
}
