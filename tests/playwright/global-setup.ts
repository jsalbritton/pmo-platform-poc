/**
 * global-setup.ts — Playwright auth state initialization
 *
 * Calls Supabase Auth REST API directly (no browser, no UI form) to obtain
 * JWTs for admin and viewer test accounts, then writes Playwright storageState
 * JSON files that each browser project loads at startup.
 *
 * WHY API-FIRST INSTEAD OF UI LOGIN:
 *   - Avoids Supabase free-tier rate limits on repeated sign-in attempts
 *   - Eliminates flaky React-controlled-input timing issues in setup
 *   - 10-20x faster than navigating the login form each run
 *   - Global setup runs ONCE; each spec reuses the persisted state
 *
 * SECURITY:
 *   playwright/.auth/*.json files contain raw JWTs — they are .gitignored.
 *   Never commit them. The tokens expire after Supabase's configured TTL.
 *
 * If this script fails, the most likely cause is:
 *   1. Password changed — update TEST_USERS below
 *   2. Supabase project paused (free-tier auto-pause) — resume in dashboard
 *   3. Network issue — check VPN / firewall
 */

import type { FullConfig } from '@playwright/test'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
// Node 18+ has built-in global fetch — no import needed

// ── SUPABASE COORDINATES ─────────────────────────────────────────────────────
// These match the hardcoded fallbacks in src/lib/supabase.ts — same project.

const SUPABASE_URL  = 'https://qffzpdhnrkfbkzgrnvsy.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmZnpwZGhucmtmYmt6Z3JudnN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTYwMjUsImV4cCI6MjA5MDA3MjAyNX0.' +
  'qI2IvYWtoDuvyR0ySfElBidyelIpB1sjXF6GVnjfiG0'

// Supabase JS v2 localStorage key pattern: sb-{projectRef}-auth-token
const STORAGE_KEY = 'sb-qffzpdhnrkfbkzgrnvsy-auth-token'

// ── TEST ACCOUNTS ─────────────────────────────────────────────────────────────
// All POC test accounts share the same password (shown on the login page).
// admin is the primary actor; viewer is used for role-gate tests.

const TEST_USERS: Record<string, { email: string; password: string }> = {
  admin:  { email: 'kai.young@globalit.example.com',     password: 'PmoTest2026!' },
  viewer: { email: 'avery.williams@globalit.example.com', password: 'PmoTest2026!' },
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

async function signInWithSupabase(email: string, password: string): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey':        SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
    },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Auth failed for ${email}: HTTP ${res.status} — ${body}`)
  }

  return res.json()
}

/**
 * buildStorageState — wraps a Supabase session into a Playwright storageState
 * object that the browser will load before the first test navigation.
 *
 * Supabase JS v2 reads the localStorage key at initialization and hydrates the
 * session without triggering a network call, so the test starts authenticated.
 */
function buildStorageState(session: any): object {
  const tokenValue = JSON.stringify({
    access_token:  session.access_token,
    token_type:    'bearer',
    expires_in:    session.expires_in,
    expires_at:    session.expires_at,
    refresh_token: session.refresh_token,
    user:          session.user,
  })

  return {
    cookies: [],
    origins: [
      {
        origin: 'http://localhost:5173',
        localStorage: [
          { name: STORAGE_KEY, value: tokenValue },
        ],
      },
    ],
  }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const authDir = path.resolve('playwright/.auth')
  await mkdir(authDir, { recursive: true })

  console.log('\n[global-setup] Acquiring Supabase auth tokens…')

  for (const [role, creds] of Object.entries(TEST_USERS)) {
    try {
      const session  = await signInWithSupabase(creds.email, creds.password)
      const state    = buildStorageState(session)
      const outPath  = path.join(authDir, `${role}.json`)

      await writeFile(outPath, JSON.stringify(state, null, 2))
      console.log(`[global-setup] ✓ ${role.padEnd(8)} (${creds.email}) → ${outPath}`)
    } catch (err) {
      console.error(`[global-setup] ✗ FAILED for role=${role}: ${err}`)
      throw err   // Abort: spec files cannot run without valid auth state
    }
  }

  console.log('[global-setup] Auth states ready.\n')
}
