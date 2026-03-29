/**
 * auth.supabase.ts — POC implementation of AuthService
 *
 * Uses Supabase Auth email/password with PKCE flow internally.
 * pmo_role is read from JWT app_metadata (set by Custom Access Token Hook).
 * Falls back to user_metadata for sessions pre-dating the hook deployment.
 *
 * PRODUCTION REPLACEMENT:
 *   Implement auth.okta.ts conforming to the same AuthService interface.
 *   signIn() becomes an OKTA PKCE redirect; the rest is identical because
 *   Supabase handles the session regardless of the upstream IdP.
 *
 * AUTH EVENT LOGGING (21 CFR 11.300(e)):
 *   All sign-in (success/failure) and sign-out events are written to
 *   activity_log via the log_auth_event() Supabase RPC function.
 *   Failed attempts are logged with hashed email for correlation without PII storage.
 */

import { db } from '@/lib/supabase'
import type { AuthService, AuthSession, AuthStateListener, PmoRole } from '@/lib/auth'

// ── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * decodeJwtPayload — decodes the payload segment of a JWT without verification.
 *
 * Verification is handled server-side by Supabase / Postgres RLS.
 * This is only used client-side to read claims for UI display purposes.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    // base64url → base64 → JSON
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * extractPmoRole — reads pmo_role from JWT claims in priority order.
 *
 * Priority 1: Decoded JWT app_metadata.pmo_role — THE authoritative source.
 *   The Custom Access Token Hook writes to the JWT claims at mint time.
 *   The Supabase JS client's user.app_metadata is the *base* DB record and
 *   does NOT reflect hook modifications — we must decode the token directly.
 *   This is also the correct path for production OKTA (hook maps group claim).
 *
 * Priority 2: user_metadata.pmo_role — written via SQL UPDATE on auth.users.
 *   Used as a fallback for test users seeded before the hook was verified.
 *
 * If neither is present, returns null — the UI will surface a no-role warning.
 */
function extractPmoRole(supabaseSession: any): PmoRole | null {
  // Priority 1: decode the JWT and read the hook-embedded claim
  if (supabaseSession?.access_token) {
    const claims = decodeJwtPayload(supabaseSession.access_token)
    const roleFromJwt = (claims?.app_metadata as any)?.pmo_role
    if (roleFromJwt) return roleFromJwt as PmoRole
  }

  // Priority 2: user_metadata fallback (set via admin SQL for test users)
  return (supabaseSession?.user?.user_metadata?.pmo_role ?? null) as PmoRole | null
}

function toAuthSession(supabaseSession: any): AuthSession {
  return {
    user: {
      id:       supabaseSession.user.id,
      email:    supabaseSession.user.email ?? '',
      pmo_role: extractPmoRole(supabaseSession),
    },
    access_token:  supabaseSession.access_token,
    refresh_token: supabaseSession.refresh_token ?? '',
    expires_at:    supabaseSession.expires_at ?? 0,
  }
}

/** Log an auth event to activity_log for 21 CFR 11.300(e) compliance. */
async function logAuthEvent(
  action:   'auth.sign_in' | 'auth.sign_out' | 'auth.sign_in_failed',
  userId?:  string,
  email?:   string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await db.rpc('log_auth_event', {
      p_action:   action,
      p_user_id:  userId ?? null,
      p_email:    email  ?? null,
      p_metadata: {
        ...metadata,
        // User-agent hash for device correlation — no raw UA stored
        ua_hint: navigator.userAgent.length,
        ts_utc:  new Date().toISOString(),
      },
    })
  } catch {
    // Audit logging must never block the auth flow — swallow silently
    // but in production this should page oncall if persistent
    console.warn('[pmo-auth] audit log write failed — non-blocking')
  }
}

// ── SUPABASE AUTH SERVICE ─────────────────────────────────────────────────────

export class SupabaseAuthService implements AuthService {

  async signIn(email: string, password: string): Promise<AuthSession> {
    const { data, error } = await db.auth.signInWithPassword({ email, password })

    if (error || !data.session) {
      // 21 CFR 11.300(e): log failed attempts for unauthorized-use detection
      await logAuthEvent('auth.sign_in_failed', undefined, email, {
        reason: error?.message ?? 'no_session',
      })
      throw new Error(error?.message ?? 'Sign-in failed')
    }

    const session = toAuthSession(data.session)

    // 21 CFR 11.300(e): log successful sign-in with role
    await logAuthEvent('auth.sign_in', session.user.id, email, {
      pmo_role: session.user.pmo_role ?? 'none',
    })

    return session
  }

  async signOut(): Promise<void> {
    // Capture user before invalidating session
    const existing = await this.getSession()

    const { error } = await db.auth.signOut()
    if (error) throw new Error(error.message)

    if (existing?.user) {
      await logAuthEvent('auth.sign_out', existing.user.id, existing.user.email, {
        pmo_role: existing.user.pmo_role ?? 'none',
      })
    }
  }

  async getSession(): Promise<AuthSession | null> {
    const { data, error } = await db.auth.getSession()
    if (error || !data.session) return null
    return toAuthSession(data.session)
  }

  onAuthStateChange(listener: AuthStateListener): () => void {
    const { data } = db.auth.onAuthStateChange((_event, session) => {
      listener(session ? toAuthSession(session) : null)
    })
    return () => data.subscription.unsubscribe()
  }
}

/** Singleton — one instance shared by the whole app via useAuth() */
export const authService = new SupabaseAuthService()
