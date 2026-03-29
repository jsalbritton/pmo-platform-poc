/**
 * AuthGuard — route-level auth + role protection.
 *
 * Wraps any route that requires authentication. Unauthenticated users
 * are redirected to /login with the attempted location preserved in state
 * so they land on their intended page after sign-in.
 *
 * Optional requiredRoles prop gates a route to specific PMO roles.
 * A pm trying to access an admin-only route is redirected to /portfolio
 * (not /login — they are authenticated, just not authorized).
 *
 * Usage:
 *   // Any authenticated user
 *   <AuthGuard><Portfolio /></AuthGuard>
 *
 *   // Admin-only
 *   <AuthGuard requiredRoles={['admin']}><AdminSettings /></AuthGuard>
 */

import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { PmoRole } from '@/lib/auth'

interface AuthGuardProps {
  children:      ReactNode
  requiredRoles?: PmoRole[]
}

function FullPageSpinner() {
  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
        <p className="text-xs text-slate-600 tracking-wide">Verifying session…</p>
      </div>
    </div>
  )
}

export default function AuthGuard({ children, requiredRoles }: AuthGuardProps) {
  const { session, isLoading } = useAuth()
  const location = useLocation()

  // Still hydrating session from storage — don't flash the login page
  if (isLoading) return <FullPageSpinner />

  // Not authenticated — redirect to login, preserving intended destination
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Authenticated but wrong role — redirect to portfolio (not login)
  if (requiredRoles && session.user.pmo_role &&
      !requiredRoles.includes(session.user.pmo_role)) {
    return <Navigate to="/portfolio" replace />
  }

  return <>{children}</>
}
