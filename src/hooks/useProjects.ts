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
import type { Project, ProjectStatus, PortfolioStats } from '@/types'

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

async function fetchProjects(filters: ProjectFilters = {}): Promise<Project[]> {
  const { status, ownerId, programId, search, page = 1, pageSize = 100 } = filters

  let query = db
    .from('projects')
    .select('*')
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
  return (data as Project[]) ?? []
}

async function fetchProjectById(id: string): Promise<Project> {
  const { data, error } = await db
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(`Failed to fetch project ${id}: ${error.message}`)
  return data as Project
}

async function fetchPortfolioStats(): Promise<PortfolioStats> {
  const { data, error } = await db
    .from('projects')
    .select('status, health_score')

  if (error) throw new Error(`Failed to fetch portfolio stats: ${error.message}`)

  const rows = data as Pick<Project, 'status' | 'health_score'>[]
  const total = rows.length

  // Exclude completed/cancelled/on_hold from health scoring — they are terminal states
  const activeRows = rows.filter(r =>
    r.status !== 'completed' && r.status !== 'cancelled' && r.status !== 'on_hold'
  )

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
  // Completed/cancelled/on_hold projects are excluded — they are terminal states
  // and shouldn't inflate the at-risk/critical counts.
  return {
    total,
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
