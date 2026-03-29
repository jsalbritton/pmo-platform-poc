import React, { useState, useEffect, useCallback, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'

// ── Supabase Client ─────────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('[PMO Platform] Missing required env vars: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY. Check .env.local or CI secrets.')
}
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Shared Utilities ─────────────────────────────────────────────────────────
function cn(...classes) { return classes.filter(Boolean).join(' ') }

function HealthBadge({ status }) {
  const map = {
    green:    'bg-green-100 text-green-800',
    amber:    'bg-yellow-100 text-yellow-800',
    red:      'bg-red-100 text-red-800',
    critical: 'bg-red-200 text-red-900 font-bold',
  }
  return (
    <span className={cn('px-2 py-1 rounded-full text-xs font-semibold', map[status] || map.amber)}>
      {(status || 'amber').charAt(0).toUpperCase() + (status || 'amber').slice(1)}
    </span>
  )
}

function RiskBadge({ score }) {
  const n = score || 0
  const cls = n <= 25 ? 'bg-green-100 text-green-800' :
              n <= 50 ? 'bg-yellow-100 text-yellow-800' :
              n <= 75 ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
  return <span className={cn('px-3 py-1 rounded-full text-sm font-semibold', cls)}>{n.toFixed(1)}</span>
}

function StatusPill({ status, mini }) {
  const map = {
    active:    'bg-blue-100 text-blue-800',
    planned:   'bg-gray-100 text-gray-700',
    completed: 'bg-green-100 text-green-800',
    archived:  'bg-gray-100 text-gray-500',
    backlog:   'bg-slate-100 text-slate-700',
    in_progress: 'bg-blue-100 text-blue-800',
    done:      'bg-green-100 text-green-800',
    blocked:   'bg-red-100 text-red-800',
    critical:  'bg-red-100 text-red-800',
    high:      'bg-orange-100 text-orange-800',
    medium:    'bg-yellow-100 text-yellow-700',
    low:       'bg-gray-100 text-gray-600',
  }
  const label = (status || '').replace(/_/g, ' ')
  return (
    <span className={cn('rounded text-xs font-semibold', mini ? 'px-1.5 py-0.5' : 'px-2 py-1', map[status] || 'bg-gray-100 text-gray-700')}>
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </span>
  )
}

function Spinner() {
  return <div className="p-12 text-center text-gray-400 text-sm">Loading...</div>
}

function KPICard({ title, value, icon, sub, color = 'blue' }) {
  const colors = { blue: 'text-blue-600', green: 'text-green-600', red: 'text-red-500', amber: 'text-amber-500', slate: 'text-slate-600' }
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">{title}</p>
          <p className={cn('text-3xl font-bold', colors[color])}>{value}</p>
          {sub && <p className="text-gray-400 text-xs mt-1">{sub}</p>}
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  )
}

