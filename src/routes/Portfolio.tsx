/**
 * Portfolio — /portfolio   ·   COMMAND CENTER
 *
 * Design philosophy: density + clarity.
 *   — Critical/At-Risk projects shown as dense table rows (3x more visible)
 *   — Priority Focus: top 5 worst projects surfaced above all else
 *   — On Hold / Planning separated into collapsible "Parked" section
 *   — Multi-select domain filter for cross-domain portfolio views
 *   — Color as signal only: green/amber/red for health status
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase,
  Warning,
  CheckCircle,
  // XCircle, // reserved for delete actions (Sprint 2)
  ArrowRight,
  ShieldWarning,
  ArrowUp,
  ArrowDown,
  ArrowsDownUp,
  MapTrifold,
  Rows,
  Lightning,
  // TrendUp, TrendDown, Minus — reserved for MOMENTUM_CFG (Sprint 1B)
  CaretDown,
  CaretRight,
  Target,
  Buildings,
  X,
} from '@phosphor-icons/react'
import { useProjects, usePortfolioStats } from '@/hooks/useProjects'
import type { ProjectWithOwner } from '@/hooks/useProjects'
import type { Project, ProjectStatus, PulseCondition } from '@/types'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type TabId = 'command' | 'list' | 'roadmap'
type FilterStatus = 'all' | 'critical' | 'at_risk' | 'on_track'

// ─── HEALTH UTILITIES ─────────────────────────────────────────────────────────

function healthCfg(score: number | null) {
  if (score === null) return {
    ring: '#d1d5db', fill: '#9ca3af', text: 'text-gray-400',
    leftBorder: 'border-l-gray-200',
    badgeBg: 'bg-gray-50', badgeText: 'text-gray-500', badgeBorder: 'border-gray-200',
  }
  if (score >= 70) return {
    ring: '#10b981', fill: '#059669', text: 'text-emerald-600',
    leftBorder: 'border-l-emerald-400',
    badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-700', badgeBorder: 'border-emerald-200',
  }
  if (score >= 50) return {
    ring: '#f59e0b', fill: '#d97706', text: 'text-amber-600',
    leftBorder: 'border-l-amber-400',
    badgeBg: 'bg-amber-50', badgeText: 'text-amber-700', badgeBorder: 'border-amber-200',
  }
  if (score >= 30) return {
    ring: '#f97316', fill: '#ea580c', text: 'text-orange-600',
    leftBorder: 'border-l-orange-400',
    badgeBg: 'bg-orange-50', badgeText: 'text-orange-700', badgeBorder: 'border-orange-200',
  }
  return {
    ring: '#ef4444', fill: '#dc2626', text: 'text-red-600',
    leftBorder: 'border-l-red-400',
    badgeBg: 'bg-red-50', badgeText: 'text-red-700', badgeBorder: 'border-red-200',
  }
}

function healthLabel(score: number | null) {
  if (score === null) return '—'
  if (score >= 70) return 'On Track'
  if (score >= 50) return 'At Risk'
  if (score >= 30) return 'Elevated'
  return 'Critical'
}

// ─── PULSE CONFIG ─────────────────────────────────────────────────────────────

function pulseConditionCfg(condition: PulseCondition | string | null | undefined) {
  switch (condition) {
    case 'healthy':  return { label: 'On Track',  textColor: 'text-emerald-700', dot: '#10b981', leftBorder: 'border-l-emerald-300' }
    case 'watch':    return { label: 'At Risk',   textColor: 'text-amber-700',   dot: '#f59e0b', leftBorder: 'border-l-amber-300'   }
    case 'elevated': return { label: 'Elevated',  textColor: 'text-orange-700',  dot: '#f97316', leftBorder: 'border-l-orange-400'  }
    case 'critical': return { label: 'Critical',  textColor: 'text-red-700',     dot: '#ef4444', leftBorder: 'border-l-red-400'     }
    case 'dormant':  return { label: 'Dormant',   textColor: 'text-gray-400',    dot: '#9ca3af', leftBorder: 'border-l-gray-200'    }
    default:         return { label: '—',          textColor: 'text-gray-400',    dot: '#d1d5db', leftBorder: 'border-l-gray-200'    }
  }
}

const STATUS_CFG: Record<ProjectStatus, { label: string; dot: string }> = {
  planning:  { label: 'Planning',  dot: 'bg-violet-400'  },
  active:    { label: 'Active',    dot: 'bg-emerald-400' },
  on_track:  { label: 'On Track',  dot: 'bg-emerald-400' },
  at_risk:   { label: 'At Risk',   dot: 'bg-amber-400'   },
  critical:  { label: 'Critical',  dot: 'bg-red-400'     },
  completed: { label: 'Completed', dot: 'bg-blue-400'    },
  on_hold:   { label: 'On Hold',   dot: 'bg-gray-400'    },
  cancelled: { label: 'Cancelled', dot: 'bg-gray-300'    },
}

const SIGNAL_LABELS: Record<string, string> = {
  budget: 'Budget', schedule: 'Schedule', delivery: 'Delivery',
  scope: 'Scope', risks: 'Risk', execution: 'Execution',
}

/* Momentum config — reserved for expanded project row detail (Sprint 1B)
const MOMENTUM_CFG: Record<string, { icon: React.ReactNode; title: string; color: string }> = {
  recovering: { icon: <TrendUp size={11} />,  title: 'Recovering', color: 'text-emerald-500' },
  declining:  { icon: <TrendDown size={11} />, title: 'Declining',  color: 'text-red-400'    },
  volatile:   { icon: <Lightning size={11} />, title: 'Volatile',   color: 'text-amber-500'  },
  stable:     { icon: <Minus size={11} />,     title: 'Stable',     color: 'text-gray-400'   },
}
*/

const CONDITION_RANK: Record<string, number> = { critical: 0, elevated: 1, dormant: 2, watch: 3, healthy: 4 }

const PARKED_STATUSES = new Set(['on_hold', 'planning', 'cancelled', 'completed'])

// ─── OWNER / TIME UTILITIES ─────────────────────────────────────────────────

/** Extract up to 2 initials from display_name or full_name */
function ownerInitials(owner: ProjectWithOwner['owner']): string {
  if (!owner) return '?'
  const name = owner.display_name || owner.full_name || ''
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (name[0] ?? '?').toUpperCase()
}

