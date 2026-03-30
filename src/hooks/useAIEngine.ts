/**
 * useAIEngine — data hooks for ML model observability
 */
import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/supabase'

export interface ModelWeight {
  id: string
  model_name: string
  signal_name: string
  weight: number
  description: string
  min_val: number
  max_val: number
  is_active: boolean
}

export interface SignalScore {
  raw: number
  weight: number
}

export interface HealthScoreEvent {
  id: string
  project_id: string
  health_score: number
  risk_score: number
  health_status: string
  pulse_condition: string
  signals: Record<string, SignalScore>
  model_version: string
  trigger_source: string
  transaction_time: string
  project?: { name: string; code: string }
}

export interface ModelVersion {
  id: string
  version_tag: string
  algorithm: string
  r_squared: number
  r_squared_std: number
  rmse: number
  mae: number
  feature_count: number
  training_rows: number
  features_added: string[]
  status: string
  promoted_at: string
  training_notes: string
}

export interface AIEngineStats {
  totalEvents: number
  totalProjectsScored: number
  avgHealthScore: number
  criticalProjects: number
  modelAccuracy: number
  lastScoredAt: string | null
}

export const aiKeys = {
  weights: () => ['ai', 'weights'] as const,
  events: () => ['ai', 'events'] as const,
  recentEvents: () => ['ai', 'events', 'recent'] as const,
  model: () => ['ai', 'model'] as const,
  stats: () => ['ai', 'stats'] as const,
  projectBreakdown: () => ['ai', 'project-breakdown'] as const,
}

export function useModelWeights() {
  return useQuery({
    queryKey: aiKeys.weights(),
    queryFn: async (): Promise<ModelWeight[]> => {
      const { data, error } = await db
        .from('model_weights')
        .select('*')
        .eq('model_name', 'project_risk_v1')
        .eq('is_active', true)
        .order('weight', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as ModelWeight[]
    },
  })
}

export function useRecentHealthEvents(limit = 50) {
  return useQuery({
    queryKey: aiKeys.recentEvents(),
    queryFn: async (): Promise<HealthScoreEvent[]> => {
      const { data, error } = await db
        .from('health_score_events')
        .select('*, project:projects!project_id(name, code)')
        .order('transaction_time', { ascending: false })
        .limit(limit)
      if (error) throw new Error(error.message)
      return (data ?? []) as HealthScoreEvent[]
    },
  })
}

export function useModelVersion() {
  return useQuery({
    queryKey: aiKeys.model(),
    queryFn: async (): Promise<ModelVersion | null> => {
      const { data, error } = await db
        .from('ml_model_versions')
        .select('*')
        .eq('status', 'production')
        .limit(1)
        .single()
      if (error) throw new Error(error.message)
      return data as ModelVersion
    },
    staleTime: 10 * 60 * 1000,
  })
}

export function useAIEngineStats() {
  return useQuery({
    queryKey: aiKeys.stats(),
    queryFn: async (): Promise<AIEngineStats> => {
      const { data: events, error: evErr } = await db
        .from('health_score_events')
        .select('project_id, health_score, pulse_condition, transaction_time')
      if (evErr) throw new Error(evErr.message)

      const rows = events ?? []
      const uniqueProjects = new Set(rows.map(r => r.project_id))
      const scores = rows.map(r => Number(r.health_score))
      const avgScore = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0

      // Get latest event per project to count current critical
      const latestByProject = new Map<string, typeof rows[0]>()
      rows.forEach(r => {
        const existing = latestByProject.get(r.project_id)
        if (!existing || r.transaction_time > existing.transaction_time) {
          latestByProject.set(r.project_id, r)
        }
      })
      const criticalCount = Array.from(latestByProject.values())
        .filter(r => r.pulse_condition === 'critical').length

      const { data: model } = await db
        .from('ml_model_versions')
        .select('r_squared')
        .eq('status', 'production')
        .limit(1)
        .single()

      const sortedTimes = rows.map(r => r.transaction_time).sort().reverse()

      return {
        totalEvents: rows.length,
        totalProjectsScored: uniqueProjects.size,
        avgHealthScore: avgScore,
        criticalProjects: criticalCount,
        modelAccuracy: model ? Number(model.r_squared) * 100 : 0,
        lastScoredAt: sortedTimes[0] ?? null,
      }
    },
    staleTime: 2 * 60 * 1000,
  })
}
