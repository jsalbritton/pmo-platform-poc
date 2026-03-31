/**
 * transformSigmaData.ts — Pure transform: Supabase rows → sigma.js / graphology attributes
 *
 * THIS FILE HAS ONE JOB:
 * Convert database-shaped project data into the attribute shapes that graphology
 * and sigma.js expect for WebGL rendering.
 *
 * WHY A SEPARATE FILE FROM transformData.ts:
 * transformData.ts produces @xyflow/react Node<T> and Edge<T> shapes — those are
 * React component wrappers around nodes. sigma.js uses graphology Graph attributes
 * (plain objects on nodes/edges), not React components. The two renderers have
 * incompatible attribute schemas; separating them keeps each pure and testable.
 *
 * WHAT IS REUSED FROM transformData.ts:
 * - PULSE_COLORS — exact fill, border, glow per condition (single source of truth)
 * - edgeColor()  — relationship-type color logic (D-043)
 * - edgeStrokeWidth() — exposure-weight → stroke width
 *
 * CONSULTING HANDOFF NOTE:
 * When the production build migrates to Azure PostgreSQL, only the Supabase client
 * in useConstellationData.ts changes. This file and transformData.ts are unchanged.
 *
 * ADR reference: ADR-002 (sigma.js renderer decision)
 */

import type { Project } from '@/types'
import {
  PULSE_COLORS,
  edgeColor,
  edgeStrokeWidth,
  type PropagationResult,
  type RiskEdgeData,
} from './transformData'
import type { ConstellationGraph, ConstellationNode, ConstellationEdge } from '@/workers/types'

// ─── SIGMA NODE ATTRIBUTES ────────────────────────────────────────────────────
// These are the graphology node attributes sigma reads at render time.
// sigma requires: x, y, size, color
// We add: label, borderColor, pulse metadata for the overlay layer

export interface SigmaNodeAttributes {
  // sigma required
  x:     number
  y:     number
  size:  number
  color: string
  label: string

  // sigma extended — used by our custom renderers and overlay
  borderColor:     string
  glowColor:       string
  pulseCondition:  string | null
  pulseMomentum:   string | null
  healthScore:     number | null
  riskScore:       number | null
  vertical:        string | null
  projectStatus:   string
  // Whether this node is currently highlighted (selected or in propagation cascade)
  highlighted:     boolean
}

// ─── SIGMA EDGE ATTRIBUTES ────────────────────────────────────────────────────

export interface SigmaEdgeAttributes {
  // sigma required
  size:  number
  color: string
  // Relationship metadata — used by overlay tooltips
  exposureWeight:  number
  relationships:   RiskEdgeData['relationships'] | null
  reasons:         string[]
}

// ─── SIZE SCALE ───────────────────────────────────────────────────────────────
// Node size communicates project priority at a glance.
// critical > high > medium > low, dormant projects are slightly smaller.

const PRIORITY_SIZE: Record<string, number> = {
  critical: 22,
  high:     16,
  medium:   12,
  low:      9,
}

function nodeSize(project: Project): number {
  const base = PRIORITY_SIZE[project.priority] ?? 12
  // Dormant projects render slightly smaller — they're not actively changing
  if (project.pulse_condition === 'dormant') return Math.max(base - 2, 7)
  return base
}

function nodeColor(project: Project): string {
  if (project.pulse_condition) {
    return PULSE_COLORS[project.pulse_condition]?.fill ?? '#374151'
  }
  // Unscored projects get the dormant color
  return PULSE_COLORS.dormant.fill
}

function nodeBorderColor(project: Project): string {
  if (project.pulse_condition) {
    return PULSE_COLORS[project.pulse_condition]?.border ?? '#4b5563'
  }
  return PULSE_COLORS.dormant.border
}

function nodeGlowColor(project: Project): string {
  if (project.pulse_condition) {
    return PULSE_COLORS[project.pulse_condition]?.glow ?? 'rgba(107,114,128,0.15)'
  }
  return PULSE_COLORS.dormant.glow
}

// ─── TRANSFORM: Projects → Sigma node attributes ──────────────────────────────

export function buildSigmaNodeAttributes(project: Project): SigmaNodeAttributes {
  return {
    // Position — sigma/graphology requires x/y at creation time.
    // These are overwritten immediately on the first WorkerBus tick.
    // Initial values spread nodes randomly so the simulation has non-zero starting positions.
    x:    0,
    y:    0,

    size:        nodeSize(project),
    color:       nodeColor(project),
    label:       project.name,
    borderColor: nodeBorderColor(project),
    glowColor:   nodeGlowColor(project),

    pulseCondition: project.pulse_condition ?? null,
    pulseMomentum:  project.pulse_momentum  ?? null,
    healthScore:    project.health_score    ?? null,
    riskScore:      project.risk_score      ?? null,
    vertical:       project.vertical        ?? null,
    projectStatus:  project.status,
    highlighted:    false,
  }
}

// ─── TRANSFORM: PropagationResult → Sigma edge attributes ────────────────────

export function buildSigmaEdgeAttributes(
  exposureWeight: number,
  relationships: RiskEdgeData['relationships'],
  reasons: string[],
): SigmaEdgeAttributes {
  return {
    size:          edgeStrokeWidth(exposureWeight),
    color:         edgeColor(relationships),
    exposureWeight,
    relationships,
    reasons,
  }
}

// ─── TRANSFORM: Projects → WorkerBus ConstellationGraph ──────────────────────
// This produces the graph payload for the d3-force Web Worker.
// Separate from sigma attributes — the worker doesn't know about sigma.

export function buildConstellationGraph(
  projects: Project[],
  propagation: PropagationResult | null,
  version: number,
  canvasWidth:  number,
  canvasHeight: number,
): ConstellationGraph {
  const activeProjects = projects.filter(p => p.status !== 'cancelled')

  const nodes: ConstellationNode[] = activeProjects.map(p => ({
    id:     p.id,
    radius: nodeSize(p),   // collision radius = visual size
    weight: (PRIORITY_SIZE[p.priority] ?? 12) / 12, // 0.75–1.83, affects charge
  }))

  // Edges come from propagation result (D-043 resource-driven relationships)
  const edges: ConstellationEdge[] = propagation?.affected_projects?.map(ap => ({
    source:   propagation.trigger_project,
    target:   ap.id,
    strength: Math.min(ap.exposure_weight, 1),
  })) ?? []

  // Additionally connect projects in the same vertical with weak ties
  // so isolated clusters don't drift to screen edges
  const verticalMap = new Map<string, string[]>()
  for (const p of activeProjects) {
    if (!p.vertical) continue
    const group = verticalMap.get(p.vertical) ?? []
    group.push(p.id)
    verticalMap.set(p.vertical, group)
  }

  for (const group of verticalMap.values()) {
    if (group.length < 2) continue
    // Chain connect within vertical — avoids n² edges for large verticals
    for (let i = 0; i < group.length - 1; i++) {
      // Only add if not already in edges (avoid duplicate)
      const src = group[i]
      const tgt = group[i + 1]
      const exists = edges.some(
        e => (e.source === src && e.target === tgt) || (e.source === tgt && e.target === src)
      )
      if (!exists) {
        edges.push({ source: src, target: tgt, strength: 0.1 })
      }
    }
  }

  return { version, nodes, edges, width: canvasWidth, height: canvasHeight }
}
