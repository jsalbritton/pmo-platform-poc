/**
 * AppShell — persistent application layout
 *
 * Wraps every route with a fixed sidebar + scrollable main area.
 * The sidebar holds navigation, user identity chip (with sign-out),
 * portfolio health summary, and the ⌘K command palette trigger.
 *
 * Session security (21 CFR Part 11.300(c)):
 *   useInactivityLogout monitors user activity and forces sign-out after
 *   SESSION_CONFIG.inactivityTimeoutMs of inactivity, with a dismissible
 *   warning modal SESSION_CONFIG.warningMs before the forced logout.
 */

import { NavLink, Outlet } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase,
  ChartBar,
  Kanban,
  UsersThree,
  Brain,
  Gear,
  MagnifyingGlass,
  ArrowsOut,
  Warning,
  CheckCircle,
  SignOut,
  Timer,
  UserCircle,
} from '@phosphor-icons/react'
import { usePortfolioStats } from '@/hooks/useProjects'
import { useAuth } from '@/hooks/useAuth'
import { useInactivityLogout } from '@/hooks/useInactivityLogout'
import { SESSION_CONFIG } from '@/config/session'
import type { AuthSession } from '@/lib/auth'

// ─── ROLE DISPLAY MAPS ────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  admin:       'Admin',
  sponsor:     'Sponsor',
  pm:          'PM',
  team_member: 'Team',
  viewer:      'Viewer',
  ml_admin:    'ML Admin',
}

const ROLE_COLORS: Record<string, string> = {
  admin:       'text-blue-400   bg-blue-500/15   border-blue-500/30',
  sponsor:     'text-violet-400 bg-violet-500/15 border-violet-500/30',
  pm:          'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
  team_member: 'text-amber-400  bg-amber-500/15  border-amber-500/30',
  viewer:      'text-slate-400  bg-slate-500/15  border-slate-500/30',
  ml_admin:    'text-cyan-400   bg-cyan-500/15   border-cyan-500/30',
}

// ─── NAV ITEMS ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: '/portfolio',  icon: Briefcase,   label: 'Portfolio'  },
  { to: '/resources',  icon: UsersThree,  label: 'Resources'  },
  { to: '/ai',         icon: Brain,       label: 'AI Engine'  },
  { to: '/settings',   icon: Gear,        label: 'Settings'   },
]

// ─── INACTIVITY WARNING MODAL ─────────────────────────────────────────────────

