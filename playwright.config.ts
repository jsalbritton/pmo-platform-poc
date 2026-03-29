/**
 * playwright.config.ts — S0-ST Smoke Test Suite Configuration
 *
 * Three browser projects:
 *   admin         — storageState pre-loaded with admin JWT (kai.young)
 *   viewer        — storageState pre-loaded with viewer JWT (avery.williams)
 *   unauthenticated — clean context, no session (login-page tests)
 *
 * Auth states are written by global-setup.ts via direct Supabase REST call
 * before any spec runs — avoids UI login on every test, skips rate limits.
 *
 * Spec grouping (all in tests/playwright/specs/):
 *   S0-ST-001  Auth smoke         — login render, sign-in, sign-out, bad creds
 *   S0-ST-002  Portfolio smoke    — 100+ projects, filter, search, sort, row nav
 *   S0-ST-003  Role gate smoke    — viewer read-only, RLS blocks mutations
 *   S0-ST-004  Session mgmt smoke — UserChip presence, sign-out button, timeout cfg
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/playwright/specs',
  globalSetup: './tests/playwright/global-setup.ts',

  // Run specs sequentially — Supabase free tier limits concurrent auth
  fullyParallel: false,
  workers: 1,

  // Fail fast in CI; allow retries for flaky network in local dev
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL:           'http://localhost:5173',
    trace:             'on-first-retry',
    screenshot:        'only-on-failure',
    video:             'off',
    actionTimeout:     15_000,
    navigationTimeout: 20_000,
  },

  projects: [
    // Single chromium project — each spec controls its own storageState via
    // test.use({ storageState }) at the describe level. This avoids the problem
    // of a project-level storageState bleeding into specs that need a different
    // (or no) auth context.
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // No default storageState — each spec/describe sets its own
      },
    },
  ],

  // Auto-start Vite dev server when no instance is already running
  webServer: {
    command:             'NODE_ENV=development npm run dev',
    url:                 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout:             60_000,
    stdout:              'ignore',
    stderr:              'pipe',
  },
})
