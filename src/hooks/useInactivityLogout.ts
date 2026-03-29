/**
 * useInactivityLogout — 21 CFR Part 11.300(c) session validity control
 *
 * Monitors user activity and automatically signs out the session after a
 * configurable inactivity period. Displays a dismissible warning modal
 * `warningMs` milliseconds before the forced logout.
 *
 * Architecture:
 *   - A single setInterval runs every second and computes idle time from
 *     `lastActivityRef.current`. This is more reliable than cascading
 *     setTimeout chains and avoids timer drift.
 *   - Activity events update only the ref — no state writes — so the
 *     interval is the single source of truth for countdown state.
 *   - Hook is a no-op when `enabled` is false (unauthenticated users).
 *
 * Usage:
 *   const { showWarning, secondsRemaining, resetTimer } = useInactivityLogout({
 *     timeoutMs: SESSION_CONFIG.inactivityTimeoutMs,
 *     warningMs: SESSION_CONFIG.warningMs,
 *     onSignOut:  signOut,
 *     enabled:    !!session,
 *   })
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { SESSION_CONFIG } from '@/config/session'

interface UseInactivityLogoutOptions {
  timeoutMs: number
  warningMs: number
  onSignOut: () => void
  /** Set false when the user is unauthenticated — disables all timers. */
  enabled?: boolean
}

interface UseInactivityLogoutReturn {
  showWarning:      boolean
  secondsRemaining: number
  resetTimer:       () => void
}

export function useInactivityLogout({
  timeoutMs,
  warningMs,
  onSignOut,
  enabled = true,
}: UseInactivityLogoutOptions): UseInactivityLogoutReturn {

  const [showWarning,      setShowWarning]      = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(Math.ceil(warningMs / 1000))

  const lastActivityRef  = useRef(Date.now())
  const warningActiveRef = useRef(false)
  const onSignOutRef     = useRef(onSignOut)

  // Keep callback ref stable so effect deps don't change
  useEffect(() => { onSignOutRef.current = onSignOut }, [onSignOut])

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now()
    if (warningActiveRef.current) {
      warningActiveRef.current = false
      setShowWarning(false)
      setSecondsRemaining(Math.ceil(warningMs / 1000))
    }
  }, [warningMs])

  useEffect(() => {
    if (!enabled) {
      setShowWarning(false)
      return
    }

    // Reset baseline when enabled (e.g., on first authenticated render)
    lastActivityRef.current = Date.now()

    const handleActivity = () => {
      lastActivityRef.current = Date.now()
      if (warningActiveRef.current) {
        warningActiveRef.current = false
        setShowWarning(false)
        setSecondsRemaining(Math.ceil(warningMs / 1000))
      }
    }

    SESSION_CONFIG.activityEvents.forEach(evt =>
      window.addEventListener(evt, handleActivity, { passive: true })
    )

    const interval = setInterval(() => {
      const idleMs    = Date.now() - lastActivityRef.current
      const remaining = timeoutMs - idleMs

      if (remaining <= 0) {
        clearInterval(interval)
        warningActiveRef.current = false
        setShowWarning(false)
        onSignOutRef.current()
        return
      }

      if (remaining <= warningMs) {
        const secs = Math.ceil(remaining / 1000)
        if (!warningActiveRef.current) {
          warningActiveRef.current = true
          setShowWarning(true)
        }
        setSecondsRemaining(secs)
      }
    }, 1000)

    return () => {
      clearInterval(interval)
      SESSION_CONFIG.activityEvents.forEach(evt =>
        window.removeEventListener(evt, handleActivity)
      )
    }
  }, [enabled, timeoutMs, warningMs])

  return { showWarning, secondsRemaining, resetTimer }
}
