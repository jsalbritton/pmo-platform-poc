/**
 * BoardHeader — control bar at the top of the Sprint Board.
 *
 * LAYOUT:
 *   ┌─────────────────────────────────────────────────────────────────────────┐
 *   │  Sprint Board                                                           │
 *   │  [Active Sprints ▾]  [Group: Status ▾]  [Filter ▾]  [🔍]  1,994 items │
 *   └─────────────────────────────────────────────────────────────────────────┘
 *
 * CHANGES from v1:
 *   - Sprint SCOPE selector (Active/Planned/Completed/All) replaces per-project sprint picker
 *   - Project filter section in filter popover
 *   - "Group by Project" option added
 *   - Search is board-level (filters items), NOT Command Palette
 */

import { useState, useRef, useEffect } from 'react'
import {
  Kanban,
  FunnelSimple,
  MagnifyingGlass,
  CaretDown,
  X,
  Rows,
  SquaresFour,
  User,
  Flag,
  Tag,
  Lightning,
  Briefcase,
} from '@phosphor-icons/react'
import type {
  WorkItemType,
  WorkItemPriority,
  WorkItemProfile,
} from '@/features/work-items/workItem.types'
import {
  TYPE_CONFIG,
  PRIORITY_CONFIG,
  profileDisplayName,
} from '@/features/work-items/workItem.types'
import type { GroupByField, KanbanFilters, SprintScope, BoardProject } from './useKanbanBoard'

// ─── GENERIC DROPDOWN ────────────────────────────────────────────────────────

function Dropdown({
  trigger,
  children,
  align = 'left',
}: {
  trigger:   React.ReactNode
  children:  React.ReactNode
  align?:    'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div className={`
          absolute top-full mt-1.5 z-50
          ${align === 'right' ? 'right-0' : 'left-0'}
          min-w-[200px] max-h-[320px] overflow-y-auto
          bg-[#1c2129] border border-white/10 rounded-xl
          shadow-xl shadow-black/40
          py-1
        `}>
          {children}
        </div>
      )}
    </div>
  )
}

function DropdownItem({
  onClick,
  active = false,
  children,
}: {
  onClick:   () => void
  active?:   boolean
  children:  React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-2 px-3 py-2 text-left
        text-xs transition-colors
        ${active
          ? 'text-blue-400 bg-blue-500/10'
          : 'text-slate-300 hover:bg-white/5'
        }
      `}
    >
      {children}
    </button>
  )
}

// ─── FILTER CHIP ─────────────────────────────────────────────────────────────

function FilterChip({
  label,
  onRemove,
}: {
  label:     string
  onRemove:  () => void
}) {
  return (
    <span className="
      inline-flex items-center gap-1 px-2 py-0.5 rounded-md
      bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-400
    ">
      {label}
      <button onClick={onRemove} className="hover:text-blue-300">
        <X size={10} weight="bold" />
      </button>
    </span>
  )
}

// ─── MULTI-SELECT FILTER SECTION ─────────────────────────────────────────────

