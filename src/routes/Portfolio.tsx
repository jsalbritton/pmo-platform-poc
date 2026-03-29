/**
 * Portfolio — /portfolio
 *
 * 4-Tab Director Intelligence Platform (light mode)
 *
 *   Tab 1  Dashboard  — KPI hero + status donut + health distribution + attention table
 *   Tab 2  List       — sortable/filterable table, risk labels, budget indicator
 *   Tab 3  Cards      — project card grid with health ring + budget bar
 *   Tab 4  Roadmap    — CSS/SVG Gantt grouped by vertical, today line, go-live diamonds
 *
 * Design principle: color is semantic, not decorative.
 *   Green (≥70) = on track, Amber (40-69) = at risk, Red (<40) = critical
 *   These thresholds match usePortfolioStats — one truth across all views.
 *
 * 21 CFR Part 11: no writes from this route — read-only portfolio view.
 */

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import {
  ArrowUp,
  ArrowDown,
  ArrowsDownUp,
  MagnifyingGlass,
  ArrowClockwise,
  Briefcase,
  Rows,
  SquaresFour,
  ChartBar,
  MapTrifold,
  Warning,
  CheckCircle,
  XCircle,
  ArrowRight,
  CalendarBlank,
  ShieldWarning,
} from '@phosphor-icons/react'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjects, usePortfolioStats } from '@/hooks/useProjects'
import type { Project, ProjectStatus, PulseCondition, PulseMomentum } from '@/types'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type TabId = 'dashboard' | 'list' | 'cards' | 'roadmap'

// ─── HEALTH UTILITIES (light mode) ────────────────────────────────────────────

