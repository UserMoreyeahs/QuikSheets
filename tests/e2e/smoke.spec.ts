import { test, expect } from '@playwright/test'

test.describe('Quiksheets smoke', () => {
  test('redirects / to /dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/dashboard$/)
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
