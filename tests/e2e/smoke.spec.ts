import { test, expect } from '@playwright/test'

test.describe('Quiksheets smoke', () => {
  test('/ redirects to /dashboard or /login (auth-guarded)', async ({ page }) => {
    await page.goto('/')
    // Without auth: middleware redirects / → /dashboard → /login?next=/dashboard
    // With auth:    / → /dashboard directly
    await page.waitForURL(/\/(dashboard|login)/, { timeout: 10_000 })
    expect(page.url()).toMatch(/\/(dashboard|login)/)
  })

  test('login page renders the Quiksheets brand', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /Sign in to Quiksheets/i })).toBeVisible()
  })

  test('signup page links back to login', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByRole('link', { name: /Sign in/i })).toBeVisible()
  })

  test('unauthorized page renders', async ({ page }) => {
    await page.goto('/unauthorized')
    await expect(page.getByRole('heading', { name: /Access denied/i })).toBeVisible()
  })
})
