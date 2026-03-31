/**
 * Constellation Worker — force-directed graph simulation
 *
 * Reference implementation for all PMO Platform workers.
 * Demonstrates the full WorkerBus protocol:
 *   - CONSTELLATION_LAYOUT: single-response, returns stable final positions
 *   - CONSTELLATION_TICK:   stream-response, emits positions on every simulation frame
 *   - CONSTELLATION_DRAG:   single-response, pins/unpins a node and re-heats simulation
 *   - CANCEL:               stops an active stream and tears down the simulation
 *
 * Hybrid state model (ADR-001 Decision 4):
 *   - First call: full hydration — builds simulation from scratch
 *   - Subsequent calls: version-gated fast path — apply delta if version is sequential
 *   - Auto-fallback: any version gap triggers full re-hydration automatically
 *
 * This worker runs entirely off the main thread. It imports d3-force directly.
 * d3-force is extracted into the 'workers-shared' Rollup chunk — it is NOT
 * duplicated between this worker bundle and the main application bundle.
 */

import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force'

import type {
  BusMessage,
  BusResponse,
  ConstellationGraph,
  ConstellationNode,
  ConstellationEdge,
  ConstellationTick,
  CancelMessage,
  InboundMessage,
} from './types'

// ─── d3 node/link types ───────────────────────────────────────────────────────

// d3-force mutates nodes in place — extend our node type with d3's required fields
type D3Node = ConstellationNode & SimulationNodeDatum

type D3Link = Omit<ConstellationEdge, 'source' | 'target'> &
  SimulationLinkDatum<D3Node> & {
    // After d3 resolves references, source/target become D3Node objects
    source: D3Node | string
    target: D3Node | string
  }

// ─── Simulation thresholds ────────────────────────────────────────────────────

/** alpha below this = simulation is stable, stop streaming ticks */
const ALPHA_STABLE   = 0.01
/** alpha decay per tick — lower = slower/smoother convergence */
const ALPHA_DECAY    = 0.02
/** velocity decay — higher = more friction/damping */
const VELOCITY_DECAY = 0.4

// ─── State (hybrid model) ─────────────────────────────────────────────────────

interface WorkerState {
  simulation: Simulation<D3Node, D3Link>
  nodes:      D3Node[]
  links:      D3Link[]
  version:    number
  width:      number
  height:     number
}

let state: WorkerState | null = null

/** Currently active stream correlationId — only one tick stream runs at a time */
let activeStreamId: string | null = null

// ─── Helpers ──────────────────────────────────────────────────────────────────

function reply<D>(response: BusResponse<D>): void {
  self.postMessage(response)
}

function replyTick(correlationId: string, tick: ConstellationTick): void {
  reply<ConstellationTick>({ correlationId, kind: 'tick', data: tick })
}

function replyResult<D>(correlationId: string, data: D): void {
  reply<D>({ correlationId, kind: 'result', data })
}

function replyComplete(correlationId: string): void {
  reply({ correlationId, kind: 'complete' })
}

function replyError(correlationId: string, message: string): void {
  reply({ correlationId, kind: 'error', error: message })
}

/** Extract current positions from live d3 nodes — structured-clone safe */
function snapshotNodes(nodes: D3Node[]): ConstellationTick['nodes'] {
  return nodes.map(n => ({ id: n.id, x: n.x ?? 0, y: n.y ?? 0 }))
}

// ─── Simulation builder ───────────────────────────────────────────────────────

function buildSimulation(graph: ConstellationGraph): WorkerState {
  // Deep-copy nodes so d3 mutation doesn't affect the original structured clone
  const nodes: D3Node[] = graph.nodes.map(n => ({ ...n }))

  const links: D3Link[] = graph.edges.map(e => ({
    ...e,
    source: e.source,
    target: e.target,
  }))

  const simulation = forceSimulation<D3Node, D3Link>(nodes)
    .alphaDecay(ALPHA_DECAY)
    .velocityDecay(VELOCITY_DECAY)
    .alpha(1)
    .stop() // We drive ticks manually for streaming control

  simulation
    .force('charge', forceManyBody<D3Node>().strength(n => -(30 + n.weight * 20)))
    .force('link',   forceLink<D3Node, D3Link>(links)
                       .id(n => n.id)
                       .distance(80)
                       .strength(l => l.strength))
    .force('center',  forceCenter(graph.width / 2, graph.height / 2).strength(0.05))
    .force('collide', forceCollide<D3Node>().radius(n => n.radius + 4).strength(0.7))

  return { simulation, nodes, links, version: graph.version, width: graph.width, height: graph.height }
}

// ─── Hybrid state: version-gated fast path ────────────────────────────────────

/**
 * Apply a full graph if state is cold or versions diverge (slow path),
 * or return the existing state after a re-heat if version is sequential (fast path).
 *
 * The fast path exists so that interactive operations (drag, add node) don't
 * re-serialize the entire graph across the thread boundary — only the delta
 * payload changes.
 */
