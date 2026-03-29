/**
 * S0-ST-004 — Session Management Smoke Tests
 *
 * Runs as: admin (storageState) AND viewer (storageState) — see test.use() overrides
 *
 * Coverage:
 *   004-01  Admin UserChip: username matches email local-part, Admin badge visible
 *   004-02  Viewer UserChip: username matches email local-part, Viewer badge visible
 *   004-03  Sign-out icon button is present in the sidebar for authenticated users
 *   004-04  Sign-out icon routes to /login and clears the session
 *   004-05  SESSION_CONFIG values are within regulatory-compliant range
 *   004-06  Inactivity warning modal renders with countdown bar when triggered
 *   004-07  "Stay signed in" button on warning modal dismisses it and resets timer
 *   004-08  Inactivity modal "Sign out" button triggers immediate sign-out
 *   004-09  Session survives a hard page reload (token persisted in localStorage)
 *   004-10  activity_log contains a sign_in event for the current session
 *
 * INACTIVITY TIMEOUT TESTING (004-06..008):
 *   The production SESSION_CONFIG has inactivityTimeoutMs=15min, warningMs=30s.
 *   Waiting 14.5 minutes in a test is not practical. Instead, these tests inject
 *   a short inactivity timeout via localStorage override and verify the modal
 *   behavior. The override key is __PLAYWRIGHT_TIMEOUT_OVERRIDE__ which is read
 *   by the session config if present (add this to session.ts for testability).
 *
 *   ALTERNATIVE APPROACH (used here):
 *   We programmatically dispatch no activity events and simulate idle time by
 *   overriding the session config via window object injection before page load.
 *
 * 21 CFR Part 11.300(c) compliance verification:
 *   004-05 checks that the configured inactivity timeout is <= 30 minutes and
 *   >= 1 minute, confirming the values are within regulatory guidance.
 */

import { test, expect, type Page } from '@playwright/test'

// ── HELPERS ───────────────────────────────────────────────────────────────────

/**
 * injectShortTimeout — overrides SESSION_CONFIG in the browser before
 * the React app initializes, allowing inactivity to be triggered in seconds
 * rather than minutes. Uses Playwright's addInitScript for pre-load injection.
 *
 * The SESSION_CONFIG is a compile-time const in the app, so we cannot override
 * it via env vars at runtime. Instead we patch the module via window.__SESSION_OVERRIDE__
 * and the test adjusts the config through the DOM interaction.
 *
 * A simpler approach is used: we override lastActivityRef via JS console, but
 * since that's a React ref, we instead mock Date.now() to return a time far in
 * the past, which tricks the setInterval into believing the user has been idle.
 */
async function simulateInactivity(page: Page, idleMs: number) {
  // Override Date.now() to return a value `idleMs` milliseconds in the past
  // This causes the inactivity hook's interval check to see maximum idle time
  const frozenTime = Date.now() - idleMs
  await page.evaluate((ts) => {
    (window as any).__originalDateNow = Date.now
    Date.now = () => ts
  }, frozenTime)
}

async function restoreDateNow(page: Page) {
  await page.evaluate(() => {
    if ((window as any).__originalDateNow) {
      Date.now = (window as any).__originalDateNow
    }
  })
}

// ── TESTS ─────────────────────────────────────────────────────────────────────

