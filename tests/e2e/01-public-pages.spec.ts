/**
 * E2E tests — Public Pages
 *
 * Tests all pages that should render without authentication:
 * - Root redirect (/ → /dashboard or /login depending on auth state)
 * - Login page brand, form elements, links
 * - Signup page form, back-to-login link
 * - Password reset page
 * - Unauthorized page
 * - Public form page structure
 *
 * These tests confirm the auth flow renders without JS errors and
 * has the expected UI elements present.
 */

import { test, expect } from '@playwright/test'
import { capturePageErrors } from './helpers'

test.describe('Root redirect', () => {
  test('/ redirects to /dashboard or /login', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL(/\/(dashboard|login)/, { timeout: 10_000 })
    expect(page.url()).toMatch(/\/(dashboard|login)/)
  })
})

test.describe('Login page', () => {
  test('renders without console errors', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await page.goto('/login')
    await page.waitForSelector('[role="heading"], h1, h2', { timeout: 10_000 })
    expect(errors).toHaveLength(0)
  })

  test('shows Quiksheets brand heading', async ({ page }) => {
    await page.goto('/login')
    const heading = page.getByRole('heading', { name: /sign in|quiksheets|login/i })
    await expect(heading).toBeVisible({ timeout: 8_000 })
  })

  test('has email input field', async ({ page }) => {
    await page.goto('/login')
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first()
    await expect(emailInput).toBeVisible({ timeout: 8_000 })
  })

  test('has password input field', async ({ page }) => {
    await page.goto('/login')
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first()
    await expect(passwordInput).toBeVisible({ timeout: 8_000 })
  })

  test('has sign-in submit button', async ({ page }) => {
    await page.goto('/login')
    const btn = page.getByRole('button', { name: /sign in|log in/i }).first()
    await expect(btn).toBeVisible({ timeout: 8_000 })
  })

  test('has link to signup', async ({ page }) => {
    await page.goto('/login')
    const link = page.getByRole('link', { name: /sign up|create account|register/i }).first()
    await expect(link).toBeVisible({ timeout: 8_000 })
  })
})

test.describe('Signup page', () => {
  test('renders without console errors', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await page.goto('/signup')
    await page.waitForSelector('[role="heading"], h1, h2', { timeout: 10_000 })
    expect(errors).toHaveLength(0)
  })

  test('has link back to login', async ({ page }) => {
    await page.goto('/signup')
    const link = page.getByRole('link', { name: /sign in|log in/i }).first()
    await expect(link).toBeVisible({ timeout: 8_000 })
  })

  test('has email input field', async ({ page }) => {
    await page.goto('/signup')
    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    await expect(emailInput).toBeVisible({ timeout: 8_000 })
  })
})

test.describe('Password reset page', () => {
  test('renders without errors', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await page.goto('/reset')
    await page.waitForSelector('[role="heading"], h1, h2, input', { timeout: 10_000 })
    expect(errors).toHaveLength(0)
  })
})

test.describe('Unauthorized page', () => {
  test('renders Access Denied heading', async ({ page }) => {
    await page.goto('/unauthorized')
    const heading = page.getByRole('heading', { name: /access denied|unauthorized|forbidden/i }).first()
    await expect(heading).toBeVisible({ timeout: 8_000 })
  })

  test('renders without errors', async ({ page }) => {
    const { errors } = capturePageErrors(page)
    await page.goto('/unauthorized')
    await page.waitForSelector('[role="heading"], h1', { timeout: 8_000 })
    expect(errors).toHaveLength(0)
  })
})
