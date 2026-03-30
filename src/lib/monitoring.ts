/**
 * monitoring.ts — Sentry error tracking + Core Web Vitals
 *
 * WHY THIS MODULE EXISTS:
 *   The PMO Platform POC is the specification for the production system that
 *   a consulting firm will rebuild. Every architectural decision made here is
 *   a decision they inherit. Shipping observability from day one — not bolted
 *   on later — is the standard for any production-grade system, especially
 *   in regulated environments where audit trails and error records are required.
 *
 * WHAT THIS WIRES UP:
 *   1. Sentry error tracking — unhandled exceptions surface in the Sentry
 *      dashboard with full stack trace, breadcrumbs, user context, and
 *      component tree (via ErrorBoundary in ErrorBoundary.tsx).
 *
 *   2. Browser tracing — automatic instrumentation of page loads, route
 *      navigations (via SentryRoutes in App.tsx), and Supabase API calls.
 *      Creates waterfall traces visible in Sentry Performance.
 *
 *   3. Core Web Vitals — CLS, FCP, INP, LCP, TTFB are attached as
 *      measurements on the page-load transaction span. In Sentry Performance,
 *      these appear alongside the trace and are used for P75/P95 dashboards.
 *
 * DSN SETUP:
 *   1. Create a project at https://sentry.io
 *   2. Copy the DSN from Settings → Projects → [project] → Client Keys
 *   3. Add to .env.local:  VITE_SENTRY_DSN=https://...@sentry.io/...
 *   4. In CI/production: inject as a secret environment variable
 *
 * GRACEFUL DEGRADATION:
 *   When VITE_SENTRY_DSN is absent (local dev, CI without secrets), this
 *   module is a no-op for production calls. Web vitals still log to the
 *   browser console in development for local verification.
 *
 * SAMPLE RATES (adjust as data needs grow):
 *   tracesSampleRate: 0.1 in production = 10% of page loads create traces.
 *   For a 20-project PMO with ~50 daily users, this is ample signal without
 *   consuming Sentry quota. Increase to 0.5 or 1.0 during UAT.
 */

import * as Sentry from '@sentry/react'
import { browserTracingIntegration, setMeasurement } from '@sentry/react'
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'
import type { Metric } from 'web-vitals'

// ─── INIT ─────────────────────────────────────────────────────────────────────

export function initMonitoring(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined

  if (!dsn) {
    // Inform developers that monitoring is off — not an error, just a reminder.
    if (import.meta.env.DEV) {
      console.info(
        '%c[Monitoring]%c Sentry DSN not set — error tracking disabled.\n' +
        'Add %cVITE_SENTRY_DSN%c to .env.local to enable.',
        'color:#003595;font-weight:bold',
        'color:#666',
        'color:#33BBFF;font-family:monospace',
        'color:#666',
      )
    }
    // Wire web vitals for local console visibility even without Sentry.
    wireWebVitals()
    return
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release:     (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'pmo-poc@dev',

    integrations: [
      // Instruments page loads, navigations, and fetch/XHR as Sentry spans.
      // React Router v6 route changes are instrumented via SentryRoutes in App.tsx.
      browserTracingIntegration(),
    ],

    // 10% in production → ample signal for 50 daily users, conservative on quota.
    // 100% in dev/staging → full trace visibility during testing.
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

    // Attach distributed trace headers to requests destined for these origins.
    // Supabase calls will carry a sentry-trace header, linking backend logs to
    // the frontend span that triggered them.
    tracePropagationTargets: ['localhost', /\.supabase\.co/],
  })

  wireWebVitals()
}

// ─── WEB VITALS ───────────────────────────────────────────────────────────────

/**
 * Registers callbacks for all 5 Core Web Vitals (2024 spec):
 *   CLS  — Cumulative Layout Shift      (no unit — pure score)
 *   FCP  — First Contentful Paint       (milliseconds)
 *   INP  — Interaction to Next Paint    (milliseconds, replaced FID)
 *   LCP  — Largest Contentful Paint     (milliseconds)
 *   TTFB — Time to First Byte           (milliseconds)
 *
 * In development:  logs to console with color-coded rating (good / needs-improvement / poor).
 * In production:   attaches each as a measurement on the current Sentry page-load span
 *                  via setMeasurement(). Appears in Sentry Performance → Web Vitals tab.
 *                  Falls back silently if no Sentry transaction is active.
 */
function wireWebVitals(): void {
  function report(metric: Metric): void {
    if (import.meta.env.DEV) {
      // Color-coded console output so you can check vitals during local dev.
      const fmtValue = metric.name === 'CLS'
        ? metric.value.toFixed(4)
        : `${Math.round(metric.value)}ms`

      const ratingColor = {
        good:               'color:#22c55e',
        'needs-improvement': 'color:#f59e0b',
        poor:               'color:#ef4444',
      }[metric.rating] ?? 'color:#9ca3af'

      console.debug(
        `%c[Vital] %c${metric.name}%c ${fmtValue} %c${metric.rating}`,
        'color:#003595;font-weight:bold',
        'color:#33BBFF;font-weight:bold;font-family:monospace',
        'color:#374151',
        `${ratingColor};font-weight:bold`,
      )
      return
    }

    // Production: attach to the active page-load transaction span.
    // setMeasurement is a no-op if called outside a transaction — safe to call always.
    const unit = metric.name === 'CLS' ? '' : 'millisecond'
    setMeasurement(metric.name.toLowerCase(), metric.value, unit)
  }

  onCLS(report)
  onFCP(report)
  onINP(report)
  onLCP(report)
  onTTFB(report)
}