function InactivityWarningModal({
  secondsRemaining,
  onStaySignedIn,
  onSignOut,
}: {
  secondsRemaining: number
  onStaySignedIn:   () => void
  onSignOut:        () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        className="bg-[#0d1117] border border-amber-500/30 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
            <Timer size={20} className="text-amber-400" weight="fill" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Session Timeout Warning</h3>
            <p className="text-xs text-slate-500">Inactivity detected — 21 CFR 11.300(c)</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 mb-5 leading-relaxed">
          Your session will end automatically in{' '}
          <span className="font-bold text-amber-400 tabular-nums">
            {secondsRemaining} second{secondsRemaining !== 1 ? 's' : ''}
          </span>{' '}
          due to inactivity.
        </p>

        {/* Countdown bar */}
        <div className="h-1 rounded-full bg-white/5 overflow-hidden mb-5">
          <motion.div
            className="h-full rounded-full bg-amber-500"
            animate={{ width: `${Math.min((secondsRemaining / (SESSION_CONFIG.warningMs / 1000)) * 100, 100)}%` }}
            transition={{ duration: 0.9, ease: 'linear' }}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onStaySignedIn}
            autoFocus
            className="
              flex-1 bg-blue-600 hover:bg-blue-500 text-white
              text-sm font-semibold rounded-lg py-2.5
              transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50
            "
          >
            Stay signed in
          </button>
          <button
            onClick={onSignOut}
            className="
              flex-1 bg-white/5 hover:bg-white/10 text-slate-300
              text-sm rounded-lg py-2.5 transition-colors
              border border-white/10 hover:border-white/20
            "
          >
            Sign out
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── USER IDENTITY CHIP ───────────────────────────────────────────────────────
// Shows the signed-in user's username + role badge + sign-out button.
// Placed above the Portfolio Pulse widget so it's always visible.

function UserChip({
  session,
  onSignOut,
}: {
  session:   AuthSession
  onSignOut: () => void
}) {
  const role       = session.user.pmo_role ?? 'viewer'
  const colorClass = ROLE_COLORS[role] ?? ROLE_COLORS.viewer
  const roleLabel  = ROLE_LABELS[role] ?? role

  // Show only the local-part of the email to save sidebar space
  const displayName = session.user.email.split('@')[0]

  return (
    <div className="mx-3 mb-2 rounded-xl border border-white/8 bg-white/3 p-3">
      <div className="flex items-center gap-2 mb-2">
        <UserCircle size={16} className="text-slate-500 flex-shrink-0" weight="duotone" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-slate-200 truncate">{displayName}</div>
          <div className="text-[10px] text-slate-600 truncate">{session.user.email}</div>
        </div>
        <button
          onClick={onSignOut}
          title="Sign out"
          className="
            flex-shrink-0 p-1.5 rounded-lg
            text-slate-500 hover:text-red-400 hover:bg-red-500/10
            transition-colors
          "
        >
          <SignOut size={13} weight="bold" />
        </button>
      </div>

      <span className={`
        inline-flex items-center text-[10px] font-semibold
        px-2 py-0.5 rounded-full border ${colorClass}
      `}>
        {roleLabel}
      </span>
    </div>
  )
}

// ─── PORTFOLIO PULSE ──────────────────────────────────────────────────────────

function PortfolioPulse() {
  const { data: stats } = usePortfolioStats()

  if (!stats) return null

  const healthColor = stats.avgHealthScore >= 70
    ? 'text-emerald-400'
    : stats.avgHealthScore >= 40
      ? 'text-amber-400'
      : 'text-red-400'

  return (
    <div className="mx-3 mb-2 rounded-xl border border-white/8 bg-white/3 p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Portfolio Health
        </span>
        <span className={`text-lg font-bold tabular-nums ${healthColor}`}>
          {stats.avgHealthScore}
        </span>
      </div>
      <div className="space-y-1.5">
        <PulseRow
          icon={<CheckCircle size={12} className="text-emerald-400" weight="fill" />}
          label="On Track"
          count={stats.onTrack}
          total={stats.total}
          color="bg-emerald-500"
        />
        <PulseRow
          icon={<Warning size={12} className="text-amber-400" weight="fill" />}
          label="At Risk"
          count={stats.atRisk}
          total={stats.total}
          color="bg-amber-500"
        />
        <PulseRow
          icon={<Warning size={12} className="text-red-400" weight="fill" />}
          label="Critical"
          count={stats.critical}
          total={stats.total}
          color="bg-red-500"
        />
      </div>
    </div>
  )
}

function PulseRow({
  icon, label, count, total, color
}: {
  icon:  React.ReactNode
  label: string
  count: number
  total: number
  color: string
}) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-[11px] text-slate-400">{label}</span>
          <span className="text-[11px] text-slate-500 tabular-nums">{count}</span>
        </div>
        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${color}`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────

function Sidebar({
  onCommandPalette,
  session,
  onSignOut,
}: {
  onCommandPalette: () => void
  session:          AuthSession | null
  onSignOut:        () => void
}) {
  return (
    <aside className="
      fixed left-0 top-0 bottom-0 w-56
      bg-[#0d1117] border-r border-white/5
      flex flex-col z-20
    ">
      {/* Brand */}
      <div className="px-4 pt-5 pb-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
            <ChartBar size={14} weight="bold" className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-100 leading-none">PMO Platform</div>
            <div className="text-[10px] text-slate-600 mt-0.5">Sprint 0 · POC</div>
          </div>
        </div>
      </div>

      {/* Command palette trigger */}
      <button
        onClick={onCommandPalette}
        className="
          mx-3 mt-3 mb-1 flex items-center gap-2 px-3 py-2
          rounded-lg border border-white/8 bg-white/3
          text-slate-500 hover:text-slate-300 hover:border-white/15
          transition-colors text-xs cursor-pointer group
        "
      >
        <MagnifyingGlass size={12} />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="text-[10px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 font-mono
                        group-hover:border-white/20 transition-colors">
          ⌘K
        </kbd>
      </button>

      {/* Nav links */}
      <nav className="flex-1 px-2 pt-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2 rounded-lg text-sm
              transition-colors relative group
              ${isActive
                ? 'bg-blue-600/15 text-blue-300 font-medium'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }
            `}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-500 rounded-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <Icon size={16} weight={isActive ? 'bold' : 'regular'} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* Constellation View — separate section */}
        <div className="pt-3 pb-1 px-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold">
            Views
          </div>
        </div>
        <NavLink
          to="/constellation"
          className={({ isActive }) => `
            flex items-center gap-3 px-3 py-2 rounded-lg text-sm
            transition-colors relative group
            ${isActive
              ? 'bg-violet-600/15 text-violet-300 font-medium'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }
          `}
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-violet-500 rounded-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <ArrowsOut size={16} weight={isActive ? 'bold' : 'regular'} />
              <span>Constellation</span>
              <span className="ml-auto text-[9px] bg-violet-500/20 text-violet-400 border border-violet-500/30 rounded px-1.5 py-0.5 font-semibold">
                NEW
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/board/all"
          className={({ isActive }) => `
            flex items-center gap-3 px-3 py-2 rounded-lg text-sm
            transition-colors relative
            ${isActive
              ? 'bg-blue-600/15 text-blue-300 font-medium'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }
          `}
        >
          {({ isActive }) => (
            <>
              <Kanban size={16} weight={isActive ? 'bold' : 'regular'} />
              <span>Sprint Board</span>
            </>
          )}
        </NavLink>
      </nav>

      {/* Bottom: user identity + portfolio pulse */}
      <div className="pb-4">
        {session && <UserChip session={session} onSignOut={onSignOut} />}
        <PortfolioPulse />
      </div>
    </aside>
  )
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────

export default function AppShell({
  onCommandPalette,
}: {
  onCommandPalette: () => void
}) {
  const { session, signOut } = useAuth()

  const { showWarning, secondsRemaining, resetTimer } = useInactivityLogout({
    timeoutMs: SESSION_CONFIG.inactivityTimeoutMs,
    warningMs: SESSION_CONFIG.warningMs,
    onSignOut: signOut,
    enabled:   !!session,
  })

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        onCommandPalette={onCommandPalette}
        session={session}
        onSignOut={signOut}
      />

      <main className="ml-56 flex-1 min-w-0 min-h-screen bg-slate-50">
        <AnimatePresence mode="wait">
          <Outlet />
        </AnimatePresence>
      </main>

      {/* Inactivity warning modal — portal-style, rendered above everything */}
      <AnimatePresence>
        {showWarning && (
          <InactivityWarningModal
            secondsRemaining={secondsRemaining}
            onStaySignedIn={resetTimer}
            onSignOut={signOut}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
