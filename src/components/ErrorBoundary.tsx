/**
 * ErrorBoundary — Global error handler for React component tree.
 *
 * WHAT IS AN ERROR BOUNDARY?
 * ──────────────────────────
 * An error boundary catches JavaScript errors anywhere in the child
 * component tree, logs them, and displays a fallback UI instead of
 * crashing the entire app.
 *
 * KEY POINTS:
 * • Error boundaries catch errors in render, lifecycle methods, and constructors
 * • They do NOT catch:
 *   - Async errors (setTimeout, promises)
 *   - Event handler errors (wrap those with try/catch)
 *   - Server-side rendering errors
 *   - Errors in the error boundary itself
 *
 * WHY THIS MATTERS FOR PMO PLATFORM:
 * ──────────────────────────────────
 * In a medical device context (21 CFR Part 11), unhandled errors can:
 * • Leave the app in an undefined state
 * • Cause data loss or inconsistency
 * • Violate audit trail requirements
 *
 * This boundary ensures:
 * ✓ Errors are logged (for audit trail)
 * ✓ Users get a clear error message (not a blank screen)
 * ✓ Users can try again or navigate to safety
 * ✓ App doesn't cascade into a broken state
 */

import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from 'react-error-boundary'
import { Warning } from '@phosphor-icons/react'
import * as Sentry from '@sentry/react'

/**
 * FallbackComponent — Rendered when an error is caught.
 *
 * Props from react-error-boundary:
 * • error: The Error object that was thrown
 * • resetErrorBoundary: Function to reset the boundary and retry
 */
function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const err = error instanceof Error ? error : new Error(String(error))
  return (
    <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-red-50 border border-red-200">
            <Warning size={32} weight="duotone" className="text-red-600" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-xl font-bold text-gray-900 text-center mb-2">
          Something went wrong
        </h1>

        {/* Error Message */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs font-mono text-gray-600 break-words leading-relaxed">
            {err.message || 'An unexpected error occurred. Please try again.'}
          </p>
          {err.stack && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700 font-medium">
                Stack trace
              </summary>
              <pre className="mt-2 text-gray-600 overflow-auto max-h-48 text-[10px]">
                {err.stack}
              </pre>
            </details>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={resetErrorBoundary}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
          <a
            href="/portfolio"
            className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg font-medium transition-colors text-center text-sm"
          >
            Go to Portfolio
          </a>
        </div>

        {/* Support Text */}
        <p className="text-xs text-gray-500 text-center mt-4">
          Error details have been logged. Contact support if the problem persists.
        </p>
      </div>
    </div>
  )
}

/**
 * AppErrorBoundary — Wrapper component that provides error boundary to entire app.
 *
 * USAGE (in App.tsx):
 *   Wrap your entire app tree with AppErrorBoundary.
 *   This ensures ANY error in your component tree is caught and handled gracefully
 *   instead of crashing the whole application.
 */
interface AppErrorBoundaryProps {
  children: React.ReactNode
}

export function AppErrorBoundary({ children }: AppErrorBoundaryProps) {
  const handleError = (error: unknown, info: { componentStack?: string | null }) => {
    // Always log locally — useful for development and for audit trail in logs.
    console.error('Error boundary caught:', error)
    console.error('Component stack:', info.componentStack ?? 'unavailable')

    // Report to Sentry — no-op if Sentry is not initialised (VITE_SENTRY_DSN absent).
    // Sentry captures the full stack trace, breadcrumbs leading to the crash,
    // environment, release, and the React component tree (componentStack).
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: info.componentStack ?? undefined,
        },
      },
    })
  }

  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleError}
      onReset={() => {
        // Optional: perform cleanup before resetting
        window.location.href = '/portfolio'
      }}
    >
      {children}
    </ReactErrorBoundary>
  )
}

export default AppErrorBoundary