/** Human-friendly relative time: "2h ago", "3d ago", "Mar 15" */
function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 14)  return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Consistent colour for initials avatar — deterministic from name string */
const AVATAR_COLORS = [
  'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500',
  'bg-pink-500', 'bg-rose-500', 'bg-red-500', 'bg-orange-500',
  'bg-amber-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500',
]
function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ─── DOMAIN DISPLAY NAMES ────────────────────────────────────────────────────
// Raw DB values → human-readable short labels for the UI.
// Add new mappings here as domains are added to the portfolio.

const DOMAIN_LABELS: Record<string, string> = {
  warehouse_distribution: 'W&D',
  warehouse:              'Warehouse',
  transportation:         'Transportation',
  infrastructure:         'Infrastructure',
  shared_services:        'Shared Services',
  data_analytics:         'Data & Analytics',
  security:               'Security',
  erp:                    'ERP',
  other:                  'Other',
}

function domainLabel(raw: string | null | undefined): string {
  if (!raw) return '—'
  return DOMAIN_LABELS[raw] ?? raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ─── ANIMATED COUNT ───────────────────────────────────────────────────────────

function AnimatedCount({ value, isLoading }: { value: number; isLoading: boolean }) {
  const [current, setCurrent] = useState(0)
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    if (isLoading) return
    const start = performance.now()
    const duration = 900
    const from = current
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(from + (value - from) * eased))
      if (progress < 1) animRef.current = requestAnimationFrame(step)
    }
    animRef.current = requestAnimationFrame(step)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [value, isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <span className="inline-block w-10 h-8 bg-gray-100 rounded animate-pulse" />
  return <>{current}</>
}

// ─── HEALTH STATUS BADGE ─────────────────────────────────────────────────────

function HealthBadge({ score, compact = false }: { score: number | null; compact?: boolean }) {
  const label = healthLabel(score)
  const cfg   = healthCfg(score)

  if (score === null) {
    return <span className="text-xs text-gray-300">—</span>
  }

  return (
    <span
      title={`Health score: ${score}/100`}
      className={`
        inline-flex items-center gap-1.5 flex-shrink-0
        ${compact ? 'text-[10px]' : 'text-[11px]'} font-semibold
        px-2 py-0.5 rounded-full border
        ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder}
      `}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.ring }} />
      {label}
    </span>
  )
}

// ─── MOMENTUM CHIP ───────────────────────────────────────────────────────────
// Compact inline indicator showing project trajectory.
// Hover reveals recent (1-2 week) reasons for the trend — distinct from the
// holistic StatusPill tooltip which shows overall project health.

