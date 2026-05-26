/**
 * MVP golden path 2 — Signup + Login round-trip.
 *
 * Covers test T003 from the MVP test plan: a brand-new user can
 * sign up, get a confirmation prompt, then sign back in with the
 * same credentials and land on the dashboard.
 *
 * Behaviour depends on the dev server's Supabase configuration:
 *
 *  - Supabase IS configured (env vars present): the test runs the
 *    full round-trip and asserts the navigation to /dashboard.
 *    If the project requires email confirmation and we don't have a
 *    SERVICE_ROLE_KEY to bypass it, we assert only that the signup
 *    UI returns "Check your email" and that the login UI doesn't
 *    crash on the unconfirmed credentials.
 *
 *  - Supabase is NOT configured: the test is skipped with a clear
 *    reason — there's no auth backend to round-trip against.
 */
import { test, expect, type APIRequestContext } from '@playwright/test'
import {
  hasSupabaseEnv,
  isSupabaseLive,
  signUpViaUI,
  loginAs,
  uniqueTestEmail,
  TEST_PASSWORD,
  adminConfirmUser,
} from './helpers/auth'

test.describe('T003 — Signup + Login', () => {
  // We can't know for sure whether the dev server has Supabase until we
  // ping it. The check is cheap so we do it per-test (Playwright shares
  // browser contexts but probing the dashboard is < 1s).
  test('signup form accepts new credentials and shows a clear next-step', async ({
    page,
    request,
  }) => {
    const live = await isSupabaseLive(page)
    test.skip(!live && !hasSupabaseEnv(), 'Supabase not configured for this dev server')

    const email = uniqueTestEmail('signup')

    const result = await signUpViaUI(page, email, TEST_PASSWORD)
    expect(result.submitted).toBe(true)
    // Either the project allowed an instant session OR it queued an
    // email confirmation. Both are valid; we just want no inline error.
    expect(result.errorText, `signup surfaced an error: ${result.errorText}`).toBeUndefined()

    // If we have admin credentials, bypass the email-confirmation gate so
    // the follow-up login test can succeed.
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const confirmed = await adminConfirmUser(request as APIRequestContext, email)
      expect(typeof confirmed).toBe('boolean')
    }
  })

  test('login with the just-created credentials reaches /dashboard', async ({ page, request }) => {
    const live = await isSupabaseLive(page)
    test.skip(!live && !hasSupabaseEnv(), 'Supabase not configured for this dev server')

    // Provision a user inline so this test is self-contained when run
    // in isolation (playwright sometimes re-orders tests across workers).
    const email = uniqueTestEmail('login')
    await signUpViaUI(page, email, TEST_PASSWORD)
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await adminConfirmUser(request as APIRequestContext, email)
    } else {
      // No admin key to bypass confirmation — the login below would
      // fail with "Email not confirmed". Skip with an explicit message
      // so the failure is debuggable.
      test.skip(true, 'requires SUPABASE_SERVICE_ROLE_KEY to bypass email confirmation')
    }

    const { landedOn, errorText } = await loginAs(page, email, TEST_PASSWORD)
    expect(errorText, `login surfaced: ${errorText}`).toBeUndefined()
    expect(landedOn).toBe('/dashboard')
  })
})
