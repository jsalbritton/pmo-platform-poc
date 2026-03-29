/**
 * useAuth.tsx — React auth context + hooks
 *
 * Provides auth state to the entire component tree via AuthProvider.
 * Components call useAuth() to get session, role, signIn, signOut.
 *
 * PATTERN: Context + singleton service. The AuthProvider owns the
 * subscription lifecycle. Components never call authService directly —
 * they go through this hook so auth state is always consistent.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { authService } from '@/lib/auth.supabase'
import type { AuthSession, PmoRole } from '@/lib/auth'

// ── CONTEXT TYPE ──────────────────────────────────────────────────────────────

interface AuthContextValue {
  session:   AuthSession | null
  user:      AuthSession['user'] | null
  role:      PmoRole | null
  isLoading: boolean
  signIn:    (email: string, password: string) => Promise<void>
  signOut:   () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ── PROVIDER ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession]     = useState<AuthSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Hydrate from persisted session on mount (local storage / cookie)
    authService.getSession().then(s => {
      setSession(s)
      setIsLoading(false)
    })

    // Subscribe to future state changes: token refresh, sign-out, OKTA callback
    const unsubscribe = authService.onAuthStateChange(s => {
      setSession(s)
      setIsLoading(false)
    })

    return unsubscribe
  }, [])

  const signIn = async (email: string, password: string): Promise<void> => {
    const s = await authService.signIn(email, password)
    setSession(s)
  }

  const signOut = async (): Promise<void> => {
    await authService.signOut()
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{
      session,
      user:      session?.user      ?? null,
      role:      session?.user?.pmo_role ?? null,
      isLoading,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// ── HOOKS ─────────────────────────────────────────────────────────────────────

/** Primary hook — returns full auth context. Must be inside AuthProvider. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/**
 * useRequireRole — returns true if the current user holds one of the given roles.
 *
 * Usage (hide a UI element from non-admins):
 *   const canManageUsers = useRequireRole(['admin'])
 *
 * Usage (PM + admin can see project creation button):
 *   const canCreate = useRequireRole(['admin', 'pm'])
 */
export function useRequireRole(roles: PmoRole[]): boolean {
  const { role } = useAuth()
  return role !== null && roles.includes(role)
}
