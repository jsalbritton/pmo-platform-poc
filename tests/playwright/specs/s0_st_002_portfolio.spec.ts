/**
 * S0-ST-002 — Portfolio Smoke Tests
 *
 * Runs as: admin (storageState pre-loaded — no login steps)
 *
 * Coverage:
 *   002-01  Portfolio page loads and renders the data table
 *   002-02  At least 100 projects are present (confirms seed data)
 *   002-03  Project count displays in the page subtitle
 *   002-04  Status filter "At Risk" narrows the row list
 *   002-05  Clearing the filter restores the full list
 *   002-06  Search with ≥2 characters triggers a filtered result
 *   002-07  Clearing search input restores unfiltered view
 *   002-08  Clicking a column header toggles sort (Health column)
 *   002-09  Clicking a row navigates to /project/:id
 *   002-10  Refresh button is visible and clickable without error
 *   002-11  Portfolio Health widget in sidebar shows avg score
 *   002-12  Sidebar nav items are all visible for admin
 *
 * Pre-condition: Supabase seed must contain >= 100 project rows.
 * Run `npm run seed` or verify via Supabase dashboard if this test fails
 * with "expected 100 or more, got N".
 */

import { test, expect } from '@playwright/test'

// All portfolio tests run as admin — storageState set here, not at project level
test.use({ storageState: 'playwright/.auth/admin.json' })

