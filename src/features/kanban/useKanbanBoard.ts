/**
 * useKanbanBoard — data layer for the Kanban Sprint Board (S1B-002).
 *
 * RESPONSIBILITIES:
 *   1. Fetch work items for a project, optionally filtered by sprint
 *   2. Group items into columns (by status, assignee, priority, or type)
 *   3. Apply quick-filters (type, priority, assignee, label, search text)
 *   4. Handle drag-and-drop reordering + column moves (status changes)
 *   5. Expose column metadata (count, WIP limit, over-limit flag)
 *
 * ARCHITECTURE:
 *   Raw data    → useQuery(workItemKeys.list(projectId))
 *   Grouped     → useMemo: group items into KanbanColumnData[]
 *   Filtered    → useMemo: apply quick-filters to grouped data
 *   Reordered   → optimistic mutation on drop (board_position + status)
 *
 * WHY GROUP CLIENT-SIDE?
 *   The board shows ≤200 items for one sprint. Grouping in JS is <1ms.
 *   Server-side grouping would require N queries (one per column) or a
 *   custom RPC. Client-side grouping keeps the data layer simple and
 *   lets us re-group instantly when the user switches group-by dimension.
 *
 * WIP LIMITS:
 *   Stored per-column in local state (not DB — WIP limits are a team
 *   preference, not a data attribute). Default: unlimited. When set,
 *   the column header shows a warning badge if count > limit.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useCallback } from 'react'
import { db } from '@/lib/supabase'
import { workItemKeys } from '@/features/work-items/useWorkItem'
import type {
  WorkItem,
  WorkItemStatus,
  WorkItemPriority,
  WorkItemType,
  WorkItemProfile,
} from '@/features/work-items/workItem.types'
import { STATUS_CONFIG, PRIORITY_CONFIG, TYPE_CONFIG } from '@/features/work-items/workItem.types'

// ─── TYPES ───────────────────────────────────────────────────────────────────

/** A work item with its joined assignee profile (board-level shape) */
export interface KanbanItem extends WorkItem {
  assignee: Pick<WorkItemProfile, 'id' | 'full_name' | 'display_name' | 'email' | 'avatar_url'> | null
}

/** One column on the board */
export interface KanbanColumnData {
  id:        string          // column key (e.g. 'in_progress', 'user-uuid', 'high')
  label:     string          // display label
  color:     string          // Tailwind text class or hex
  dotColor:  string          // hex for status dot
  items:     KanbanItem[]    // work items in this column
  wipLimit:  number | null   // null = unlimited
  isOverWip: boolean         // true if items.length > wipLimit
}

/** How columns are grouped */
export type GroupByField = 'status' | 'assignee' | 'priority' | 'type'

/** Quick-filter state */
export interface KanbanFilters {
  types:      WorkItemType[]
  priorities: WorkItemPriority[]
  assignees:  string[]          // user IDs
  labels:     string[]
  search:     string            // free-text title search
}

/** Sprint option for the selector */
export interface SprintOption {
  id:           string
  sprint_number: number
  name:         string | null
  sprint_start: string | null
  sprint_end:   string | null
  status:       string | null
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

/** Status column order (intentional — matches workflow progression) */
const STATUS_ORDER: WorkItemStatus[] = [
  'backlog', 'todo', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled',
]

const PRIORITY_ORDER: WorkItemPriority[] = [
  'urgent', 'high', 'medium', 'low', 'no_priority',
]

const TYPE_ORDER: WorkItemType[] = [
  'epic', 'story', 'task', 'bug', 'spike',
]

/** Columns that are collapsed by default */
export const DEFAULT_COLLAPSED: string[] = ['cancelled']

// ─── EMPTY FILTERS ───────────────────────────────────────────────────────────

export const EMPTY_FILTERS: KanbanFilters = {
  types: [],
  priorities: [],
  assignees: [],
  labels: [],
  search: '',
}

// ─── FETCH ───────────────────────────────────────────────────────────────────

/**
 * Fetch work items for a project, optionally filtered by sprint.
 * Returns top-level items only (sub-tasks loaded in detail panel).
 */
async function fetchBoardItems(projectId: string, sprintId?: string | null): Promise<KanbanItem[]> {
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
      )
    `)
    .eq('project_id', projectId)
    .is('parent_id', null)

  if (sprintId) {
    query = query.eq('sprint_id', sprintId)
  }

  const { data, error } = await query
    .order('board_position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch board items: ${error.message}`)
  return (data ?? []) as KanbanItem[]
}

