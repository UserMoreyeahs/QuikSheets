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

/**
 * The dev server port. Defaults to 3000 to match every other Next.js
 * tutorial on the planet, but can be overridden by setting
 * `PLAYWRIGHT_DEV_PORT` — useful when a sibling git worktree is
 * holding 3000 and Next.js falls through to 3001 / 3002.
 */
const DEV_PORT = process.env.PLAYWRIGHT_DEV_PORT ?? '3000'

/**
 * The webServer URL. Defaults to localhost:DEV_PORT but can be
 * overridden by PLAYWRIGHT_BASE_URL (e.g. to test against a deployed
 * preview).
 */
const TARGET_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${DEV_PORT}`

const config: PlaywrightTestConfig = {
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  // The default 30s per-test timeout is tight for the MVP golden-path
  // suite — those tests dynamic-import FortuneSheet and HyperFormula
  // (several seconds in dev), exercise the full create-edit-reload
  // cycle, and in CI also round-trip Supabase. Bump to 90s.
  timeout: 90_000,
  // globalSetup builds the sample.xlsx fixture used by 04-import-xlsx
  // and any future tests that need pre-built workbooks on disk.
  globalSetup: require.resolve('./tests/e2e/fixtures/generateSampleXlsx.ts'),
  use: {
    baseURL: TARGET_URL,
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
}

// Spawn `npm run dev` on DEV_PORT whenever the user hasn't pointed
// us at a fully-qualified remote (e.g. a Vercel preview). Setting
// PLAYWRIGHT_DEV_PORT to a free port lets sibling worktrees coexist;
// setting PLAYWRIGHT_BASE_URL to an https://… URL skips the spawn
// entirely. `reuseExistingServer: true` is essential so iterating
// inside `npm run test:e2e` doesn't restart Next.js on every run.
const targetingRemote = /^https?:\/\//.test(process.env.PLAYWRIGHT_BASE_URL ?? '')
  && !TARGET_URL.startsWith('http://localhost')
if (!process.env.CI && !targetingRemote) {
  config.webServer = {
    command: `npm run dev -- -p ${DEV_PORT}`,
    url: TARGET_URL,
    reuseExistingServer: true,
    timeout: 180_000,
  }
}

export default defineConfig(config)