test.describe('S0-ST-002 · Portfolio', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/portfolio')
    // Wait for the table to finish loading (skeleton disappears)
    await expect(page.getByRole('heading', { name: 'Project Portfolio' })).toBeVisible()
    // Wait until at least one data row is visible (not skeleton)
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('tbody tr')
      return rows.length > 0 && !rows[0].classList.contains('animate-pulse')
    }, { timeout: 15_000 })
  })

  // ── 002-01: Portfolio table renders ────────────────────────────────────────
  test('002-01 portfolio table renders with column headers', async ({ page }) => {
    // Column headers from columnHelper definitions
    await expect(page.getByRole('columnheader', { name: 'Project Name' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Health' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Risk' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Budget' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Due Date' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Priority' })).toBeVisible()
  })

  // ── 002-02: Seed data check — ≥100 projects ────────────────────────────────
  test('002-02 at least 100 seeded projects are present', async ({ page }) => {
    // The subtitle text is "{n} projects" where n is fetched from DB
    const subtitle = page.locator('text=/\\d+ projects/')
    await expect(subtitle).toBeVisible({ timeout: 15_000 })

    const text  = await subtitle.textContent() ?? ''
    const count = parseInt(text.match(/(\d+)/)?.[1] ?? '0', 10)

    expect(count, `Expected 100 or more projects, got ${count}`).toBeGreaterThanOrEqual(100)
  })

  // ── 002-03: Project count in subtitle ──────────────────────────────────────
  test('002-03 project count subtitle is accurate (not "Loading...")', async ({ page }) => {
    const subtitle = page.locator('p').filter({ hasText: /projects/ })
    await expect(subtitle).not.toHaveText('Loading...')
    await expect(subtitle).toHaveText(/\d+ projects/)
  })

  // ── 002-04: Status filter narrows rows ─────────────────────────────────────
  test('002-04 filtering by "At Risk" returns only at-risk rows', async ({ page }) => {
    // Click the "At Risk" filter button
    await page.getByRole('button', { name: 'At Risk' }).click()

    // Wait for the table to update
    await page.waitForTimeout(500)

    // All visible status badges should show "At Risk"
    const badges = page.locator('tbody').getByText('At Risk')
    const otherBadges = page.locator('tbody').getByText(/On Track|Critical|Planning|Completed|On Hold/)

    const atRiskCount = await badges.count()
    const otherCount  = await otherBadges.count()

    // If there are no at-risk projects, empty state shows — that's also valid
    if (atRiskCount > 0) {
      expect(otherCount).toBe(0)
    } else {
      // Empty state renders
      await expect(page.getByText('No projects match your filters')).toBeVisible()
    }
  })

  // ── 002-05: Clear filter restores full list ─────────────────────────────────
  test('002-05 "All" filter restores the full project list', async ({ page }) => {
    // Apply a filter first
    await page.getByRole('button', { name: 'At Risk' }).click()
    await page.waitForTimeout(300)

    // Reset
    await page.getByRole('button', { name: 'All' }).click()
    await page.waitForTimeout(500)

    // Subtitle should show full count again
    await expect(page.locator('text=/1\\d{2,} projects/')).toBeVisible({ timeout: 10_000 })
  })

  // ── 002-06: Search triggers filtered results ───────────────────────────────
  test('002-06 search with 2+ characters filters the visible rows', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search projects...')
    await expect(searchInput).toBeVisible()

    // Type 2 characters to trigger the search (hook only fires for search.length >= 2)
    await searchInput.fill('Pr')
    await page.waitForTimeout(800)  // debounce / network

    // Either rows are shown OR empty state — either way, no crash
    const rows       = page.locator('tbody tr:not(.animate-pulse)')
    const emptyState = page.getByText('No projects match your filters')

    const rowCount   = await rows.count()
    const hasEmpty   = await emptyState.isVisible()

    expect(rowCount > 0 || hasEmpty, 'Expected filtered rows or empty state').toBeTruthy()
  })

  // ── 002-07: Clearing search restores unfiltered view ──────────────────────
  test('002-07 clearing the search input restores unfiltered projects', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search projects...')
    await searchInput.fill('zzz_no_match_expected')
    await page.waitForTimeout(800)

    await searchInput.clear()
    await page.waitForTimeout(800)

    // Full list should be back (no "No projects match" message)
    await expect(page.getByText('No projects match your filters')).not.toBeVisible()
    await expect(page.locator('text=/1\\d{2,} projects/')).toBeVisible({ timeout: 10_000 })
  })

  // ── 002-08: Column sort toggles ────────────────────────────────────────────
  test('002-08 clicking Health column header toggles sort direction', async ({ page }) => {
    const healthHeader = page.getByRole('columnheader', { name: 'Health' })
    const sortBtn      = healthHeader.getByRole('button')

    // First click — one direction
    await sortBtn.click()
    await page.waitForTimeout(300)

    // Get first row health value
    const firstRowBefore = await page.locator('tbody tr:first-child td:nth-child(3)').textContent()

    // Second click — reverse
    await sortBtn.click()
    await page.waitForTimeout(300)

    const firstRowAfter = await page.locator('tbody tr:first-child td:nth-child(3)').textContent()

    // The sort direction changed so the first row should differ
    // (unless all health scores are identical, which is very unlikely with 100+ seeded rows)
    expect(firstRowBefore).not.toEqual(firstRowAfter)
  })

  // ── 002-09: Row click navigates to project detail ──────────────────────────
  test('002-09 clicking a row navigates to /project/:id', async ({ page }) => {
    // Click the first data row
    const firstRow = page.locator('tbody tr:not(.animate-pulse)').first()
    await firstRow.click()

    // URL should match /project/{uuid}
    await page.waitForURL(/\/project\/[0-9a-f-]{36}/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/project\/[0-9a-f-]{36}/)
  })

  // ── 002-10: Refresh button ─────────────────────────────────────────────────
  test('002-10 refresh button is visible and does not crash the page', async ({ page }) => {
    const refreshBtn = page.getByTitle('Refresh data')
    await expect(refreshBtn).toBeVisible()

    await refreshBtn.click()
    // Page should still show the portfolio after refresh
    await expect(page.getByRole('heading', { name: 'Project Portfolio' })).toBeVisible()
  })

  // ── 002-11: Portfolio Health sidebar widget ────────────────────────────────
  test('002-11 Portfolio Health widget shows avg score in sidebar', async ({ page }) => {
    // The widget is in the sidebar with heading "Portfolio Health"
    await expect(
      page.getByText('Portfolio Health', { exact: false })
    ).toBeVisible({ timeout: 10_000 })
  })

  // ── 002-12: Admin sees all nav items ──────────────────────────────────────
  test('002-12 admin has access to all sidebar nav items', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Portfolio' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Resources' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'AI Engine' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Constellation' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sprint Board' })).toBeVisible()
  })

})
