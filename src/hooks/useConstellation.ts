/**
 * useConstellation — React hook for the Constellation force simulation
 *
 * Drives the WorkerBus ↔ Constellation worker connection from a React component.
 * Returns live node positions that update every simulation tick.
 *
 * Usage:
 *   const { nodes, alpha, isStabilized, startSimulation, dragNode } = useConstellation()
 *
 *   // Call startSimulation with your graph data to begin
 *   useEffect(() => {
 *     startSimulation({ version: 1, nodes: projectNodes, edges, width, height })
 *   }, [projectNodes, edges])
 *
 *   // nodes updates automatically on every tick — pass to your WebGL/SVG renderer
 *
 * Subscription lifecycle:
 *   The hook creates one Observable subscription per simulation run.
 *   It unsubscribes automatically on unmount and whenever startSimulation
 *   is called with new data (cancelling the previous stream).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { workerBus } from '@/workers/bus'
import type { ConstellationGraph, ConstellationTick } from '@/workers/types'
import type { Subscription } from '@/workers/observable'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ConstellationNodePosition {
  id: string
  x: number
  y: number
}

export interface UseConstellationReturn {
  /** Current node positions — updates every simulation tick */
  nodes:         ConstellationNodePosition[]
  /** d3 alpha — 1.0 = hot, 0.0 = fully stable. Useful for showing a "settling" indicator */
  alpha:         number
  /** True once the simulation has converged below the stable threshold */
  isStabilized:  boolean
  /** Send a new graph to the worker and start streaming ticks */
  startSimulation: (graph: ConstellationGraph) => void
  /** Pin or unpin a node — triggers a re-heat and re-settle */
  dragNode: (nodeId: string, x: number | null, y: number | null) => void
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useConstellation(): UseConstellationReturn {
  const [nodes,        setNodes]        = useState<ConstellationNodePosition[]>([])
  const [alpha,        setAlpha]        = useState(0)
  const [isStabilized, setIsStabilized] = useState(false)

  // Ref holds the active subscription — avoids stale closure in cleanup
  const subscriptionRef = useRef<Subscription | null>(null)

  // Cancel the current stream on unmount
  useEffect(() => {
    return () => {
      subscriptionRef.current?.unsubscribe()
      subscriptionRef.current = null
    }
  }, [])

  const startSimulation = useCallback((graph: ConstellationGraph) => {
    // Cancel any existing stream before starting a new one
    subscriptionRef.current?.unsubscribe()

    setIsStabilized(false)
    setAlpha(1)

    const subscription = workerBus
      .stream<ConstellationTick>('constellation', 'CONSTELLATION_TICK', graph)
      .subscribe({
        next: (tick) => {
          setNodes(tick.nodes)
          setAlpha(tick.alpha)
          if (tick.stabilized) setIsStabilized(true)
        },
        error: (err) => {
          console.error('[useConstellation] Simulation error:', err)
          setIsStabilized(true) // Stop showing spinner on error
        },
        complete: () => {
          setIsStabilized(true)
        },
      })

    subscriptionRef.current = subscription
  }, [])

  const dragNode = useCallback(
    async (nodeId: string, x: number | null, y: number | null) => {
      try {
        await workerBus.dispatch('constellation', 'CONSTELLATION_DRAG', { nodeId, x, y })
      } catch (err) {
        console.error('[useConstellation] Drag failed:', err)
      }
    },
    [],
  )

  return { nodes, alpha, isStabilized, startSimulation, dragNode }
}
