/**
 * AI Engine — /ai-engine  ·  ML MODEL TRANSPARENCY & OBSERVABILITY
 *
 * This is the crown jewel — the differentiator. No competitor exposes ML model
 * scoring logic with this level of transparency.
 *
 * Design: Show the model's signal weights, recent scoring events, model metadata,
 * and health score distribution across all projects. Build trust through transparency.
 */

import { useState, useMemo } from 'react'
import {
  Brain,
  ChartBar,
  Gauge,
  Lightning,
  TrendUp,
  Warning,
  CaretDown,
  CaretRight,
  Timer,
  Cpu,
  Database,
  Atom,
} from '@phosphor-icons/react'
import { useModelWeights, useRecentHealthEvents, useModelVersion, useAIEngineStats } from '@/hooks/useAIEngine'
import type { ModelWeight, HealthScoreEvent } from '@/hooks/useAIEngine'

// ─── TIME UTILITIES ──────────────────────────────────────────────────────────

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── SIGNAL NAME FORMATTER ──────────────────────────────────────────────────

function formatSignalName(snake: string): string {
  return snake
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// ─── PULSE CONDITION COLORS ─────────────────────────────────────────────────

// getPulseColor — reserved for radar chart visualization (Sprint 2)

function getPulseBadgeClass(pulse: string | null | undefined) {
  switch (pulse) {
    case 'healthy':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    case 'watch':
      return 'bg-amber-50 text-amber-700 border border-amber-200'
    case 'elevated':
      return 'bg-orange-50 text-orange-700 border border-orange-200'
    case 'critical':
      return 'bg-red-50 text-red-700 border border-red-200'
    case 'dormant':
      return 'bg-gray-50 text-gray-600 border border-gray-200'
    default:
      return 'bg-gray-50 text-gray-600 border border-gray-200'
  }
}

function getPulseLabel(pulse: string | null | undefined) {
  switch (pulse) {
    case 'healthy': return 'On Track'
    case 'watch': return 'At Risk'
    case 'elevated': return 'Elevated'
    case 'critical': return 'Critical'
    case 'dormant': return 'Dormant'
    default: return '—'
  }
}

// ─── HISTOGRAM COMPONENT ────────────────────────────────────────────────────

interface HistogramProps {
  data: number[]
}

function HealthScoreHistogram({ data }: HistogramProps) {
  const bins = Array.from({ length: 10 }, () => 0)
  data.forEach(score => {
    const bin = Math.min(9, Math.floor(score / 10))
    bins[bin]++
  })

  const maxCount = Math.max(...bins, 1)
  const width = 400
  const height = 120
  const barSpacing = width / bins.length
  const barWidth = barSpacing * 0.85
  const padding = 30

  return (
    <div className="flex flex-col gap-2">
      <svg width={width + padding * 2} height={height + padding} className="bg-white rounded">
        {/* Y-axis */}
        <line x1={padding} y1={padding} x2={padding} y2={height + padding} stroke="#d1d5db" strokeWidth="1" />
        
        {/* X-axis */}
        <line x1={padding} y1={height + padding} x2={width + padding} y2={height + padding} stroke="#d1d5db" strokeWidth="1" />

        {/* Bars */}
        {bins.map((count, idx) => {
          const x = padding + idx * barSpacing + (barSpacing - barWidth) / 2
          const barHeight = (count / maxCount) * (height - 20)
          const y = height + padding - barHeight
          
          let barColor = '#ef4444' // <40 = red
          if (idx >= 7) barColor = '#10b981' // >=70 = green
          else if (idx >= 4) barColor = '#f59e0b' // 40-69 = amber

          return (
            <g key={idx}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={barColor}
                opacity="0.9"
                className="transition-all duration-300"
              />
              <text
                x={x + barWidth / 2}
                y={height + padding + 18}
                textAnchor="middle"
                className="text-xs fill-gray-600"
              >
                {idx * 10}
              </text>
              {count > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  textAnchor="middle"
                  className="text-xs font-semibold fill-gray-700"
                >
                  {count}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <div className="flex justify-between text-xs text-gray-600 mt-2">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-red-500"></span>
          Critical (&lt;40)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-amber-500"></span>
          At Risk (40-69)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-emerald-500"></span>
          On Track (70+)
        </span>
      </div>
    </div>
  )
}

// ─── MODEL WEIGHTS BAR CHART ────────────────────────────────────────────────

interface WeightsChartProps {
  weights: ModelWeight[]
}

function ModelWeightsChart({ weights }: WeightsChartProps) {
  const total = weights.reduce((sum, w) => sum + w.weight, 0)

  return (
    <div className="flex flex-col gap-4">
      {weights.map((w, idx) => {
        const pct = Math.round((w.weight / total) * 100)
        const hue = 280 - (idx / weights.length) * 80 // violet gradient
        const color = `hsl(${hue}, 100%, 50%)`

        return (
          <div key={w.id} className="flex flex-col gap-1">
            <div className="flex justify-between items-baseline">
              <label className="text-xs font-semibold text-gray-700">
                {formatSignalName(w.signal_name)}
              </label>
              <span className="text-xs font-bold text-gray-600">{pct}%</span>
            </div>

            <div className="w-full bg-gray-100 rounded h-2 overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: color,
                }}
              ></div>
            </div>

            <p className="text-xs text-gray-500">{w.description}</p>
          </div>
        )
      })}
    </div>
  )
}

// ─── KPI CARD ────────────────────────────────────────────────────────────────

interface KPICardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  unit?: string
  accent?: string
}

function KPICard({ icon, label, value, unit, accent = 'text-violet-600' }: KPICardProps) {
  return (
    <div className="kpi-card-rows bg-white border border-gray-200 rounded-lg p-4">
      {/* Row 1: label + icon */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
        <div className={`${accent} opacity-80 flex-shrink-0`}>{icon}</div>
      </div>
      {/* Row 2: value */}
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {unit && <span className="text-xs text-gray-600">{unit}</span>}
      </div>
      {/* Row 3: spacer */}
      <span aria-hidden="true" />
    </div>
  )
}

// ─── RECENT EVENTS LIST ──────────────────────────────────────────────────────

interface EventListProps {
  events: HealthScoreEvent[]
}

function RecentEventsList({ events }: EventListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <Gauge size={32} className="mx-auto mb-2 text-gray-400" />
        <p className="text-gray-500 text-sm">No scoring events yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {events.slice(0, 20).map(event => {
        const isExp = expanded.has(event.id)
        const projectName = event.project?.name || 'Unknown Project'
        const projectCode = event.project?.code || '—'

        return (
          <div key={event.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Header */}
            <button
              onClick={() => toggleExpand(event.id)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3 flex-1 text-left min-w-0">
                <div className="flex-shrink-0">
                  {isExp ? (
                    <CaretDown size={16} className="text-gray-400" />
                  ) : (
                    <CaretRight size={16} className="text-gray-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                      {projectCode}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {projectName}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{relativeTime(event.transaction_time)}</span>
                </div>
              </div>

              {/* Health score & pulse */}
              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    {Math.round(event.health_score)}
                  </div>
                  <div className={`text-xs font-semibold px-2 py-0.5 rounded ${getPulseBadgeClass(event.pulse_condition)}`}>
                    {getPulseLabel(event.pulse_condition)}
                  </div>
                </div>
              </div>
            </button>

            {/* Expanded signal breakdown */}
            {isExp && (
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
                <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Signal Decomposition
                </div>

                {Object.entries(event.signals).map(([signalKey, signalData]) => {
                  const raw = signalData.raw
                  const weight = signalData.weight
                  const isHigh = raw > 0.8

                  return (
                    <div key={signalKey} className="flex flex-col gap-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-semibold text-gray-700">
                          {formatSignalName(signalKey)}
                        </span>
                        <span className={`text-xs font-bold ${isHigh ? 'text-red-600' : 'text-gray-600'}`}>
                          {raw.toFixed(2)} {isHigh && '• HIGH'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded h-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all ${isHigh ? 'bg-red-500' : 'bg-violet-500'}`}
                            style={{ width: `${raw * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500 min-w-[3rem] text-right">
                          Weight: {(weight * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )
                })}

                <div className="text-xs text-gray-600 pt-2 border-t border-gray-200">
                  <span className="font-semibold">Trigger:</span> {event.trigger_source || '—'}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────

export default function AIEngine() {
  const statsQuery = useAIEngineStats()
  const weightsQuery = useModelWeights()
  const eventsQuery = useRecentHealthEvents(20)
  const modelQuery = useModelVersion()

  const stats = statsQuery.data
  const weights = weightsQuery.data ?? []
  const events = eventsQuery.data ?? []
  const model = modelQuery.data

  // Compute histogram data
  const histogramData = useMemo(() => {
    return (eventsQuery.data ?? []).map(e => Number(e.health_score))
  }, [eventsQuery.data])

  const anyLoading = statsQuery.isLoading || weightsQuery.isLoading || modelQuery.isLoading

  if (anyLoading) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] p-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-violet-100 rounded-lg">
              <Brain size={24} className="text-violet-700" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI Engine</h1>
              <p className="text-sm text-gray-600">Loading model data...</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 bg-white border border-gray-200 rounded-xl animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
              <div className="h-7 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f4f6f9] p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-violet-100 rounded-lg">
            <Brain size={24} className="text-violet-700" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AI Engine</h1>
            <p className="text-sm text-gray-600">
              Machine learning model transparency & observability
            </p>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="kpi-grid-rows grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        <KPICard
          icon={<Database size={20} />}
          label="Events"
          value={stats?.totalEvents ?? '—'}
          accent="text-blue-600"
        />
        <KPICard
          icon={<Cpu size={20} />}
          label="Model R²"
          value={stats?.modelAccuracy.toFixed(1) ?? '—'}
          unit="%"
          accent="text-emerald-600"
        />
        <KPICard
          icon={<Gauge size={20} />}
          label="Avg Health"
          value={stats?.avgHealthScore ?? '—'}
          accent="text-amber-600"
        />
        <KPICard
          icon={<Warning size={20} />}
          label="Critical"
          value={stats?.criticalProjects ?? '—'}
          accent="text-red-600"
        />
        <KPICard
          icon={<Atom size={20} />}
          label="Scored"
          value={stats?.totalProjectsScored ?? '—'}
          accent="text-purple-600"
        />
        <KPICard
          icon={<Timer size={20} />}
          label="Last Scored"
          value={relativeTime(stats?.lastScoredAt ?? null)}
          accent="text-gray-600"
        />
      </div>

      {/* Main Content: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left: Model Signal Weights (60%) */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <ChartBar size={18} className="text-violet-600" />
              <h2 className="text-lg font-bold text-gray-900">Model Signal Weights</h2>
            </div>

            {weightsQuery.isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded animate-pulse"></div>
                ))}
              </div>
            ) : weightsQuery.error ? (
              <div className="text-center py-8">
                <Warning size={32} className="mx-auto mb-2 text-red-400" />
                <p className="text-red-600 text-sm">Failed to load model weights</p>
              </div>
            ) : (
              <ModelWeightsChart weights={weights} />
            )}

            {weights.length > 0 && (
              <p className="text-xs text-gray-500 mt-6 pt-6 border-t border-gray-100">
                These weights define how each signal contributes to the overall project risk score.
                Higher weights indicate stronger influence on health assessment.
              </p>
            )}
          </div>
        </div>

        {/* Right: Model Card (40%) */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm h-full">
            <div className="flex items-center gap-2 mb-6">
              <Cpu size={18} className="text-emerald-600" />
              <h2 className="text-lg font-bold text-gray-900">Model Card</h2>
            </div>

            {modelQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-6 bg-gray-100 rounded animate-pulse"></div>
                ))}
              </div>
            ) : modelQuery.error || !model ? (
              <div className="text-center py-6">
                <Warning size={24} className="mx-auto mb-2 text-red-400" />
                <p className="text-red-600 text-xs">No model loaded</p>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-gray-500 uppercase font-semibold">Algorithm</span>
                  <p className="text-gray-900 font-semibold">{model.algorithm}</p>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <span className="text-xs text-gray-500 uppercase font-semibold">Accuracy (R²)</span>
                  <p className="text-gray-900 font-semibold">
                    {(model.r_squared * 100).toFixed(1)}%
                    {model.r_squared_std && (
                      <span className="text-xs text-gray-500"> ±{(model.r_squared_std * 100).toFixed(2)}%</span>
                    )}
                  </p>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <span className="text-xs text-gray-500 uppercase font-semibold">Error Metrics</span>
                  <div className="text-xs text-gray-700 space-y-1 mt-1">
                    <div>RMSE: {model.rmse.toFixed(2)}</div>
                    <div>MAE: {model.mae.toFixed(2)}</div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <span className="text-xs text-gray-500 uppercase font-semibold">Features</span>
                  <p className="text-gray-900 font-semibold">{model.feature_count} total</p>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <span className="text-xs text-gray-500 uppercase font-semibold">Training</span>
                  <p className="text-gray-900 font-semibold">{model.training_rows} rows</p>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <span className="text-xs text-gray-500 uppercase font-semibold">Status</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="text-emerald-700 font-semibold text-xs">Production</span>
                  </div>
                </div>

                {model.version_tag && (
                  <div className="border-t border-gray-100 pt-3">
                    <span className="text-xs text-gray-500 uppercase font-semibold">Version</span>
                    <p className="text-gray-900 font-mono text-xs">{model.version_tag}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Health Score Distribution */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-8">
        <div className="flex items-center gap-2 mb-6">
          <TrendUp size={18} className="text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">Health Score Distribution</h2>
        </div>

        {eventsQuery.isLoading ? (
          <div className="h-32 bg-gray-100 rounded animate-pulse"></div>
        ) : histogramData.length === 0 ? (
          <div className="text-center py-8">
            <Gauge size={32} className="mx-auto mb-2 text-gray-400" />
            <p className="text-gray-500 text-sm">No health score data available</p>
          </div>
        ) : (
          <HealthScoreHistogram data={histogramData} />
        )}

        <p className="text-xs text-gray-500 mt-6 pt-6 border-t border-gray-100">
          Shows the distribution of health scores across all {stats?.totalProjectsScored ?? 0} scored projects.
        </p>
      </div>

      {/* Recent Scoring Events */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Lightning size={18} className="text-amber-600" />
          <h2 className="text-lg font-bold text-gray-900">Recent Scoring Events</h2>
        </div>

        {eventsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
            ))}
          </div>
        ) : eventsQuery.error ? (
          <div className="text-center py-8">
            <Warning size={32} className="mx-auto mb-2 text-red-400" />
            <p className="text-red-600 text-sm">Failed to load scoring events</p>
          </div>
        ) : (
          <RecentEventsList events={events} />
        )}

        {events.length > 0 && (
          <p className="text-xs text-gray-500 mt-6 pt-6 border-t border-gray-100">
            Showing the {Math.min(events.length, 20)} most recent scoring events. Click an event to see signal breakdown.
          </p>
        )}
      </div>
    </div>
  )
}