function MomentumChip({ momentum, project }: { momentum?: string | null; project?: Project }) {
  const [showTip, setShowTip] = useState(false)

  if (!momentum || momentum === 'stable') return null

  const cfg: Record<string, { label: string; icon: string; bg: string; text: string; border: string }> = {
    declining:  { label: 'Declining',  icon: '↓', bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-200' },
    volatile:   { label: 'Volatile',   icon: '~', bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-200' },
    recovering: { label: 'Recovering', icon: '↑', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  }

  const c = cfg[momentum]
  if (!c) return null

  // Build recent-trend reasons (1-2 week view)
  // Filter out any signals the project has opted out of
  const reasons: string[] = []
  const actions: string[] = []
  if (project) {
    const excluded = new Set(project.excluded_signals ?? [])
    const signals = (project.pulse_signals ?? []).filter(s => !excluded.has(s))
    if (momentum === 'declining') {
      if (signals.includes('schedule')) reasons.push('Schedule slipping — missed recent milestone')
      if (signals.includes('budget'))   reasons.push('Budget burn rate exceeding plan')
      if (signals.includes('delivery')) reasons.push('Delivery velocity dropped last 2 sprints')
      if (signals.includes('scope'))    reasons.push('Scope creep detected — new items added')
      if (signals.includes('risks'))    reasons.push('Unmitigated risks escalated this week')
      if (reasons.length === 0) reasons.push('Health score dropped in the last 2 weeks')
      // Actionable recommendations
      if (signals.includes('schedule') || signals.includes('delivery'))
        actions.push('Schedule project review with PM and tech lead')
      if (signals.includes('budget'))
        actions.push('Request updated forecast from finance')
      if (signals.includes('scope'))
        actions.push('Convene change control board to assess scope additions')
      if (signals.includes('risks'))
        actions.push('Escalate top risks to steering committee')
      if (actions.length === 0)
        actions.push('Schedule a health check with the project team')
    } else if (momentum === 'volatile') {
      reasons.push('Health score fluctuating — no stable trend')
      if (signals.includes('schedule')) reasons.push('Timeline dates shifted multiple times')
      if (signals.includes('delivery')) reasons.push('Sprint velocity inconsistent')
      // Volatile = instability. The action is to stabilize, not firefight.
      actions.push('Review recent scope or resource changes for root cause')
      if (signals.includes('schedule'))
        actions.push('Lock timeline baseline and reassess dependencies')
      else
        actions.push('Assign dedicated PM attention until trend stabilizes')
    } else if (momentum === 'recovering') {
      reasons.push('Health score improving over last 2 weeks')
      if (signals.length > 0) reasons.push(`Remaining signals: ${signals.map(s => SIGNAL_LABELS[s] ?? s).join(', ')}`)
      // Recovering = positive but fragile. Don't remove attention yet.
      actions.push('Maintain current approach — do not reallocate resources yet')
      if (signals.length > 0)
        actions.push(`Monitor remaining ${signals.length} signal${signals.length > 1 ? 's' : ''} at next review`)
    }
  }

  return (
    <div
      className="relative flex-shrink-0"
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <span className={`
        inline-flex items-center gap-1 flex-shrink-0 cursor-default
        text-[9px] font-bold uppercase tracking-wide
        px-1.5 py-0.5 rounded border
        ${c.bg} ${c.text} ${c.border}
      `}>
        {c.icon} {c.label}
      </span>

      {showTip && (reasons.length > 0 || actions.length > 0) && (
        <div className="absolute top-full left-0 mt-1.5 z-50 pointer-events-none">
          <div className="bg-gray-900 text-white rounded-lg shadow-xl px-3 py-2.5 text-[11px] leading-relaxed w-72">
            <div className="font-semibold mb-1.5 flex items-center gap-1.5">
              <span>{c.icon}</span>
              {c.label} — Last 2 Weeks
            </div>
            <ul className="space-y-1 text-gray-300">
              {reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-gray-500 mt-0.5">•</span>
                  {r}
                </li>
              ))}
            </ul>
            {actions.length > 0 && (
              <>
                <div className="border-t border-gray-700 mt-2 pt-2">
                  <div className="font-semibold text-[10px] uppercase tracking-wider text-amber-400 mb-1">
                    Recommended Action
                  </div>
                  <ul className="space-y-1 text-gray-200">
                    {actions.map((a, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-amber-500 mt-0.5">→</span>
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
          <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 rotate-45" />
        </div>
      )}
    </div>
  )
}

// ─── STATUS PILL WITH HOVER TOOLTIP ──────────────────────────────────────────
// Single interactive pill that replaces HealthBadge + overdue text.
// On hover, shows a dynamic popup explaining why the project is in this status.

function StatusPill({ project }: { project: Project }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const score = project.health_score ?? null
  const label = healthLabel(score)
  const cfg   = healthCfg(score)

  if (score === null) {
    return <span className="text-xs text-gray-300">—</span>
  }

  // Build tooltip reasons — filter out excluded signal categories
  const reasons: string[] = []
  const excluded = new Set(project.excluded_signals ?? [])
  const signals = (project.pulse_signals ?? []).filter(s => !excluded.has(s))
  if (signals.length > 0) {
    reasons.push(`Triggered signals: ${signals.map(s => SIGNAL_LABELS[s] ?? s).join(', ')}`)
  }

  const days = project.target_end
    ? Math.round((new Date(project.target_end).getTime() - Date.now()) / 86400000)
    : null
  if (days !== null && days < 0) {
    reasons.push(`${Math.abs(days)} days past target end date`)
  } else if (days !== null && days < 30) {
    reasons.push(`${days} days until target end date`)
  }

  const mom = project.pulse_momentum
  if (mom === 'declining') reasons.push('Trend: health score declining')
  if (mom === 'volatile')  reasons.push('Trend: health score volatile')
  if (mom === 'recovering') reasons.push('Trend: health score recovering')

  if (reasons.length === 0) {
    reasons.push(`Health score: ${score}/100`)
  }

  return (
    <div
      className="relative flex-shrink-0"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        className={`
          inline-flex items-center gap-1.5 flex-shrink-0
          text-[11px] font-semibold cursor-default
          px-2.5 py-1 rounded-full border
          ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder}
          transition-shadow hover:shadow-md
        `}
      >
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.ring }} />
        {label}
        {mom && mom !== 'stable' && (
          <span className={`ml-0.5 ${
            mom === 'recovering' ? 'text-emerald-500' :
            mom === 'declining'  ? 'text-red-400' :
            'text-amber-500'
          }`}>
            {mom === 'recovering' ? '↑' : mom === 'declining' ? '↓' : '~'}
          </span>
        )}
      </span>

      {/* Hover tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full right-0 mb-2 z-50 pointer-events-none">
          <div className="bg-gray-900 text-white rounded-lg shadow-xl px-3 py-2.5 text-[11px] leading-relaxed w-56">
            <div className="font-semibold mb-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: cfg.ring }} />
              {label} — Score {score}/100
            </div>
            <ul className="space-y-1 text-gray-300">
              {reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-gray-500 mt-0.5">•</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
          {/* Arrow */}
          <div className="absolute -bottom-1 right-4 w-2 h-2 bg-gray-900 rotate-45" />
        </div>
      )}
    </div>
  )
}

// ─── SIGNAL TEXT ──────────────────────────────────────────────────────────────

function SignalText({ signals, max = 3 }: { signals: string[] | null | undefined; max?: number }) {
  if (!signals || signals.length === 0) return null
  const shown = signals.slice(0, max).map(s => SIGNAL_LABELS[s] ?? s)
  const extra = signals.length - max
  return (
    <span className="text-[10px] text-gray-400">
      {shown.join(' · ')}{extra > 0 ? ` +${extra}` : ''}
    </span>
  )
}

// ─── KPI STRIP ────────────────────────────────────────────────────────────────

function KPIStrip({ activeCount, activeCounts }: {
  activeCount: number
  activeCounts: { onTrack: number; atRisk: number; critical: number; avgHealth: number }
}) {
  const { isLoading } = usePortfolioStats()

  const total = Math.max(activeCount, 1)
  const cards = [
    { label: 'Active Projects', value: activeCount,                   valueColor: 'text-gray-800',    sub: 'in execution',  accent: 'border-b-blue-400' },
    { label: 'On Track',        value: activeCounts.onTrack,          valueColor: 'text-emerald-600', sub: `${Math.round((activeCounts.onTrack / total) * 100)}%`, accent: 'border-b-emerald-400' },
    { label: 'At Risk',         value: activeCounts.atRisk,           valueColor: 'text-amber-600',   sub: `${Math.round((activeCounts.atRisk / total) * 100)}%`, accent: 'border-b-amber-400' },
    { label: 'Critical',        value: activeCounts.critical,         valueColor: 'text-red-600',     sub: `${Math.round((activeCounts.critical / total) * 100)}%`, accent: 'border-b-red-400' },
    { label: 'Avg Health',      value: activeCounts.avgHealth,        valueColor: healthCfg(activeCounts.avgHealth).text, sub: healthLabel(activeCounts.avgHealth), accent: activeCounts.avgHealth >= 70 ? 'border-b-emerald-400' : activeCounts.avgHealth >= 40 ? 'border-b-amber-400' : 'border-b-red-400' },
  ]

  return (
    <div className="kpi-grid-rows grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
      {cards.map((card) => (
        <div key={card.label}
          className={`kpi-card-rows rounded-xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm border-b-2 ${card.accent}`}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
            {card.label}
          </p>
          <p className={`text-2xl font-bold tabular-nums tracking-tight ${card.valueColor}`}>
            <AnimatedCount value={card.value} isLoading={isLoading} />
          </p>
          {card.sub && !isLoading && (
            <p className="text-[10px] text-gray-400 mt-1">{card.sub}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── MULTI-SELECT DOMAIN FILTER ──────────────────────────────────────────────

function DomainPills({
  verticals,
  selected,
  onToggle,
}: {
  verticals: string[]
  selected:  Set<string>
  onToggle:  (v: string) => void
}) {
  if (verticals.length <= 1) return null

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Domain</p>
      <div className="flex flex-wrap items-center gap-2">
        <Buildings size={14} className="text-gray-400 mr-0.5" />
        {verticals.map(v => {
          const isActive = selected.has(v)
          return (
            <button
              key={v}
              onClick={() => onToggle(v)}
              className={`
                flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[12px] font-semibold
                border transition-all cursor-pointer
                ${isActive
                  ? 'bg-[#002a7a] text-white border-[#002a7a] shadow-lg shadow-blue-900/25 ring-1 ring-blue-400/30'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:shadow-md shadow-sm'
                }
              `}
            >
              {domainLabel(v)}
              {isActive && <X size={11} className="text-white/70" />}
            </button>
          )
        })}
        {selected.size > 0 && (
          <button
            onClick={() => selected.forEach(v => onToggle(v))}
            className="text-[11px] text-gray-400 hover:text-gray-600 ml-1 cursor-pointer"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  )
}

// ─── FILTER BAR ──────────────────────────────────────────────────────────────

function FilterBar({
  active,
  onFilter,
  counts,
}: {
  active:   FilterStatus
  onFilter: (f: FilterStatus) => void
  counts:   { all: number; critical: number; at_risk: number; on_track: number }
}) {
  // Active pill uses sidebar navy (#002a7a) with white text — consistent brand identity
  const ACTIVE_PILL = 'text-white bg-[#002a7a] border-[#002a7a] shadow-lg shadow-blue-900/25 ring-1 ring-blue-400/30'
  const filters: { id: FilterStatus; label: string; color: string; count: number }[] = [
    { id: 'all',      label: 'All Active',   color: 'text-gray-500 bg-white border-gray-200 hover:border-gray-300 hover:shadow-md',   count: counts.all },
    { id: 'critical', label: 'Critical',      color: 'text-gray-500 bg-white border-gray-200 hover:border-red-200 hover:shadow-md',    count: counts.critical },
    { id: 'at_risk',  label: 'At Risk',       color: 'text-gray-500 bg-white border-gray-200 hover:border-amber-200 hover:shadow-md',  count: counts.at_risk },
    { id: 'on_track', label: 'On Track',      color: 'text-gray-500 bg-white border-gray-200 hover:border-emerald-200 hover:shadow-md', count: counts.on_track },
  ]

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Project Status</p>
      <div className="flex flex-wrap items-center gap-2">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => onFilter(f.id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold
              border transition-all cursor-pointer
              ${active === f.id ? ACTIVE_PILL : f.color}
            `}
          >
            {f.label}
            <span className={`tabular-nums text-[11px] font-bold ${active === f.id ? 'text-white/80' : 'opacity-40'}`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── PRIORITY FOCUS — TOP 5 WORST PROJECTS ───────────────────────────────────
// When everything is red, nothing is red. This section surfaces the 5 projects
// that are in the worst shape: lowest health, most overdue, most signal triggers.
// This is where the executive should look FIRST.

function PriorityFocus({ projects, onNavigate }: { projects: ProjectWithOwner[]; onNavigate: (id: string) => void }) {
  const top5 = useMemo(() => {
    return [...projects]
      .filter(p => !PARKED_STATUSES.has(p.status) && (p.health_score ?? 100) < 70)
      .sort((a, b) => {
        // Primary: lowest health score first
        const scoreA = a.health_score ?? 50
        const scoreB = b.health_score ?? 50
        if (scoreA !== scoreB) return scoreA - scoreB

        // Secondary: most overdue first
        const daysA = a.target_end ? Math.round((new Date(a.target_end).getTime() - Date.now()) / 86400000) : 0
        const daysB = b.target_end ? Math.round((new Date(b.target_end).getTime() - Date.now()) / 86400000) : 0
        if (daysA !== daysB) return daysA - daysB

        // Tertiary: most signal triggers
        return (b.pulse_signals?.length ?? 0) - (a.pulse_signals?.length ?? 0)
      })
      .slice(0, 5)
  }, [projects])

  if (top5.length === 0) return null

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-md bg-red-50 border border-red-200 flex items-center justify-center">
          <Target size={11} weight="fill" className="text-red-500" />
        </div>
        <span className="text-[12px] font-bold text-gray-800">Priority Focus</span>
        <span className="text-[10px] text-gray-400">Top 5 projects requiring immediate attention</span>
      </div>

      <div className="rounded-xl border border-red-200 bg-white shadow-sm ring-1 ring-red-50">
        {/* Column header for Priority Focus — matches Critical/At Risk table columns */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-red-200 bg-red-50/40 rounded-t-xl">
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Project</span>
          </div>
          <div className="hidden md:flex w-24 flex-shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Owner</span>
          </div>
          <div className="hidden sm:flex w-20 flex-shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Status</span>
          </div>
          <span className="hidden lg:block flex-shrink-0 text-[11px] font-bold uppercase tracking-wider text-gray-500 w-28">Domain</span>
          <div className="hidden xl:block w-20 flex-shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Timeline</span>
          </div>
          <div className="hidden xl:flex w-16 flex-shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Updated</span>
          </div>
          <div className="w-28 flex-shrink-0 flex justify-end">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Health</span>
          </div>
          <div className="w-3 flex-shrink-0" />
        </div>

        <div className="divide-y divide-gray-50">
          {top5.map((p, _i) => {
            const pc = pulseConditionCfg(p.pulse_condition)

            return (
              <button
                key={p.id}
                onClick={() => onNavigate(p.id)}
                className={`
                  w-full flex items-center gap-3 px-4 py-2.5
                  hover:bg-red-50/50 transition-colors group text-left
                  border-l-[3px] ${pc.leftBorder}
                `}
              >
                {/* Project info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {p.code && <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">{p.code}</span>}
                    <span className="text-[13px] font-semibold text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                      {p.name}
                    </span>
                    <MomentumChip momentum={p.pulse_momentum} project={p} />
                  </div>
                </div>

                {/* Owner */}
                {(() => {
                  const oName = (p as ProjectWithOwner).owner?.display_name || (p as ProjectWithOwner).owner?.full_name || null
                  return (
                    <div className="hidden md:flex items-center gap-1.5 w-24 flex-shrink-0">
                      {oName ? (
                        <>
                          <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white ${avatarColor(oName)}`}>
                            {ownerInitials((p as ProjectWithOwner).owner)}
                          </div>
                          <span className="text-[10px] text-gray-500 truncate">{oName}</span>
                        </>
                      ) : (
                        <span className="text-[10px] text-gray-300">Unassigned</span>
                      )}
                    </div>
                  )
                })()}

                {/* Status — matches ProjectTableRow */}
                <div className="hidden sm:flex items-center gap-1.5 w-20 flex-shrink-0">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${(STATUS_CFG[p.status] ?? STATUS_CFG['active']).dot}`} />
                  <span className="text-[10px] text-gray-500">{(STATUS_CFG[p.status] ?? STATUS_CFG['active']).label}</span>
                </div>

                {/* Domain — aligned with table below */}
                <span className="hidden lg:block flex-shrink-0 text-[10px] text-gray-400 w-28 truncate">
                  {domainLabel(p.vertical)}
                </span>

                {/* Timeline mini-bar — matches ProjectTableRow */}
                {(() => {
                  const startDate = p.start_date ? new Date(p.start_date).getTime() : null
                  const endDate   = p.target_end ? new Date(p.target_end).getTime() : null
                  const pct = (startDate && endDate && endDate > startDate)
                    ? Math.min(100, Math.max(0, ((Date.now() - startDate) / (endDate - startDate)) * 100))
                    : null
                  return pct !== null ? (
                    <div className="hidden xl:block w-20 flex-shrink-0">
                      <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            (p.health_score ?? 50) < 40 ? 'bg-red-400' :
                            (p.health_score ?? 50) < 70 ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  ) : <div className="hidden xl:block w-20 flex-shrink-0" />
                })()}

                {/* Updated */}
                <div className="hidden xl:flex w-16 flex-shrink-0">
                  <span className="text-[10px] text-gray-400">{relativeTime(p.updated_at)}</span>
                </div>

                {/* Health badge with hover tooltip */}
                <div className="w-28 flex-shrink-0 flex justify-end">
                  <StatusPill project={p} />
                </div>

                <ArrowRight size={12} className="flex-shrink-0 text-gray-200 group-hover:text-blue-400 transition-colors" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── PROJECT TABLE ROW ───────────────────────────────────────────────────────
// Dense line-item view for Critical / At Risk sections.
// 3x density vs cards — see 20 projects without scrolling.

function ProjectTableRow({ project, onNavigate, zebra = false }: { project: ProjectWithOwner; onNavigate: (id: string) => void; zebra?: boolean }) {
  const pc     = pulseConditionCfg(project.pulse_condition)
  const status = STATUS_CFG[project.status] ?? STATUS_CFG['active']

  const startDate = project.start_date ? new Date(project.start_date).getTime() : null
  const endDate   = project.target_end ? new Date(project.target_end).getTime() : null
  const progressPct = (startDate && endDate && endDate > startDate)
    ? Math.min(100, Math.max(0, ((Date.now() - startDate) / (endDate - startDate)) * 100))
    : null

  const ownerName = project.owner?.display_name || project.owner?.full_name || null

  return (
    <button
      onClick={() => onNavigate(project.id)}
      className={`
        cv-row scroll-reveal-up
        w-full flex items-center gap-3 px-4 py-2.5
        hover:bg-blue-50/50 transition-colors group text-left
        border-l-2 ${pc.leftBorder}
        ${zebra ? 'bg-gray-50/60' : ''}
      `}
    >
      {/* Project name + momentum */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {project.code && <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">{project.code}</span>}
          <span className="text-[13px] font-medium text-gray-900 group-hover:text-blue-700 transition-colors truncate">
            {project.name}
          </span>
          <MomentumChip momentum={project.pulse_momentum} project={project} />
        </div>
      </div>

      {/* Owner */}
      <div className="hidden md:flex items-center gap-1.5 w-24 flex-shrink-0">
        {ownerName ? (
          <>
            <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white ${avatarColor(ownerName)}`}>
              {ownerInitials(project.owner)}
            </div>
            <span className="text-[10px] text-gray-500 truncate">{ownerName}</span>
          </>
        ) : (
          <span className="text-[10px] text-gray-300">Unassigned</span>
        )}
      </div>

      {/* Status */}
      <div className="hidden sm:flex items-center gap-1.5 w-20 flex-shrink-0">
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.dot}`} />
        <span className="text-[10px] text-gray-500">{status.label}</span>
      </div>

      {/* Domain */}
      <span className="hidden lg:block flex-shrink-0 text-[10px] text-gray-400 w-28 truncate">
        {domainLabel(project.vertical)}
      </span>

      {/* Timeline mini-bar */}
      {progressPct !== null ? (
        <div className="hidden xl:block w-20 flex-shrink-0">
          <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                (project.health_score ?? 50) < 40 ? 'bg-red-400' :
                (project.health_score ?? 50) < 70 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="hidden xl:block w-20 flex-shrink-0" />
      )}

      {/* Updated */}
      <div className="hidden xl:flex w-16 flex-shrink-0">
        <span className="text-[10px] text-gray-400">{relativeTime(project.updated_at)}</span>
      </div>

      {/* Status pill with hover tooltip */}
      <div className="w-28 flex-shrink-0 flex justify-end">
        <StatusPill project={project} />
      </div>

      <ArrowRight size={12} className="flex-shrink-0 text-gray-200 group-hover:text-blue-400 transition-colors" />
    </button>
  )
}

// ─── COMPACT CARD (for On Track section only) ────────────────────────────────

function CompactCard({ project, onNavigate }: { project: ProjectWithOwner; onNavigate: (id: string) => void }) {
  const pc     = pulseConditionCfg(project.pulse_condition)
  const status = STATUS_CFG[project.status] ?? STATUS_CFG['active']

  return (
    <motion.button
      onClick={() => onNavigate(project.id)}
      whileHover={{ y: -1, boxShadow: '0 4px 16px rgba(0,0,0,0.07)' }}
      transition={{ duration: 0.12 }}
      className={`
        cv-card-sm scroll-reveal-up
        w-full text-left rounded-xl border-l-2 border border-gray-100 bg-white shadow-sm
        hover:border-gray-200 transition-colors cursor-pointer group
        ${pc.leftBorder} px-3 py-2.5
      `}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          {project.code && (
            <span className="text-[9px] font-mono text-gray-400">{project.code}</span>
          )}
          <p className="text-[12px] font-semibold text-gray-900 group-hover:text-blue-700 transition-colors leading-tight truncate">
            {project.name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.dot}`} />
            <span className="text-[10px] text-gray-500">{status.label}</span>
            {project.owner && (
              <>
                <span className="text-gray-200">·</span>
                <span className="text-[10px] text-gray-400 truncate">{project.owner.display_name || project.owner.full_name}</span>
              </>
            )}
          </div>
        </div>
        <HealthBadge score={project.health_score ?? null} compact />
      </div>
    </motion.button>
  )
}

