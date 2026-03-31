/**
 * ConstellationSigmaCanvas.tsx — WebGL graph renderer
 *
 * THIS FILE HAS ONE JOB:
 * Own the sigma.js WebGL renderer lifecycle, subscribe to the WorkerBus
 * tick stream, and drive 60fps node position updates without involving React.
 *
 * WHY POSITIONS BYPASS REACT STATE:
 * React state updates are batched and async — they go through the reconciler
 * on every tick. At 60fps that's 60 reconciler cycles per second for position
 * data that only sigma needs. Instead, we mutate graphology attributes directly
 * and call sigma.refresh({ skipIndexation: true }) — a direct WebGL draw call
 * that never touches React. React state is only updated for low-frequency events:
 * selected node, alpha/settling indicator, error state.
 *
 * DATA FLOW (60fps path):
 *   WorkerBus tick → graphRef.current.mergeNodeAttributes(id, {x, y}) → sigma.refresh()
 *   (no setState, no re-render, pure WebGL)
 *
 * DATA FLOW (React path):
 *   Selected node click → onNodeSelect(id) → parent setState → DetailPanel renders
 *   Alpha change → onAlphaChange(alpha) → parent setState → settling bar updates
 *
 * UPGRADE PATH (Sprint 2+):
 * Replace NodeCircleProgram with a custom WebGL program for:
 *   - Per-node bloom/glow via fragment shader
 *   - Pulse condition radial gradient (not flat fill)
 *   - "Breathing" animation on critical nodes (time-uniform shader)
 * See: https://www.sigmajs.org/docs/advanced/custom-rendering/
 *
 * ADR reference: ADR-002 (sigma.js renderer)
 * ADR reference: ADR-001 Decision 2/3 (WorkerBus, Observable streaming)
 */

import { useEffect, useRef, useCallback } from 'react'
import Sigma from 'sigma'
import Graph from 'graphology'
import { workerBus } from '@/workers/bus'
import type { ConstellationGraph, ConstellationTick } from '@/workers/types'
import type { Subscription } from '@/workers/observable'
import {
  buildSigmaNodeAttributes,
  buildSigmaEdgeAttributes,
  type SigmaNodeAttributes,
  type SigmaEdgeAttributes,
} from './transformSigmaData'
import type { Project } from '@/types'
import type { PropagationResult } from './transformData'

// ─── Types ─────────────────────────────────────────────────────────────────────

// sigma's generic takes attribute types directly (not the Graph type)
type SigmaGraph    = Graph<SigmaNodeAttributes, SigmaEdgeAttributes>
type SigmaInstance = Sigma<SigmaNodeAttributes, SigmaEdgeAttributes>

