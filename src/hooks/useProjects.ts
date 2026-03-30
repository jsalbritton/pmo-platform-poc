/**
 * useProjects — data hooks for the projects domain
 *
 * PATTERN: each hook = queryKey + queryFn + TanStack Query options.
 *
 * queryKey  — cache identity. ['projects', filters] means "projects with
 *             these specific filters". Change a filter → different cache
 *             entry → new fetch. Same filters → cache hit, no network call.
 *
 * queryFn   — async function that fetches from Supabase and either returns
 *             typed data or throws. Never return null on error — throw so
 *             TanStack Query catches it and sets isError = true.
 *
 * The hook returns { data, isLoading, isError, error, refetch, isFetching }.
 * Components destructure what they need. They never call db directly.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '@/lib/supabase'
import type { Project, ProjectStatus, PortfolioStats, Profile, Sprint, Risk } from '@/types'

// ─── ENRICHED PROJECT TYPE ──────────────────────────────────────────────────
// Supabase's nested select returns owner as an object when using FK join syntax.
export interface ProjectWithOwner extends Project {
  owner: Pick<Profile, 'id' | 'display_name' | 'full_name' | 'avatar_url'> | null
}

// ─── QUERY KEYS ───────────────────────────────────────────────────────────────

export const projectKeys = {
  all:    ()              => ['projects']                 as const,
  lists:  ()              => ['projects', 'list']         as const,
  list:   (f: ProjectFilters) => ['projects', 'list', f] as const,
  detail: (id: string)    => ['projects', id]             as const,
  stats:  ()              => ['projects', 'stats']        as const,
}

// ─── FILTER TYPE ──────────────────────────────────────────────────────────────

export interface ProjectFilters {
  status?: ProjectStatus | 'all'
  ownerId?: string
  programId?: string
  search?: string
  page?: number
  pageSize?: number
}

// ─── FETCH FUNCTIONS ─────────────────────────────────────────────────────────

async function fetchProjects(filters: ProjectFilters = {}): Promise<ProjectWithOwner[]> {
  const { status, ownerId, programId, search, page = 1, pageSize = 100 } = filters

  // Join profiles via owner_id FK to get owner display_name + initials.
  // Supabase syntax: "owner:profiles!owner_id(id, display_name, full_name, avatar_url)"
  // This returns an `owner` object nested inside each project row.
  let query = db
    .from('projects')
    .select('*, owner:profiles!owner_id(id, display_name, full_name, avatar_url)')
    .order('health_score', { ascending: true, nullsFirst: false })  // worst health first
    .range((page - 1) * pageSize, page * pageSize - 1)

  // status filter — 'all' means no filter
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }
  if (ownerId) query = query.eq('owner_id', ownerId)
  if (programId) query = query.eq('program_id', programId)
  if (search) {
    // ilike = case-insensitive LIKE. %term% = contains anywhere in the string.
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) throw new Error(`Failed to fetch projects: ${error.message}`)
  return (data as ProjectWithOwner[]) ?? []
}

async function fetchProjectById(id: string): Promise<ProjectWithOwner> {
  const { data, error } = await db
    .from('projects')
    .select('*, owner:profiles!owner_id(id, display_name, full_name, avatar_url)')
    .eq('id', id)
    .single()

  if (error) throw new Error(`Failed to fetch project ${id}: ${error.message}`)
  return data as ProjectWithOwner
}

async function fetchPortfolioStats(): Promise<PortfolioStats> {
  const { data, error } = await db
    .from('projects')
    .select('status, health_score')

  if (error) throw new Error(`Failed to fetch portfolio stats: ${error.message}`)

  const rows = data as Pick<Project, 'status' | 'health_score'>[]

  // Exclude parked statuses from health scoring — they are terminal / not-yet-active states.
  // Must match PARKED_STATUSES in Portfolio.tsx so sidebar & KPI tiles agree.
  const PARKED = new Set(['completed', 'cancelled', 'on_hold', 'planning'])
  const activeRows = rows.filter(r => !PARKED.has(r.status))

  const scores = activeRows.map(r => r.health_score ?? 50)
  const avgHealthScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0

  // DESIGN INTENT: In an ML-driven PMO, risk classification derives from health_score,
  // NOT from the PM-managed status field. A PM marking something "active" doesn't mean
  // it isn't at risk. The ML engine sets health_score; these thresholds classify it.
  //
  // Thresholds align with the HealthBar component in Portfolio.tsx:
  //   health >= 70  → On Track  (green)
  //   health 40–69  → At Risk   (amber)
  //   health < 40   → Critical  (red)
  //
  // Parked projects are excluded — they are terminal / pre-active states
  // and shouldn't inflate the at-risk/critical counts.
  return {
    total: activeRows.length,
    onTrack:  activeRows.filter(r => (r.health_score ?? 50) >= 70).length,
    atRisk:   activeRows.filter(r => { const h = r.health_score ?? 50; return h >= 40 && h < 70 }).length,
    critical: activeRows.filter(r => (r.health_score ?? 50) < 40).length,
    avgHealthScore,
  }
}

// ─── HOOKS ───────────────────────────────────────────────────────────────────

/**
 * useProjects — fetches a filtered, paginated list of projects.
 *
 * placeholderData keeps the previous filter results visible while
 * new results load — prevents the table from blanking on filter change.
 *
 * Usage:
 *   const { data: projects = [], isLoading } = useProjects({ status: 'at-risk' })
 */