// ─── TABLE COLUMN HEADER ─────────────────────────────────────────────────────

function TableColumnHeader() {
  const hdr = 'text-[11px] font-bold uppercase tracking-wider text-gray-500'
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 bg-gray-50 rounded-t-xl">
      <div className="flex-1 min-w-0">
        <span className={hdr}>Project</span>
      </div>
      <div className="hidden md:flex w-24 flex-shrink-0">
        <span className={hdr}>Owner</span>
      </div>
      <div className="hidden sm:flex w-20 flex-shrink-0">
        <span className={hdr}>Status</span>
      </div>
      <span className={`hidden lg:block flex-shrink-0 ${hdr} w-28`}>Domain</span>
      <div className="hidden xl:block w-20 flex-shrink-0">
        <span className={hdr}>Timeline</span>
      </div>
      <div className="hidden xl:flex w-16 flex-shrink-0">
        <span className={hdr}>Updated</span>
      </div>
      <div className="w-28 flex-shrink-0 flex justify-end">
        <span className={hdr}>Health</span>
      </div>
      <div className="w-3 flex-shrink-0" /> {/* Arrow spacer */}
    </div>
  )
}

// ─── ACTIVE PROJECTS GRID ────────────────────────────────────────────────────
// Critical & At Risk: dense table rows. On Track: compact cards.