function hydrateOrUpdate(graph: ConstellationGraph): WorkerState {
  if (!state) {
    // Cold start — full hydration
    return buildSimulation(graph)
  }

  if (graph.version === state.version + 1) {
    // Fast path: version is exactly sequential — apply new positions/bounds
    // For now, full rebuild but preserve existing node positions
    const previousPositions = new Map(state.nodes.map(n => [n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy }]))
    const newState = buildSimulation(graph)

    // Carry over positions for nodes that existed before — avoids layout jump
    for (const node of newState.nodes) {
      const prev = previousPositions.get(node.id)
      if (prev) {
        node.x  = prev.x
        node.y  = prev.y
        node.vx = prev.vx
        node.vy = prev.vy
      }
    }

    // Re-heat — user made a change, animate to new equilibrium
    newState.simulation.alpha(0.3).restart().stop()
    return newState
  }

  // Version gap — full re-hydration (handles out-of-order messages, worker restarts)
  return buildSimulation(graph)
}

// ─── Message handlers ─────────────────────────────────────────────────────────

/**
 * CONSTELLATION_TICK — stream mode
 * Drives the force simulation manually, emitting one tick message per frame
 * until the simulation stabilizes or the stream is cancelled.
 */
function handleConstellationTick(msg: BusMessage<ConstellationGraph>): void {
  const { correlationId, payload } = msg

  // Cancel any existing tick stream before starting a new one
  activeStreamId = correlationId

  try {
    state = hydrateOrUpdate(payload)
  } catch (err) {
    replyError(correlationId, `Hydration failed: ${String(err)}`)
    return
  }

  const { simulation, nodes } = state

  function tick(): void {
    // Stream was cancelled or replaced
    if (activeStreamId !== correlationId) return

    simulation.tick()

    const alpha      = simulation.alpha()
    const stabilized = alpha < ALPHA_STABLE

    replyTick(correlationId, {
      nodes: snapshotNodes(nodes),
      alpha,
      stabilized,
    })

    if (stabilized) {
      activeStreamId = null
      replyComplete(correlationId)
      return
    }

    // Schedule next tick — setTimeout(0) yields to the event loop between ticks
    // so CANCEL messages can be processed without blocking the simulation
    setTimeout(tick, 0)
  }

  tick()
}

/**
 * CONSTELLATION_LAYOUT — single mode
 * Runs the simulation to completion (no streaming) and returns final positions.
 * Useful for initial layout before the Constellation view is mounted.
 */
function handleConstellationLayout(msg: BusMessage<ConstellationGraph>): void {
  const { correlationId, payload } = msg

  try {
    state = hydrateOrUpdate(payload)
  } catch (err) {
    replyError(correlationId, `Layout failed: ${String(err)}`)
    return
  }

  const { simulation, nodes } = state

  // Run to completion synchronously — acceptable for pre-mount layout
  simulation.tick(Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - ALPHA_DECAY)))

  replyResult<ConstellationTick>(correlationId, {
    nodes:      snapshotNodes(nodes),
    alpha:      simulation.alpha(),
    stabilized: true,
  })
}

/**
 * CONSTELLATION_DRAG — single mode
 * Pin or unpin a node and re-heat the simulation.
 */
function handleConstellationDrag(
  msg: BusMessage<{ nodeId: string; x: number | null; y: number | null }>,
): void {
  const { correlationId, payload } = msg

  if (!state) {
    replyError(correlationId, 'Worker has no active simulation state')
    return
  }

  const node = state.nodes.find(n => n.id === payload.nodeId)
  if (!node) {
    replyError(correlationId, `Node ${payload.nodeId} not found`)
    return
  }

  // null = unpin; number = pin at position
  node.fx = payload.x
  node.fy = payload.y

  // Re-heat so the graph settles around the dragged node
  state.simulation.alpha(0.3).restart().stop()

  replyResult(correlationId, { success: true })
}

// ─── Message router ───────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<InboundMessage>) => {
  const msg = e.data

  if (msg.type === 'CANCEL') {
    const cancel = msg as CancelMessage
    if (activeStreamId === cancel.correlationId) {
      activeStreamId = null
    }
    return
  }

  const busMsg = msg as BusMessage

  switch (busMsg.type) {
    case 'CONSTELLATION_TICK':
      handleConstellationTick(busMsg as BusMessage<ConstellationGraph>)
      break

    case 'CONSTELLATION_LAYOUT':
      handleConstellationLayout(busMsg as BusMessage<ConstellationGraph>)
      break

    case 'CONSTELLATION_DRAG':
      handleConstellationDrag(busMsg as BusMessage<{ nodeId: string; x: number | null; y: number | null }>)
      break

    default:
      console.warn(`[constellation.worker] Unknown message type: ${busMsg.type}`)
  }
}
