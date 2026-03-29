import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/hooks/useAuth'
import AppShell    from '@/components/AppShell'
import AuthGuard   from '@/components/AuthGuard'
import CommandPalette from '@/components/CommandPalette'
import Login       from '@/routes/Login'
import Portfolio   from '@/routes/Portfolio'
import Project     from '@/routes/Project'
import Board       from '@/routes/Board'
import Resources   from '@/routes/Resources'
import AIEngine    from '@/routes/AIEngine'
import Settings    from '@/routes/Settings'
// S0 version (D3 canvas): import Constellation from '@/routes/Constellation'
// S1A version (@xyflow/react): D-040 Constellation View with D-043 risk propagation
import ConstellationView from '@/features/constellation/ConstellationView'

/**
 * App — root component.
 *
 * Auth architecture:
 *   AuthProvider wraps the entire tree — all routes can call useAuth().
 *   AuthGuard wraps the layout route — any unauthenticated request to any
 *   protected path is redirected to /login before AppShell renders.
 *   /login is outside AuthGuard — always accessible.
 *
 * Production IdP swap:
 *   AuthProvider → useAuth → authService (auth.supabase.ts)
 *   Replace authService import in auth.supabase.ts with auth.okta.ts.
 *   No changes required here or in any route component.
 *
 * Role-gated routes (examples for Sprint 1+):
 *   <AuthGuard requiredRoles={['admin']}>
 *     <AdminConsole />
 *   </AuthGuard>
 */
export default function App() {
  const [commandOpen, setCommandOpen] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setCommandOpen(prev => !prev)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <BrowserRouter>
      {/* AuthProvider must wrap everything so useAuth() works in all routes */}
      <AuthProvider>

        {/* CommandPalette is outside Routes so it overlays any protected route */}
        <CommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
        />

        <Routes>
          {/* ── Public route — no auth required ────────────────────────── */}
          <Route path="/login" element={<Login />} />

          {/* ── Protected layout route ──────────────────────────────────── */}
          {/* AuthGuard redirects unauthenticated users to /login           */}
          {/* AppShell renders sidebar + <Outlet /> for nested routes        */}
          <Route
            path="/"
            element={
              <AuthGuard>
                <AppShell onCommandPalette={() => setCommandOpen(true)} />
              </AuthGuard>
            }
          >
            <Route index element={<Navigate to="/portfolio" replace />} />
            <Route path="portfolio"     element={<Portfolio />} />
            <Route path="constellation" element={<ConstellationView />} />
            <Route path="project/:id"   element={<Project />} />
            <Route path="board/:id"     element={<Board />} />
            <Route path="resources"     element={<Resources />} />
            <Route path="ai"            element={<AIEngine />} />

            {/* Settings — admin only in production; open during POC */}
            <Route path="settings"      element={<Settings />} />

            <Route path="*"             element={<Navigate to="/portfolio" replace />} />
          </Route>
        </Routes>

      </AuthProvider>
    </BrowserRouter>
  )
}
