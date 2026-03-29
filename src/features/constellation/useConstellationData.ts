/**
 * useConstellationData.ts — TanStack Query hook for Constellation View
 *
 * THIS FILE HAS ONE JOB:
 * Fetch data from Supabase, cache it, subscribe to Realtime, and return
 * transformed nodes + edges ready for @xyflow/react.
 *
 * THREE INVALIDATION TRIGGERS:
 * 1. Supabase Realtime (WebSocket) — event-driven, instant on data change
 * 2. staleTime (60s) — safety net, auto-refetch when cache is stale
 * 3. Manual — after re-score mutation, onSuccess invalidates the cache
 *
 * WHY THIS FILE CHANGES ON AZURE MIGRATION:
 * - Supabase client → Azure PostgreSQL direct or Supabase-on-Azure
 * - Realtime subscription → Azure SignalR
 * - Everything else (TanStack, transform, @xyflow) stays the same
 *
 * ARCHITECTURE REF: Constellation_View_Architecture.html, Steps 1-2
 */

import { useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '@/lib/supabase'
import type { Project } from '@/types'
import {
  transformConstellationData,
  type PropagationResult,
  type SparklineMap,
} from './transformData'

// ─── QUERY KEYS ──────────────────────────────────────────────────────────────
// Structured keys for cache identity. Change a key segment → different cache entry.

export const constellationKeys = {
  all:          () => ['constellation']                     as const,
  projects:     () => ['constellation', 'projects']         as const,
  propagation:  (id: string) => ['constellation', 'propagation', id] as const,
  sparklines:   () => ['constellation', 'sparklines']       as const,
}

// ─── FETCH FUNCTIONS ─────────────────────────────────────────────────────────

/**
 * Query A — All projects with Pulse data for node rendering
 */
async function fetchConstellationProjects(): Promise<Project[]> {
  const { data, error } = await db
    .from('projects')
    .select(`
      id, name, vertical, program_id, owner_id, status,
      health_score, risk_score,
      pulse_condition, pulse_momentum, pulse_signals, pulse_updated_at
    `)
    .neq('status', 'cancelled')
    .order('health_score', { ascending: true, nullsFirst: false })

  if (error) throw new Error(`[Constellation] Failed to fetch projects: ${error.message}`)
  return (data as Project[]) ?? []
}

/**
 * Query B — Risk propagation for a specific project (D-043 resource-driven)
 * Called when a critical/elevated project is selected or on initial load for worst project.
 */
async function fetchPropagation(projectId: string): Promise<PropagationResult | null> {
  if (!projectId) return null

  const { data, error } = await db.rpc('ml_propagate_risk', {
    p_project_id: projectId,
  })

  if (error) {
    console.warn(`[Constellation] Propagation fetch failed for ${projectId}:`, error.message)
    return null
  }
  return data as PropagationResult
}

/**
 * Query C — Sparkline data: last 6 health scores per project
 * Used for the mini trajectory charts inside each node.
 */
async function fetchSparklines(): Promise<SparklineMap> {
  const { data, error } = await db
    .from('health_score_events')
    .select('project_id, new_health_score, transaction_time')
    .order('transaction_time', { ascending: false })
    .limit(900)  // ~6 per project × 150 projects

  if (error) {
    console.warn('[Constellation] Sparkline fetch failed:', error.message)
    return {}
  }

  // Group by project_id, keep last 6, reverse to oldest→newest
  const map: SparklineMap = {}
  for (const row of data ?? []) {
    const pid = row.project_id as string
    if (!map[pid]) map[pid] = []
    if (map[pid].length < 6) {
      map[pid].push(row.new_health_score as number)
    }
  }
  // Reverse each array so sparklines read left=oldest, right=newest
  for (const pid of Object.keys(map)) {
    map[pid].reverse()
  }
  return map
}

// ─── MAIN HOOK ───────────────────────────────────────────────────────────────

export function useConstellationData(selectedProjectId?: string) {
  const queryClient = useQueryClient()

  // Query A — All projects
  const projectsQuery = useQuery({
    queryKey: constellationKeys.projects(),
    queryFn: fetchConstellationProjects,
    staleTime: 60_000,          // 60 seconds — Trigger 2 (safety net timer)
    refetchOnWindowFocus: true,  // refetch when user tabs back
  })

  // Query B — Risk propagation for selected project
  // Finds the worst project automatically if none selected
  const triggerProjectId = selectedProjectId
    ?? projectsQuery.data?.find(p =>
      p.pulse_condition === 'critical' || p.pulse_condition === 'elevated'
    )?.id
    ?? ''

  const propagationQuery = useQuery({
    queryKey: constellationKeys.propagation(triggerProjectId),
    queryFn: () => fetchPropagation(triggerProjectId),
    enabled: Boolean(triggerProjectId),
    staleTime: 60_000,
  })

  // Query C — Sparkline data
  const sparklineQuery = useQuery({
    queryKey: constellationKeys.sparklines(),
    queryFn: fetchSparklines,
    staleTime: 5 * 60_000,      // 5 min — sparklines don't need to be as fresh
  })

  // ─── TRIGGER 1: Supabase Realtime (WebSocket) ─────────────────────────────
  // Event-driven — fires instantly when projects table changes.
  // Calls queryClient.invalidateQueries() which tells TanStack to refetch.
  useEffect(() => {
    const channel = db
      .channel('constellation-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',                  // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'projects',
        },
        () => {
          // Invalidate all constellation queries — TanStack refetches automatically
          queryClient.invalidateQueries({ queryKey: constellationKeys.all() })
        }
      )
      .subscribe()

    return () => {
      db.removeChannel(channel)
    }
  }, [queryClient])

  // ─── TRANSFORM — Step 3 in the pipeline ────────────────────────────────────
  // useMemo ensures transform only re-runs when source data changes,
  // not on every React render cycle.
  const { nodes, edges } = useMemo(
    () => transformConstellationData(
      projectsQuery.data ?? [],
      propagationQuery.data ?? null,
      sparklineQuery.data ?? {},
    ),
    [projectsQuery.data, propagationQuery.data, sparklineQuery.data]
  )

  // ─── TRIGGER 3: Manual re-score mutation ───────────────────────────────────
  // Used by the detail panel "Re-score" button.
  // POST to FastAPI → update DB → invalidate cache → nodes re-render.
  const rescoreMutation = useMutation({
    mutationFn: async (projectId: string) => {
      // This will call the FastAPI endpoint once Railway is deployed
      // For now, scaffold returns the project ID for the onSuccess handler
      const FASTAPI_URL = import.meta.env.VITE_FASTAPI_URL ?? 'http://localhost:8000'
      const session = await db.auth.getSession()
      const jwt = session.data.session?.access_token

      const response = await fetch(`${FASTAPI_URL}/api/predict/${projectId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Re-score failed: ${response.status} ${response.statusText}`)
      }
      return response.json()
    },
    onSuccess: () => {
      // Invalidate everything — new scores mean new nodes, new propagation, new sparklines
      queryClient.invalidateQueries({ queryKey: constellationKeys.all() })
    },
  })

  return {
    // Data for @xyflow
    nodes,
    edges,

    // Loading states
    isLoading: projectsQuery.isLoading,
    isError: projectsQuery.isError,
    error: projectsQuery.error,

    // For the detail panel
    projects: projectsQuery.data ?? [],
    propagation: propagationQuery.data ?? null,

    // Actions
    rescore: rescoreMutation.mutate,
    isRescoring: rescoreMutation.isPending,

    // Refetch manually (e.g., after bulk operations)
    refetch: () => queryClient.invalidateQueries({ queryKey: constellationKeys.all() }),
  }
}
