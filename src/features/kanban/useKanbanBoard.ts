/**
 * useKanbanBoard — data layer for the Sprint Board (S1B-002).
 *
 * ARCHITECTURE: Sprint-centric, cross-project.
 *   The board defaults to showing ALL work items in ACTIVE sprints across
 *   every project. Project is a FILTER, not the entry point.
 *
 *   Raw data    → useQuery: items in active sprints, cross-project
 *   Filtered    → useMemo: apply quick-filters (project, type, priority, assignee, label, search)
 *   Grouped     → useMemo: group into columns (status, assignee, priority, type, project)
 *   Reordered   → optimistic mutation on drop (board_position + groupBy field)
 *
 * WHY CLIENT-SIDE GROUPING?
 *   Even at 2,000 items, JS grouping runs in <5ms. Server-side grouping
 *   would require N queries or a custom RPC. Client-side keeps the data
 *   layer simple and lets us re-group instantly when switching dimensions.
 *
 * SPRINT SCOPE:
 *   - "Active Sprints" (default): items where sprint.status = 'active'
 *   - "All Sprints": no sprint filter
 *   - Planned/Completed: filter by sprint.status
 *
 * WIP LIMITS:
 *   Stored per-column in local state (not DB). Default: unlimited.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useCallback } from 'react'
import { db } from '@/lib/supabase'
import type {
  WorkItem,
  WorkItemStatus,
  WorkItemPriority,
  WorkItemType,
  WorkItemProfile,
} from '@/features/work-items/workItem.types'
import { STATUS_CONFIG, PRIORITY_CONFIG, TYPE_CONFIG } from '@/features/work-items/workItem.types'

// ─── TYPES ───────────────────────────────────────────────────────────────────

/** A work item with joined assignee + project info (board-level shape) */
export interface KanbanItem extends WorkItem {
  assignee: Pick<WorkItemProfile, 'id' | 'full_name' | 'display_name' | 'email' | 'avatar_url'> | null
  project_info: { id: string; name: string; code: string } | null
}

/** One column on the board */
export interface KanbanColumnData {
  id:        string
  label:     string
  color:     string
  dotColor:  string
  items:     KanbanItem[]
  wipLimit:  number | null
  isOverWip: boolean
}

/** How columns are grouped — now includes 'project' */
export type GroupByField = 'status' | 'assignee' | 'priority' | 'type' | 'project'

/** Sprint scope options */
export type SprintScope = 'active' | 'planned' | 'completed' | 'all'

/** Quick-filter state — now includes projects */
export interface KanbanFilters {
  types:      WorkItemType[]
  priorities: WorkItemPriority[]
  assignees:  string[]
  labels:     string[]
  projects:   string[]            // project IDs
  search:     string
}

/** Lightweight project info for filter dropdowns */
export interface BoardProject {
  id:   string
  name: string
  code: string
}