// ── Burn-Down Chart (pure SVG) ────────────────────────────────────────────────
function BurnDownChart({ burndown, committed, sprintName }) {
  if (!burndown || burndown.length === 0) {
    return <div className="h-48 flex items-center justify-center text-gray-400 text-sm bg-gray-50 rounded-lg">No burn-down data</div>
  }

  const W = 520, H = 240
  const PAD = { top: 16, right: 20, bottom: 40, left: 50 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom
  const days = burndown.length
  const maxPts = committed || Math.max(...burndown.map(d => d.remaining))

  const xScale = (day) => PAD.left + ((day - 1) / Math.max(days - 1, 1)) * chartW
  const yScale = (pts) => PAD.top + chartH - (pts / maxPts) * chartH

  // Ideal line
  const idealStart = { x: xScale(1), y: yScale(maxPts) }
  const idealEnd   = { x: xScale(days), y: yScale(0) }

  // Actual polyline
  const actualPts = burndown.map((d, i) => `${xScale(i + 1)},${yScale(d.remaining)}`).join(' ')

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ pts: Math.round(maxPts * t), y: yScale(Math.round(maxPts * t)) }))

  // X-axis ticks — show every other day if many days
  const xTicks = burndown.filter((_, i) => days <= 12 || i % 2 === 0).map((d, i) => ({
    label: `D${burndown.indexOf(d) + 1}`,
    x: xScale(burndown.indexOf(d) + 1)
  }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 240 }}>
      {/* Grid lines */}
      {yTicks.map(t => (
        <g key={t.pts}>
          <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} stroke="#f0f0f0" strokeWidth="1" />
          <text x={PAD.left - 8} y={t.y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{t.pts}</text>
        </g>
      ))}

      {/* Ideal line */}
      <line x1={idealStart.x} y1={idealStart.y} x2={idealEnd.x} y2={idealEnd.y}
        stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6,4" />

      {/* Actual line */}
      <polyline points={actualPts} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" />

      {/* Actual dots */}
      {burndown.map((d, i) => (
        <circle key={i} cx={xScale(i + 1)} cy={yScale(d.remaining)} r="3.5" fill="#3b82f6" />
      ))}

      {/* Axes */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="#e5e7eb" strokeWidth="1" />
      <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="#e5e7eb" strokeWidth="1" />

      {/* X labels */}
      {xTicks.map((t, i) => (
        <text key={i} x={t.x} y={H - PAD.bottom + 14} textAnchor="middle" fontSize="10" fill="#9ca3af">{t.label}</text>
      ))}

      {/* Legend */}
      <line x1={W - 130} y1={14} x2={W - 112} y2={14} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,3" />
      <text x={W - 108} y={18} fontSize="10" fill="#94a3b8">Ideal</text>
      <line x1={W - 70} y1={14} x2={W - 52} y2={14} stroke="#3b82f6" strokeWidth="2.5" />
      <text x={W - 48} y={18} fontSize="10" fill="#3b82f6">Actual</text>
    </svg>
  )
}

// ── Velocity Chart (pure SVG bars) ────────────────────────────────────────────
function VelocityChart({ sprints }) {
  if (!sprints || sprints.length === 0) {
    return <div className="h-40 flex items-center justify-center text-gray-400 text-sm bg-gray-50 rounded-lg">No velocity data</div>
  }

  const W = 520, H = 180
  const PAD = { top: 16, right: 20, bottom: 36, left: 46 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const maxV = Math.max(...sprints.map(s => s.committed_pts || 0), 1)
  const avg = sprints.reduce((a, s) => a + (s.completed_pts || 0), 0) / sprints.length
  const barW = Math.min(chartW / sprints.length - 4, 36)
  const gap = chartW / sprints.length

  const yScale = (v) => PAD.top + chartH - (v / maxV) * chartH
  const avgY = yScale(avg)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 180 }}>
      {/* Grid */}
      {[0, 0.5, 1].map(t => {
        const y = yScale(maxV * t)
        return <g key={t}>
          <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#f0f0f0" strokeWidth="1" />
          <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{Math.round(maxV * t)}</text>
        </g>
      })}

      {/* Bars */}
      {sprints.map((s, i) => {
        const cx = PAD.left + gap * i + gap / 2
        const committed = s.committed_pts || 0
        const completed = s.completed_pts || 0
        const committedH = (committed / maxV) * chartH
        const completedH = (completed / maxV) * chartH
        return (
          <g key={i}>
            <rect x={cx - barW / 2 - 2} y={yScale(committed)} width={barW / 2} height={committedH}
              fill="#e0e7ff" rx="2" />
            <rect x={cx + 2} y={yScale(completed)} width={barW / 2} height={completedH}
              fill="#6366f1" rx="2" />
            <text x={cx} y={H - PAD.bottom + 14} textAnchor="middle" fontSize="9" fill="#9ca3af">
              {`S${s.sprint_number}`}
            </text>
          </g>
        )
      })}

      {/* Avg velocity line */}
      <line x1={PAD.left} y1={avgY} x2={W - PAD.right} y2={avgY}
        stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5,4" />
      <text x={W - PAD.right + 4} y={avgY + 4} fontSize="10" fill="#f59e0b">Avg</text>

      {/* Axes */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="#e5e7eb" />
      <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="#e5e7eb" />

      {/* Legend */}
      <rect x={PAD.left} y={4} width={10} height={8} fill="#e0e7ff" rx="1" />
      <text x={PAD.left + 13} y={12} fontSize="10" fill="#6b7280">Committed</text>
      <rect x={PAD.left + 75} y={4} width={10} height={8} fill="#6366f1" rx="1" />
      <text x={PAD.left + 88} y={12} fontSize="10" fill="#6b7280">Completed</text>
    </svg>
  )
}

// ── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error: err } = await db.auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false); return }
    if (data.user) onLogin(data.user)
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
            <span className="text-white text-xl font-bold">P</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">PMO Platform</h1>
          <p className="text-gray-500 text-sm mt-1">Global IT · Transportation &amp; W&amp;D</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="you@company.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="••••••••" />
          </div>
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-lg transition text-sm">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── DASHBOARD VIEW ───────────────────────────────────────────────────────────
function DashboardView() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ count: total }, { count: active }, { count: atRisk }, { count: team }, { data: projects }, { data: risks }] = await Promise.all([
        db.from('projects').select('*', { count: 'exact', head: true }),
        db.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        db.from('projects').select('*', { count: 'exact', head: true }).in('health_status', ['red', 'critical']),
        db.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
        db.from('projects').select('id,name,status,health_status,risk_score,priority').order('risk_score', { ascending: false }).limit(20),
        db.from('risks').select('severity').eq('status', 'open'),
      ])
      const dist = { green: 0, amber: 0, red: 0, critical: 0 }
      ;(projects || []).forEach(p => { const s = p.health_status || 'amber'; if (s in dist) dist[s]++ })
      const openRisks = (risks || []).filter(r => r.severity === 'high' || r.severity === 'critical').length
      setData({ total, active, atRisk, team, dist, projects: projects || [], openRisks })
      setLoading(false)
    }
    load()
  }, [])

  if (loading || !data) return <Spinner />

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Projects" value={data.total} icon="📊" color="slate" />
        <KPICard title="Active Projects" value={data.active} icon="⚡" color="blue" />
        <KPICard title="At Risk / Critical" value={data.atRisk} icon="🚨" color="red" />
        <KPICard title="Team Members" value={data.team} icon="👥" color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Health Distribution</h3>
          <div className="space-y-3">
            {[
              { label: 'Healthy', key: 'green', color: 'bg-green-500' },
              { label: 'At Risk', key: 'amber', color: 'bg-yellow-400' },
              { label: 'Critical', key: 'red', color: 'bg-red-500' },
              { label: 'Severe', key: 'critical', color: 'bg-red-800' },
            ].map(({ label, key, color }) => {
              const count = data.dist[key]
              const pct = data.total > 0 ? Math.round((count / data.total) * 100) : 0
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 font-medium">{label}</span>
                    <span className="text-gray-900 font-bold">{count} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', color)} style={{ width: pct + '%' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Open High Risks</h3>
          <div className="flex items-center justify-center h-24">
            <div className="text-center">
              <div className={cn('text-5xl font-bold', data.openRisks > 5 ? 'text-red-500' : data.openRisks > 2 ? 'text-amber-500' : 'text-green-500')}>
                {data.openRisks}
              </div>
              <div className="text-gray-400 text-xs mt-2">High/Critical severity</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Portfolio Status</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Total Projects</span><span className="font-semibold">{data.total}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Active</span><span className="font-semibold text-blue-600">{data.active}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Needs Attention</span><span className="font-semibold text-red-500">{data.atRisk}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Team Members</span><span className="font-semibold">{data.team}</span></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Top Risk Projects</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Project', 'Status', 'Priority', 'Health', 'Risk Score'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.projects.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-5 py-3"><StatusPill status={p.status} /></td>
                  <td className="px-5 py-3"><StatusPill status={p.priority} /></td>
                  <td className="px-5 py-3"><HealthBadge status={p.health_status} /></td>
                  <td className="px-5 py-3"><RiskBadge score={p.risk_score} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── SPRINTS VIEW ─────────────────────────────────────────────────────────────
function SprintsView() {
  const [sprints, setSprints] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    async function load() {
      const { data } = await db
        .from('sprints')
        .select(`
          id, name, sprint_number, status, start_date, end_date,
          committed_pts, completed_pts, velocity, goal,
          project_id,
          projects!sprints_project_id_fkey(name, health_status)
        `)
        .order('start_date', { ascending: false })
        .limit(80)
      setSprints(data || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <Spinner />

  if (selected) return <SprintDetail sprint={selected} onBack={() => setSelected(null)} />

  const filtered = filter === 'all' ? sprints : sprints.filter(s => s.status === filter)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        {['all', 'active', 'planned', 'completed'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('px-4 py-1.5 rounded-full text-sm font-medium transition',
              filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300')}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} sprints</span>
      </div>

      <div className="grid gap-3">
        {filtered.map(s => {
          const pct = s.committed_pts > 0 ? Math.round((s.completed_pts / s.committed_pts) * 100) : 0
          const barColor = pct >= 90 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : pct >= 30 ? 'bg-amber-400' : 'bg-red-400'
          const days = s.end_date ? Math.ceil((new Date(s.end_date) - new Date()) / 86400000) : null
          return (
            <div key={s.id}
              onClick={() => setSelected(s)}
              className="bg-white rounded-xl border border-gray-100 p-5 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-900">{s.name}</span>
                    <span className="text-gray-400 text-xs">#{s.sprint_number}</span>
                    <StatusPill status={s.status} mini />
                  </div>
                  <p className="text-xs text-gray-500 truncate mb-3">{s.projects?.name || '—'}</p>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: pct + '%' }} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0 space-y-1">
                  <div className="text-lg font-bold text-gray-900">{pct}%</div>
                  <div className="text-xs text-gray-400">{s.completed_pts || 0} / {s.committed_pts || 0} pts</div>
                  {s.status === 'active' && days !== null && (
                    <div className={cn('text-xs font-medium', days < 0 ? 'text-red-500' : days < 3 ? 'text-amber-500' : 'text-gray-400')}>
                      {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                    </div>
                  )}
                </div>
              </div>
              {s.goal && <p className="text-xs text-gray-400 mt-3 border-t border-gray-50 pt-3 line-clamp-1">{s.goal}</p>}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400 text-sm">No {filter === 'all' ? '' : filter} sprints found.</div>
        )}
      </div>
    </div>
  )
}

// ── SPRINT DETAIL ─────────────────────────────────────────────────────────────
function SprintDetail({ sprint, onBack }) {
  const [metrics, setMetrics] = useState(null)
  const [workItems, setWorkItems] = useState([])
  const [velocityData, setVelocityData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: m }, { data: wi }, { data: vel }] = await Promise.all([
        db.from('sprint_metrics').select('*').eq('sprint_id', sprint.id).limit(1).single(),
        db.from('work_items').select('id,title,status,story_points,priority,assignee_id').eq('sprint_id', sprint.id).order('status'),
        db.from('sprints').select('sprint_number,committed_pts,completed_pts').eq('project_id', sprint.project_id).order('sprint_number').limit(12),
      ])
      setMetrics(m)
      setWorkItems(wi || [])
      setVelocityData(vel || [])
      setLoading(false)
    }
    load()
  }, [sprint.id, sprint.project_id])

  const statusGroups = { done: [], in_progress: [], blocked: [], backlog: [] }
  workItems.forEach(wi => {
    const k = wi.status in statusGroups ? wi.status : 'backlog'
    statusGroups[k].push(wi)
  })

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
        ← Back to Sprints
      </button>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{sprint.name} <span className="text-gray-400 font-normal text-base">#{sprint.sprint_number}</span></h2>
            <p className="text-gray-500 text-sm mt-0.5">{sprint.start_date} → {sprint.end_date}</p>
            {sprint.goal && <p className="text-gray-600 text-sm mt-2 max-w-xl">{sprint.goal}</p>}
          </div>
          <StatusPill status={sprint.status} />
        </div>
        <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-gray-50">
          <div className="text-center"><div className="text-2xl font-bold text-gray-900">{sprint.committed_pts || 0}</div><div className="text-xs text-gray-400">Committed</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-green-600">{sprint.completed_pts || 0}</div><div className="text-xs text-gray-400">Completed</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-blue-600">{sprint.velocity ? Number(sprint.velocity).toFixed(1) : '—'}</div><div className="text-xs text-gray-400">Velocity</div></div>
        </div>
      </div>

      {loading ? <Spinner /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Burn-Down Chart</h3>
            <BurnDownChart burndown={metrics?.burndown} committed={sprint.committed_pts} sprintName={sprint.name} />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Velocity Trend — This Project</h3>
            <VelocityChart sprints={velocityData} />
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Work Items ({workItems.length})</h3>
        </div>
        {['in_progress', 'blocked', 'backlog', 'done'].map(status => {
          const items = statusGroups[status]
          if (!items.length) return null
          return (
            <div key={status} className="border-b border-gray-50 last:border-0">
              <div className="px-5 py-2 bg-gray-50">
                <StatusPill status={status} mini /> <span className="text-xs text-gray-500 ml-2">{items.length}</span>
              </div>
              {items.map(wi => (
                <div key={wi.id} className="px-5 py-2.5 flex items-center justify-between hover:bg-gray-50 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-800">{wi.title}</span>
                  <div className="flex items-center gap-2">
                    <StatusPill status={wi.priority} mini />
                    {wi.story_points && <span className="text-xs text-gray-400">{wi.story_points}pt</span>}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
        {workItems.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No work items in this sprint.</div>}
      </div>
    </div>
  )
}

// ── BACKLOG VIEW ─────────────────────────────────────────────────────────────
function BacklogView() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')

  useEffect(() => {
    async function load() {
      const { data } = await db
        .from('work_items')
        .select('id,title,description,status,priority,story_points,project_id,created_at,projects!work_items_project_id_fkey(name)')
        .in('status', ['backlog'])
        .order('priority')
        .limit(200)
      setItems(data || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <Spinner />

  const filtered = items.filter(i => {
    const matchSearch = !search || i.title.toLowerCase().includes(search.toLowerCase())
    const matchPriority = priorityFilter === 'all' || i.priority === priorityFilter
    return matchSearch && matchPriority
  })

  const total = filtered.reduce((a, i) => a + (i.story_points || 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search backlog…"
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-56" />
        {['all', 'critical', 'high', 'medium', 'low'].map(p => (
          <button key={p} onClick={() => setPriorityFilter(p)}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition',
              priorityFilter === p ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300')}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} items · {total} story pts</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Title', 'Project', 'Priority', 'Pts', 'Created'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(i => (
              <tr key={i.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-medium text-gray-900 max-w-xs">
                  <div className="truncate">{i.title}</div>
                  {i.description && <div className="text-xs text-gray-400 truncate mt-0.5">{i.description}</div>}
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">{i.projects?.name || '—'}</td>
                <td className="px-5 py-3"><StatusPill status={i.priority} mini /></td>
                <td className="px-5 py-3 text-gray-500">{i.story_points || '—'}</td>
                <td className="px-5 py-3 text-gray-400 text-xs">{i.created_at ? new Date(i.created_at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">No backlog items match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── CAPACITY HEATMAP VIEW ─────────────────────────────────────────────────────
function CapacityView() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const today = new Date()
      const fiveWeeks = new Date(today); fiveWeeks.setDate(today.getDate() + 35)

      const { data: allocs } = await db
        .from('allocations')
        .select(`
          user_id, project_id, allocation_pct, start_date, end_date, role_on_project,
          profiles!allocations_user_id_fkey(full_name, department, title),
          projects!allocations_project_id_fkey(name)
        `)
        .eq('is_active', true)
        .lte('start_date', fiveWeeks.toISOString().split('T')[0])

      // Build week buckets: current week + 4 ahead
      const weeks = Array.from({ length: 5 }, (_, i) => {
        const d = new Date(today); d.setDate(today.getDate() + i * 7)
        const end = new Date(d); end.setDate(d.getDate() + 6)
        return {
          label: `Wk ${i === 0 ? 'Now' : '+' + i}`,
          start: d.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
        }
      })

      // Group by user, sum allocation_pct per week
      const byUser = {}
      ;(allocs || []).forEach(a => {
        const key = a.user_id
        if (!byUser[key]) byUser[key] = { profile: a.profiles, weeks: {}, projects: [] }
        if (a.projects?.name && !byUser[key].projects.includes(a.projects.name)) {
          byUser[key].projects.push(a.projects.name)
        }
        weeks.forEach(w => {
          const allocStart = a.start_date || '1970-01-01'
          const allocEnd = a.end_date || '2099-12-31'
          if (allocStart <= w.end && allocEnd >= w.start) {
            byUser[key].weeks[w.label] = (byUser[key].weeks[w.label] || 0) + Number(a.allocation_pct)
          }
        })
      })

      setData({ users: Object.entries(byUser).slice(0, 30), weeks })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <Spinner />

  const cellColor = (pct) => {
    if (!pct) return 'bg-gray-50 text-gray-300'
    if (pct > 100) return 'bg-red-100 text-red-700 font-bold'
    if (pct > 80) return 'bg-amber-100 text-amber-700 font-semibold'
    return 'bg-green-50 text-green-700'
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 inline-block" /> Under 80%</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 inline-block" /> 80–100%</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 inline-block" /> Over 100% (conflict)</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-50">Team Member</th>
              {data.weeks?.map(w => (
                <th key={w.label} className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{w.label}</th>
              ))}
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Projects</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.users?.map(([uid, u]) => (
              <tr key={uid} className="hover:bg-gray-50">
                <td className="px-5 py-3 sticky left-0 bg-white">
                  <div className="font-medium text-gray-900 text-sm">{u.profile?.full_name || 'Unknown'}</div>
                  <div className="text-xs text-gray-400">{u.profile?.title || u.profile?.department || ''}</div>
                </td>
                {data.weeks?.map(w => {
                  const pct = u.weeks[w.label] || 0
                  return (
                    <td key={w.label} className="px-4 py-3 text-center">
                      {pct > 0 ? (
                        <span className={cn('inline-block px-2 py-1 rounded text-xs', cellColor(pct))}>
                          {Math.round(pct)}%
                        </span>
                      ) : <span className="text-gray-200">—</span>}
                    </td>
                  )
                })}
                <td className="px-5 py-3">
                  <div className="text-xs text-gray-400 truncate max-w-xs">{u.projects.slice(0, 3).join(', ')}{u.projects.length > 3 ? ` +${u.projects.length - 3}` : ''}</div>
                </td>
              </tr>
            ))}
            {(!data.users || data.users.length === 0) && (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">No active allocations found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── STANDUP VIEW ─────────────────────────────────────────────────────────────
function StandupView() {
  const [projects, setProjects] = useState([])
  const [risks, setRisks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: r }] = await Promise.all([
        db.from('projects').select('id,name,health_status,risk_score,status').eq('status', 'active').order('health_status').limit(25),
        db.from('risks').select('id,title,severity,status,project_id,projects!risks_project_id_fkey(name)').in('status', ['open','monitoring']).in('severity', ['critical','high']).order('severity').limit(20),
      ])
      setProjects(p || [])
      setRisks(r || [])
      setLoading(false)
    }

    load()

    // Live subscription for real-time updates
    const sub = db.channel('standup_projects')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => load())
      .subscribe()

    return () => sub.unsubscribe()
  }, [])

  if (loading) return <Spinner />

  const now = new Date()
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-5">
      <div className="bg-slate-900 rounded-xl p-5 text-white flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Live Standup Dashboard</div>
          <div className="text-xl font-bold">Daily Stand-Up · Active Projects</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono font-bold">{timeStr}</div>
          <div className="text-slate-400 text-xs">{now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Active Projects', val: projects.length, icon: '📋', color: 'text-blue-600' },
          { label: 'Healthy', val: projects.filter(p => p.health_status === 'green').length, icon: '✅', color: 'text-green-600' },
          { label: 'At Risk', val: projects.filter(p => ['amber','red'].includes(p.health_status)).length, icon: '⚠️', color: 'text-amber-500' },
          { label: 'Open High Risks', val: risks.length, icon: '🚨', color: 'text-red-500' },
        ].map(({ label, val, icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <div className="text-2xl mb-1">{icon}</div>
            <div className={cn('text-2xl font-bold', color)}>{val}</div>
            <div className="text-xs text-gray-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Project Health</h3>
            <span className="text-xs text-green-500 font-medium">● Live</span>
          </div>
          <div className="divide-y divide-gray-50">
            {projects.map(p => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                <span className="text-sm font-medium text-gray-800 truncate flex-1 mr-4">{p.name}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <RiskBadge score={p.risk_score} />
                  <HealthBadge status={p.health_status} />
                </div>
              </div>
            ))}
            {projects.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No active projects.</div>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Open Blockers &amp; High Risks</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {risks.map(r => (
              <div key={r.id} className="px-5 py-3 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm text-gray-800">{r.title}</span>
                  <StatusPill status={r.severity} mini />
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{r.projects?.name || '—'}</div>
              </div>
            ))}
            {risks.length === 0 && <div className="p-8 text-center text-green-500 text-sm font-medium">✓ No high-severity open risks</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── PROJECTS VIEW ─────────────────────────────────────────────────────────────
function ProjectsView() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ by: 'risk_score', desc: true })

  useEffect(() => {
    async function load() {
      const { data } = await db
        .from('projects')
        .select('id,name,status,priority,health_status,risk_score,budget_total,budget_spent')
        .order(sort.by, { ascending: !sort.desc })
      setProjects(data || [])
      setLoading(false)
    }
    load()
  }, [sort])

  if (loading) return <Spinner />

  const filtered = search ? projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase())) : projects

  const toggleSort = (col) => {
    setSort(s => s.by === col ? { ...s, desc: !s.desc } : { by: col, desc: true })
  }

  const SortTh = ({ col, children }) => (
    <th onClick={() => toggleSort(col)}
      className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 select-none">
      {children} {sort.by === col ? (sort.desc ? '↓' : '↑') : ''}
    </th>
  )

  return (
    <div className="space-y-5">
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search projects…"
        className="w-full max-w-sm px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <SortTh col="name">Name</SortTh>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Priority</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Health</th>
                <SortTh col="risk_score">Risk</SortTh>
                <SortTh col="budget_total">Budget Total</SortTh>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Spent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => {
                const burnPct = p.budget_total > 0 ? Math.round((p.budget_spent / p.budget_total) * 100) : 0
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-5 py-3"><StatusPill status={p.status} mini /></td>
                    <td className="px-5 py-3"><StatusPill status={p.priority} mini /></td>
                    <td className="px-5 py-3"><HealthBadge status={p.health_status} /></td>
                    <td className="px-5 py-3"><RiskBadge score={p.risk_score} /></td>
                    <td className="px-5 py-3 text-gray-600">${(p.budget_total || 0).toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <div className="text-gray-600">${(p.budget_spent || 0).toLocaleString()}</div>
                      <div className={cn('text-xs mt-0.5', burnPct > 90 ? 'text-red-500' : burnPct > 70 ? 'text-amber-500' : 'text-gray-400')}>
                        {burnPct}% used
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">No projects found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── ML RISK VIEW ─────────────────────────────────────────────────────────────
function MLRiskView() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  const signals = [
    { label: 'Work Item Health', weight: 36.7 },
    { label: 'Schedule Pressure', weight: 15.3 },
    { label: 'Velocity Trend', weight: 15.2 },
    { label: 'Scope Volatility', weight: 14.6 },
    { label: 'Budget Burn Rate', weight: 9.5 },
    { label: 'Open Risk Exposure', weight: 8.6 },
  ]

  useEffect(() => {
    db.from('projects').select('id,name,risk_score,health_status,scored_at').order('risk_score', { ascending: false })
      .then(({ data }) => { setProjects(data || []); setLoading(false) })
  }, [])

  if (loading) return <Spinner />

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
        <h3 className="text-sm font-bold text-blue-900 mb-1">ML Risk Scoring Engine</h3>
        <p className="text-blue-700 text-sm">Risk scores computed by a PostgreSQL-native ML engine across 6 signal dimensions. Work item health (36.7%) is the dominant predictor.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Signal Weights</h3>
          <div className="space-y-3">
            {signals.map(s => (
              <div key={s.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-700 font-medium">{s.label}</span>
                  <span className="text-gray-900 font-bold">{s.weight}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: s.weight + '%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Score Distribution</h3>
          </div>
          <div className="p-5 space-y-2">
            {[
              { label: '0–25 Low', filter: p => p.risk_score <= 25, color: 'bg-green-500' },
              { label: '26–50 Moderate', filter: p => p.risk_score > 25 && p.risk_score <= 50, color: 'bg-yellow-400' },
              { label: '51–75 High', filter: p => p.risk_score > 50 && p.risk_score <= 75, color: 'bg-orange-400' },
              { label: '76–100 Critical', filter: p => p.risk_score > 75, color: 'bg-red-500' },
            ].map(({ label, filter, color }) => {
              const count = projects.filter(filter).length
              const pct = projects.length > 0 ? Math.round((count / projects.length) * 100) : 0
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-semibold">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', color)} style={{ width: pct + '%' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">All Scored Projects</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Project', 'Risk Score', 'Health', 'Scored At'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {projects.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-5 py-3"><RiskBadge score={p.risk_score} /></td>
                  <td className="px-5 py-3"><HealthBadge status={p.health_status} /></td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{p.scored_at ? new Date(p.scored_at).toLocaleDateString() : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── ACTIVITY VIEW ─────────────────────────────────────────────────────────────
function ActivityView() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    db.from('activity_log').select('id,action,entity_type,created_at').order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => { setActivities(data || []); setLoading(false) })
  }, [])

  if (loading) return <Spinner />

  const rel = (d) => {
    const s = Math.floor((Date.now() - new Date(d)) / 1000)
    if (s < 60) return 'just now'
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`
    return new Date(d).toLocaleDateString()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Recent Activity ({activities.length})</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {activities.map(a => (
          <div key={a.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
            <div>
              <span className="text-sm text-gray-800 font-medium">{a.action}</span>
              <span className="text-gray-400 text-xs ml-2">({a.entity_type})</span>
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">{rel(a.created_at)}</span>
          </div>
        ))}
        {activities.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No activity recorded yet.</div>}
      </div>
    </div>
  )
}

// ── SIDEBAR ───────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'dashboard', label: 'Dashboard',  icon: '📊' },
  { id: 'sprints',   label: 'Sprints',    icon: '🏃' },
  { id: 'backlog',   label: 'Backlog',    icon: '📥' },
  { id: 'standup',   label: 'Standup',    icon: '🎯' },
  { id: 'capacity',  label: 'Capacity',   icon: '👥' },
  { id: 'projects',  label: 'Projects',   icon: '📁' },
  { id: 'ml',        label: 'ML Risk',    icon: '⚡' },
  { id: 'activity',  label: 'Activity',   icon: '📋' },
]

function Sidebar({ active, onNav, onSignOut }) {
  return (
    <div className="w-56 bg-slate-900 text-white flex flex-col h-full flex-shrink-0">
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">P</div>
          <div>
            <div className="font-bold text-sm leading-tight">PMO Platform</div>
            <div className="text-slate-400 text-xs">Global IT</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(item => (
          <button key={item.id} onClick={() => onNav(item.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition',
              active === item.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            )}>
            <span className="text-base">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-slate-700">
        <button onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg text-sm transition">
          <span>🔒</span><span className="font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  )
}

// ── PAGE TITLES ───────────────────────────────────────────────────────────────
const PAGE_TITLES = {
  dashboard: 'Portfolio Dashboard',
  sprints:   'Sprint Management',
  backlog:   'Global Backlog',
  standup:   'Live Standup',
  capacity:  'Resource Capacity',
  projects:  'Projects',
  ml:        'ML Risk Scores',
  activity:  'Activity Log',
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('dashboard')

  useEffect(() => {
    db.auth.getUser().then(({ data }) => {
      setUser(data?.user || null)
      setLoading(false)
    })
    const { data: sub } = db.auth.onAuthStateChange((_, session) => setUser(session?.user || null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const signOut = useCallback(async () => {
    await db.auth.signOut()
    setUser(null)
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-lg font-medium">Loading…</div>
    </div>
  )

  if (!user) return <LoginScreen onLogin={setUser} />

  const VIEW_COMPONENTS = {
    dashboard: <DashboardView />,
    sprints:   <SprintsView />,
    backlog:   <BacklogView />,
    standup:   <StandupView />,
    capacity:  <CapacityView />,
    projects:  <ProjectsView />,
    ml:        <MLRiskView />,
    activity:  <ActivityView />,
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar active={view} onNav={setView} onSignOut={signOut} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{PAGE_TITLES[view]}</h1>
            <p className="text-xs text-gray-400">PMO Platform · Global IT · Transportation &amp; W&amp;D</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{user.email}</span>
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {(user.email || 'U')[0].toUpperCase()}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-8">
          {VIEW_COMPONENTS[view] || <DashboardView />}
        </main>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
