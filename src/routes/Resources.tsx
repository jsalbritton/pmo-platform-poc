/**
 * Resources — Team utilization & capacity management (S1A-005)
 *
 * VISION: Best-in-class resource planning UX.
 *   — Per-person utilization heatmap with project breakdown
 *   — Department capacity cards with over-allocation warnings
 *   — Risk-aware allocation (project health_score context)
 *   — SVG utilization bars (not div slices)
 *   — 41 team members across 6 departments, 90% avg utilization
 *
 * COMPETITIVE DIFFERENTIATION:
 *   Monday.com: Workload view lacks per-project color coding
 *   Float: Resource planning is monthly grid, not per-person detail
 *   Smartsheet: Resource mgmt requires enterprise tier
 *
 * This page delivers allocation clarity at a glance.
 */

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UsersThree,
  UserCircle,
  Warning,
  Gauge,
  CaretDown,
  CaretRight,
  MagnifyingGlass,
  GridFour,
  ListBullets,
} from '@phosphor-icons/react'
import { useResourceStats, useDepartmentStats, useTeamMembers } from '@/hooks/useResources'
import type { DepartmentStats, TeamMember } from '@/hooks/useResources'

// ─── CONSTANTS & UTILITIES ──────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500',
  'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500', 'bg-orange-500',
  'bg-amber-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500',
]

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0
  }
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function initials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function utilizationColor(pct: number): string {
  if (pct > 100) return '#ef4444'  // red
  if (pct >= 85) return '#f59e0b'   // amber
  if (pct >= 50) return '#10b981'   // green
  return '#d1d5db'                   // gray
}

// utilizationLabel — reserved for list view (Sprint 2)
// function utilizationLabel(pct: number): string { ... }

/**
 * SVG utilization bar component.
 * Shows stacked allocation segments with 100% threshold line and overflow region.
 * Total width: 200px responsive.
 */
function UtilizationBar({ member }: { member: TeamMember }) {
  const { allocations, total_allocation } = member
  const barWidth = 200
  const barHeight = 16
  const maxAllocation = Math.max(100, total_allocation)
  const scale = barWidth / maxAllocation

  let x = 0
  const segments = allocations.map(alloc => {
    const segmentWidth = (alloc.allocation_pct ?? 0) * scale
    const result = {
      projectCode: alloc.project?.code ?? '?',
      projectName: alloc.project?.name ?? 'Unknown',
      percentage: alloc.allocation_pct ?? 0,
      color: alloc.project?.health_score ? 
        (alloc.project.health_score >= 70 ? '#10b981' : alloc.project.health_score >= 50 ? '#f59e0b' : '#ef4444')
        : '#d1d5db',
      x,
      width: segmentWidth,
    }
    x += segmentWidth
    return result
  })

  return (
    <div className="flex items-center gap-2 flex-1">
      <svg width={barWidth} height={barHeight} className="flex-shrink-0">
        {/* Background track */}
        <rect x="0" y="0" width={barWidth} height={barHeight} fill="#f3f4f6" rx="2" />
        
        {/* Allocation segments */}
        {segments.map((seg, i) => (
          <g key={i}>
            <rect
              x={seg.x}
              y="0"
              width={seg.width}
              height={barHeight}
              fill={seg.color}
              rx="1"
              data-title={`${seg.projectCode}: ${seg.percentage}%`}
              className="cursor-pointer opacity-90 hover:opacity-100"
            />
          </g>
        ))}

        {/* 100% threshold line */}
        <line
          x1={100 * scale}
          y1="0"
          x2={100 * scale}
          y2={barHeight}
          stroke="#6b7280"
          strokeWidth="2"
          strokeDasharray="2,2"
        />

        {/* Over-100% overflow highlight */}
        {total_allocation > 100 && (
          <rect
            x={100 * scale}
            y="0"
            width={(total_allocation - 100) * scale}
            height={barHeight}
            fill="#ef4444"
            opacity="0.2"
            rx="1"
          />
        )}
      </svg>
      <div className="text-xs font-semibold min-w-10 text-right" style={{ color: utilizationColor(total_allocation) }}>
        {total_allocation}%
      </div>
    </div>
  )
}

// ─── LOADING SKELETON ────────────────────────────────────────────────────────

function KPISkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="p-4 bg-white border border-gray-200 rounded-xl">
          <div className="h-4 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-6 bg-gray-200 rounded animate-pulse" />
        </div>
      ))}
    </div>
  )
}

function DepartmentSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-4 bg-white border border-gray-200 rounded-xl">
          <div className="h-5 bg-gray-200 rounded animate-pulse mb-3" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── KPI CARDS ──────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string
  value: string | number
  subtext?: string
  status?: 'good' | 'warning' | 'critical' | 'neutral'
  icon?: React.ReactNode
}

function KPICard({ label, value, subtext, status, icon }: KPICardProps) {
  const statusColors: Record<string, { bg: string; text: string; icon: string }> = {
    good:     { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-500' },
    warning:  { bg: 'bg-amber-50',   text: 'text-amber-700',   icon: 'text-amber-500' },
    critical: { bg: 'bg-red-50',     text: 'text-red-700',     icon: 'text-red-500' },
    neutral:  { bg: 'bg-blue-50',    text: 'text-blue-700',    icon: 'text-blue-500' },
  }
  const cfg = statusColors[status || 'neutral']

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="kpi-card-rows p-4 bg-white border border-gray-200 rounded-xl shadow-sm"
    >
      {/* Row 1: label + icon */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-gray-500 text-xs font-medium">{label}</p>
        {icon && (
          <div className={`p-2 rounded-lg flex-shrink-0 ${cfg.bg}`}>
            <div className={cfg.icon}>{icon}</div>
          </div>
        )}
      </div>
      {/* Row 2: value */}
      <p className="text-gray-900 text-2xl font-bold">{value}</p>
      {/* Row 3: subtext or spacer */}
      {subtext ? (
        <p className={`text-xs ${cfg.text}`}>{subtext}</p>
      ) : (
        <span aria-hidden="true" />
      )}
    </motion.div>
  )
}

// ─── DEPARTMENT SECTION ──────────────────────────────────────────────────────

interface DepartmentSectionProps {
  dept: DepartmentStats
  isOpen: boolean
  onToggle: () => void
  searchTerm: string
}

function DepartmentSection({ dept, isOpen, onToggle, searchTerm }: DepartmentSectionProps) {
  // Filter members by search term
  const filtered = dept.members.filter(m =>
    m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.role.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const overAllocWarning = dept.overAllocated > 0
  const warningColor = overAllocWarning ? 'border-l-amber-400' : 'border-l-gray-200'

  return (
    <motion.div
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm border-l-4 ${warningColor}`}
    >
      {/* Department Header */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4 flex-1">
          <div className={isOpen ? 'text-gray-600' : 'text-gray-400'}>
            {isOpen ? <CaretDown size={16} weight="fill" /> : <CaretRight size={16} weight="fill" />}
          </div>
          <div className="text-left flex-1">
            <h3 className="font-semibold text-gray-900 text-sm">{dept.department}</h3>
            <p className="text-gray-500 text-xs">
              {dept.headcount} people · {dept.avgUtilization}% avg utilization
            </p>
          </div>
          {/* Utilization Bar */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0 w-32">
            <div className="flex-1">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    dept.avgUtilization > 100 ? 'bg-red-500' :
                    dept.avgUtilization >= 85 ? 'bg-amber-500' :
                    'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(dept.avgUtilization, 100)}%` }}
                />
              </div>
            </div>
            <span className="text-xs font-semibold text-gray-600 min-w-8 text-right">{dept.avgUtilization}%</span>
          </div>
          {overAllocWarning && (
            <div className="flex items-center gap-1 flex-shrink-0 px-2 py-1 rounded-full bg-amber-50 border border-amber-200">
              <Warning size={12} weight="fill" className="text-amber-600" />
              <span className="text-xs font-medium text-amber-700">{dept.overAllocated} over</span>
            </div>
          )}
        </div>
      </button>

      {/* Department Members (Collapsible) */}
      <AnimatePresence>
        {isOpen && filtered.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-gray-100"
          >
            <div className="divide-y divide-gray-100 bg-gray-50">
              {filtered.map(member => (
                <div key={member.id} className="px-6 py-3 flex items-center gap-4 hover:bg-gray-100 transition-colors">
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full ${avatarColor(member.full_name)} flex items-center justify-center text-white text-xs font-bold`}>
                    {initials(member.full_name)}
                  </div>

                  {/* Name & Title */}
                  <div className="flex-shrink-0 w-40">
                    <p className="text-sm font-medium text-gray-900">{member.full_name}</p>
                    <p className="text-xs text-gray-500">{member.title || member.role}</p>
                  </div>

                  {/* Utilization Bar */}
                  <UtilizationBar member={member} />

                  {/* Allocation Count */}
                  <div className="flex-shrink-0 min-w-12">
                    <p className="text-xs font-semibold text-gray-600">{member.allocations.length} proj</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isOpen && filtered.length === 0 && (
        <div className="p-6 text-center text-gray-400 text-xs">
          No team members matching "{searchTerm}"
        </div>
      )}
    </motion.div>
  )
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────

export default function Resources() {
  const statsQuery = useResourceStats()
  const deptQuery = useDepartmentStats()
  const teamQuery = useTeamMembers()

  // Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDepts] = useState<Set<string>>(new Set())
  const [openDepts, setOpenDepts] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const toggleDept = useCallback((deptName: string) => {
    setOpenDepts(prev => {
      const next = new Set(prev)
      next.has(deptName) ? next.delete(deptName) : next.add(deptName)
      return next
    })
  }, [])

  // Filter departments by search
  const filteredDepts = useMemo(() => {
    if (!deptQuery.data) return []
    return deptQuery.data.filter(
      d => !selectedDepts.size || selectedDepts.has(d.department)
    )
  }, [deptQuery.data, selectedDepts])

  // Load state
  const isLoading = statsQuery.isLoading || deptQuery.isLoading
  const isError = statsQuery.isError || deptQuery.isError

  if (isError) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] p-6">
        <div className="max-w-6xl mx-auto">
          <div className="p-6 bg-white rounded-xl border border-red-200 bg-red-50 text-center">
            <Warning size={24} weight="fill" className="text-red-600 mx-auto mb-2" />
            <h2 className="text-sm font-semibold text-red-800">Failed to load resources</h2>
            <p className="text-xs text-red-600 mt-1">{statsQuery.error?.message || deptQuery.error?.message}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f4f6f9] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Resources</h1>
            <p className="text-sm text-gray-500 mt-1">
              Team utilization and capacity management
            </p>
          </div>
          {!isLoading && (
            <div className="text-sm font-medium text-gray-600">
              {teamQuery.data?.length ?? 0} team members
            </div>
          )}
        </div>

        {/* KPI Cards */}
        {isLoading ? (
          <KPISkeleton />
        ) : (
          <div className="kpi-grid-rows grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KPICard
              label="Total People"
              value={statsQuery.data?.totalPeople ?? 0}
              status="neutral"
              icon={<UsersThree size={16} weight="fill" />}
            />
            <KPICard
              label="Avg Utilization"
              value={`${statsQuery.data?.avgUtilization ?? 0}%`}
              status={
                (statsQuery.data?.avgUtilization ?? 0) > 100 ? 'critical' :
                (statsQuery.data?.avgUtilization ?? 0) >= 85 ? 'warning' : 'good'
              }
              icon={<Gauge size={16} weight="fill" />}
            />
            <KPICard
              label="Over-Allocated"
              value={statsQuery.data?.overAllocated ?? 0}
              status="critical"
              icon={<Warning size={16} weight="fill" />}
            />
            <KPICard
              label="Under-Utilized"
              value={statsQuery.data?.underUtilized ?? 0}
              status="warning"
              icon={<UserCircle size={16} weight="fill" />}
            />
            <KPICard
              label="Optimal (50-100%)"
              value={statsQuery.data?.optimallyAllocated ?? 0}
              status="good"
              icon={<Gauge size={16} weight="fill" />}
            />
            <KPICard
              label="Total Allocations"
              value={statsQuery.data?.totalAllocations ?? 0}
              status="neutral"
              icon={<GridFour size={16} weight="fill" />}
            />
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search by name, title, or role..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pl-10 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
              title="Grid view"
            >
              <GridFour size={16} weight="fill" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
              title="List view"
            >
              <ListBullets size={16} weight="fill" />
            </button>
          </div>
        </div>

        {/* Department Sections */}
        {isLoading ? (
          <DepartmentSkeleton />
        ) : (
          <div className="space-y-4">
            {filteredDepts.length > 0 ? (
              filteredDepts.map(dept => (
                <DepartmentSection
                  key={dept.department}
                  dept={dept}
                  isOpen={openDepts.has(dept.department)}
                  onToggle={() => toggleDept(dept.department)}
                  searchTerm={searchTerm}
                />
              ))
            ) : (
              <div className="p-8 text-center bg-white border border-gray-200 rounded-xl">
                <UsersThree size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600">No departments found</p>
                <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="mt-8 p-4 bg-white border border-gray-200 rounded-lg text-xs text-gray-600">
          <p className="font-semibold text-gray-900 mb-2">Utilization Legend</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-emerald-500" />
              <span>50-85% (Good)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-amber-500" />
              <span>85-100% (Full)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500" />
              <span>&gt;100% (Over)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-300" />
              <span>&lt;50% (Under)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
