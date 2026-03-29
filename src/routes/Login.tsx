/**
 * Login — /login
 *
 * Light-mode enterprise design. Clean white card on slate background.
 * POC: Email + password via Supabase Auth.
 * Production: OKTA SSO with Azure AD federation (PKCE + SAML 2.0).
 *
 * 21 CFR Part 11.300 notes:
 *   - Password field never logs its value
 *   - Failed attempts write to activity_log (auth.sign_in_failed)
 *   - Successful sign-in writes to activity_log (auth.sign_in)
 */

import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Warning } from '@phosphor-icons/react'

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin:       { label: 'Administrator',   color: 'bg-blue-100 text-blue-700' },
  sponsor:     { label: 'Program Sponsor', color: 'bg-violet-100 text-violet-700' },
  pm:          { label: 'Project Manager', color: 'bg-emerald-100 text-emerald-700' },
  team_member: { label: 'Team Member',     color: 'bg-amber-100 text-amber-700' },
  viewer:      { label: 'Viewer',          color: 'bg-slate-100 text-slate-600' },
  ml_admin:    { label: 'ML Administrator',color: 'bg-cyan-100 text-cyan-700' },
}

export default function Login() {
  const { signIn, session, isLoading } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const from      = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/portfolio'

  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [error,      setError]      = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!isLoading && session) {
    return <Navigate to={from} replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email, password)
      navigate(from, { replace: true })
    } catch {
      setError('Invalid credentials. Please check your email and password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">

      {/* Subtle background pattern */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `radial-gradient(circle, #94a3b8 1px, transparent 1px)`,
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative w-full max-w-sm">

        {/* Logo / wordmark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl
                          bg-gradient-to-br from-blue-600 to-violet-600 shadow-lg shadow-blue-500/20 mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 7v10l8 5 8-5V7L12 2z"
                    stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M12 2v20M4 7l8 5 8-5"
                    stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">PMO Platform</h1>
          <p className="text-xs text-slate-500 mt-1">Global IT · Program Management Office</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/80 border border-slate-200/80 p-8">

          <h2 className="text-sm font-semibold text-slate-700 mb-6">Sign in to your account</h2>

          {/* POC mode banner */}
          <div className="mb-5 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-xs text-amber-700 leading-relaxed">
              <span className="font-semibold">POC mode</span> — using Supabase Auth.{' '}
              Production will use <span className="font-medium">OKTA SSO</span> with Azure AD.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label htmlFor="email"
                     className="block text-xs font-medium text-slate-600 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-sm
                           text-slate-900 placeholder-slate-400 outline-none
                           focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                placeholder="you@globalit.example.com"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password"
                     className="block text-xs font-medium text-slate-600 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-sm
                           text-slate-900 placeholder-slate-400 outline-none
                           focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                placeholder="••••••••"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
                <Warning size={14} weight="fill" className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                         text-white text-sm font-semibold rounded-lg py-2.5 mt-1
                         transition-colors shadow-sm shadow-blue-600/30
                         focus:outline-none focus:ring-2 focus:ring-blue-500/50
                         disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Signing in…
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* OKTA stub */}
          <div className="mt-5 pt-5 border-t border-slate-100">
            <button
              disabled
              title="OKTA SSO — enabled in production with Azure AD federation"
              className="w-full flex items-center justify-center gap-2.5 px-3 py-2.5
                         bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-400
                         cursor-not-allowed select-none"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-slate-400">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 18a6 6 0 110-12 6 6 0 010 12z"/>
              </svg>
              Sign in with OKTA
              <span className="ml-auto text-[10px] text-slate-400 font-medium tracking-wide uppercase">
                Production
              </span>
            </button>
            <p className="text-center text-[10px] text-slate-400 mt-2">
              Azure AD / Entra ID · PKCE + SAML 2.0
            </p>
          </div>
        </div>

        {/* Test accounts */}
        <div className="mt-5 px-1">
          <p className="text-xs text-slate-500 mb-2.5 font-medium">POC test accounts</p>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(ROLE_LABELS).map(([, { label, color }]) => (
              <div key={label}
                   className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${color}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            All test accounts: <span className="font-mono font-medium text-slate-600">PmoTest2026!</span>
          </p>
        </div>

        {/* 21 CFR footer */}
        <p className="text-center text-[10px] text-slate-400 mt-5 leading-relaxed">
          Session activity is recorded per 21 CFR Part 11.300(e).<br />
          Unauthorized access attempts are logged and reported.
        </p>
      </div>
    </div>
  )
}
