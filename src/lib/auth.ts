/**
 * auth.ts — AuthService interface
 *
 * This interface is the explicit seam between the POC identity provider
 * (Supabase Auth email/password) and the production identity provider
 * (OKTA PKCE/SAML via Supabase SSO connector with Azure AD Entra ID federation).
 *
 * ── PRODUCTION MIGRATION PATH ────────────────────────────────────────────────
 *
 *  Identity chain in your Microsoft-standard org:
 *
 *    User  →  OKTA (cloud IdP)  →  Azure AD / Entra ID (on-prem identity store)
 *          →  Supabase SAML/OIDC connector
 *          →  Custom Access Token Hook (pg-functions://postgres/public/custom_access_token_hook)
 *          →  JWT  app_metadata.pmo_role embedded
 *          →  Postgres RLS reads auth.jwt() → 'app_metadata' ->> 'pmo_role'
 *
 *  Migration steps (consulting firm handoff checklist):
 *    1. Configure OKTA as a Supabase SSO provider:
 *       Supabase Dashboard → Auth → Sign In Methods → SAML 2.0 / OIDC
 *       OKTA metadata URL: https://<tenant>.okta.com/.well-known/openid-configuration
 *
 *    2. Map OKTA group claim → pmo_role in Custom Access Token Hook:
 *       In supabase/migrations/..._auth_jwt_hook_and_audit_logging.sql
 *       Replace:  SELECT role FROM public.profiles WHERE id = user_uuid
 *       With:     pmo_role := event -> 'claims' -> 'app_metadata' ->> 'okta_pmo_role'
 *       (Where 'okta_pmo_role' is the OKTA attribute name for PMO role assignment)
 *
 *    3. Implement OktaAuthService in src/lib/auth.okta.ts:
 *       signIn() triggers OKTA PKCE redirect instead of email/password
 *       getSession() / onAuthStateChange() are identical — Supabase handles the session
 *
 *    4. Swap the singleton in src/hooks/useAuth.tsx:
 *       import { authService } from '@/lib/auth.okta'  (was auth.supabase)
 *
 *    5. No RLS policy changes required. Policies read pmo_role from JWT.
 *       Run S0-003T RBAC test suite to confirm 10/10 after IdP swap.
 *
 * ── 21 CFR PART 11.300 COMPLIANCE ───────────────────────────────────────────
 *   11.300(a) Unique IDs:          email as identity, no shared accounts
 *   11.300(b) Password security:   bcrypt via Supabase Auth; not displayed
 *   11.300(c) Session validity:    JWT expiry (1hr) + refresh token rotation
 *   11.300(d) Loss management:     signInWithOtp / resetPasswordForEmail flows
 *   11.300(e) Unauthorized use:    auth events logged to activity_log via log_auth_event()
 */

// ── ROLE TYPE ────────────────────────────────────────────────────────────────

export type PmoRole =
  | 'admin'
  | 'sponsor'
  | 'pm'
  | 'team_member'
  | 'viewer'
  | 'ml_admin'

// ── SESSION & USER TYPES ─────────────────────────────────────────────────────

export interface AuthUser {
  id:       string
  email:    string
  pmo_role: PmoRole | null
}

export interface AuthSession {
  user:          AuthUser
  access_token:  string
  refresh_token: string
  expires_at:    number   // Unix timestamp seconds
}

export type AuthStateListener = (session: AuthSession | null) => void

// ── SERVICE INTERFACE ────────────────────────────────────────────────────────

export interface AuthService {
  /**
   * Sign in with email + password.
   *
   * POC:        Supabase Auth email/password (PKCE flow internally)
   * Production: Replace with OKTA PKCE redirect → Supabase callback session
   *
   * Throws on auth failure — callers should catch and surface error messages.
   * Auth events (success/failure) are logged to activity_log via RPC.
   */
  signIn(email: string, password: string): Promise<AuthSession>

  /**
   * Sign out and invalidate the current session token.
   * Signs out from Supabase AND the external IdP (OKTA in production).
   */
  signOut(): Promise<void>

  /**
   * Return the current session from local storage / secure cookie.
   * Automatically refreshes the token if within the refresh window.
   * Returns null if unauthenticated or session irreversibly expired.
   */
  getSession(): Promise<AuthSession | null>

  /**
   * Subscribe to auth state changes: sign-in, sign-out, token refresh.
   * Returns an unsubscribe function — call it on component unmount.
   *
   * Production: Supabase's onAuthStateChange fires on OKTA OIDC callback,
   * refresh token rotation, and explicit sign-out. Same interface, different IdP.
   */
  onAuthStateChange(listener: AuthStateListener): () => void
}

// ── OKTA PRODUCTION STUB ─────────────────────────────────────────────────────
// Placeholder documenting the production interface contract.
// Implement auth.okta.ts conforming to AuthService for production handoff.

/**
 * OktaAuthServiceConfig — configuration for production OKTA integration.
 * Populated from environment variables in production deployment.
 *
 * OKTA Application settings (create in OKTA Admin → Applications):
 *   - Application type: Single-Page App (SPA)
 *   - Grant type: Authorization Code + PKCE
 *   - Sign-in redirect URI: https://<app-domain>/auth/callback
 *   - Sign-out redirect URI: https://<app-domain>/login
 *   - Allowed CORS origins: https://<app-domain>
 *
 * Supabase SSO settings (Auth → Sign In Methods → SAML/OIDC):
 *   - Provider: OKTA
 *   - Client ID: from OKTA Application
 *   - Issuer: https://<okta-tenant>.okta.com
 *   - Attribute mapping: pmo_role → app_metadata.pmo_role (via Custom Access Token Hook)
 */
export interface OktaAuthServiceConfig {
  oktaDomain:   string   // e.g. 'globalit.okta.com'
  clientId:     string   // OKTA SPA Application client ID
  redirectUri:  string   // e.g. 'https://pmo.globalit.com/auth/callback'
  scopes:       string[] // ['openid', 'profile', 'email', 'groups']
}