function FilterSection<T extends string>({
  label,
  icon: Icon,
  options,
  selected,
  onToggle,
  getLabel,
  getColor,
}: {
  label:     string
  icon:      typeof Tag
  options:   T[]
  selected:  T[]
  onToggle:  (value: T) => void
  getLabel:  (value: T) => string
  getColor?: (value: T) => string
}) {
  if (options.length === 0) return null

  return (
    <div className="py-1">
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-slate-600 uppercase tracking-wider font-medium">
        <Icon size={10} weight="bold" />
        {label}
      </div>
      {options.map((opt) => {
        const isSelected = selected.includes(opt)
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            className={`
              w-full flex items-center gap-2 px-3 py-1.5 text-left
              text-xs transition-colors
              ${isSelected
                ? 'text-blue-400 bg-blue-500/10'
                : 'text-slate-300 hover:bg-white/5'
              }
            `}
          >
            <div className={`
              w-3.5 h-3.5 rounded border flex items-center justify-center
              transition-colors
              ${isSelected
                ? 'bg-blue-500 border-blue-500'
                : 'border-white/20 bg-transparent'
              }
            `}>
              {isSelected && (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span className={getColor?.(opt) ?? ''}>{getLabel(opt)}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

interface BoardHeaderProps {
  // Sprint scope
  sprintScope:        SprintScope
  onSprintScopeChange: (s: SprintScope) => void
  isCrossProject:     boolean

  // Group
  groupBy:        GroupByField
  onGroupChange:  (g: GroupByField) => void

  // Filters
  filters:        KanbanFilters
  onFiltersChange: (f: KanbanFilters) => void
  onClearFilters: () => void
  hasActiveFilter: boolean

  // Stats
  totalItems:    number
  filteredCount: number

  // Data for filter dropdowns
  teamMembers:       WorkItemProfile[]
  allLabels:         string[]
  availableProjects: BoardProject[]

  // Board search
  showSearch:      boolean
  onToggleSearch:  () => void
}

const SPRINT_SCOPE_OPTIONS: { value: SprintScope; label: string; color: string }[] = [
  { value: 'active',    label: 'Active Sprints',    color: 'text-emerald-400' },
  { value: 'planned',   label: 'Planned Sprints',   color: 'text-amber-400' },
  { value: 'completed', label: 'Completed Sprints', color: 'text-slate-400' },
  { value: 'all',       label: 'All Sprints',       color: 'text-blue-400' },
]

const GROUP_OPTIONS: { value: GroupByField; label: string; icon: typeof Rows }[] = [
  { value: 'status',   label: 'Status',   icon: Rows },
  { value: 'assignee', label: 'Assignee', icon: User },
  { value: 'priority', label: 'Priority', icon: Flag },
  { value: 'type',     label: 'Type',     icon: SquaresFour },
  { value: 'project',  label: 'Project',  icon: Briefcase },
]

export function BoardHeader({
  sprintScope,
  onSprintScopeChange,
  isCrossProject,
  groupBy,
  onGroupChange,
  filters,
  onFiltersChange,
  onClearFilters,
  hasActiveFilter,
  totalItems,
  filteredCount,
  teamMembers,
  allLabels,
  availableProjects,
  showSearch,
  onToggleSearch,
}: BoardHeaderProps) {
  const activeFilterCount =
    filters.types.length +
    filters.priorities.length +
    filters.assignees.length +
    filters.labels.length +
    filters.projects.length +
    (filters.search.trim() ? 1 : 0)

  // ── Filter toggle helpers ───────────────────────────────────────────────────
  function toggleType(t: WorkItemType) {
    const next = filters.types.includes(t)
      ? filters.types.filter((x) => x !== t)
      : [...filters.types, t]
    onFiltersChange({ ...filters, types: next })
  }

  function togglePriority(p: WorkItemPriority) {
    const next = filters.priorities.includes(p)
      ? filters.priorities.filter((x) => x !== p)
      : [...filters.priorities, p]
    onFiltersChange({ ...filters, priorities: next })
  }

  function toggleAssignee(id: string) {
    const next = filters.assignees.includes(id)
      ? filters.assignees.filter((x) => x !== id)
      : [...filters.assignees, id]
    onFiltersChange({ ...filters, assignees: next })
  }

  function toggleLabel(l: string) {
    const next = filters.labels.includes(l)
      ? filters.labels.filter((x) => x !== l)
      : [...filters.labels, l]
    onFiltersChange({ ...filters, labels: next })
  }

  function toggleProject(id: string) {
    const next = filters.projects.includes(id)
      ? filters.projects.filter((x) => x !== id)
      : [...filters.projects, id]
    onFiltersChange({ ...filters, projects: next })
  }

  const currentScopeOption = SPRINT_SCOPE_OPTIONS.find(s => s.value === sprintScope)!
  const currentGroupOption = GROUP_OPTIONS.find((g) => g.value === groupBy)!

  return (
    <div className="flex-shrink-0 border-b border-white/5 bg-[#0d1117]/80 backdrop-blur-sm">
      {/* ── Row 1: Title + controls ────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Board icon + title */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-pmo-cyan/10">
            <Kanban size={18} weight="duotone" style={{ color: '#39c5cf' }} />
          </div>
          <h1 className="text-base font-semibold text-slate-100 tracking-tight">
            Sprint Board
          </h1>
        </div>

        <div className="w-px h-5 bg-white/10" />

        {/* Sprint scope selector */}
        <Dropdown
          trigger={
            <button className="
              flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
              bg-white/5 border border-white/8 hover:border-white/15
              text-xs text-slate-300 hover:text-slate-200
              transition-colors
            ">
              <Lightning size={12} weight="bold" className={currentScopeOption.color} />
              {currentScopeOption.label}
              <CaretDown size={10} weight="bold" className="text-slate-600" />
            </button>
          }
        >
          {SPRINT_SCOPE_OPTIONS.map((opt) => (
            <DropdownItem
              key={opt.value}
              onClick={() => onSprintScopeChange(opt.value)}
              active={sprintScope === opt.value}
            >
              <span className={opt.color}>{opt.label}</span>
            </DropdownItem>
          ))}
        </Dropdown>

        {/* Group-by selector */}
        <Dropdown
          trigger={
            <button className="
              flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
              bg-white/5 border border-white/8 hover:border-white/15
              text-xs text-slate-300 hover:text-slate-200
              transition-colors
            ">
              <currentGroupOption.icon size={12} weight="bold" className="text-slate-500" />
              Group: {currentGroupOption.label}
              <CaretDown size={10} weight="bold" className="text-slate-600" />
            </button>
          }
        >
          {GROUP_OPTIONS.map((opt) => (
            <DropdownItem
              key={opt.value}
              onClick={() => onGroupChange(opt.value)}
              active={groupBy === opt.value}
            >
              <opt.icon size={14} weight="bold" />
              {opt.label}
            </DropdownItem>
          ))}
        </Dropdown>

        {/* Filter button */}
        <Dropdown
          trigger={
            <button className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
              border transition-colors text-xs
              ${hasActiveFilter
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                : 'bg-white/5 border-white/8 hover:border-white/15 text-slate-300 hover:text-slate-200'
              }
            `}>
              <FunnelSimple size={12} weight="bold" />
              Filter
              {activeFilterCount > 0 && (
                <span className="
                  ml-0.5 px-1.5 py-0 rounded-full
                  bg-blue-500 text-white text-[10px] font-bold
                ">
                  {activeFilterCount}
                </span>
              )}
            </button>
          }
          align="left"
        >
          {/* Project filters (cross-project mode) */}
          {isCrossProject && availableProjects.length > 0 && (
            <>
              <FilterSection
                label={`Project (${availableProjects.length})`}
                icon={Briefcase}
                options={availableProjects.map(p => p.id)}
                selected={filters.projects}
                onToggle={toggleProject}
                getLabel={(id) => {
                  const p = availableProjects.find(x => x.id === id)
                  return p ? `${p.code} · ${p.name}` : id.slice(0, 8)
                }}
              />
              <div className="h-px bg-white/5" />
            </>
          )}

          {/* Type filters */}
          <FilterSection
            label="Type"
            icon={SquaresFour}
            options={Object.keys(TYPE_CONFIG) as WorkItemType[]}
            selected={filters.types}
            onToggle={toggleType}
            getLabel={(t) => TYPE_CONFIG[t].label}
            getColor={(t) => TYPE_CONFIG[t].color}
          />

          <div className="h-px bg-white/5" />

          {/* Priority filters */}
          <FilterSection
            label="Priority"
            icon={Flag}
            options={Object.keys(PRIORITY_CONFIG) as WorkItemPriority[]}
            selected={filters.priorities}
            onToggle={togglePriority}
            getLabel={(p) => PRIORITY_CONFIG[p].label}
            getColor={(p) => PRIORITY_CONFIG[p].color}
          />

          {/* Assignee filters */}
          {teamMembers.length > 0 && (
            <>
              <div className="h-px bg-white/5" />
              <FilterSection
                label="Assignee"
                icon={User}
                options={teamMembers.map((m) => m.id)}
                selected={filters.assignees}
                onToggle={toggleAssignee}
                getLabel={(id) => {
                  const m = teamMembers.find((t) => t.id === id)
                  return m ? profileDisplayName(m) : 'Unknown'
                }}
              />
            </>
          )}

          {/* Label filters */}
          {allLabels.length > 0 && (
            <>
              <div className="h-px bg-white/5" />
              <FilterSection
                label="Labels"
                icon={Tag}
                options={allLabels}
                selected={filters.labels}
                onToggle={toggleLabel}
                getLabel={(l) => l}
              />
            </>
          )}

          {/* Clear all */}
          {hasActiveFilter && (
            <>
              <div className="h-px bg-white/5" />
              <button
                onClick={onClearFilters}
                className="
                  w-full px-3 py-2 text-xs text-red-400
                  hover:bg-red-500/10 transition-colors text-left
                "
              >
                Clear all filters
              </button>
            </>
          )}
        </Dropdown>

        {/* Search toggle — board-level search, NOT Command Palette */}
        <button
          onClick={onToggleSearch}
          className={`
            p-1.5 rounded-lg border transition-colors
            ${showSearch || filters.search
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
              : 'bg-white/5 border-white/8 hover:border-white/15 text-slate-400 hover:text-slate-300'
            }
          `}
          title="Search board items (/)"
        >
          <MagnifyingGlass size={14} weight="bold" />
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Item count */}
        <div className="text-[11px] text-slate-500 tabular-nums">
          {hasActiveFilter ? (
            <span>
              <span className="text-blue-400 font-medium">{filteredCount}</span>
              {' / '}
              {totalItems} items
            </span>
          ) : (
            <span>{totalItems} items</span>
          )}
        </div>
      </div>

      {/* ── Row 2: Search bar (conditional, board-level) ──────────────────── */}
      {showSearch && (
        <div className="flex items-center gap-2 px-4 pb-3">
          <MagnifyingGlass size={14} className="text-slate-600 flex-shrink-0" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            placeholder="Search items by title..."
            autoFocus
            className="
              flex-1 bg-transparent border-none outline-none
              text-sm text-slate-200 placeholder:text-slate-600
            "
          />
          {filters.search && (
            <button
              onClick={() => onFiltersChange({ ...filters, search: '' })}
              className="text-slate-600 hover:text-slate-400"
            >
              <X size={14} weight="bold" />
            </button>
          )}
        </div>
      )}

      {/* ── Row 3: Active filter chips ─────────────────────────────────────── */}
      {hasActiveFilter && (
        <div className="flex items-center gap-1.5 px-4 pb-2.5 flex-wrap">
          {filters.projects.map((id) => {
            const p = availableProjects.find(x => x.id === id)
            return (
              <FilterChip
                key={`prj-${id}`}
                label={p ? p.code : id.slice(0, 8)}
                onRemove={() => toggleProject(id)}
              />
            )
          })}
          {filters.types.map((t) => (
            <FilterChip
              key={`type-${t}`}
              label={TYPE_CONFIG[t].label}
              onRemove={() => toggleType(t)}
            />
          ))}
          {filters.priorities.map((p) => (
            <FilterChip
              key={`pri-${p}`}
              label={PRIORITY_CONFIG[p].label}
              onRemove={() => togglePriority(p)}
            />
          ))}
          {filters.assignees.map((id) => {
            const m = teamMembers.find((t) => t.id === id)
            return (
              <FilterChip
                key={`ass-${id}`}
                label={m ? profileDisplayName(m) : id.slice(0, 8)}
                onRemove={() => toggleAssignee(id)}
              />
            )
          })}
          {filters.labels.map((l) => (
            <FilterChip
              key={`lbl-${l}`}
              label={l}
              onRemove={() => toggleLabel(l)}
            />
          ))}
          {filters.search && (
            <FilterChip
              label={`"${filters.search}"`}
              onRemove={() => onFiltersChange({ ...filters, search: '' })}
            />
          )}
          <button
            onClick={onClearFilters}
            className="text-[11px] text-slate-600 hover:text-red-400 transition-colors ml-1"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
