/**
 * Playwright E2E configuration for Quiksheets.
 *
 * Test structure:
 *   tests/e2e/
 *     smoke.spec.ts          — Quick public-page checks (CI gate)
 *     01-public-pages.spec.ts — Auth flow pages (login, signup, unauthorized)
 *     02-sheet-load.spec.ts   — Sheet page loads & FortuneSheet grid renders
 *     03-ribbon.spec.ts       — All ribbon tabs (Home/Insert/Data/…) no-crash
 *     04-keyboard-shortcuts.spec.ts — All 19+ keyboard shortcuts no-crash
 *     05-formula-engine.spec.ts     — Formula bar, autocomplete, AI trigger
 *     06-data-operations.spec.ts    — Sort / Filter / Find&Replace / DataValidation
 *     07-import-export.spec.ts      — CSV/XLSX export, import modal, Ctrl+S
 *     08-feature-panels.spec.ts     — Dep map, scratchpad, CF, charts, pivot, forms
 *
 * Running tests:
 *   npm run test:e2e              — All tests (starts dev server)
 *   npm run test:e2e:headed       — See the browser
 *   npx playwright test smoke     — Just the smoke suite
 *   PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e  — Use existing server
 *
 * Authentication:
 *   The sheet page (/sheet/demo) bypasses auth when NEXT_PUBLIC_SUPABASE_URL
 *   is not set (middleware falls through). Local dev tests work without credentials.
 */

import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = {
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    /** Give the FortuneSheet canvas up to 10s per action to appear */
    actionTimeout: 10_000,
    /** Screenshot on failure for easier debugging */
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
}

if (process.env.CI) {
  config.workers = 1
} else {
  config.webServer = {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  }
}

export default defineConfig(config)