/** Fetch sprints for a project (for the sprint selector) */
async function fetchProjectSprints(projectId: string): Promise<SprintOption[]> {
  const { data, error } = await db
    .from('sprints')
    .select('id, sprint_number, name, sprint_start, sprint_end, status')
    .eq('project_id', projectId)
    .order('sprint_number', { ascending: false })

  if (error) throw new Error(`Failed to fetch sprints: ${error.message}`)
  return (data ?? []) as SprintOption[]
}

/** Fetch unique team members who have items in this project */
async function fetchProjectTeam(projectId: string): Promise<WorkItemProfile[]> {
  const { data, error } = await db
    .rpc('get_project_team_members', { p_project_id: projectId })

  // If the RPC doesn't exist yet, fall back to a simpler query
  if (error) {
    const { data: fallback } = await db
      .from('work_items')
      .select(`
        assignee:profiles!work_items_assignee_id_fkey (
          id, full_name, display_name, email, avatar_url, role, title, department
        )
      `)
      .eq('project_id', projectId)
      .not('assignee_id', 'is', null)

    if (!fallback) return []

    // Deduplicate by ID
    const seen = new Set<string>()
    const unique: WorkItemProfile[] = []
    for (const row of fallback) {
      const a = row.assignee as unknown as WorkItemProfile | null
      if (a && !seen.has(a.id)) {
        seen.add(a.id)
        unique.push(a)
      }
    }
    return unique
  }

  return (data ?? []) as WorkItemProfile[]
}

// ─── GROUPING ────────────────────────────────────────────────────────────────

function groupByStatus(
  items: KanbanItem[],
  wipLimits: Record<string, number | null>,
): KanbanColumnData[] {
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
      id:        s,
      label:     col.label,
      color:     col.color,
      dotColor:  col.dotColor,
      items:     colItems,
      wipLimit:  wip,
      isOverWip: wip !== null && colItems.length > wip,
    }
  })
}

function groupByPriority(
  items: KanbanItem[],
  wipLimits: Record<string, number | null>,
): KanbanColumnData[] {
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
      id:        p,
      label:     cfg.label,
      color:     cfg.color,
      dotColor:  '#64748b',
      items:     colItems,
      wipLimit:  wip,
      isOverWip: wip !== null && colItems.length > wip,
    }
  })
}

function groupByType(
  items: KanbanItem[],
  wipLimits: Record<string, number | null>,
): KanbanColumnData[] {
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
      id:        t,
      label:     cfg.label,
      color:     cfg.color,
      dotColor:  '#64748b',
      items:     colItems,
      wipLimit:  wip,
      isOverWip: wip !== null && colItems.length > wip,
    }
  })
}

function groupByAssignee(
  items: KanbanItem[],
  wipLimits: Record<string, number | null>,
): KanbanColumnData[] {
  const buckets = new Map<string, KanbanItem[]>()
  const names = new Map<string, string>()

  // Always have an "Unassigned" column
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

  // Sort: unassigned first, then alphabetical by name
  const keys = Array.from(buckets.keys()).sort((a, b) => {
    if (a === unassignedKey) return -1
    if (b === unassignedKey) return 1
    return (names.get(a) ?? '').localeCompare(names.get(b) ?? '')
  })

  return keys.map((key) => {
    const colItems = buckets.get(key) ?? []
    const wip = wipLimits[key] ?? null
    return {
      id:        key,
      label:     names.get(key) ?? 'Unknown',
      color:     'text-slate-300',
      dotColor:  key === unassignedKey ? '#475569' : '#58a6ff',
      items:     colItems,
      wipLimit:  wip,
      isOverWip: wip !== null && colItems.length > wip,
    }
  })
}

// ─── FILTERING ───────────────────────────────────────────────────────────────

