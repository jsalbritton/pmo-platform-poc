/**
 * Project Detail — /project/:id
 *
 * The drill-down page that makes the Command Center actionable.
 * When a VP clicks "Critical" on the portfolio view, this is where
 * they see WHY it's critical and WHO is responsible.
 *
 * Layout: Header → KPI Cards → Sprint Timeline → Risks → Work Items
 */

import { useParams, useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import {
  ArrowLeft,
  CalendarBlank,
  Lightning,
  Warning,
  Clock,
  TrendUp,
  TrendDown,
  Minus,
  Target,
  ShieldWarning,
  Briefcase,
  CaretRight,
  Fire,
  ArrowsClockwise,
  FlagPennant,
  CircleNotch,
} from '@phosphor-icons/react'
import {
  useProject,
  useProjectWorkItemCounts,
  useProjectSprints,
  useProjectRisks,
  useCompleteSprint,
} from '@/hooks/useProjects'
import { useConfetti } from '@/hooks/useConfetti'
import type { ProjectWithOwner } from '@/hooks/useProjects'
import type { Sprint, Risk } from '@/types'

// ─── UTILITIES ──────────────────────────────────────────────────────────────

function healthLabel(score: number | null): string {
  if (score === null) return 'Unknown'
  if (score >= 70) return 'On Track'
  if (score >= 40) return 'At Risk'
  return 'Critical'
}

function healthColor(score: number | null) {
  if (score === null) return { bg: 'bg-gray-100', text: 'text-gray-500', ring: 'ring-gray-200', fill: '#9ca3af' }
  if (score >= 70) return { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', fill: '#10b981' }
  if (score >= 40) return { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', fill: '#f59e0b' }
  return { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200', fill: '#ef4444' }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 14) return `${days}d ago`
  return formatDate(iso)
}

function daysRemaining(targetEnd: string | null): { text: string; urgent: boolean } {
  if (!targetEnd) return { text: 'No end date', urgent: false }
  const days = Math.round((new Date(targetEnd).getTime() - Date.now()) / 86400000)
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, urgent: true }
  if (days === 0) return { text: 'Due today', urgent: true }
  if (days <= 14) return { text: `${days}d remaining`, urgent: true }
  return { text: `${days}d remaining`, urgent: false }
}

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

const MOMENTUM_CFG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  recovering: { icon: <TrendUp size={14} />, label: 'Recovering', color: 'text-emerald-600' },
  declining:  { icon: <TrendDown size={14} />, label: 'Declining', color: 'text-red-500' },
  volatile:   { icon: <Lightning size={14} />, label: 'Volatile', color: 'text-amber-500' },
  stable:     { icon: <Minus size={14} />, label: 'Stable', color: 'text-gray-400' },
}

const SIGNAL_LABELS: Record<string, string> = {
  budget: 'Budget', schedule: 'Schedule', delivery: 'Delivery',
  scope: 'Scope', risks: 'Risk', execution: 'Execution',
}

// ─── KPI CARD ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color = 'text-gray-900' }: {
  label: string; value: string | number; sub?: string; icon: React.ReactNode; color?: string
}) {
  return (
    <div className="kpi-card-rows bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
      {/* Row 1: label + icon */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        <div className="p-1.5 rounded-lg bg-gray-50 border border-gray-100 flex-shrink-0 text-gray-400">
          {icon}
        </div>
      </div>
      {/* Row 2: value */}
      <p className={`text-xl font-bold ${color} leading-tight`}>{value}</p>
      {/* Row 3: sub or spacer */}
      {sub ? (
        <p className="text-[10px] text-gray-400">{sub}</p>
      ) : (
        <span aria-hidden="true" />
      )}
    </div>
  )
}

// ─── HEALTH RING (SVG) ──────────────────────────────────────────────────────

function HealthRing({ score }: { score: number | null }) {
  const s = score ?? 0
  const { fill } = healthColor(score)
  const circumference = 2 * Math.PI * 40
  const offset = circumference - (s / 100) * circumference

  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="40" fill="none" stroke={fill} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-gray-900">{score ?? '—'}</span>
        <span className="text-[9px] text-gray-400 uppercase tracking-wider">{healthLabel(score)}</span>
      </div>
    </div>
  )
}

// ─── TIMELINE PROGRESS ──────────────────────────────────────────────────────