function healthColor(score: number | null) {
  if (score === null) return {
    border: 'border-slate-200', text: 'text-slate-400',
    bg: 'bg-slate-50', fill: '#94a3b8', bar: 'bg-slate-300',
    chip: 'bg-slate-100 text-slate-500 border-slate-200',
  }
  if (score >= 70) return {
    border: 'border-emerald-400', text: 'text-emerald-600',
    bg: 'bg-emerald-50', fill: '#10b981', bar: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  if (score >= 40) return {
    border: 'border-amber-400', text: 'text-amber-600',
    bg: 'bg-amber-50', fill: '#f59e0b', bar: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  return {
    border: 'border-red-400', text: 'text-red-600',
    bg: 'bg-red-50', fill: '#ef4444', bar: 'bg-red-500',
    chip: 'bg-red-50 text-red-700 border-red-200',
  }
}

function healthLabel(score: number | null) {
  if (score === null) return '—'
  if (score >= 70) return 'Healthy'
  if (score >= 50) return 'Watch'
  if (score >= 30) return 'Elevated'
  return 'Critical'
}

// ─── PULSE MODEL ──────────────────────────────────────────────────────────────
// Replaces raw number chips with condition language across all personas.
// Executives read condition (do I need to act?). PMs read signals (what's wrong?).
// Directors read momentum (which way is it going?). SAs read signals for tech depth.

function pulseConditionConfig(condition: PulseCondition | string | null | undefined) {
  switch (condition) {
    case 'healthy':  return { label: 'Healthy',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', border: 'border-emerald-400', fill: '#10b981' }
    case 'watch':    return { label: 'Watch',    cls: 'bg-amber-50 text-amber-700 border-amber-200',       dot: 'bg-amber-500',   border: 'border-amber-400',   fill: '#f59e0b' }
    case 'elevated': return { label: 'Elevated', cls: 'bg-orange-50 text-orange-700 border-orange-200',   dot: 'bg-orange-500',  border: 'border-orange-400',  fill: '#f97316' }
    case 'critical': return { label: 'Critical', cls: 'bg-red-50 text-red-700 border-red-200',             dot: 'bg-red-500',     border: 'border-red-400',     fill: '#ef4444' }
    case 'dormant':  return { label: 'Dormant',  cls: 'bg-slate-100 text-slate-500 border-slate-200',     dot: 'bg-slate-400',   border: 'border-slate-300',   fill: '#94a3b8' }
    default:         return { label: '—',         cls: 'bg-slate-100 text-slate-400 border-slate-200',     dot: 'bg-slate-300',   border: 'border-slate-200',   fill: '#cbd5e1' }
  }
}

const MOMENTUM_CONFIG: Record<string, { arrow: string; color: string; title: string }> = {
  recovering: { arrow: '↗', color: 'text-emerald-600', title: 'Recovering — health improving' },
  declining:  { arrow: '↘', color: 'text-red-500',     title: 'Declining — health worsening' },
  volatile:   { arrow: '⚡', color: 'text-amber-600',  title: 'Volatile — large score swings' },
  stable:     { arrow: '→', color: 'text-slate-400',   title: 'Stable — no significant change' },
}

const SIGNAL_CONFIG: Record<string, string> = {
  budget:    'bg-rose-50 text-rose-700 border border-rose-200',
  schedule:  'bg-amber-50 text-amber-700 border border-amber-200',
  delivery:  'bg-orange-50 text-orange-700 border border-orange-200',
  scope:     'bg-purple-50 text-purple-700 border border-purple-200',
  risks:     'bg-red-50 text-red-700 border border-red-200',
  execution: 'bg-blue-50 text-blue-700 border border-blue-200',
}

const SIGNAL_LABELS: Record<string, string> = {
  budget: 'Budget', schedule: 'Schedule', delivery: 'Delivery',
  scope: 'Scope', risks: 'Risks', execution: 'Execution',
}

// Pulse condition badge + momentum arrow in one inline unit
function PulseBadge({ condition, momentum, showMomentum = true }: {
  condition: PulseCondition | string | null | undefined
  momentum?: PulseMomentum | string | null
  showMomentum?: boolean
}) {
  const cfg = pulseConditionConfig(condition)
  const mom = momentum ? MOMENTUM_CONFIG[momentum] : null
  return (
    <div className="flex items-center gap-1">
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${cfg.cls}`}>
        {cfg.label}
      </span>
      {showMomentum && mom && (
        <span className={`text-[12px] font-bold leading-none ${mom.color}`} title={mom.title}>
          {mom.arrow}
        </span>
      )}
    </div>
  )
}

// Signal dimension chips — the "why" behind the condition
function SignalChips({ signals, max = 3 }: { signals: string[] | null | undefined; max?: number }) {
  if (!signals || signals.length === 0) return null
  const shown = signals.slice(0, max)
  const extra = signals.length - max
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {shown.map(s => (
        <span key={s} className={`px-1.5 py-0 rounded text-[9px] font-semibold leading-5 ${SIGNAL_CONFIG[s] ?? 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
          {SIGNAL_LABELS[s] ?? s}
        </span>
      ))}
      {extra > 0 && <span className="text-[9px] text-slate-400">+{extra}</span>}
    </div>
  )
}

// ─── STATUS CONFIG (light mode) ───────────────────────────────────────────────

const STATUS_STYLES: Record<ProjectStatus, { label: string; dot: string; text: string; badge: string }> = {
  'planning':  { label: 'Planning',  dot: 'bg-violet-500',  text: 'text-violet-600',  badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  'active':    { label: 'Active',    dot: 'bg-emerald-500', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'on_track':  { label: 'On Track',  dot: 'bg-emerald-500', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'at_risk':   { label: 'At Risk',   dot: 'bg-amber-500',   text: 'text-amber-600',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  'critical':  { label: 'Critical',  dot: 'bg-red-500',     text: 'text-red-600',     badge: 'bg-red-50 text-red-700 border-red-200' },
  'completed': { label: 'Completed', dot: 'bg-blue-500',    text: 'text-blue-600',    badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  'on_hold':   { label: 'On Hold',   dot: 'bg-slate-400',   text: 'text-slate-500',   badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  'cancelled': { label: 'Cancelled', dot: 'bg-slate-300',   text: 'text-slate-400',   badge: 'bg-slate-50 text-slate-500 border-slate-200' },
}

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'text-red-600',
  high:     'text-amber-600',
  medium:   'text-blue-600',
  low:      'text-slate-400',
}

// ─── ANIMATED COUNT ────────────────────────────────────────────────────────────

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

  if (isLoading) return <span className="inline-block w-10 h-7 bg-slate-100 rounded animate-pulse" />
  return <>{current}</>
}

// ─── STATS HERO (light mode) ──────────────────────────────────────────────────

function StatsHero() {
  const { data: stats, isLoading } = usePortfolioStats()

  const cards = [
    {
      label: 'Total Projects',
      value: stats?.total ?? 0,
      icon:  <Briefcase size={18} weight="fill" className="text-slate-400" />,
      accent: 'border-t-slate-300',
      numColor: 'text-slate-900',
      sub: null,
    },
    {
      label: 'Healthy',
      value: stats?.onTrack ?? 0,
      icon:  <CheckCircle size={18} weight="fill" className="text-emerald-500" />,
      accent: 'border-t-emerald-400',
      numColor: 'text-emerald-700',
      sub: stats ? `${Math.round((stats.onTrack / Math.max(stats.total, 1)) * 100)}% of portfolio` : null,
    },
    {
      label: 'Watch',
      value: stats?.atRisk ?? 0,
      icon:  <Warning size={18} weight="fill" className="text-amber-500" />,
      accent: 'border-t-amber-400',
      numColor: 'text-amber-700',
      sub: stats ? `${Math.round((stats.atRisk / Math.max(stats.total, 1)) * 100)}% of portfolio` : null,
    },
    {
      label: 'Needs Action',
      value: stats?.critical ?? 0,
      icon:  <XCircle size={18} weight="fill" className="text-red-500" />,
      accent: 'border-t-red-400',
      numColor: 'text-red-700',
      sub: stats ? `${Math.round((stats.critical / Math.max(stats.total, 1)) * 100)}% of portfolio` : null,
    },
    {
      label: 'Avg Health',
      value: stats?.avgHealthScore ?? 0,
      icon:  null,
      accent: stats ? `border-t-${stats.avgHealthScore >= 70 ? 'emerald' : stats.avgHealthScore >= 50 ? 'amber' : 'red'}-400` : 'border-t-slate-300',
      numColor: stats ? healthColor(stats.avgHealthScore).text : 'text-slate-900',
      sub: stats ? healthLabel(stats.avgHealthScore) : null,
      isScore: true,
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`bg-white rounded-xl border border-slate-200 border-t-2 ${card.accent} px-5 py-4 shadow-sm`}
        >
          <div className="flex items-center gap-2 mb-3">
            {card.icon}
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {card.label}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold tabular-nums tracking-tight ${card.numColor}`}>
              <AnimatedCount value={card.value} isLoading={isLoading} />
            </span>
          </div>
          {card.sub && !isLoading && (
            <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── SVG DONUT CHART ──────────────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polarToCartesian(cx, cy, r, start)
  const e = polarToCartesian(cx, cy, r, end)
  const large = end - start > 180 ? 1 : 0
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
}

function StatusDonut({ projects }: { projects: Project[] }) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of projects) {
      map[p.status] = (map[p.status] ?? 0) + 1
    }
    return map
  }, [projects])

  const segments = [
    { key: 'active',    label: 'Active',    color: '#10b981' },
    { key: 'planning',  label: 'Planning',  color: '#8b5cf6' },
    { key: 'completed', label: 'Completed', color: '#3b82f6' },
    { key: 'on_hold',   label: 'On Hold',   color: '#94a3b8' },
    { key: 'on_track',  label: 'On Track',  color: '#34d399' },
    { key: 'at_risk',   label: 'At Risk',   color: '#f59e0b' },
    { key: 'critical',  label: 'Critical',  color: '#ef4444' },
    { key: 'cancelled', label: 'Cancelled', color: '#cbd5e1' },
  ].filter(s => (counts[s.key] ?? 0) > 0)

  const total = projects.length
  if (total === 0) return null

  const cx = 80, cy = 80, r = 60, hole = 38
  let angle = 0
  const arcs = segments.map(s => {
    const pct = (counts[s.key] ?? 0) / total
    const sweep = pct * 360
    const start = angle
    angle += sweep
    return { ...s, count: counts[s.key] ?? 0, pct, start, end: angle }
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Status Distribution</h3>
      <div className="flex items-center gap-6">
        <div className="flex-shrink-0 relative">
          <svg width="160" height="160" viewBox="0 0 160 160">
            {/* Background ring */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={22} />
            {arcs.map((a, i) => (
              a.end - a.start > 0.5 && (
                <path
                  key={i}
                  d={arcPath(cx, cy, r, a.start, a.end - 0.5)}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={22}
                  strokeLinecap="round"
                />
              )
            ))}
            {/* Center hole */}
            <circle cx={cx} cy={cy} r={hole} fill="white" />
            {/* Center text */}
            <text x={cx} y={cy - 8} textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f172a" fontFamily="ui-sans-serif,system-ui,sans-serif">
              {total}
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontSize="10" fill="#94a3b8" fontFamily="ui-sans-serif,system-ui,sans-serif">
              projects
            </text>
          </svg>
        </div>
        <div className="flex-1 space-y-2 min-w-0">
          {arcs.map(a => (
            <div key={a.key} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: a.color }} />
              <span className="text-xs text-slate-600 flex-1 truncate">{a.label}</span>
              <span className="text-xs font-semibold text-slate-800 tabular-nums">{a.count}</span>
              <span className="text-[10px] text-slate-400 tabular-nums w-8 text-right">{Math.round(a.pct * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── HEALTH DISTRIBUTION ──────────────────────────────────────────────────────

function HealthDistribution({ projects }: { projects: Project[] }) {
  const active = projects.filter(p => p.status !== 'completed' && p.status !== 'cancelled' && p.status !== 'on_hold')
  const total = active.length || 1

  // Use Pulse condition when available, fall back to health_score thresholds
  const healthy  = active.filter(p => p.pulse_condition ? p.pulse_condition === 'healthy'  : (p.health_score ?? 50) >= 70).length
  const watch    = active.filter(p => p.pulse_condition ? p.pulse_condition === 'watch'    : ((p.health_score ?? 50) >= 50 && (p.health_score ?? 50) < 70)).length
  const elevated = active.filter(p => p.pulse_condition ? p.pulse_condition === 'elevated' : ((p.health_score ?? 50) >= 30 && (p.health_score ?? 50) < 50)).length
  const critical = active.filter(p => p.pulse_condition ? p.pulse_condition === 'critical' : (p.health_score ?? 50) < 30).length
  const dormant  = active.filter(p => p.pulse_condition === 'dormant').length

  const bars = [
    { label: 'Healthy',  count: healthy,  color: 'bg-emerald-500', textColor: 'text-emerald-700', bgChip: 'bg-emerald-50', desc: 'Self-managed, no intervention' },
    { label: 'Watch',    count: watch,    color: 'bg-amber-500',   textColor: 'text-amber-700',   bgChip: 'bg-amber-50',   desc: 'PM review this week' },
    { label: 'Elevated', count: elevated, color: 'bg-orange-500',  textColor: 'text-orange-700',  bgChip: 'bg-orange-50',  desc: 'Director should be in the loop' },
    { label: 'Critical', count: critical, color: 'bg-red-500',     textColor: 'text-red-700',     bgChip: 'bg-red-50',     desc: 'Executive visibility required' },
    ...(dormant > 0 ? [{ label: 'Dormant', count: dormant, color: 'bg-slate-400', textColor: 'text-slate-600', bgChip: 'bg-slate-100', desc: 'No recent activity detected' }] : []),
  ]

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-1">Pulse Distribution</h3>
      <p className="text-[10px] text-slate-400 mb-4">Condition-based view — active projects only</p>
      <div className="space-y-3.5">
        {bars.map(b => (
          <div key={b.label}>
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <span className="text-xs font-semibold text-slate-700">{b.label}</span>
                <span className="text-[10px] text-slate-400 ml-1.5">{b.desc}</span>
              </div>
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${b.bgChip}`}>
                <span className={`text-xs font-bold tabular-nums ${b.textColor}`}>{b.count}</span>
                <span className={`text-[10px] ${b.textColor} opacity-70`}>
                  {Math.round((b.count / total) * 100)}%
                </span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${b.color} transition-all duration-700`}
                style={{ width: `${(b.count / total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ATTENTION TABLE ──────────────────────────────────────────────────────────

function AttentionTable({ projects, onNavigate }: { projects: Project[]; onNavigate: (id: string) => void }) {
  // Sort: critical first, then by health_score ascending within each condition
  const CONDITION_RANK: Record<string, number> = { critical: 0, elevated: 1, dormant: 2, watch: 3, healthy: 4 }
  const worst = useMemo(() =>
    [...projects]
      .filter(p => p.status !== 'completed' && p.status !== 'cancelled')
      .sort((a, b) => {
        const rankA = CONDITION_RANK[a.pulse_condition ?? ''] ?? 5
        const rankB = CONDITION_RANK[b.pulse_condition ?? ''] ?? 5
        if (rankA !== rankB) return rankA - rankB
        return (a.health_score ?? 50) - (b.health_score ?? 50)
      })
      .slice(0, 10),
    [projects]
  )

  if (worst.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <ShieldWarning size={16} className="text-red-500" weight="fill" />
          Needs Attention
        </h3>
        <span className="text-xs text-slate-400">By condition · critical first</span>
      </div>
      <div className="divide-y divide-slate-50">
        {worst.map((p, i) => {
          const pc     = pulseConditionConfig(p.pulse_condition)
          const status = STATUS_STYLES[p.status] ?? STATUS_STYLES['active']
          const days   = p.target_end ? Math.round((new Date(p.target_end).getTime() - Date.now()) / 86400000) : null
          return (
            <div
              key={p.id}
              onClick={() => onNavigate(p.id)}
              className={`flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer
                          group transition-colors border-l-2 ${pc.border}`}
            >
              <span className="text-xs font-mono text-slate-300 w-5 flex-shrink-0 select-none">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                  {p.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                  <span className={`text-[10px] ${status.text}`}>{status.label}</span>
                  {p.vertical && <span className="text-[10px] text-slate-400">{p.vertical}</span>}
                </div>
              </div>
              {/* Pulse condition + momentum */}
              <div className="flex-shrink-0">
                <PulseBadge condition={p.pulse_condition} momentum={p.pulse_momentum} />
              </div>
              {/* Signal chips — the "why" */}
              <div className="flex-shrink-0 hidden sm:block">
                <SignalChips signals={p.pulse_signals} max={2} />
              </div>
              {/* Days remaining */}
              {days !== null && (
                <span className={`flex-shrink-0 text-[10px] tabular-nums font-medium hidden md:block ${
                  days < 0 ? 'text-red-500' : days < 30 ? 'text-amber-600' : 'text-slate-400'
                }`}>
                  {days < 0 ? `${Math.abs(days)}d late` : `${days}d`}
                </span>
              )}
              <ArrowRight size={12} className="flex-shrink-0 text-slate-300 group-hover:text-blue-400 transition-colors" />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── DASHBOARD TAB ────────────────────────────────────────────────────────────

function DashboardTab({ projects, onNavigate }: { projects: Project[]; onNavigate: (id: string) => void }) {
  return (
    <div className="space-y-5">
      <StatsHero />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <StatusDonut projects={projects} />
        <HealthDistribution projects={projects} />
      </div>
      <AttentionTable projects={projects} onNavigate={onNavigate} />
    </div>
  )
}

// ─── HEALTH RING (light mode) ─────────────────────────────────────────────────

function HealthRing({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="w-10 h-10 flex items-center justify-center">
        <span className="text-xs text-slate-400">—</span>
      </div>
    )
  }

  const r    = 16
  const circ = 2 * Math.PI * r
  const pct  = Math.max(0, Math.min(100, score)) / 100
  const off  = circ * (1 - pct)
  const hc   = healthColor(score)

  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="flex-shrink-0">
      <circle cx="20" cy="20" r={r} fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
      <circle
        cx="20" cy="20" r={r} fill="none"
        stroke={hc.fill} strokeWidth="3.5"
        strokeDasharray={circ}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform="rotate(-90 20 20)"
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)' }}
      />
      <text x="20" y="24" textAnchor="middle" fill={hc.fill} fontSize="10" fontWeight="700" fontFamily="ui-monospace,monospace">
        {score}
      </text>
    </svg>
  )
}

// ─── BUDGET CELL (light mode) ─────────────────────────────────────────────────

function BudgetCell({ spent, total, inline = false }: { spent: number | null; total: number | null; inline?: boolean }) {
  if (total === null) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-400 border border-slate-200">
        Not Tracked
      </span>
    )
  }

  const s   = spent ?? 0
  const pct = total > 0 ? Math.min((s / total) * 100, 100) : 0
  const over = s > total

  if (inline) {
    return (
      <div className="min-w-[80px]">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className={over ? 'text-red-600 font-semibold' : 'text-slate-700'}>
            ${(s / 1000).toFixed(0)}k
          </span>
          <span className="text-slate-400">/ ${(total / 1000).toFixed(0)}k</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full ${over ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-blue-500'}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="text-xs tabular-nums mb-1">
        <span className={over ? 'text-red-600 font-semibold' : 'text-slate-700'}>
          ${(s / 1000).toFixed(0)}k
        </span>
        <span className="text-slate-400"> / ${(total / 1000).toFixed(0)}k</span>
      </div>
      <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${over ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── PROJECT CARD (light mode) ────────────────────────────────────────────────

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const status = STATUS_STYLES[project.status] ?? STATUS_STYLES['active']
  const pc     = pulseConditionConfig(project.pulse_condition)

  const deadline = project.target_end ? new Date(project.target_end) : null
  const now      = new Date()
  const daysLeft = deadline ? Math.round((deadline.getTime() - now.getTime()) / 86400000) : null
  const overdue  = daysLeft !== null && daysLeft < 0

  return (
    <div
      onClick={onClick}
      className={`group relative bg-white border border-slate-200 rounded-xl overflow-hidden
                  cursor-pointer hover:border-slate-300 hover:shadow-md
                  transition-all duration-200 hover:-translate-y-0.5 border-l-4 ${pc.border}`}
    >
      <div className="px-4 pt-4 pb-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-0.5 ${status.dot}`} />
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${status.text}`}>
              {status.label}
            </span>
          </div>
          <span className={`flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider ${
            PRIORITY_STYLES[project.priority] ?? 'text-slate-400'
          }`}>
            {project.priority}
          </span>
        </div>

        {/* Name */}
        <h3 className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2 mb-3 min-h-[2.5rem]
                        group-hover:text-blue-700 transition-colors">
          {project.name}
        </h3>

        {/* Vertical chip */}
        {project.vertical && (
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-[10px] text-slate-500 mb-3">
            {project.vertical}
          </span>
        )}

        {/* Pulse badge + health ring */}
        <div className="flex items-center justify-between mb-2">
          <PulseBadge condition={project.pulse_condition} momentum={project.pulse_momentum} />
          <HealthRing score={project.health_score} />
        </div>
        {/* Signal chips */}
        {project.pulse_signals && project.pulse_signals.length > 0 && (
          <div className="mb-3">
            <SignalChips signals={project.pulse_signals} max={3} />
          </div>
        )}

        {/* Budget */}
        <div className="mb-3">
          <BudgetCell spent={project.budget_spent} total={project.budget_total} inline />
        </div>

        {/* Deadline */}
        {deadline && (
          <div className={`flex items-center gap-1.5 text-[11px] font-medium ${
            overdue ? 'text-red-500' : daysLeft !== null && daysLeft < 30 ? 'text-amber-600' : 'text-slate-400'
          }`}>
            <CalendarBlank size={11} />
            {overdue
              ? `${Math.abs(daysLeft!)}d overdue`
              : daysLeft === 0
                ? 'Due today'
                : daysLeft !== null && daysLeft <= 30
                  ? `${daysLeft}d remaining`
                  : deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
            }
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CARDS TAB ────────────────────────────────────────────────────────────────

function CardsTab({ projects, onNavigate }: { projects: Project[]; onNavigate: (id: string) => void }) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Briefcase size={40} weight="thin" className="mb-4 opacity-40" />
        <p className="text-sm font-medium">No projects match your filters</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {projects.map(p => (
        <ProjectCard key={p.id} project={p} onClick={() => onNavigate(p.id)} />
      ))}
    </div>
  )
}

// ─── SORT ICON ────────────────────────────────────────────────────────────────

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (!sorted) return <ArrowsDownUp size={11} className="text-slate-400" />
  if (sorted === 'asc') return <ArrowUp size={11} className="text-blue-500" />
  return <ArrowDown size={11} className="text-blue-500" />
}

// ─── TABLE COLUMN DEFINITIONS ─────────────────────────────────────────────────

const columnHelper = createColumnHelper<Project>()

const columns = [
  columnHelper.accessor('name', {
    header: 'Project',
    cell: info => {
      const p      = info.row.original
      const status = STATUS_STYLES[p.status] ?? STATUS_STYLES['active']
      return (
        <div className="min-w-0">
          <span className="font-medium text-slate-800 leading-snug line-clamp-1 block text-sm">
            {info.getValue()}
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.dot}`} />
            <span className={`text-[10px] ${status.text}`}>{status.label}</span>
            {p.vertical && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-[10px] text-slate-400 truncate">{p.vertical}</span>
              </>
            )}
          </div>
        </div>
      )
    },
    enableSorting: true,
  }),
  columnHelper.accessor('health_score', {
    header: 'Health',
    cell: info => {
      const score = info.getValue()
      if (score === null) return <span className="text-xs text-slate-400">—</span>
      const hc = healthColor(score)
      return (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full ${hc.bar}`} style={{ width: `${score}%` }} />
          </div>
          <span className={`text-xs tabular-nums font-semibold ${hc.text}`}>{score}</span>
        </div>
      )
    },
    enableSorting: true,
  }),
  columnHelper.accessor(row => ({ condition: row.pulse_condition, momentum: row.pulse_momentum, signals: row.pulse_signals }), {
    id: 'pulse',
    header: 'Pulse',
    cell: info => {
      const { condition, momentum, signals } = info.getValue()
      return (
        <div className="space-y-1">
          <PulseBadge condition={condition} momentum={momentum} />
          <SignalChips signals={signals} max={2} />
        </div>
      )
    },
    enableSorting: false,
  }),
  columnHelper.accessor(row => ({ spent: row.budget_spent, total: row.budget_total }), {
    id: 'budget',
    header: 'Budget',
    cell: info => {
      const { spent, total } = info.getValue()
      return <BudgetCell spent={spent} total={total} inline />
    },
    enableSorting: false,
  }),
  columnHelper.accessor('target_end', {
    header: 'Due',
    cell: info => {
      const val = info.getValue()
      if (!val) return <span className="text-xs text-slate-400">—</span>
      const date   = new Date(val)
      const days   = Math.round((date.getTime() - Date.now()) / 86400000)
      const overdue = days < 0
      return (
        <div>
          <span className={`text-xs ${overdue ? 'text-red-500 font-semibold' : 'text-slate-600'}`}>
            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
          </span>
          {overdue && <p className="text-[10px] text-red-400">{Math.abs(days)}d late</p>}
        </div>
      )
    },
    enableSorting: true,
  }),
  columnHelper.accessor('priority', {
    header: 'Priority',
    cell: info => (
      <span className={`text-xs font-semibold capitalize ${PRIORITY_STYLES[info.getValue()] ?? 'text-slate-400'}`}>
        {info.getValue()}
      </span>
    ),
    enableSorting: true,
  }),
]

// ─── STATUS FILTER OPTIONS ────────────────────────────────────────────────────

const STATUS_FILTER_OPTIONS: Array<{ value: ProjectStatus | 'all'; label: string }> = [
  { value: 'all',       label: 'All' },
  { value: 'active',    label: 'Active' },
  { value: 'planning',  label: 'Planning' },
  { value: 'on_hold',   label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'at_risk',   label: 'At Risk' },
  { value: 'critical',  label: 'Critical' },
]

// ─── LIST TAB ─────────────────────────────────────────────────────────────────

function ListTab({ projects, isLoading, onNavigate, onRefresh }: {
  projects: Project[]
  isLoading: boolean
  onNavigate: (id: string) => void
  onRefresh: () => void
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'health_score', desc: false },
  ])
  const [globalFilter, setGlobalFilter] = useState('')

  const table = useReactTable({
    data: projects,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects…"
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg
                       text-slate-800 placeholder-slate-400 outline-none
                       focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>
        <div className="text-xs text-slate-400 ml-auto tabular-nums">
          {table.getFilteredRowModel().rows.length} of {projects.length} projects
        </div>
        <button
          onClick={onRefresh}
          className="p-2 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-600
                     hover:border-slate-300 transition-colors"
          title="Refresh"
        >
          <ArrowClockwise size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id} className="border-b border-slate-100">
                  {hg.headers.map(header => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={`px-4 py-3 text-left text-[10px] font-semibold text-slate-500
                                  uppercase tracking-wider select-none whitespace-nowrap
                                  ${header.column.getCanSort() ? 'cursor-pointer hover:text-slate-700' : ''}`}
                    >
                      <div className="flex items-center gap-1.5">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <SortIcon sorted={header.column.getIsSorted()} />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-50">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-16 text-center text-sm text-slate-400">
                    No projects match your search
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => {
                  const hc = healthColor(row.original.health_score)
                  return (
                    <tr
                      key={row.id}
                      onClick={() => onNavigate(row.original.id)}
                      className={`cursor-pointer hover:bg-slate-50 transition-colors border-l-2 ${hc.border} group`}
                    >
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-4 py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── ROADMAP / GANTT TAB ──────────────────────────────────────────────────────

function RoadmapTab({ projects, onNavigate }: { projects: Project[]; onNavigate: (id: string) => void }) {
  // Only projects with start_date AND target_end
  const roadmapProjects = useMemo(() =>
    projects.filter(p => p.start_date && p.target_end),
    [projects]
  )

  // Compute date range
  const { rangeStart, rangeEnd, totalDays } = useMemo(() => {
    if (roadmapProjects.length === 0) {
      const now = new Date()
      return { rangeStart: now, rangeEnd: new Date(now.getTime() + 180 * 86400000), totalDays: 180 }
    }
    const starts = roadmapProjects.map(p => new Date(p.start_date!).getTime())
    const ends   = roadmapProjects.map(p => new Date(p.target_end!).getTime())
    const minMs  = Math.min(...starts) - 14 * 86400000   // 2 week pad
    const maxMs  = Math.max(...ends)   + 14 * 86400000
    const rs     = new Date(minMs)
    const re     = new Date(maxMs)
    const days   = Math.ceil((maxMs - minMs) / 86400000)
    return { rangeStart: rs, rangeEnd: re, totalDays: days }
  }, [roadmapProjects])

  // Group by vertical
  const grouped = useMemo(() => {
    const map = new Map<string, Project[]>()
    for (const p of roadmapProjects) {
      const key = p.vertical ?? 'Other'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    // Sort each group by start_date
    for (const [, arr] of map) {
      arr.sort((a, b) => new Date(a.start_date!).getTime() - new Date(b.start_date!).getTime())
    }
    return map
  }, [roadmapProjects])

  // Today's position
  const todayPct = useMemo(() => {
    const now   = Date.now()
    const start = rangeStart.getTime()
    const end   = rangeEnd.getTime()
    return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100))
  }, [rangeStart, rangeEnd])

  // Month labels
  const monthLabels = useMemo(() => {
    const labels: { label: string; pct: number }[] = []
    const cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
    while (cur <= rangeEnd) {
      const pct = ((cur.getTime() - rangeStart.getTime()) / (rangeEnd.getTime() - rangeStart.getTime())) * 100
      labels.push({
        label: cur.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        pct,
      })
      cur.setMonth(cur.getMonth() + 1)
    }
    return labels
  }, [rangeStart, rangeEnd])

  function barPct(dateStr: string) {
    const ts = new Date(dateStr).getTime()
    return ((ts - rangeStart.getTime()) / (rangeEnd.getTime() - rangeStart.getTime())) * 100
  }

  if (roadmapProjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <MapTrifold size={40} weight="thin" className="mb-4 opacity-40" />
        <p className="text-sm font-medium">No projects with timeline data</p>
        <p className="text-xs mt-1">Projects need start_date and target_end to appear here</p>
      </div>
    )
  }

  const MIN_CHART_WIDTH = Math.max(900, totalDays * 3)

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <MapTrifold size={16} className="text-blue-500" weight="fill" />
          Portfolio Roadmap
        </h3>
        <div className="flex items-center gap-4 text-[10px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> On Track
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> At Risk
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-red-400" /> Critical
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-blue-500 font-bold">◆</span> Go-live
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: `${MIN_CHART_WIDTH + 160}px` }}>
          {/* Month header */}
          <div className="flex" style={{ paddingLeft: '160px' }}>
            <div className="relative flex-1 h-8 border-b border-slate-100 bg-slate-50">
              {monthLabels.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full flex items-center"
                  style={{ left: `${m.pct}%` }}
                >
                  <div className="h-full border-l border-slate-200" />
                  <span className="text-[10px] text-slate-400 font-medium pl-1.5 whitespace-nowrap">
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Groups */}
          {Array.from(grouped.entries()).map(([vertical, vProjects]) => (
            <div key={vertical}>
              {/* Group header */}
              <div className="flex items-center border-b border-slate-100 bg-slate-50 sticky left-0">
                <div className="w-40 flex-shrink-0 px-4 py-2">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                    {vertical}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-2">({vProjects.length})</span>
                </div>
                <div className="flex-1 relative h-6">
                  {/* Today line through header */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-blue-400/30"
                    style={{ left: `${todayPct}%` }}
                  />
                </div>
              </div>

              {/* Project rows */}
              {vProjects.map(p => {
                const hc    = healthColor(p.health_score)
                const left  = barPct(p.start_date!)
                const right = barPct(p.target_end!)
                const width = Math.max(right - left, 0.5)
                const days  = Math.round((new Date(p.target_end!).getTime() - Date.now()) / 86400000)
                const overdue = days < 0

                return (
                  <div
                    key={p.id}
                    className="flex items-center border-b border-slate-50 hover:bg-slate-50/60 group cursor-pointer"
                    onClick={() => onNavigate(p.id)}
                  >
                    {/* Label */}
                    <div className="w-40 flex-shrink-0 px-4 py-2.5">
                      <p className="text-xs font-medium text-slate-700 truncate group-hover:text-blue-600 transition-colors">
                        {p.name}
                      </p>
                      <p className={`text-[10px] ${hc.text} font-semibold`}>
                        {healthLabel(p.health_score)}
                        {p.health_score !== null && ` · ${p.health_score}`}
                      </p>
                    </div>

                    {/* Gantt track */}
                    <div className="flex-1 relative h-12 py-3.5">
                      {/* Today line */}
                      <div
                        className="absolute top-0 bottom-0 w-px bg-blue-400 z-10"
                        style={{ left: `${todayPct}%` }}
                      />
                      {/* Month grid lines */}
                      {monthLabels.map((m, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 w-px bg-slate-100"
                          style={{ left: `${m.pct}%` }}
                        />
                      ))}

                      {/* Gantt bar */}
                      <div
                        className={`absolute top-3 h-5 rounded ${
                          hc.bar
                        } opacity-80 group-hover:opacity-100 transition-opacity`}
                        style={{
                          left:  `${Math.max(0, left)}%`,
                          width: `${Math.min(width, 100 - Math.max(0, left))}%`,
                        }}
                        title={`${p.name}: ${p.start_date} → ${p.target_end}`}
                      />

                      {/* Go-live diamond at target_end */}
                      <div
                        className={`absolute top-2.5 z-20 w-3.5 h-3.5 rotate-45 border-2 ${
                          overdue
                            ? 'bg-red-500 border-red-600'
                            : 'bg-blue-500 border-blue-600'
                        } shadow-sm`}
                        style={{
                          left: `calc(${Math.min(right, 99.5)}% - 7px)`,
                        }}
                        title={`Go-live: ${p.target_end}${overdue ? ` (${Math.abs(days)}d late)` : ''}`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          {/* Today label at bottom */}
          <div className="flex" style={{ paddingLeft: '160px' }}>
            <div className="flex-1 relative h-6 bg-slate-50 border-t border-slate-100">
              <div
                className="absolute top-0 h-full flex flex-col items-center"
                style={{ left: `${todayPct}%` }}
              >
                <div className="w-px h-full bg-blue-400" />
              </div>
              <div
                className="absolute top-1 px-1.5 py-0.5 bg-blue-500 rounded text-[9px] text-white font-semibold whitespace-nowrap -translate-x-1/2"
                style={{ left: `${todayPct}%` }}
              >
                Today
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PORTFOLIO COMPONENT ─────────────────────────────────────────────────

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'dashboard', label: 'Dashboard', icon: <ChartBar size={15} weight="fill" /> },
  { id: 'list',      label: 'List',      icon: <Rows size={15} weight="fill" /> },
  { id: 'cards',     label: 'Cards',     icon: <SquaresFour size={15} weight="fill" /> },
  { id: 'roadmap',   label: 'Roadmap',   icon: <MapTrifold size={15} weight="fill" /> },
]

const STATUS_FILTER_OPTIONS_WITH_ALL = STATUS_FILTER_OPTIONS

export default function Portfolio() {
  const navigate = useNavigate()

  const [activeTab,   setActiveTab]   = useState<TabId>('dashboard')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')
  const [searchQuery,  setSearchQuery]  = useState('')

  const { data: projects = [], isLoading, refetch } = useProjects({
    status:   statusFilter !== 'all' ? statusFilter : undefined,
    search:   searchQuery || undefined,
    pageSize: 200,
  })

  const onNavigate = (id: string) => navigate(`/project/${id}`)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Portfolio</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {isLoading ? 'Loading…' : `${projects.length} projects · Global IT`}
            </p>
          </div>

          {/* Filter controls */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as ProjectStatus | 'all')}
              className="text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-700
                         outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              {STATUS_FILTER_OPTIONS_WITH_ALL.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {/* Search (visible on List/Cards/Roadmap tabs) */}
            {activeTab !== 'dashboard' && (
              <div className="relative">
                <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg
                             text-slate-800 placeholder-slate-400 outline-none w-48
                             focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            )}

            <button
              onClick={() => refetch()}
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-400
                         hover:text-slate-600 hover:border-slate-300 transition-colors"
              title="Refresh"
            >
              <ArrowClockwise size={15} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                          transition-all duration-150
                          ${activeTab === tab.id
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-transparent'
                          }`}
            >
              <span className={activeTab === tab.id ? 'text-blue-600' : 'text-slate-400'}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-6 py-5">
        {activeTab === 'dashboard' && (
          <DashboardTab projects={projects} onNavigate={onNavigate} />
        )}
        {activeTab === 'list' && (
          <ListTab
            projects={projects}
            isLoading={isLoading}
            onNavigate={onNavigate}
            onRefresh={() => refetch()}
          />
        )}
        {activeTab === 'cards' && (
          <CardsTab projects={projects} onNavigate={onNavigate} />
        )}
        {activeTab === 'roadmap' && (
          <RoadmapTab projects={projects} onNavigate={onNavigate} />
        )}
      </div>
    </div>
  )
}
