/**
 * transformData.ts — Pure transform: Supabase rows → @xyflow nodes[] + edges[]
 *
 * THIS FILE HAS ONE JOB:
 * Convert database-shaped data into the shape @xyflow/react expects.
 * No React. No hooks. No side effects. No data fetching.
 * Input: Supabase rows.  Output: { nodes: Node[], edges: Edge[] }
 *
 * WHY PURE:
 * - Testable independently (jest, no React test renderer needed)
 * - When consulting firm migrates to Azure PostgreSQL, this file doesn't change
 * - All Pulse → visual mapping lives here, single source of truth
 *
 * ARCHITECTURE REF: Constellation_View_Architecture.html, Step 3
 * DECISION REF: D-043 (resource-driven risk propagation)
 */

// @xyflow/react was uninstalled in S1A (constellation migrated to sigma.js).
// These minimal local types replace Node<T> and Edge<T> so the legacy transform
// functions compile without the dependency. The functions themselves are dead code
// in the sigma.js path — preserved as reference for the consulting firm handoff.
type XFlowNode<TData> = {
  id: string
  type: string
  position: { x: number; y: number }
  data: TData
  style?: Record<string, unknown>
}
type XFlowEdge<TData> = {
  id: string
  source: string
  target: string
  type?: string
  animated?: boolean
  data: TData
}

import type { Project, PulseCondition, PulseMomentum, PulseSignal } from '@/types'

// ─── EXPORTED TYPES ──────────────────────────────────────────────────────────

/** Shape of data passed into each ProjectNode component via node.data */
export interface ProjectNodeData {
  [key: string]: unknown              // index signature for @xyflow/react Node<T>
  projectId: string
  name: string
  condition: PulseCondition | null
  momentum: PulseMomentum | null
  signals: PulseSignal[] | null
  healthScore: number | null
  riskScore: number | null
  vertical: string | null
  sparkline: number[]               // last 6 health scores, oldest → newest
}

/** Shape of data passed into each RiskEdge component via edge.data */
export interface RiskEdgeData {
  [key: string]: unknown              // index signature for @xyflow/react Edge<T>
  exposureWeight: number             // 0.4 – 1.0, drives line thickness
  relationships: {
    same_pm: boolean
    same_program: boolean
    same_vertical: boolean
    shared_resource: boolean
    critical_resource: boolean
    shared_resource_count: number
    max_allocation_pct: number
  }
  reasons: string[]                  // ["Shared resource at 135% (CRITICAL)"]
  constrainedResources: {
    user_id: string
    total_allocation_pct: number
    utilization_condition: string
    on_trigger_pct: number
    on_affected_pct: number
  }[]
}

/** Return type of ml_propagate_risk() from Supabase */
export interface PropagationResult {
  trigger_project: string
  trigger_name: string
  trigger_condition: string
  affected_count: number
  computed_at: string
  affected_projects: {
    id: string
    name: string
    vertical: string
    health_score: number
    pulse_condition: PulseCondition
    exposure_weight: number
    propagation_reasons: string[]
    relationships: RiskEdgeData['relationships']
    constrained_resources: RiskEdgeData['constrainedResources']
  }[]
}

/** Sparkline lookup: project_id → last 6 scores */
export type SparklineMap = Record<string, number[]>

// ─── PULSE → VISUAL MAPPING ─────────────────────────────────────────────────
// Single source of truth for all condition → color/size/animation mappings.
// ProjectNode.tsx reads these; it never computes colors itself.

export const PULSE_COLORS: Record<PulseCondition, {
  fill: string
  border: string
  glow: string
  label: string
}> = {
  healthy:  { fill: '#059669', border: '#34d399', glow: 'rgba(5,150,105,0.25)',   label: 'Healthy' },
  watch:    { fill: '#d97706', border: '#fbbf24', glow: 'rgba(217,119,6,0.25)',   label: 'Watch' },
  elevated: { fill: '#dc2626', border: '#f87171', glow: 'rgba(220,38,38,0.25)',   label: 'Elevated' },
  critical: { fill: '#7f1d1d', border: '#ef4444', glow: 'rgba(239,68,68,0.35)',   label: 'Critical' },
  dormant:  { fill: '#374151', border: '#6b7280', glow: 'rgba(107,114,128,0.15)', label: 'Dormant' },
}