interface Props {
  /** Active project list from useConstellationData */
  projects:    Project[]
  /** Risk propagation edges from ml_propagate_risk() */
  propagation: PropagationResult | null
  /** Full graph payload for the d3-force worker */
  workerGraph: ConstellationGraph
  /** Called when the user clicks a node (pass project id) or clicks empty space (null) */
  onNodeSelect: (nodeId: string | null) => void
  /** Called on every tick with current simulation heat (1.0 = hot, 0.0 = stable) */
  onAlphaChange: (alpha: number) => void
  /** Called once when simulation stabilises */
  onStabilized: () => void
  /** Currently selected node id — used to highlight in renderer */
  selectedNodeId: string | null
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ConstellationSigmaCanvas({
  projects,
  propagation,
  workerGraph,
  onNodeSelect,
  onAlphaChange,
  onStabilized,
  selectedNodeId,
}: Props) {
  const containerRef   = useRef<HTMLDivElement>(null)
  const sigmaRef       = useRef<SigmaInstance | null>(null)
  const graphRef       = useRef<SigmaGraph | null>(null)
  const subscriptionRef = useRef<Subscription | null>(null)
  const isDraggingRef  = useRef(false)
  const draggedNodeRef = useRef<string | null>(null)

  // ── Graph initialisation ────────────────────────────────────────────────────
  // Runs once on mount. Builds the graphology model and mounts sigma.

  useEffect(() => {
    if (!containerRef.current) return

    const graph: SigmaGraph = new Graph()

    // Add nodes — one per non-cancelled project
    for (const project of projects) {
      if (project.status === 'cancelled') continue
      graph.addNode(project.id, buildSigmaNodeAttributes(project))
    }

    // Add edges from risk propagation result (D-043)
    if (propagation?.affected_projects) {
      for (const ap of propagation.affected_projects) {
        const src = propagation.trigger_project
        const tgt = ap.id
        if (!graph.hasNode(src) || !graph.hasNode(tgt)) continue
        const edgeId = `${src}--${tgt}`
        if (!graph.hasEdge(edgeId)) {
          graph.addEdgeWithKey(edgeId, src, tgt,
            buildSigmaEdgeAttributes(ap.exposure_weight, ap.relationships, ap.propagation_reasons)
          )
        }
      }
    }

    graphRef.current = graph

    const sigma = new Sigma<SigmaNodeAttributes, SigmaEdgeAttributes>(graph, containerRef.current, {
      // Labels are rendered by the overlay layer, not sigma
      // (sigma labels would require custom label renderer for our dark theme)
      renderLabels:       false,
      renderEdgeLabels:   false,
      // Default appearance — overridden per-node via graph attributes
      defaultNodeColor:   '#374151',
      defaultEdgeColor:   'rgba(51,187,255,0.2)',
      defaultEdgeType:    'line',
      // Zoom config
      minCameraRatio:     0.15,
      maxCameraRatio:     4,
      // Enable edge interaction events (sigma v3 unified flag)
      enableEdgeEvents: true,
    })

    sigmaRef.current = sigma

    // ── Node interaction ──────────────────────────────────────────────────────

    sigma.on('clickNode', ({ node }) => {
      onNodeSelect(node)
    })

    sigma.on('clickStage', () => {
      onNodeSelect(null)
    })

    // ── Drag to pin node ──────────────────────────────────────────────────────
    // Drag = pin node at position (tells worker to fix fx/fy)
    // Release = unpin (worker resumes physics for that node)

    sigma.on('downNode', ({ node }) => {
      isDraggingRef.current  = true
      draggedNodeRef.current = node
      // Disable camera pan while dragging a node
      sigma.getCamera().disable()
      // Visually highlight the dragged node
      graph.setNodeAttribute(node, 'highlighted', true)
      sigma.refresh({ skipIndexation: true })
    })

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !draggedNodeRef.current) return
      if (!containerRef.current || !sigmaRef.current || !graphRef.current) return

      const rect    = containerRef.current.getBoundingClientRect()
      const viewX   = e.clientX - rect.left
      const viewY   = e.clientY - rect.top
      const graphPos = sigmaRef.current.viewportToGraph({ x: viewX, y: viewY })

      graphRef.current.mergeNodeAttributes(draggedNodeRef.current, {
        x: graphPos.x,
        y: graphPos.y,
      })
      sigmaRef.current.refresh({ skipIndexation: true })
    }

    const handleMouseUp = () => {
      if (!isDraggingRef.current || !draggedNodeRef.current) return

      const node     = draggedNodeRef.current
      const nodeAttr = graphRef.current?.getNodeAttributes(node)

      if (nodeAttr) {
        // Tell the worker to pin this node at its current position
        void workerBus.dispatch('constellation', 'CONSTELLATION_DRAG', {
          nodeId: node,
          x:     nodeAttr.x,
          y:     nodeAttr.y,
        })
      }

      graphRef.current?.setNodeAttribute(node, 'highlighted', false)
      sigmaRef.current?.refresh({ skipIndexation: true })

      isDraggingRef.current  = false
      draggedNodeRef.current = null
      sigma.getCamera().enable()
    }

    const container = containerRef.current
    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseup',   handleMouseUp)
    // Catch mouseup outside canvas (user dragged off-screen)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseup',   handleMouseUp)
      window.removeEventListener('mouseup', handleMouseUp)
      sigma.kill()
      sigmaRef.current  = null
      graphRef.current  = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Intentional: sigma initialises once. Data changes handled by other effects.

  // ── Tick stream subscription ────────────────────────────────────────────────
  // Subscribes to the WorkerBus d3-force tick stream.
  // CRITICAL: positions update graphology directly — no React setState.

  useEffect(() => {
    subscriptionRef.current?.unsubscribe()

    const sub = workerBus
      .stream<ConstellationTick>('constellation', 'CONSTELLATION_TICK', workerGraph)
      .subscribe({
        next: (tick) => {
          const graph = graphRef.current
          const sigma = sigmaRef.current
          if (!graph || !sigma) return

          // Update all node positions — direct graphology mutation, bypasses React
          for (const { id, x, y } of tick.nodes) {
            if (graph.hasNode(id)) {
              graph.mergeNodeAttributes(id, { x, y })
            }
          }

          // Fast WebGL redraw — skipIndexation avoids rebuilding the spatial index
          // since graph structure (nodes/edges) hasn't changed, only positions
          sigma.refresh({ skipIndexation: true })

          // Low-frequency React updates — settling indicator only
          onAlphaChange(tick.alpha)
          if (tick.stabilized) onStabilized()
        },
        error: (err) => {
          console.error('[ConstellationSigmaCanvas] Worker simulation error:', err)
          onStabilized()
        },
      })

    subscriptionRef.current = sub

    return () => {
      sub.unsubscribe()
      subscriptionRef.current = null
    }
  // Re-subscribe when the graph payload changes (new data from Supabase Realtime)
  }, [workerGraph, onAlphaChange, onStabilized])

  // ── Selection highlight ─────────────────────────────────────────────────────
  // When selectedNodeId changes, update the visual highlight state in graphology.
  // sigma.refresh() re-renders with the new highlight.

  useEffect(() => {
    const graph = graphRef.current
    const sigma = sigmaRef.current
    if (!graph || !sigma) return

    graph.forEachNode((nodeId) => {
      const shouldHighlight = nodeId === selectedNodeId
      const currentHighlight = graph.getNodeAttribute(nodeId, 'highlighted')
      if (shouldHighlight !== currentHighlight) {
        graph.setNodeAttribute(nodeId, 'highlighted', shouldHighlight)
      }
    })

    sigma.refresh({ skipIndexation: true })
  }, [selectedNodeId])

  // ── Graph sync on data change ───────────────────────────────────────────────
  // When projects or propagation changes (Realtime update or re-score),
  // update graphology attributes and re-subscribe to worker stream.

  const syncGraph = useCallback(() => {
    const graph = graphRef.current
    if (!graph) return

    // Update node attributes for changed projects
    for (const project of projects) {
      if (project.status === 'cancelled') {
        if (graph.hasNode(project.id)) graph.dropNode(project.id)
        continue
      }
      if (graph.hasNode(project.id)) {
        const fresh = buildSigmaNodeAttributes(project)
        // Preserve current position — don't reset to (0,0) on data refresh
        const current = graph.getNodeAttributes(project.id)
        graph.mergeNodeAttributes(project.id, {
          ...fresh,
          x: current.x,
          y: current.y,
        })
      } else {
        graph.addNode(project.id, buildSigmaNodeAttributes(project))
      }
    }

    sigmaRef.current?.refresh({ skipIndexation: false }) // Full refresh after structural change
  }, [projects])

  useEffect(() => {
    syncGraph()
  }, [syncGraph])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{
        // Transparent so the CSS animated background (Layer 1) shows through
        background: 'transparent',
        cursor: isDraggingRef.current ? 'grabbing' : 'default',
      }}
    />
  )
}
