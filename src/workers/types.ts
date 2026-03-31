/**
 * WorkerBus shared protocol types
 *
 * These types are the communication contract between the main thread (WorkerBus)
 * and every domain worker. Both sides import from this file — changes here affect
 * all workers simultaneously.
 *
 * ADR-001: Decision 3 — Structured protocol with Observable streaming
 */

// ─── Core protocol ────────────────────────────────────────────────────────────

/** Every message the bus sends to a worker */
export interface BusMessage<P = unknown> {
  /** Discriminated message type — each worker handles a known set of types */
  type: string
  /** UUID correlating this message to its pending Promise/Observable */
  correlationId: string
  /** Declares whether the caller expects a single result or a stream of ticks */
  responseMode: 'single' | 'stream'
  /** Domain-specific payload — typed by each worker's handler */
  payload: P
}

/** Special cancel message — no correlationId Promise resolution, fire-and-forget */
export interface CancelMessage {
  type: 'CANCEL'
  correlationId: string
}

export type InboundMessage<P = unknown> = BusMessage<P> | CancelMessage

/** Every response a worker sends back to the bus */
export interface BusResponse<D = unknown> {
  correlationId: string
  /**
   * result  — single-mode response, Promise resolves
   * tick    — stream-mode progress update, Observable.next()
   * complete — stream ended cleanly, Observable.complete()
   * error   — either mode failed, Promise.reject() / Observable.error()
   */
  kind: 'result' | 'tick' | 'complete' | 'error'
  data?: D
  error?: string
}

// ─── Worker domains ───────────────────────────────────────────────────────────

export type WorkerDomain = 'constellation' | 'ml' | 'risk'

// ─── Constellation types ──────────────────────────────────────────────────────

/** A node in the Constellation force graph */
export interface ConstellationNode {
  id: string
  /** d3-force mutable position fields (set to undefined before first tick) */
  x?: number
  y?: number
  vx?: number
  vy?: number
  /** Pin a node: set fx/fy to lock position (null = unpinned) */
  fx?: number | null
  fy?: number | null
  /** Visual size — influences collision radius */
  radius: number
  /** Affects charge strength — busier projects repel more */
  weight: number
}

/** An edge in the Constellation force graph */
export interface ConstellationEdge {
  source: string
  target: string
  /** 0–1 — affects link spring strength */
  strength: number
}

/**
 * The full graph payload sent to the Constellation worker.
 * version is a monotonic integer — the worker uses it for the hybrid
 * state model fast path. Increment on every mutation.
 *
 * ADR-001: Decision 4 — Hybrid state model (stateless protocol, stateful internals)
 */
export interface ConstellationGraph {
  version: number
  nodes: ConstellationNode[]
  edges: ConstellationEdge[]
  /** Canvas bounds for force centering */
  width: number
  height: number
}

/** Delta update — sent when only a subset of nodes changed */
export interface ConstellationDelta {
  version: number
  /** Partial node updates — only changed nodes included */
  nodeUpdates?: Array<Partial<ConstellationNode> & { id: string }>
  /** New edges added */
  addedEdges?: ConstellationEdge[]
  /** Edge source+target pairs removed */
  removedEdges?: Array<{ source: string; target: string }>
}

/** One tick of the force simulation — streamed progressively */
export interface ConstellationTick {
  /** Current positions of all nodes */
  nodes: Array<{ id: string; x: number; y: number }>
  /** d3 alpha — approaches 0 as simulation stabilizes (starts at 1) */
  alpha: number
  /** True when alpha has dropped below the stabilization threshold */
  stabilized: boolean
}

// ─── ML worker types (S2 placeholders) ────────────────────────────────────────

export interface RiskScoreRequest {
  projectIds: string[]
}

export interface RiskScore {
  projectId: string
  score: number
  confidence: number
  factors: string[]
}

// ─── Risk propagation types (S3 placeholders) ─────────────────────────────────

export interface PropagationRequest {
  sourceProjectId: string
  graphSnapshot: ConstellationGraph
}

export interface PropagationTick {
  affectedNodeId: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  depth: number
}
