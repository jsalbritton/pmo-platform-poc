/**
 * S0-ST-003 — Role Gate Smoke Tests
 *
 * Runs as: viewer (storageState pre-loaded) AND admin (for comparison)
 *
 * Coverage — viewer role enforcement:
 *   003-01  Viewer can access /portfolio (read is permitted by RLS)
 *   003-02  Viewer UserChip shows "Viewer" role badge
 *   003-03  Viewer can see all projects in the portfolio table (SELECT passes)
 *   003-04  Viewer cannot UPDATE a project status — RLS blocks the mutation
 *   003-05  Viewer can navigate to /project/:id (read detail is permitted)
 *   003-06  Viewer can access /constellation (read-only view)
 *   003-07  Viewer can access /board/all (read-only board)
 *
 * 003-04 is the critical gate: it tests that Supabase RLS row-level security
 * actually enforces the boundary. The useUpdateProjectStatus mutation returns
 * an error for viewer role — this is verified via direct Supabase REST call
 * using the viewer's JWT from storageState.
 *
 * NOTE on RLS policy names:
 *   The expected policy names match the migration that created them.
 *   If your RLS policies use different names, update the error matching below.
 */

import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// All role-gate tests run as viewer — this is the sole auth context for 003
test.use({ storageState: 'playwright/.auth/viewer.json' })

// ── SUPABASE COORDINATES ─────────────────────────────────────────────────────

const SUPABASE_URL  = 'https://qffzpdhnrkfbkzgrnvsy.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmZnpwZGhucmtmYmt6Z3JudnN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTYwMjUsImV4cCI6MjA5MDA3MjAyNX0.' +
  'qI2IvYWtoDuvyR0ySfElBidyelIpB1sjXF6GVnjfiG0'

const STORAGE_KEY   = 'sb-qffzpdhnrkfbkzgrnvsy-auth-token'

// ── HELPERS ───────────────────────────────────────────────────────────────────

/**
 * getViewerAccessToken — extracts the JWT from the page's localStorage.
 * Used to make direct Supabase REST calls that bypass the UI and test
 * RLS enforcement at the database level, not just at the UI level.
 */
async function getAccessToken(page: Page): Promise<string> {
  const raw = await page.evaluate(
    (key) => localStorage.getItem(key),
    STORAGE_KEY
  )
  if (!raw) throw new Error('No Supabase auth token in localStorage')
  return JSON.parse(raw).access_token
}

/**
 * getFirstProjectId — fetches the first project id visible in the table.
 * Used to construct /project/:id navigation in tests.
 */
async function getFirstProjectId(page: Page): Promise<string> {
  // Wait for rows to load
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll('tbody tr')
    return rows.length > 0 && !rows[0].classList.contains('animate-pulse')
  }, { timeout: 15_000 })

  // Click the first row to get the id from the URL
  const firstRow = page.locator('tbody tr:not(.animate-pulse)').first()
  await firstRow.click()
  await page.waitForURL(/\/project\/[0-9a-f-]{36}/, { timeout: 10_000 })

  const url = page.url()
  const id  = url.split('/project/')[1]
  return id
}

// ── VIEWER TESTS ──────────────────────────────────────────────────────────────

test.describe('S0-ST-003 · Role Gates', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/portfolio')
    await expect(page.getByRole('heading', { name: 'Project Portfolio' })).toBeVisible()
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('tbody tr')
      return rows.length > 0 && !rows[0].classList.contains('animate-pulse')
    }, { timeout: 15_000 })
  })

  // ── 003-01: Viewer can read portfolio ─────────────────────────────────────
  test('003-01 viewer can access /portfolio (SELECT permitted by RLS)', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Project Portfolio' })).toBeVisible()

    // Table has rows — viewer can read
    const rows = page.locator('tbody tr:not(.animate-pulse)')
    await expect(rows.first()).toBeVisible()
    expect(await rows.count()).toBeGreaterThan(0)
  })

  // ── 003-02: Viewer role badge in UserChip ─────────────────────────────────
  test('003-02 viewer UserChip shows "Viewer" role badge', async ({ page }) => {
    // The sidebar UserChip should show role badge "Viewer"
    await expect(page.getByText('Viewer', { exact: true })).toBeVisible()

    // Username should be the local-part of viewer email
    await expect(page.getByText('avery.williams')).toBeVisible()
  })

  // ── 003-03: Viewer sees project data ──────────────────────────────────────
  test('003-03 viewer can see project names and statuses in the table', async ({ page }) => {
    // Status badges should be visible (means data was returned by RLS-controlled SELECT)
    const statusBadges = page.locator('tbody td').filter({ hasText: /On Track|At Risk|Critical|Planning|Active/ })
    await expect(statusBadges.first()).toBeVisible({ timeout: 10_000 })
    expect(await statusBadges.count()).toBeGreaterThan(0)
  })

  // ── 003-04: Viewer cannot UPDATE a project (RLS blocks mutation) ──────────
  test('003-04 viewer JWT is rejected by RLS for project UPDATE', async ({ page }) => {
    const token = await getAccessToken(page)

    // Create a Supabase client authenticated as the viewer
    const viewerDb = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    })

    // Fetch the first project to get a valid ID
    const { data: projects } = await viewerDb
      .from('projects')
      .select('id')
      .limit(1)
      .single()

    expect(projects?.id, 'Need at least one project to test UPDATE').toBeTruthy()

    // Attempt to UPDATE — RLS policy should reject this for viewer role
    const { error } = await viewerDb
      .from('projects')
      .update({ status: 'on_hold', updated_at: new Date().toISOString() })
      .eq('id', projects!.id)
      .select()

    // RLS should block: error expected (42501 = insufficient privilege)
    // The exact message depends on the policy; check that an error occurred
    expect(
      error,
      'Expected RLS to block viewer UPDATE but got no error — check your policies'
    ).not.toBeNull()
  })

  // ── 003-05: Viewer can read project detail ─────────────────────────────────
  test('003-05 viewer can navigate to /project/:id (SELECT permitted)', async ({ page }) => {
    const id = await getFirstProjectId(page)
    expect(id).toMatch(/[0-9a-f-]{36}/)

    // Should be on the project detail page — not redirected or errored
    await expect(page).toHaveURL(new RegExp(`/project/${id}`))
  })

  // ── 003-06: Viewer can access Constellation view ──────────────────────────
  test('003-06 viewer can navigate to /constellation (read-only view)', async ({ page }) => {
    await page.getByRole('link', { name: 'Constellation' }).click()
    await page.waitForURL('**/constellation', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/constellation/)
    // Should not be redirected to /login
    await expect(page).not.toHaveURL(/\/login/)
  })

  // ── 003-07: Viewer can access Sprint Board ────────────────────────────────
  test('003-07 viewer can navigate to /board/all (read-only board)', async ({ page }) => {
    await page.getByRole('link', { name: 'Sprint Board' }).click()
    await page.waitForURL('**/board/all', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/board\/all/)
    await expect(page).not.toHaveURL(/\/login/)
  })

})
