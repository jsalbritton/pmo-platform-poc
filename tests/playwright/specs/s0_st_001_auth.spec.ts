/**
 * S0-ST-001 — Authentication Smoke Tests
 *
 * Runs as: unauthenticated (clean browser context, no storageState)
 *
 * Coverage:
 *   001-01  Login page renders key structural elements
 *   001-02  POC mode banner is visible
 *   001-03  OKTA SSO button is present but disabled (production stub)
 *   001-04  Successful sign-in navigates to /portfolio
 *   001-05  After sign-in, sidebar UserChip displays username
 *   001-06  Invalid credentials show an inline error, no navigation
 *   001-07  Unauthenticated access to /portfolio redirects to /login
 *   001-08  Sign-out via sidebar button redirects to /login
 *   001-09  After sign-out, /portfolio again redirects to /login
 *   001-10  21 CFR Part 11 compliance footer is visible on login page
 *
 * These tests use the LOGIN UI (not pre-loaded auth state) so they exercise
 * the actual form, error states, and navigation logic end-to-end.
 */

import { test, expect } from '@playwright/test'

// Shared credentials — matches the hardcoded POC test accounts
const ADMIN_EMAIL    = 'kai.young@globalit.example.com'
const ADMIN_PASSWORD = 'PmoTest2026!'
const BAD_PASSWORD   = 'WrongPassword999!'

// ── HELPERS ────────────────────────────────────────────────────────────────────

async function loginAs(page: any, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

// ── TESTS ──────────────────────────────────────────────────────────────────────

test.describe('S0-ST-001 · Authentication', () => {

  // ── 001-01: Login page structure ─────────────────────────────────────────────
  test('001-01 login page renders brand, form, and OKTA stub', async ({ page }) => {
    await page.goto('/login')

    // Brand heading
    await expect(page.getByRole('heading', { name: 'PMO Platform' })).toBeVisible()

    // Form fields
    await expect(page.getByLabel('Email address')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()

    // Submit button
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  // ── 001-02: POC mode banner ───────────────────────────────────────────────────
  test('001-02 POC mode banner is visible', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('POC mode')).toBeVisible()
  })

  // ── 001-03: OKTA stub is present and disabled ─────────────────────────────────
  test('001-03 OKTA SSO button is present but disabled', async ({ page }) => {
    await page.goto('/login')
    const okta = page.getByRole('button', { name: /sign in with okta/i })
    await expect(okta).toBeVisible()
    await expect(okta).toBeDisabled()
  })

  // ── 001-04: Successful sign-in navigates to portfolio ─────────────────────────
  test('001-04 valid admin credentials → navigate to /portfolio', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)

    // Wait for navigation away from /login
    await page.waitForURL('**/portfolio', { timeout: 15_000 })
    await expect(page).toHaveURL(/\/portfolio/)

    // Portfolio page heading should render
    await expect(page.getByRole('heading', { name: 'Project Portfolio' })).toBeVisible()
  })

  // ── 001-05: UserChip renders after sign-in ────────────────────────────────────
  test('001-05 sidebar UserChip shows username after sign-in', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await page.waitForURL('**/portfolio', { timeout: 15_000 })

    // UserChip shows the local-part of the email (kai.young)
    const expectedUsername = ADMIN_EMAIL.split('@')[0]   // "kai.young"
    await expect(page.getByText(expectedUsername)).toBeVisible()

    // Admin role badge
    await expect(page.getByText('Admin', { exact: true })).toBeVisible()
  })

  // ── 001-06: Invalid credentials show error, no redirect ───────────────────────
  test('001-06 invalid credentials show error message without navigating', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, BAD_PASSWORD)

    // Error message appears in the form
    await expect(
      page.getByText('Invalid credentials. Please check your email and password.')
    ).toBeVisible({ timeout: 10_000 })

    // Must still be on /login — no redirect to portfolio
    await expect(page).toHaveURL(/\/login/)
  })

  // ── 001-07: Unauthenticated access to /portfolio redirects ────────────────────
  test('001-07 unauthenticated visit to /portfolio redirects to /login', async ({ page }) => {
    await page.goto('/portfolio')
    await page.waitForURL('**/login', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  // ── 001-08: Sign-out redirects to login ───────────────────────────────────────
  test('001-08 sign-out button in sidebar redirects to /login', async ({ page }) => {
    // Sign in first
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await page.waitForURL('**/portfolio', { timeout: 15_000 })

    // Click the sign-out icon in the UserChip
    // The button has title="Sign out"
    await page.getByRole('button', { name: 'Sign out' }).click()

    await page.waitForURL('**/login', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  // ── 001-09: Post-sign-out access to /portfolio redirects again ────────────────
  test('001-09 after sign-out, /portfolio access redirects to /login', async ({ page }) => {
    // Full sign-in → sign-out → attempt protected route
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await page.waitForURL('**/portfolio', { timeout: 15_000 })

    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.waitForURL('**/login', { timeout: 10_000 })

    // Now try to navigate directly to portfolio
    await page.goto('/portfolio')
    await page.waitForURL('**/login', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  // ── 001-10: 21 CFR compliance footer ──────────────────────────────────────────
  test('001-10 21 CFR Part 11.300(e) compliance notice on login page', async ({ page }) => {
    await page.goto('/login')
    await expect(
      page.getByText(/session activity is recorded per 21 cfr part 11/i)
    ).toBeVisible()
  })

})