function ActiveProjectsView({ projects, onNavigate, statusFilter }: {
  projects: ProjectWithOwner[]; onNavigate: (id: string) => void; statusFilter: FilterStatus
}) {
  const active = useMemo(() =>
    [...projects].filter(p => !PARKED_STATUSES.has(p.status)),
    [projects]
  )

  const sortFn = (a: Project, b: Project) => {
    const rA = CONDITION_RANK[a.pulse_condition ?? ''] ?? 5
    const rB = CONDITION_RANK[b.pulse_condition ?? ''] ?? 5
    if (rA !== rB) return rA - rB
    return (a.health_score ?? 50) - (b.health_score ?? 50)
  }

  // Section groupings use health_score thresholds — same as KPI tiles and sidebar.
  // This ensures the count on the filter pill matches the rows you see in each section.
  const critical = active.filter(p => (p.health_score ?? 50) < 40).sort(sortFn)
  const watch    = active.filter(p => { const h = p.health_score ?? 50; return h >= 40 && h < 70 }).sort(sortFn)
  const healthy  = active.filter(p => (p.health_score ?? 50) >= 70).sort(sortFn)

  const showCritical = statusFilter === 'all' || statusFilter === 'critical'
  const showWatch    = statusFilter === 'all' || statusFilter === 'at_risk'
  const showHealthy  = statusFilter === 'all' || statusFilter === 'on_track'

  const SECTION_DESCRIPTIONS: Record<string, string> = {
    'Critical':  'Projects requiring immediate executive intervention',
    'At Risk':   'Projects showing warning signals — monitor closely',
    'On Track':  'Projects progressing within acceptable parameters',
  }

  const SectionHeader = ({ color, icon, label, count }: { color: string; icon: React.ReactNode; label: string; count: number }) => (
    <div className="scroll-reveal-up flex items-center gap-2 mb-3">
      <div className="flex items-center gap-2">
        <span className={`text-[12px] font-bold ${color} flex items-center gap-1.5`}>
          {icon} {label}
        </span>
        <span className="text-[10px] text-gray-300 bg-gray-50 rounded-full px-2 py-0.5 border border-gray-100 tabular-nums">
          {count}
        </span>
      </div>
      <span className="text-[10px] text-gray-400 hidden sm:inline">
        {SECTION_DESCRIPTIONS[label] ?? ''}
      </span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Critical — dense table rows with column headers */}
      {showCritical && critical.length > 0 && (
        <section>
          <SectionHeader color="text-red-500" icon={<ShieldWarning size={12} weight="fill" />} label="Critical" count={critical.length} />
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
            <TableColumnHeader />
            <div className="divide-y divide-gray-50">
              {critical.map((p, i) => <ProjectTableRow key={p.id} project={p} onNavigate={onNavigate} zebra={i % 2 === 1} />)}
            </div>
          </div>
        </section>
      )}

      {/* At Risk — dense table rows with column headers */}
      {showWatch && watch.length > 0 && (
        <section>
          <SectionHeader color="text-amber-600" icon={<Warning size={12} weight="fill" />} label="At Risk" count={watch.length} />
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
            <TableColumnHeader />
            <div className="divide-y divide-gray-50">
              {watch.map((p, i) => <ProjectTableRow key={p.id} project={p} onNavigate={onNavigate} zebra={i % 2 === 1} />)}
            </div>
          </div>
        </section>
      )}

      {/* On Track — compact cards (these don't need attention, less density is fine) */}
      {showHealthy && healthy.length > 0 && (
        <section>
          <SectionHeader color="text-emerald-600" icon={<CheckCircle size={12} weight="fill" />} label="On Track" count={healthy.length} />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
            {healthy.map(p => <CompactCard key={p.id} project={p} onNavigate={onNavigate} />)}
          </div>
        </section>
      )}

      {active.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-2">
            <Briefcase size={32} className="text-gray-200 mx-auto" />
            <p className="text-sm text-gray-400">No active projects match this filter</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PARKED PROJECTS (On Hold / Planning / Completed) ────────────────────────

function ParkedProjects({ projects, onNavigate }: { projects: ProjectWithOwner[]; onNavigate: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  const parked = useMemo(() =>
    projects.filter(p => PARKED_STATUSES.has(p.status)).sort((a, b) => a.name.localeCompare(b.name)),
    [projects]
  )

  if (parked.length === 0) return null

  /* Group parked projects by status — reserved for status sub-sections in Sprint 1B
  const byStatus = useMemo(() => {
    const map: Record<string, ProjectWithOwner[]> = {}
    for (const p of parked) (map[p.status] ??= []).push(p)
    return map
  }, [parked])
  */

  return (
    <section className="mt-8">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-3 cursor-pointer group"
      >
        {expanded
          ? <CaretDown size={12} className="text-gray-400" />
          : <CaretRight size={12} className="text-gray-400" />
        }
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">
          Parked Projects
        </span>
        <span className="text-[10px] text-gray-300 bg-gray-50 rounded-full px-2 py-0.5 border border-gray-100">
          {parked.length}
        </span>
        <div className="flex-1 h-px bg-gray-100" />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm divide-y divide-gray-50">
              {parked.map(p => {
                const status = STATUS_CFG[p.status] ?? STATUS_CFG['on_hold']
                return (
                  <button
                    key={p.id}
                    onClick={() => onNavigate(p.id)}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors group text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {p.code && <span className="text-[10px] font-mono text-gray-300">{p.code}</span>}
                        <span className="text-[12px] font-medium text-gray-600 group-hover:text-blue-600 transition-colors truncate">
                          {p.name}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 w-20 flex-shrink-0">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.dot}`} />
                      <span className="text-[10px] text-gray-400">{status.label}</span>
                    </div>
                    {p.vertical && <span className="text-[10px] text-gray-300 w-28 truncate hidden lg:block">{domainLabel(p.vertical)}</span>}
                    <ArrowRight size={12} className="flex-shrink-0 text-gray-200 group-hover:text-blue-400 transition-colors" />
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

// ─── COMMAND CENTER TAB ───────────────────────────────────────────────────────

function CommandCenterTab({ projects, onNavigate }: { projects: ProjectWithOwner[]; onNavigate: (id: string) => void }) {
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [selectedVerticals, setSelectedVerticals] = useState<Set<string>>(new Set())

  const toggleVertical = useCallback((v: string) => {
    setSelectedVerticals(prev => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      return next
    })
  }, [])

  const active = useMemo(() =>
    projects.filter(p => !PARKED_STATUSES.has(p.status)),
    [projects]
  )

  const verticals = useMemo(() =>
    [...new Set(active.map(p => p.vertical).filter(Boolean))].sort() as string[],
    [active]
  )

  // Apply domain filter
  const filtered = useMemo(() => {
    if (selectedVerticals.size === 0) return projects
    return projects.filter(p => selectedVerticals.has(p.vertical ?? ''))
  }, [projects, selectedVerticals])

  const filteredActive = useMemo(() =>
    filtered.filter(p => !PARKED_STATUSES.has(p.status)),
    [filtered]
  )

  // Filter pill counts use health_score thresholds — same as KPI tiles and sidebar.
  const counts = useMemo(() => ({
    all:      filteredActive.length,
    critical: filteredActive.filter(p => (p.health_score ?? 50) < 40).length,
    at_risk:  filteredActive.filter(p => { const h = p.health_score ?? 50; return h >= 40 && h < 70 }).length,
    on_track: filteredActive.filter(p => (p.health_score ?? 50) >= 70).length,
  }), [filteredActive])

  // Compute KPI counts from health_score thresholds (not pulse_condition) so the
  // summary tiles match the sidebar Portfolio Health widget. pulse_condition drives
  // section groupings; health_score drives the executive-level RAG summary.
  const activeCounts = useMemo(() => {
    const scores = filteredActive.map(p => p.health_score ?? 50)
    const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    return {
      onTrack:  filteredActive.filter(p => (p.health_score ?? 50) >= 70).length,
      atRisk:   filteredActive.filter(p => { const h = p.health_score ?? 50; return h >= 40 && h < 70 }).length,
      critical: filteredActive.filter(p => (p.health_score ?? 50) < 40).length,
      avgHealth: avg,
    }
  }, [filteredActive])

  return (
    <div>
      <KPIStrip activeCount={filteredActive.length} activeCounts={activeCounts} />

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <FilterBar active={filter} onFilter={setFilter} counts={counts} />
        <div className="sm:ml-auto">
          <DomainPills verticals={verticals} selected={selectedVerticals} onToggle={toggleVertical} />
        </div>
      </div>

      {/* Priority Focus — top 5 worst */}
      {filter === 'all' && <PriorityFocus projects={filtered} onNavigate={onNavigate} />}

      {/* Active projects by status zone */}
      <ActiveProjectsView projects={filtered} onNavigate={onNavigate} statusFilter={filter} />

      {/* Parked projects — collapsible */}
      {filter === 'all' && <ParkedProjects projects={filtered} onNavigate={onNavigate} />}
    </div>
  )
}

// ─── LIST TAB ─────────────────────────────────────────────────────────────────

type SortField = 'name' | 'health_score' | 'status' | 'pulse_condition'
type SortDir   = 'asc' | 'desc'

function ListTab({ projects, onNavigate }: { projects: ProjectWithOwner[]; onNavigate: (id: string) => void }) {
  const [sortField, setSortField] = useState<SortField>('health_score')
  const [sortDir, setSortDir]     = useState<SortDir>('asc')
  const [search, setSearch]       = useState('')

  const sorted = useMemo(() => {
    const filtered = projects.filter(p =>
      !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.code ?? '').toLowerCase().includes(search.toLowerCase())
    )
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortField === 'name')            cmp = a.name.localeCompare(b.name)
      if (sortField === 'health_score')    cmp = (a.health_score ?? 50) - (b.health_score ?? 50)
      if (sortField === 'status')          cmp = a.status.localeCompare(b.status)
      if (sortField === 'pulse_condition') cmp = (CONDITION_RANK[a.pulse_condition ?? ''] ?? 5) - (CONDITION_RANK[b.pulse_condition ?? ''] ?? 5)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [projects, sortField, sortDir, search])

  const toggle = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const SortBtn = ({ field, label }: { field: SortField; label: string }) => (
    <button onClick={() => toggle(field)}
      className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
      {label}
      {sortField === field
        ? sortDir === 'asc' ? <ArrowUp size={10} className="text-blue-500" /> : <ArrowDown size={10} className="text-blue-500" />
        : <ArrowsDownUp size={10} className="text-gray-300" />}
    </button>
  )

  return (
    <div>
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search projects..."
        className="mb-4 w-full sm:w-72 bg-white border border-gray-200 rounded-lg
                   px-3 py-2 text-sm text-gray-700 placeholder:text-gray-300
                   focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
      />
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 bg-gray-50/50">
          <div className="flex-1"><SortBtn field="name" label="Project" /></div>
          <div className="w-24 hidden sm:block"><SortBtn field="pulse_condition" label="Condition" /></div>
          <div className="w-24"><SortBtn field="health_score" label="Health" /></div>
          <div className="w-28 hidden md:block text-[10px] font-semibold uppercase tracking-widest text-gray-400">Signals</div>
        </div>
        <div className="divide-y divide-gray-50">
          {sorted.map(p => {
            const pc     = pulseConditionCfg(p.pulse_condition)
            const status = STATUS_CFG[p.status] ?? STATUS_CFG['active']
            return (
              <button key={p.id} onClick={() => onNavigate(p.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group text-left border-l-2 ${pc.leftBorder}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {p.code && <span className="text-[10px] font-mono text-gray-400">{p.code}</span>}
                    <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                    <span className="text-[10px] text-gray-500">{status.label}</span>
                    {p.vertical && <span className="text-[10px] text-gray-400">{domainLabel(p.vertical)}</span>}
                  </div>
                </div>
                <div className="hidden sm:block w-24 flex-shrink-0">
                  <span className={`text-[10px] font-semibold ${pc.textColor}`}>{pc.label}</span>
                </div>
                <div className="w-24 flex-shrink-0"><HealthBadge score={p.health_score ?? null} compact /></div>
                <div className="w-28 hidden md:block flex-shrink-0"><SignalText signals={p.pulse_signals} max={2} /></div>
                <ArrowRight size={12} className="flex-shrink-0 text-gray-200 group-hover:text-blue-400 transition-colors" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── ROADMAP TAB ──────────────────────────────────────────────────────────────

function RoadmapTab({ projects }: { projects: ProjectWithOwner[] }) {
  const VERTICAL_COLORS: Record<string, string> = {
    'Transportation': '#3b82f6', 'Warehouse': '#8b5cf6', 'W&D': '#8b5cf6',
    'Infrastructure': '#f59e0b', 'Security': '#ef4444', 'Data & Analytics': '#06b6d4', 'ERP': '#10b981',
  }

  const now   = Date.now()
  const valid = projects
    .filter(p => p.start_date && p.target_end && p.status !== 'cancelled')
    .sort((a, b) => new Date(a.start_date!).getTime() - new Date(b.start_date!).getTime())

  if (valid.length === 0) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <MapTrifold size={32} className="text-gray-200 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No projects with date ranges</p>
      </div>
    </div>
  )

  const earliest = Math.min(...valid.map(p => new Date(p.start_date!).getTime()))
  const latest   = Math.max(...valid.map(p => new Date(p.target_end!).getTime()))
  const totalMs  = latest - earliest || 1
  const toX = (d: Date | string) => ((new Date(d).getTime() - earliest) / totalMs) * 100
  const nowX = ((now - earliest) / totalMs) * 100

  const byVertical = useMemo(() => {
    const map: Record<string, typeof valid> = {}
    for (const p of valid) (map[p.vertical ?? 'Other'] ??= []).push(p)
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [valid])

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-5 overflow-x-auto">
      <div className="min-w-[600px]">
        <div className="ml-44 mb-3 relative h-5">
          {[0, 25, 50, 75, 100].map(pct => (
            <span key={pct} className="absolute text-[10px] text-gray-300 -translate-x-1/2" style={{ left: `${pct}%` }}>
              {new Date(earliest + (pct / 100) * totalMs).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
            </span>
          ))}
        </div>
        <div className="relative space-y-1">
          {nowX >= 0 && nowX <= 100 && (
            <div className="absolute top-0 bottom-0 pointer-events-none z-10"
              style={{ left: `calc(176px + ${nowX}% * ((100% - 176px) / 100))` }}>
              <div className="h-full w-px bg-blue-400/60" />
              <div className="absolute -top-1 -translate-x-1/2 bg-blue-500 text-white text-[8px] px-1.5 py-0.5 rounded font-semibold">Today</div>
            </div>
          )}
          {byVertical.map(([vertical, vProjects]) => (
            <div key={vertical}>
              <div className="flex items-center gap-2 py-2">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: VERTICAL_COLORS[vertical] ?? '#9ca3af' }} />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{domainLabel(vertical)}</span>
              </div>
              {vProjects.map(p => {
                const sx = toX(p.start_date!), ex = toX(p.target_end!)
                const late = p.target_end && new Date(p.target_end) < new Date() && p.status !== 'completed'
                return (
                  <div key={p.id} className="scroll-reveal-up flex items-center mb-1 min-h-[28px]">
                    <div className="w-44 flex-shrink-0 pr-3">
                      <div className="flex items-center gap-1">
                        {p.code && <span className="text-[9px] font-mono text-gray-300">{p.code}</span>}
                        <span className="text-[11px] text-gray-600 truncate">{p.name}</span>
                      </div>
                    </div>
                    <div className="flex-1 relative h-6 rounded overflow-hidden bg-gray-50">
                      <div className="absolute top-1.5 bottom-1.5 rounded-sm"
                        style={{ left: `${sx}%`, width: `${Math.max(ex - sx, 0.5)}%`,
                          background: late ? '#fca5a5' : (VERTICAL_COLORS[vertical] ?? '#9ca3af'), opacity: 0.6 }} />
                      <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45"
                        style={{ left: `calc(${ex}% - 5px)`,
                          background: late ? '#ef4444' : (VERTICAL_COLORS[vertical] ?? '#9ca3af'), opacity: 0.8 }}
                        title={`Target: ${new Date(p.target_end!).toLocaleDateString()}`} />
                    </div>
                    <div className="w-20 flex-shrink-0 flex justify-end ml-2">
                      <HealthBadge score={p.health_score ?? null} compact />
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── PORTFOLIO ────────────────────────────────────────────────────────────────

export default function Portfolio() {
  const navigate  = useNavigate()
  const [tab, setTab] = useState<TabId>('command')
  const { data: stats } = usePortfolioStats()

  const { data: rawProjects = [], isLoading } = useProjects({ pageSize: 500 })
  const projects = rawProjects as ProjectWithOwner[]

  const onNavigate = (id: string) => navigate(`/project/${id}`)

  // Ambient aura
  const aura = !stats ? '' :
    stats.avgHealthScore >= 65 ? '' :
    stats.avgHealthScore >= 40 ? 'aura-warning' :
    'aura-critical'

  const TABS = [
    { id: 'command'  as TabId, label: 'Command Center', icon: <Lightning size={12} weight="fill" />  },
    { id: 'list'     as TabId, label: 'Projects',       icon: <Rows size={12} />      },
    { id: 'roadmap'  as TabId, label: 'Roadmap',        icon: <MapTrifold size={12} /> },
  ]

  return (
    <div className={`min-h-screen bg-[#f4f6f9] ${aura}`}>
      <div className="max-w-[1400px] mx-auto px-6 py-6">

        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">Portfolio Intelligence</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Global IT · {projects.length} projects tracked
            </p>
          </div>
          {/* Company logo placeholder */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center">
              <span className="text-[8px] font-bold text-gray-500">CO</span>
            </div>
            <span className="text-[11px] font-medium text-gray-500">Company Logo</span>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`
                flex items-center gap-2 px-5 py-3 text-[14px] font-semibold
                border-b-2 -mb-px transition-all cursor-pointer
                ${tab === t.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
                }
              `}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-white border border-gray-100 shadow-sm animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {tab === 'command'  && <CommandCenterTab projects={projects} onNavigate={onNavigate} />}
            {tab === 'list'     && <ListTab projects={projects} onNavigate={onNavigate} />}
            {tab === 'roadmap'  && <RoadmapTab projects={projects} />}
          </>
        )}

      </div>
    </div>
  )
}