function applyFilters(items: KanbanItem[], filters: KanbanFilters): KanbanItem[] {
  return items.filter((item) => {
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

export function useKanbanBoard(projectId: string | undefined) {
  const queryClient = useQueryClient()

  // ── Board settings (local state) ────────────────────────────────────────────
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null)
  const [groupBy, setGroupBy]                   = useState<GroupByField>('status')
  const [filters, setFilters]                   = useState<KanbanFilters>(EMPTY_FILTERS)
  const [wipLimits, setWipLimits]               = useState<Record<string, number | null>>({})
  const [collapsedColumns, setCollapsedColumns]  = useState<Set<string>>(new Set(DEFAULT_COLLAPSED))

  // ── Data queries ────────────────────────────────────────────────────────────
  const itemsQuery = useQuery({
    queryKey: [...workItemKeys.list(projectId ?? ''), selectedSprintId ?? 'all'],
    queryFn:  () => fetchBoardItems(projectId!, selectedSprintId),
    enabled:  Boolean(projectId),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  })

  const sprintsQuery = useQuery({
    queryKey: ['sprints', projectId ?? ''],
    queryFn:  () => fetchProjectSprints(projectId!),
    enabled:  Boolean(projectId),
    staleTime: 60_000,
  })

  const teamQuery = useQuery({
    queryKey: ['team-members', projectId ?? ''],
    queryFn:  () => fetchProjectTeam(projectId!),
    enabled:  Boolean(projectId),
    staleTime: 60_000,
  })

  // ── Derived: filter → group ─────────────────────────────────────────────────
  const allItems = itemsQuery.data ?? []

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
    }
  }, [filteredItems, groupBy, wipLimits])

  // Split columns into visible and collapsed
  const visibleColumns = useMemo(
    () => columns.filter((c) => !collapsedColumns.has(c.id)),
    [columns, collapsedColumns],
  )

  const hiddenColumns = useMemo(
    () => columns.filter((c) => collapsedColumns.has(c.id)),
    [columns, collapsedColumns],
  )

  // ── Aggregate stats ─────────────────────────────────────────────────────────
  const totalItems      = allItems.length
  const filteredCount   = filteredItems.length
  const hasActiveFilter = filters.types.length > 0 ||
    filters.priorities.length > 0 ||
    filters.assignees.length > 0 ||
    filters.labels.length > 0 ||
    filters.search.trim() !== ''

  // Unique labels across all items (for filter dropdown)
  const allLabels = useMemo(() => {
    const s = new Set<string>()
    for (const item of allItems) {
      for (const l of item.labels ?? []) s.add(l)
    }
    return Array.from(s).sort()
  }, [allItems])

  // ── Drag-and-drop mutation ──────────────────────────────────────────────────
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
      // Build the update payload based on groupBy field
      const patch: Record<string, unknown> = { board_position: newPosition }

      if (groupBy === 'status')   patch.status      = newColumnId
      if (groupBy === 'priority') patch.priority     = newColumnId
      if (groupBy === 'type')     patch.type         = newColumnId
      if (groupBy === 'assignee') {
        patch.assignee_id = newColumnId === '__unassigned__' ? null : newColumnId
      }

      const { error } = await db
        .from('work_items')
        .update(patch)
        .eq('id', itemId)

      if (error) throw new Error(`Failed to move item: ${error.message}`)
    },

    // ── Optimistic update ────────────────────────────────────────────────────
    onMutate: async ({ itemId, newColumnId, newPosition }) => {
      const listKey = [...workItemKeys.list(projectId ?? ''), selectedSprintId ?? 'all']
      await queryClient.cancelQueries({ queryKey: listKey })

      const prev = queryClient.getQueryData<KanbanItem[]>(listKey)

      if (prev) {
        const updated = prev.map((item) => {
          if (item.id !== itemId) return item

          const patch: Partial<KanbanItem> = { board_position: newPosition }
          if (groupBy === 'status')   patch.status      = newColumnId as WorkItemStatus
          if (groupBy === 'priority') patch.priority     = newColumnId as WorkItemPriority
          if (groupBy === 'type')     patch.type         = newColumnId as WorkItemType
          if (groupBy === 'assignee') patch.assignee_id  = newColumnId === '__unassigned__' ? null : newColumnId

          return { ...item, ...patch }
        })

        queryClient.setQueryData(listKey, updated)
      }

      return { prev }
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        const listKey = [...workItemKeys.list(projectId ?? ''), selectedSprintId ?? 'all']
        queryClient.setQueryData(listKey, ctx.prev)
      }
    },

    onSettled: () => {
      const listKey = [...workItemKeys.list(projectId ?? ''), selectedSprintId ?? 'all']
      queryClient.invalidateQueries({ queryKey: listKey })
    },
  })

  // ── Column actions ──────────────────────────────────────────────────────────
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

  // ── Return ──────────────────────────────────────────────────────────────────
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
    teamMembers: teamQuery.data ?? [],

    // Loading
    isLoading:  itemsQuery.isLoading,
    isError:    itemsQuery.isError,

    // Sprint
    sprints:          sprintsQuery.data ?? [],
    selectedSprintId,
    setSelectedSprintId,

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