// ─── EDGE COLOR BY RELATIONSHIP TYPE (D-043) ────────────────────────────────
// Priority order: shared_resource > same_pm > same_program > same_vertical+resource

export function edgeColor(relationships: RiskEdgeData['relationships']): string {
  if (relationships.shared_resource && relationships.max_allocation_pct >= 120) return '#ef4444'  // critical resource — red
  if (relationships.shared_resource) return '#f87171'   // elevated resource — lighter red
  if (relationships.same_pm) return '#8b5cf6'           // purple
  if (relationships.same_program) return '#3b82f6'      // blue
  if (relationships.same_vertical) return '#059669'     // green (only if shared resource exists per D-043)
  return '#475569'                                      // fallback gray
}

export function edgeStrokeWidth(exposureWeight: number): number {
  // 0.4 → 1.5px, 1.0 → 3.5px
  return 1.5 + (exposureWeight - 0.4) * (2 / 0.6)
}

export function edgeDashArray(relationships: RiskEdgeData['relationships']): string {
  // Shared resource edges are dashed (risk cascade), others solid
  if (relationships.shared_resource) return '6,4'
  return 'none'
}

// ─── TRANSFORM FUNCTION ─────────────────────────────────────────────────────

export function transformProjectsToNodes(
  projects: Project[],
  sparklines: SparklineMap = {},
): XFlowNode<ProjectNodeData>[] {
  return projects
    .filter(p => p.status !== 'cancelled')   // cancelled projects don't appear
    .map((p) => {
      const condition = p.pulse_condition ?? null

      return {
        id: p.id,
        type: 'projectNode',
        position: { x: 0, y: 0 },            // force layout calculates actual position
        data: {
          projectId: p.id,
          name: p.name,
          condition,
          momentum: p.pulse_momentum ?? null,
          signals: p.pulse_signals ?? null,
          healthScore: p.health_score,
          riskScore: p.risk_score,
          vertical: p.vertical,
          sparkline: sparklines[p.id] ?? [],
        },
        // Pass visual properties for force layout grouping
        style: {
          // @xyflow uses these for the wrapper div; actual node rendering is in ProjectNode.tsx
        },
      } satisfies XFlowNode<ProjectNodeData>
    })
}

export function transformPropagationToEdges(
  propagation: PropagationResult | null,
): XFlowEdge<RiskEdgeData>[] {
  if (!propagation || !propagation.affected_projects) return []

  return propagation.affected_projects.map((ap) => ({
    id: `${propagation.trigger_project}-${ap.id}`,
    source: propagation.trigger_project,
    target: ap.id,
    type: 'riskEdge',
    animated: ap.relationships.shared_resource && ap.relationships.max_allocation_pct >= 120,
    data: {
      exposureWeight: ap.exposure_weight,
      relationships: ap.relationships,
      reasons: ap.propagation_reasons,
      constrainedResources: ap.constrained_resources,
    },
  } satisfies XFlowEdge<RiskEdgeData>))
}

// ─── COMBINED TRANSFORM ─────────────────────────────────────────────────────
// Single entry point: give it all the Supabase data, get back nodes + edges.

export function transformConstellationData(
  projects: Project[],
  propagation: PropagationResult | null,
  sparklines: SparklineMap = {},
): { nodes: XFlowNode<ProjectNodeData>[]; edges: XFlowEdge<RiskEdgeData>[] } {
  return {
    nodes: transformProjectsToNodes(projects, sparklines),
    edges: transformPropagationToEdges(propagation),
  }
}