function TimelineBar({ startDate, endDate }: { startDate: string | null; endDate: string | null }) {
  const start = startDate ? new Date(startDate).getTime() : null
  const end = endDate ? new Date(endDate).getTime() : null
  const pct = (start && end && end > start)
    ? Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100))
    : null

  if (pct === null) return <span className="text-[11px] text-gray-400">No timeline set</span>

  const overdue = pct > 100

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-500">{formatDate(startDate)}</span>
        <span className={`text-[10px] font-medium ${overdue ? 'text-red-500' : 'text-gray-500'}`}>
          {Math.round(pct)}% elapsed
        </span>
        <span className="text-[10px] text-gray-500">{formatDate(endDate)}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${overdue ? 'bg-red-400' : pct > 75 ? 'bg-amber-400' : 'bg-emerald-400'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  )
}

// ─── SPRINT ROW ─────────────────────────────────────────────────────────────

function SprintRow({ sprint }: { sprint: Sprint }) {
  const { id: projectId = '' } = useParams<{ id: string }>()
  const { fireSprint }         = useConfetti()
  const { mutate: completeSprint, isPending } = useCompleteSprint(projectId)

  const statusCfg: Record<string, { bg: string; text: string; label: string }> = {
    active:    { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Active' },
    completed: { bg: 'bg-blue-50',    text: 'text-blue-700',    label: 'Completed' },
    planned:   { bg: 'bg-gray-50',    text: 'text-gray-500',    label: 'Planned' },
    cancelled: { bg: 'bg-gray-50',    text: 'text-gray-400',    label: 'Cancelled' },
  }
  const cfg = statusCfg[sprint.status] ?? statusCfg.planned
  const velocity = sprint.capacity_points && sprint.completed_pts
    ? Math.round((sprint.completed_pts / sprint.capacity_points) * 100)
    : null

  return (
    <div className="scroll-reveal-up flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-gray-900">{sprint.name}</span>
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
            {cfg.label}
          </span>
        </div>
        {sprint.goal && (
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">{sprint.goal}</p>
        )}
      </div>

      <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0">
        <span className="text-[10px] text-gray-500">
          {formatDate(sprint.start_date)} — {formatDate(sprint.end_date)}
        </span>
        {velocity !== null && (
          <span className={`text-[10px] font-medium ${velocity >= 80 ? 'text-emerald-600' : velocity >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
            {sprint.completed_pts}/{sprint.capacity_points} pts ({velocity}%)
          </span>
        )}
      </div>

      {/* Complete Sprint — only shown for active sprints */}
      {sprint.status === 'active' && (
        <button
          onClick={() => completeSprint(sprint.id, { onSuccess: fireSprint })}
          disabled={isPending}
          className="
            flex items-center gap-1.5 px-2.5 py-1 rounded-lg flex-shrink-0
            text-[11px] font-semibold
            bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700
            text-white
            transition-colors cursor-pointer
            disabled:opacity-60 disabled:cursor-not-allowed
          "
          title="Mark this sprint as completed"
        >
          {isPending
            ? <CircleNotch size={12} className="animate-spin" />
            : <FlagPennant size={12} weight="fill" />
          }
          {isPending ? 'Completing…' : 'Complete'}
        </button>
      )}
    </div>
  )
}

// ─── RISK ROW ───────────────────────────────────────────────────────────────

function RiskRow({ risk }: { risk: Risk }) {
  const severityCfg: Record<string, { bg: string; text: string }> = {
    critical: { bg: 'bg-red-50', text: 'text-red-700' },
    high:     { bg: 'bg-orange-50', text: 'text-orange-700' },
    medium:   { bg: 'bg-amber-50', text: 'text-amber-700' },
    low:      { bg: 'bg-gray-50', text: 'text-gray-500' },
  }
  const sev = severityCfg[risk.severity ?? 'medium'] ?? severityCfg.medium
  const isOpen = risk.status === 'open'

  return (
    <div className={`flex items-start gap-3 px-4 py-2.5 border-b border-gray-50 last:border-b-0 ${isOpen ? '' : 'opacity-60'}`}>
      <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${sev.bg}`}>
        {risk.type === 'risk' ? <ShieldWarning size={12} className={sev.text} /> :
         risk.type === 'issue' ? <Fire size={12} className={sev.text} /> :
         <ArrowsClockwise size={12} className={sev.text} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-gray-900 truncate">{risk.title}</span>
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${sev.bg} ${sev.text} uppercase`}>
            {risk.severity ?? 'med'}
          </span>
          {risk.ai_generated && (
            <span className="text-[8px] font-medium px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-100">
              AI
            </span>
          )}
        </div>
        {risk.mitigation && (
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">Mitigation: {risk.mitigation}</p>
        )}
      </div>
      <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${isOpen ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
          {risk.status}
        </span>
        {risk.risk_score != null && (
          <span className="text-[10px] text-gray-400">Score: {Math.round(risk.risk_score)}</span>
        )}
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export default function Project() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: project, isLoading } = useProject(id ?? '')
  const { data: workCounts } = useProjectWorkItemCounts(id ?? '')
  const { data: sprints = [] } = useProjectSprints(id ?? '')
  const { data: risks = [] } = useProjectRisks(id ?? '')

  const p = project as ProjectWithOwner | undefined

  const openRisks = useMemo(() => risks.filter(r => r.status === 'open'), [risks])
  const closedRisks = useMemo(() => risks.filter(r => r.status !== 'open'), [risks])
  const activeSprint = useMemo(() => sprints.find(s => s.status === 'active'), [sprints])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading project...</div>
      </div>
    )
  }

  if (!p) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-gray-500">Project not found</p>
          <button onClick={() => navigate('/portfolio')} className="text-blue-600 text-sm hover:underline">
            Back to Portfolio
          </button>
        </div>
      </div>
    )
  }

  const { text: daysText, urgent } = daysRemaining(p.target_end)
  const ownerName = p.owner?.display_name || p.owner?.full_name || 'Unassigned'
  const mom = p.pulse_momentum ? MOMENTUM_CFG[p.pulse_momentum] : null
  const excluded = new Set(p.excluded_signals ?? [])
  const activeSignals = (p.pulse_signals ?? []).filter(s => !excluded.has(s))

  return (
    <div className="min-h-screen bg-[#f4f6f9]">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          {/* Breadcrumb */}
          <button
            onClick={() => navigate('/portfolio')}
            className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-blue-600 transition-colors mb-3"
          >
            <ArrowLeft size={12} />
            <span>Portfolio</span>
            <CaretRight size={10} className="text-gray-300" />
            <span className="text-gray-500">Command Center</span>
          </button>

          <div className="flex items-start gap-6">
            {/* Health ring */}
            <HealthRing score={p.health_score ?? null} />

            {/* Project info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                {p.code && (
                  <span className="text-[11px] font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                    {p.code}
                  </span>
                )}
                <h1 className="text-xl font-bold text-gray-900 truncate">{p.name}</h1>
                {mom && (
                  <span className={`flex items-center gap-1 text-[11px] font-semibold ${mom.color}`}>
                    {mom.icon} {mom.label}
                  </span>
                )}
              </div>

              {p.description && (
                <p className="text-[12px] text-gray-500 mt-1 line-clamp-2 max-w-2xl">{p.description}</p>
              )}

              <div className="flex items-center gap-4 mt-3 flex-wrap">
                {/* Owner */}
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${avatarColor(ownerName)}`}>
                    {ownerName !== 'Unassigned' ? (ownerName.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)) : '?'}
                  </div>
                  <span className="text-[11px] text-gray-600">{ownerName}</span>
                </div>

                {/* Dates */}
                <div className="flex items-center gap-1 text-[11px] text-gray-400">
                  <CalendarBlank size={12} />
                  <span>{formatDate(p.start_date)} — {formatDate(p.target_end)}</span>
                </div>

                {/* Days remaining */}
                <span className={`text-[11px] font-medium ${urgent ? 'text-red-500' : 'text-gray-500'}`}>
                  {daysText}
                </span>

                {/* Domain */}
                {p.vertical && (
                  <span className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full border border-gray-100">
                    {p.vertical.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                )}

                {/* Priority */}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  p.priority === 'critical' ? 'bg-red-50 text-red-600' :
                  p.priority === 'high' ? 'bg-orange-50 text-orange-600' :
                  p.priority === 'medium' ? 'bg-amber-50 text-amber-600' :
                  'bg-gray-50 text-gray-500'
                }`}>
                  {p.priority.charAt(0).toUpperCase() + p.priority.slice(1)} Priority
                </span>

                {/* Last updated */}
                <span className="text-[10px] text-gray-400">
                  Updated {relativeTime(p.updated_at)}
                </span>
              </div>

              {/* Active signals */}
              {activeSignals.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Signals:</span>
                  {activeSignals.map(s => (
                    <span key={s} className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100">
                      {SIGNAL_LABELS[s] ?? s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Timeline progress bar */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Project Timeline</p>
          <TimelineBar startDate={p.start_date} endDate={p.target_end} />
        </div>

        {/* KPI Cards */}
        <div className="kpi-grid-rows grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <KpiCard
            label="Work Items"
            value={workCounts?.total ?? '—'}
            sub={workCounts ? `${workCounts.done} completed` : undefined}
            icon={<Briefcase size={16} className="text-gray-400" />}
          />
          <KpiCard
            label="In Progress"
            value={workCounts?.in_progress ?? '—'}
            icon={<ArrowsClockwise size={16} className="text-blue-400" />}
            color="text-blue-600"
          />
          <KpiCard
            label="Blocked"
            value={workCounts?.blocked ?? '—'}
            icon={<Warning size={16} className="text-red-400" />}
            color={workCounts && workCounts.blocked > 0 ? 'text-red-600' : 'text-gray-900'}
          />
          <KpiCard
            label="Overdue"
            value={workCounts?.overdue ?? '—'}
            icon={<Clock size={16} className="text-amber-400" />}
            color={workCounts && workCounts.overdue > 0 ? 'text-red-600' : 'text-gray-900'}
          />
          <KpiCard
            label="Story Points"
            value={workCounts ? `${workCounts.completedPoints}/${workCounts.totalPoints}` : '—'}
            sub={workCounts && workCounts.totalPoints > 0
              ? `${Math.round((workCounts.completedPoints / workCounts.totalPoints) * 100)}% complete`
              : undefined}
            icon={<Target size={16} className="text-violet-400" />}
          />
          <KpiCard
            label="Open Risks"
            value={openRisks.length}
            sub={`${risks.length} total`}
            icon={<ShieldWarning size={16} className="text-orange-400" />}
            color={openRisks.length > 3 ? 'text-red-600' : 'text-gray-900'}
          />
        </div>

        {/* Two-column layout: Sprints + Risks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sprints */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightning size={14} className="text-amber-500" />
                <span className="text-[12px] font-bold text-gray-800">Sprints</span>
                <span className="text-[10px] text-gray-400">{sprints.length} total</span>
              </div>
              {activeSprint && (
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  Active: {activeSprint.name}
                </span>
              )}
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {sprints.length === 0 ? (
                <div className="px-4 py-8 text-center text-[11px] text-gray-400">No sprints yet</div>
              ) : (
                sprints.map(s => <SprintRow key={s.id} sprint={s} />)
              )}
            </div>
          </div>

          {/* Risks */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldWarning size={14} className="text-red-500" />
                <span className="text-[12px] font-bold text-gray-800">Risks & Issues</span>
                <span className="text-[10px] text-gray-400">{openRisks.length} open</span>
              </div>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {risks.length === 0 ? (
                <div className="px-4 py-8 text-center text-[11px] text-gray-400">No risks identified</div>
              ) : (
                <>
                  {openRisks.map(r => <RiskRow key={r.id} risk={r} />)}
                  {closedRisks.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-gray-50 border-y border-gray-100">
                        <span className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">
                          Resolved ({closedRisks.length})
                        </span>
                      </div>
                      {closedRisks.slice(0, 5).map(r => <RiskRow key={r.id} risk={r} />)}
                      {closedRisks.length > 5 && (
                        <div className="px-4 py-2 text-center text-[10px] text-gray-400">
                          +{closedRisks.length - 5} more resolved
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Budget card (if budget data exists) */}
        {p.budget_total != null && p.budget_total > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Budget</p>
            <div className="flex items-center gap-6">
              <div>
                <span className="text-lg font-bold text-gray-900">
                  ${((p.budget_spent ?? 0) / 1000).toFixed(0)}k
                </span>
                <span className="text-[11px] text-gray-400"> / ${(p.budget_total / 1000).toFixed(0)}k</span>
              </div>
              <div className="flex-1 max-w-md">
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      ((p.budget_spent ?? 0) / p.budget_total) > 0.9 ? 'bg-red-400' :
                      ((p.budget_spent ?? 0) / p.budget_total) > 0.75 ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${Math.min(100, ((p.budget_spent ?? 0) / p.budget_total) * 100)}%` }}
                  />
                </div>
              </div>
              <span className={`text-[11px] font-medium ${
                ((p.budget_spent ?? 0) / p.budget_total) > 0.9 ? 'text-red-500' : 'text-gray-500'
              }`}>
                {Math.round(((p.budget_spent ?? 0) / p.budget_total) * 100)}% used
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