/** Sprint option for legacy per-project mode */
export interface SprintOption {
  id:           string
  sprint_number: number
  name:         string | null
  sprint_start: string | null
  sprint_end:   string | null
  status:       string | null
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const STATUS_ORDER: WorkItemStatus[] = [
  'backlog', 'todo', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled',
]

const PRIORITY_ORDER: WorkItemPriority[] = [
  'urgent', 'high', 'medium', 'low', 'no_priority',
]

const TYPE_ORDER: WorkItemType[] = [
  'epic', 'story', 'task', 'bug', 'spike',
]

export const DEFAULT_COLLAPSED: string[] = ['cancelled']

export const EMPTY_FILTERS: KanbanFilters = {
  types: [],
  priorities: [],
  assignees: [],
  labels: [],
  projects: [],
  search: '',
}

// ─── FETCH: CROSS-PROJECT (SPRINT-CENTRIC) ──────────────────────────────────

/**
 * Fetch all work items across projects, scoped by sprint status.
 * Uses a two-step approach: get sprint IDs, then fetch items.
 */
async function fetchCrossProjectItems(sprintScope: SprintScope): Promise<KanbanItem[]> {
  // Step 1: Get sprint IDs matching the scope
  let sprintIds: string[] | null = null

  if (sprintScope !== 'all') {
    const { data: sprints, error: sprintErr } = await db
      .from('sprints')
      .select('id')
      .eq('status', sprintScope)

    if (sprintErr) throw new Error(`Failed to fetch sprints: ${sprintErr.message}`)
    sprintIds = (sprints ?? []).map(s => s.id)

    // If no sprints match this scope, return empty
    if (sprintIds.length === 0) return []
  }

  // Step 2: Fetch work items with assignee + project joins
  let query = db
    .from('work_items')
    .select(`
      id, title, type, status, priority, story_points,
      assignee_id, sprint_id, board_position, labels, due_date,
      parent_id, start_date, estimated_hours, project_id,
      created_at, updated_at, description, phase_id, reporter_id,
      actual_hours, completed_at, metadata,
      assignee:profiles!work_items_assignee_id_fkey (
        id, full_name, display_name, email, avatar_url
      ),
      project_info:projects!work_items_project_id_fkey (
        id, name, code
      )
    `)
    .is('parent_id', null)

  // Apply sprint filter if not 'all'
  if (sprintIds) {
    query = query.in('sprint_id', sprintIds)
  }

  const { data, error } = await query
    .order('board_position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(3000)

  if (error) throw new Error(`Failed to fetch board items: ${error.message}`)
  return (data ?? []) as unknown as KanbanItem[]
}

/**
 * Fetch items for a single project (legacy per-project mode).
 */
async function fetchProjectItems(projectId: string, sprintScope: SprintScope): Promise<KanbanItem[]> {
  let query = db
    .from('work_items')
    .select(`
      id, title, type, status, priority, story_points,
      assignee_id, sprint_id, board_position, labels, due_date,
      parent_id, start_date, estimated_hours, project_id,
      created_at, updated_at, description, phase_id, reporter_id,
      actual_hours, completed_at, metadata,
      assignee:profiles!work_items_assignee_id_fkey (
        id, full_name, display_name, email, avatar_url
      ),
      project_info:projects!work_items_project_id_fkey (
        id, name, code
      )
    `)
    .eq('project_id', projectId)
    .is('parent_id', null)

  if (sprintScope !== 'all') {
    // Get sprint IDs for this project matching the scope
    const { data: sprints } = await db
      .from('sprints')
      .select('id')
      .eq('project_id', projectId)
      .eq('status', sprintScope)

    const ids = (sprints ?? []).map(s => s.id)
    if (ids.length === 0) return []
    query = query.in('sprint_id', ids)
  }

  const { data, error } = await query
    .order('board_position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch board items: ${error.message}`)
  return (data ?? []) as unknown as KanbanItem[]
}

/** Fetch team members who have items in the current dataset */
async function fetchTeamFromItems(items: KanbanItem[]): Promise<WorkItemProfile[]> {
  const seen = new Set<string>()
  const team: WorkItemProfile[] = []
  for (const item of items) {
    const a = item.assignee as unknown as WorkItemProfile | null
    if (a && !seen.has(a.id)) {
      seen.add(a.id)
      team.push(a)
    }
  }
  return team.sort((a, b) =>
    (a.display_name ?? a.full_name ?? a.email).localeCompare(
      b.display_name ?? b.full_name ?? b.email
    )
  )
}

/** Extract unique projects from items */
function extractProjects(items: KanbanItem[]): BoardProject[] {
  const seen = new Map<string, BoardProject>()
  for (const item of items) {
    const p = item.project_info
    if (p && !seen.has(p.id)) {
      seen.set(p.id, { id: p.id, name: p.name, code: p.code })
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.code.localeCompare(b.code))
}

// ─── GROUPING ────────────────────────────────────────────────────────────────

function groupByStatus(items: KanbanItem[], wipLimits: Record<string, number | null>): KanbanColumnData[] {
  const buckets = new Map<string, KanbanItem[]>()
  for (const s of STATUS_ORDER) buckets.set(s, [])
  for (const item of items) {
    const bucket = buckets.get(item.status) ?? []
    bucket.push(item)
    buckets.set(item.status, bucket)
  }

  return STATUS_ORDER.map((s) => {
    const col = STATUS_CONFIG[s]
    const colItems = buckets.get(s) ?? []
    const wip = wipLimits[s] ?? null
    return {
      id: s, label: col.label, color: col.color, dotColor: col.dotColor,
      items: colItems, wipLimit: wip,
      isOverWip: wip !== null && colItems.length > wip,
    }
  })
}

function groupByPriority(items: KanbanItem[], wipLimits: Record<string, number | null>): KanbanColumnData[] {
  const buckets = new Map<string, KanbanItem[]>()
  for (const p of PRIORITY_ORDER) buckets.set(p, [])
  for (const item of items) {
    const bucket = buckets.get(item.priority) ?? []
    bucket.push(item)
    buckets.set(item.priority, bucket)
  }

  return PRIORITY_ORDER.map((p) => {
    const cfg = PRIORITY_CONFIG[p]
    const colItems = buckets.get(p) ?? []
    const wip = wipLimits[p] ?? null
    return {
      id: p, label: cfg.label, color: cfg.color, dotColor: '#64748b',
      items: colItems, wipLimit: wip,
      isOverWip: wip !== null && colItems.length > wip,
    }
  })
}

function groupByType(items: KanbanItem[], wipLimits: Record<string, number | null>): KanbanColumnData[] {
  const buckets = new Map<string, KanbanItem[]>()
  for (const t of TYPE_ORDER) buckets.set(t, [])
  for (const item of items) {
    const bucket = buckets.get(item.type) ?? []
    bucket.push(item)
    buckets.set(item.type, bucket)
  }

  return TYPE_ORDER.map((t) => {
    const cfg = TYPE_CONFIG[t]
    const colItems = buckets.get(t) ?? []
    const wip = wipLimits[t] ?? null
    return {
      id: t, label: cfg.label, color: cfg.color, dotColor: '#64748b',
      items: colItems, wipLimit: wip,
      isOverWip: wip !== null && colItems.length > wip,
    }
  })
}

function groupByAssignee(items: KanbanItem[], wipLimits: Record<string, number | null>): KanbanColumnData[] {
  const buckets = new Map<string, KanbanItem[]>()
  const names = new Map<string, string>()
  const unassignedKey = '__unassigned__'
  buckets.set(unassignedKey, [])
  names.set(unassignedKey, 'Unassigned')

  for (const item of items) {
    const key = item.assignee_id ?? unassignedKey
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(item)
    if (item.assignee && !names.has(key)) {
      names.set(key, item.assignee.display_name ?? item.assignee.full_name ?? item.assignee.email.split('@')[0])
    }
  }

  const keys = Array.from(buckets.keys()).sort((a, b) => {
    if (a === unassignedKey) return -1
    if (b === unassignedKey) return 1
    return (names.get(a) ?? '').localeCompare(names.get(b) ?? '')
  })

  return keys.map((key) => {
    const colItems = buckets.get(key) ?? []
    const wip = wipLimits[key] ?? null
    return {
      id: key, label: names.get(key) ?? 'Unknown',
      color: 'text-slate-300', dotColor: key === unassignedKey ? '#475569' : '#58a6ff',
      items: colItems, wipLimit: wip,
      isOverWip: wip !== null && colItems.length > wip,
    }
  })
}

/** NEW: Group by project — each column is a project */
function groupByProject(items: KanbanItem[], wipLimits: Record<string, number | null>): KanbanColumnData[] {
  const buckets = new Map<string, KanbanItem[]>()
  const projectMeta = new Map<string, { name: string; code: string }>()
  const noProjectKey = '__no_project__'

  for (const item of items) {
    const p = item.project_info
    const key = p?.id ?? noProjectKey
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(item)
    if (p && !projectMeta.has(key)) {
      projectMeta.set(key, { name: p.name, code: p.code })
    }
  }

  // Sort by project code
  const keys = Array.from(buckets.keys()).sort((a, b) => {
    if (a === noProjectKey) return 1
    if (b === noProjectKey) return -1
    const codeA = projectMeta.get(a)?.code ?? ''
    const codeB = projectMeta.get(b)?.code ?? ''
    return codeA.localeCompare(codeB)
  })

  // Color palette for project columns
  const projectColors = [
    '#58a6ff', '#3fb950', '#d29922', '#f85149', '#bc8cff',
    '#39d2c0', '#e07c5f', '#79c0ff', '#7ee787', '#f0883e',
  ]

  return keys.map((key, i) => {
    const meta = projectMeta.get(key)
    const colItems = buckets.get(key) ?? []
    const wip = wipLimits[key] ?? null
    const color = projectColors[i % projectColors.length]
    return {
      id: key,
      label: meta ? `${meta.code} · ${meta.name}` : 'No Project',
      color: 'text-slate-300',
      dotColor: color,
      items: colItems,
      wipLimit: wip,
      isOverWip: wip !== null && colItems.length > wip,
    }
  })
}

// ─── FILTERING ───────────────────────────────────────────────────────────────

function applyFilters(items: KanbanItem[], filters: KanbanFilters): KanbanItem[] {
  return items.filter((item) => {
    if (filters.projects.length > 0 && !filters.projects.includes(item.project_id)) return false
    if (filters.types.length > 0 && !filters.types.includes(item.type)) return false
    if (filters.priorities.length > 0 && !filters.priorities.includes(item.priority)) return false
    if (filters.assignees.length > 0) {
      if (!item.assignee_id || !filters.assignees.includes(item.assignee_id)) return false
    }
    if (filters.labels.length > 0) {
      const itemLabels = item.labels ?? []
      if (!filters.labels.some((l) => itemLabels.includes(l))) return false
    }
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase()
      if (!item.title.toLowerCase().includes(q)) return false
    }
    return true
  })
}

// ─── HOOK ────────────────────────────────────────────────────────────────────

/**
 * @param projectId — optional. When provided, scopes to a single project.
 *                     When undefined (default /board/all), shows cross-project.
 */
export function useKanbanBoard(projectId?: string) {
  const queryClient = useQueryClient()
  const isCrossProject = !projectId

  // ── Board settings (local state) ────────────────────────────────────────────
  const [sprintScope, setSprintScope]             = useState<SprintScope>('active')
  const [groupBy, setGroupBy]                     = useState<GroupByField>('status')
  const [filters, setFilters]                     = useState<KanbanFilters>(EMPTY_FILTERS)
  const [wipLimits, setWipLimits]                 = useState<Record<string, number | null>>({})
  const [collapsedColumns, setCollapsedColumns]   = useState<Set<string>>(new Set(DEFAULT_COLLAPSED))

  // ── Data query ──────────────────────────────────────────────────────────────
  const queryKey = isCrossProject
    ? ['board', 'cross-project', sprintScope]
    : ['board', 'project', projectId, sprintScope]

  const itemsQuery = useQuery({
    queryKey,
    queryFn: () => isCrossProject
      ? fetchCrossProjectItems(sprintScope)
      : fetchProjectItems(projectId!, sprintScope),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  })

  // ── Derived data ───────────────────────────────────────────────────────────
  const allItems = itemsQuery.data ?? []

  // Extract unique projects and team members from the data (no extra queries!)
  const availableProjects = useMemo(() => extractProjects(allItems), [allItems])
  const teamMembers = useMemo(() => {
    const seen = new Set<string>()
    const team: WorkItemProfile[] = []
    for (const item of allItems) {
      const a = item.assignee as unknown as WorkItemProfile | null
      if (a && !seen.has(a.id)) {
        seen.add(a.id)
        team.push(a)
      }
    }
    return team.sort((x, y) =>
      (x.display_name ?? x.full_name ?? x.email).localeCompare(
        y.display_name ?? y.full_name ?? y.email
      )
    )
  }, [allItems])

  // Filter → Group
  const filteredItems = useMemo(
    () => applyFilters(allItems, filters),
    [allItems, filters],
  )

  const columns = useMemo(() => {
    switch (groupBy) {
      case 'status':   return groupByStatus(filteredItems, wipLimits)
      case 'priority': return groupByPriority(filteredItems, wipLimits)
      case 'type':     return groupByType(filteredItems, wipLimits)
      case 'assignee': return groupByAssignee(filteredItems, wipLimits)
      case 'project':  return groupByProject(filteredItems, wipLimits)
    }
  }, [filteredItems, groupBy, wipLimits])

  const visibleColumns = useMemo(
    () => columns.filter((c) => !collapsedColumns.has(c.id)),
    [columns, collapsedColumns],
  )

  const hiddenColumns = useMemo(
    () => columns.filter((c) => collapsedColumns.has(c.id)),
    [columns, collapsedColumns],
  )

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalItems      = allItems.length
  const filteredCount   = filteredItems.length
  const hasActiveFilter = filters.types.length > 0 ||
    filters.priorities.length > 0 ||
    filters.assignees.length > 0 ||
    filters.labels.length > 0 ||
    filters.projects.length > 0 ||
    filters.search.trim() !== ''

  const allLabels = useMemo(() => {
    const s = new Set<string>()
    for (const item of allItems) {
      for (const l of item.labels ?? []) s.add(l)
    }
    return Array.from(s).sort()
  }, [allItems])

  // ── Drag-and-drop mutation ─────────────────────────────────────────────────
  const moveItem = useMutation({
    mutationFn: async ({
      itemId,
      newColumnId,
      newPosition,
    }: {
      itemId:      string
      newColumnId: string
      newPosition: number
    }) => {
      const patch: Record<string, unknown> = { board_position: newPosition }

      if (groupBy === 'status')   patch.status      = newColumnId
      if (groupBy === 'priority') patch.priority     = newColumnId
      if (groupBy === 'type')     patch.type         = newColumnId
      if (groupBy === 'assignee') {
        patch.assignee_id = newColumnId === '__unassigned__' ? null : newColumnId
      }
      // groupBy === 'project' → moving between projects changes project_id
      if (groupBy === 'project') {
        patch.project_id = newColumnId === '__no_project__' ? null : newColumnId
      }

      const { error } = await db
        .from('work_items')
        .update(patch)
        .eq('id', itemId)

      if (error) throw new Error(`Failed to move item: ${error.message}`)
    },

    onMutate: async ({ itemId, newColumnId, newPosition }) => {
      await queryClient.cancelQueries({ queryKey })
      const prev = queryClient.getQueryData<KanbanItem[]>(queryKey)

      if (prev) {
        const updated = prev.map((item) => {
          if (item.id !== itemId) return item
          const patch: Partial<KanbanItem> = { board_position: newPosition }
          if (groupBy === 'status')   patch.status      = newColumnId as WorkItemStatus
          if (groupBy === 'priority') patch.priority     = newColumnId as WorkItemPriority
          if (groupBy === 'type')     patch.type         = newColumnId as WorkItemType
          if (groupBy === 'assignee') patch.assignee_id  = newColumnId === '__unassigned__' ? null : newColumnId
          if (groupBy === 'project')  patch.project_id   = newColumnId === '__no_project__' ? null : newColumnId
          return { ...item, ...patch }
        })
        queryClient.setQueryData(queryKey, updated)
      }
      return { prev }
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev)
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  // ── Column actions ─────────────────────────────────────────────────────────
  const toggleCollapse = useCallback((columnId: string) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev)
      if (next.has(columnId)) next.delete(columnId)
      else next.add(columnId)
      return next
    })
  }, [])

  const setWipLimit = useCallback((columnId: string, limit: number | null) => {
    setWipLimits((prev) => ({ ...prev, [columnId]: limit }))
  }, [])

  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), [])

  // ── Return ─────────────────────────────────────────────────────────────────
  return {
    // Data
    columns,
    visibleColumns,
    hiddenColumns,
    allItems,
    totalItems,
    filteredCount,
    hasActiveFilter,
    allLabels,
    teamMembers,
    availableProjects,
    isCrossProject,

    // Loading
    isLoading:  itemsQuery.isLoading,
    isError:    itemsQuery.isError,

    // Sprint scope
    sprintScope,
    setSprintScope,

    // Legacy compatibility — empty array since we don't list individual sprints now
    sprints: [] as SprintOption[],
    selectedSprintId: null as string | null,
    setSelectedSprintId: (() => {}) as (id: string | null) => void,

    // Grouping
    groupBy,
    setGroupBy,

    // Filters
    filters,
    setFilters,
    clearFilters,

    // WIP
    wipLimits,
    setWipLimit,

    // Collapse
    collapsedColumns,
    toggleCollapse,

    // Mutations
    moveItem: moveItem.mutate,
    isMoving: moveItem.isPending,
  }
}