export function useProjects(filters: ProjectFilters = {}) {
  return useQuery({
    queryKey: projectKeys.list(filters),
    queryFn:  () => fetchProjects(filters),
    placeholderData: (prev) => prev,
  })
}

/**
 * useProject — fetches a single project by id.
 * Used in /project/:id route.
 *
 * enabled: false when id is empty — prevents a query with an undefined key.
 */
export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn:  () => fetchProjectById(id),
    enabled:  Boolean(id),
  })
}

/**
 * usePortfolioStats — aggregate counts for the portfolio header.
 * staleTime override: stats don't need to be as fresh as individual rows.
 */
export function usePortfolioStats() {
  return useQuery({
    queryKey: projectKeys.stats(),
    queryFn:  fetchPortfolioStats,
    staleTime: 2 * 60 * 1000,  // 2 min — slightly less fresh than row data
  })
}

/**
 * useUpdateProjectStatus — mutation: change a project's status field.
 *
 * After success:
 *   - setQueryData updates the detail cache immediately (optimistic-feel)
 *   - invalidateQueries marks the list as stale → background refetch
 *
 * Usage:
 *   const { mutate } = useUpdateProjectStatus()
 *   mutate({ id: project.id, status: 'at-risk' })
 */
export function useUpdateProjectStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ProjectStatus }) => {
      const { data, error } = await db
        .from('projects')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw new Error(`Failed to update status: ${error.message}`)
      return data as Project
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(projectKeys.detail(updated.id), updated)
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
      queryClient.invalidateQueries({ queryKey: projectKeys.stats() })
    },
  })
}

// ─── PROJECT DETAIL HOOKS ────────────────────────────────────────────────────

/** Work item status counts for a project */
export interface WorkItemCounts {
  total: number
  todo: number
  in_progress: number
  done: number
  blocked: number
  overdue: number
  totalPoints: number
  completedPoints: number
}

export function useProjectWorkItemCounts(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'work-item-counts'],
    queryFn: async (): Promise<WorkItemCounts> => {
      const { data, error } = await db
        .from('work_items')
        .select('status, story_points, due_date')
        .eq('project_id', projectId)

      if (error) throw new Error(error.message)
      const items = data ?? []
      const now = new Date().toISOString().slice(0, 10)
      return {
        total:           items.length,
        todo:            items.filter(i => i.status === 'todo' || i.status === 'backlog').length,
        in_progress:     items.filter(i => i.status === 'in_progress').length,
        done:            items.filter(i => i.status === 'done' || i.status === 'completed').length,
        blocked:         items.filter(i => i.status === 'blocked').length,
        overdue:         items.filter(i => i.due_date && i.due_date < now && i.status !== 'done' && i.status !== 'completed').length,
        totalPoints:     items.reduce((s, i) => s + (i.story_points ?? 0), 0),
        completedPoints: items.filter(i => i.status === 'done' || i.status === 'completed').reduce((s, i) => s + (i.story_points ?? 0), 0),
      }
    },
    enabled: Boolean(projectId),
  })
}

export function useProjectSprints(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'sprints'],
    queryFn: async (): Promise<Sprint[]> => {
      const { data, error } = await db
        .from('sprints')
        .select('*')
        .eq('project_id', projectId)
        .order('sprint_number', { ascending: false })
        .limit(10)

      if (error) throw new Error(error.message)
      return (data as Sprint[]) ?? []
    },
    enabled: Boolean(projectId),
  })
}

// ─── COMPLETE SPRINT ─────────────────────────────────────────────────────────

/**
 * useCompleteSprint — marks an active sprint as completed.
 *
 * Optimistic update: flips the sprint's status in cache immediately so the
 * UI responds before the network round-trip. Rolls back on error. Invalidates
 * both the sprints list and the project detail on settle.
 *
 * Pattern mirrors useUpdateWorkItem for consistency.
 */
export function useCompleteSprint(projectId: string) {
  const queryClient = useQueryClient()
  const sprintKey   = ['projects', projectId, 'sprints'] as const

  return useMutation({
    mutationFn: async (sprintId: string) => {
      const { error } = await db
        .from('sprints')
        .update({ status: 'completed' })
        .eq('id', sprintId)

      if (error) throw new Error(`Failed to complete sprint: ${error.message}`)
    },

    onMutate: async (sprintId) => {
      await queryClient.cancelQueries({ queryKey: sprintKey })
      const snapshot = queryClient.getQueryData<Sprint[]>(sprintKey)

      queryClient.setQueryData<Sprint[]>(sprintKey, (prev) =>
        prev?.map((s) =>
          s.id === sprintId ? { ...s, status: 'completed' as const } : s
        )
      )

      return { snapshot }
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) queryClient.setQueryData(sprintKey, ctx.snapshot)
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sprintKey })
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
    },
  })
}

export function useProjectRisks(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'risks'],
    queryFn: async (): Promise<Risk[]> => {
      const { data, error } = await db
        .from('risks')
        .select('*')
        .eq('project_id', projectId)
        .order('risk_score', { ascending: false, nullsFirst: false })
        .limit(20)

      if (error) throw new Error(error.message)
      return (data as Risk[]) ?? []
    },
    enabled: Boolean(projectId),
  })
}
