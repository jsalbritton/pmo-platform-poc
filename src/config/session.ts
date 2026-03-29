/**
 * session.ts — Session security configuration
 *
 * 21 CFR Part 11.300(c): Controls to ensure the validity of electronic signatures
 * includes inactivity timeouts to prevent unauthorized session continuation.
 *
 * ── PRODUCTION NOTE ────────────────────────────────────────────────────────────
 * These values are compile-time constants for the POC. In production the
 * consulting firm should store them in an `app_settings` table and surface
 * them in Settings → Security → Session Policy so they can be adjusted by an
 * admin without a code deploy. Changing these values requires a GxP change
 * control record if deployed in a validated environment.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const SESSION_CONFIG = {
  /**
   * Inactivity timeout (ms).
   * Session is forcibly terminated after this period without user interaction.
   *
   * Default: 15 minutes.
   * Recommended range for regulated environments: 5–30 minutes.
   * 21 CFR Part 11 does not specify a value; 15 min is standard practice
   * for medical device software (FDA guidance on electronic records).
   */
  inactivityTimeoutMs: 15 * 60 * 1000,

  /**
   * Warning lead time (ms).
   * A dismissible modal is shown this long before automatic logout.
   * Default: 30 seconds — enough time to click "Stay signed in."
   */
  warningMs: 30 * 1000,

  /**
   * Events that reset the inactivity timer.
   * Touch events cover tablet use during factory floor demos.
   */
  activityEvents: [
    'mousemove',
    'mousedown',
    'keydown',
    'touchstart',
    'scroll',
    'click',
  ] as const,
} as const