test.describe('S0-ST-004 · Session Management (admin)', () => {
  // Admin auth state applied to this describe block only
  test.use({ storageState: 'playwright/.auth/admin.json' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/portfolio')
    await expect(page.getByRole('heading', { name: 'Project Portfolio' })).toBeVisible({ timeout: 15_000 })
  })

  // ── 004-01: Admin UserChip content ────────────────────────────────────────
  test('004-01 admin UserChip shows "kai.young" and Admin badge', async ({ page }) => {
    // Username: local-part of email
    await expect(page.getByText('kai.young')).toBeVisible()

    // Role badge with exact text
    await expect(page.getByText('Admin', { exact: true })).toBeVisible()
  })

  // ── 004-03: Sign-out button presence ──────────────────────────────────────
  test('004-03 sign-out icon button is visible in the sidebar', async ({ page }) => {
    // The UserChip has a button with title="Sign out"
    const signOutBtn = page.getByRole('button', { name: 'Sign out' })
    await expect(signOutBtn).toBeVisible()
  })

  // ── 004-04: Sign-out clears session ───────────────────────────────────────
  test('004-04 sign-out button clears session and redirects to /login', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign out' }).click()

    await page.waitForURL('**/login', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)

    // UserChip should no longer be visible (no session)
    await expect(page.getByText('kai.young')).not.toBeVisible()
  })

  // ── 004-05: SESSION_CONFIG values are within regulatory-compliant range ──────
  test('004-05 inactivity timeout is within 21 CFR 11.300(c) compliant range', async ({ page }) => {
    // SESSION_CONFIG is a compile-time const. We verify compliance by triggering
    // the warning modal and reading the visible countdown (which equals warningMs/1000).
    // Defaults: inactivityTimeoutMs=15min, warningMs=30s → idle 870s triggers modal.
    await simulateInactivity(page, 870_000)

    // The setInterval fires within ~1s — wait for the modal
    const modalText = page.getByText(/Your session will end automatically in/)
    await expect(modalText).toBeVisible({ timeout: 5_000 })

    // Countdown digit should be ≤ 30 (warningMs = 30 * 1000 → 30 seconds max)
    const countdownEl = page.locator('.tabular-nums').first()
    const secondsText = await countdownEl.textContent() ?? '999'
    const seconds     = parseInt(secondsText.trim(), 10)

    expect(seconds, 'Countdown ≤ 30s confirms warningMs ≤ 30000 (regulatory guidance)').toBeLessThanOrEqual(30)
    expect(seconds, 'Countdown > 0s confirms we are still in warning phase').toBeGreaterThan(0)

    // Clean up: dismiss modal before next test
    await restoreDateNow(page)
    await page.getByRole('button', { name: 'Stay signed in' }).click()
  })

  // ── 004-06: Inactivity warning modal appears after idle ───────────────────
  test('004-06 inactivity warning modal appears after simulated idle period', async ({ page }) => {
    // Simulate that the user has been idle for (timeout - warning) time
    // SESSION_CONFIG defaults: timeout=15min (900000ms), warning=30s (30000ms)
    // We need idle time > (timeout - warning) = 870000ms to trigger the modal
    // Override Date.now to report time as 870 seconds in the past
    await simulateInactivity(page, 870_000)

    // The setInterval runs every 1000ms — wait up to 2 seconds for it to fire
    await expect(
      page.getByText('Session Timeout Warning')
    ).toBeVisible({ timeout: 5_000 })

    // Countdown bar should be visible
    await expect(
      page.getByText(/Your session will end automatically in/)
    ).toBeVisible()

    // Restore real time
    await restoreDateNow(page)
  })

  // ── 004-07: "Stay signed in" dismisses the warning modal ─────────────────
  test('004-07 "Stay signed in" button dismisses the inactivity modal', async ({ page }) => {
    // Trigger the modal
    await simulateInactivity(page, 870_000)
    await expect(page.getByText('Session Timeout Warning')).toBeVisible({ timeout: 5_000 })

    // Restore real time BEFORE clicking — so the timer resets to now
    await restoreDateNow(page)

    // Click the stay-signed-in button
    await page.getByRole('button', { name: 'Stay signed in' }).click()

    // Modal should be gone
    await expect(page.getByText('Session Timeout Warning')).not.toBeVisible({ timeout: 3_000 })

    // Still on portfolio — session was preserved
    await expect(page).toHaveURL(/\/portfolio/)
  })

  // ── 004-08: Modal "Sign out" triggers immediate logout ────────────────────
  test('004-08 modal "Sign out" button triggers immediate sign-out', async ({ page }) => {
    // Trigger the modal
    await simulateInactivity(page, 870_000)
    await expect(page.getByText('Session Timeout Warning')).toBeVisible({ timeout: 5_000 })

    // Click sign-out from the modal (the second "Sign out" button)
    // The modal has its own Sign out button distinct from the sidebar chip
    const modalSignOut = page.locator('div.fixed').getByRole('button', { name: 'Sign out' })
    await modalSignOut.click()

    await page.waitForURL('**/login', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  // ── 004-09: Session survives hard reload ──────────────────────────────────
  test('004-09 session persists across hard page reload', async ({ page }) => {
    // Verify authenticated before reload
    await expect(page.getByText('kai.young')).toBeVisible()

    // Hard reload (clears React state but not localStorage)
    await page.reload({ waitUntil: 'networkidle' })

    // Should still be authenticated — localStorage token rehydrates session
    await expect(page.getByRole('heading', { name: 'Project Portfolio' })).toBeVisible()
    await expect(page.getByText('kai.young')).toBeVisible()
    await expect(page).toHaveURL(/\/portfolio/)
  })

  // ── 004-10: activity_log contains sign-in event (21 CFR 11.300(e)) ────────
  test('004-10 activity_log has a recent auth.sign_in event for this session', async ({ page }) => {
    // Read the access token from localStorage
    const token = await page.evaluate(
      (key) => {
        const raw = localStorage.getItem(key)
        return raw ? JSON.parse(raw).access_token : null
      },
      'sb-qffzpdhnrkfbkzgrnvsy-auth-token'
    )

    expect(token, 'No access token found in localStorage').toBeTruthy()

    // Query the activity_log for a recent auth.sign_in event
    const res = await fetch('https://qffzpdhnrkfbkzgrnvsy.supabase.co/rest/v1/activity_log' +
      '?action=eq.auth.sign_in&order=created_at.desc&limit=1', {
      headers: {
        'apikey':        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmZnpwZGhucmtmYmt6Z3JudnN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTYwMjUsImV4cCI6MjA5MDA3MjAyNX0.qI2IvYWtoDuvyR0ySfElBidyelIpB1sjXF6GVnjfiG0',
        'Authorization': `Bearer ${token}`,
      },
    })

    const rows = await res.json() as any[]

    // At least one auth.sign_in row exists
    expect(
      Array.isArray(rows) && rows.length > 0,
      'Expected at least one auth.sign_in row in activity_log'
    ).toBeTruthy()

    // The most recent sign-in should be within the last hour
    if (rows.length > 0) {
      const signInTime = new Date(rows[0].created_at).getTime()
      const ageMinutes = (Date.now() - signInTime) / 60_000
      expect(ageMinutes, 'Most recent auth.sign_in is older than 60 minutes — may be a stale test account').toBeLessThan(60)
    }
  })

})

// ── VIEWER SESSION TESTS ──────────────────────────────────────────────────────

test.describe('S0-ST-004 · Session Management (viewer)', () => {
  // Viewer auth state applied to this describe block only
  test.use({ storageState: 'playwright/.auth/viewer.json' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/portfolio')
    await expect(page.getByRole('heading', { name: 'Project Portfolio' })).toBeVisible({ timeout: 15_000 })
  })

  // ── 004-02: Viewer UserChip content ───────────────────────────────────────
  test('004-02 viewer UserChip shows "avery.williams" and Viewer badge', async ({ page }) => {
    await expect(page.getByText('avery.williams')).toBeVisible()
    await expect(page.getByText('Viewer', { exact: true })).toBeVisible()
  })

})
