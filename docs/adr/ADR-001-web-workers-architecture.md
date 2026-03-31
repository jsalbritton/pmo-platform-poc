# ADR-001: Web Workers Architecture

**Date:** 2026-03-30
**Status:** Accepted
**Author:** Jeremy Salbritton (Global IT Lead)
**Scope:** Sprint 1B — PMO Platform POC

**Related documents:**
- [System Overview](../architecture/SYSTEM_OVERVIEW.md)
- [Data Sovereignty Policy](../architecture/DATA_SOVEREIGNTY.md) — all ML inference runs in-browser, no external AI APIs
- [Deferred Decisions](../DEFERRED_DECISIONS.md) — AI policy review required before Sprint 2 ML implementation

---

## Context

The PMO Platform POC introduces computationally intensive features that cannot run on the main thread without degrading UI responsiveness. The primary driver is the **Constellation View** — a live force-directed graph visualization of project relationships — which requires continuous physics simulation at 60fps. Secondary drivers include ML risk scoring, intelligent search, and real-time risk propagation across the project graph.

The platform is a global IT management tool spanning Transportation and Warehouse & Distribution, managing 20+ concurrent projects. The Constellation View is the centrepiece demo feature for the Q4 2026 consulting handoff. A degraded rendering experience during that demo is unacceptable.

Five architectural decisions were required before implementation could begin. Each was evaluated independently with full tradeoffs.

---

## Decision 1: Worker Scope

**Question:** Should Web Workers be scoped narrowly to the Constellation feature only, or designed as a platform-wide computation layer?

### Options Evaluated

| Option | Description |
|---|---|
| A — Narrow scope | Workers only for Constellation force simulation |
| **B — Future-proofing** | Workers as a platform compute layer from the start |

### Decision: Option B — Future-proofing

**Rationale:** The PMO Platform has a defined 8-sprint roadmap with 103 features. The following Sprint 2–5 features are already scoped and require off-thread computation:

- ML risk scoring (S2): inference over project graphs
- Intelligent search (S2): fuzzy matching across 1,000+ work items
- Risk propagation simulation (S3): cascade analysis across project dependencies
- Timeline conflict detection (S4): constraint satisfaction over schedules

Designing a narrow Constellation-only worker in S1B and rebuilding it into a platform layer in S2 is rework with no architectural benefit. The consulting firm inheriting this codebase needs a consistent pattern, not two different worker approaches. The additional upfront complexity is a one-time investment.

---

## Decision 2: Worker Topology

**Question:** How should workers be instantiated and managed across the application?

### Options Evaluated

| Option | Description |
|---|---|
| A — Single shared worker | One worker handles all compute domains |
| B — Naive multi-worker | Each feature spawns its own worker ad hoc |
| **C — WorkerBus with lazy domain workers** | Singleton bus, lazy per-domain workers, auto-terminate on idle |

### Decision: Option C — WorkerBus with lazy domain workers

**Architecture:**
```
Main Thread
┌────────────────────────────────────────────────┐
│  React Components                              │
│  dispatch() / stream() ──► WorkerBus          │
│                              │                 │
│           ┌──────────────────┼──────────────┐  │
│           ▼                  ▼              ▼  │
│   constellation.worker  ml.worker    risk.worker│
│   (lazy, auto-terminate) (lazy)      (lazy)    │
└────────────────────────────────────────────────┘
```

**Rationale:**
- A single shared worker serialises all computation — the Constellation tick loop would block ML inference
- Naive multi-worker instantiation creates uncontrolled memory growth with no lifecycle management
- WorkerBus provides a single, consistent dispatch API across all features; workers are instantiated on first use and terminated after 30s idle
- The consulting firm gets one pattern to understand, extend, and maintain

---

## Decision 3: Communication Protocol

**Question:** What message protocol governs communication between the WorkerBus and workers?

### Options Evaluated

| Option | Description |
|---|---|
| A — Raw postMessage + discriminated unions | Pure TypeScript, explicit, no dependencies |
| B — Comlink | RPC abstraction, workers as async function calls |
| **C — Structured protocol with Observable streaming** | Discriminated unions + RxJS Observable for progressive results |

### Decision: Option C — Structured protocol with Observable streaming

**Rationale:** The Constellation force simulation is a progressive computation — it produces hundreds of tick updates per second, not a single result. Raw postMessage (Option A) resolves once; it cannot model a 60fps tick stream without bolting on a custom event system that recreates Option C badly. Comlink (Option B) is an elegant abstraction for request/response but structurally excludes streaming — adding streaming later would require removing Comlink entirely.

The protocol uses a `responseMode` field to declare the return shape at the call site:

```ts
// Single-response: risk scores, search results
const scores = await bus.dispatch('SCORE_RISKS', { projects })

// Streaming: Constellation ticks, risk propagation cascade
bus.stream('CONSTELLATION_TICK', { graph }).subscribe(tick => {
  renderer.applyTick(tick)
})
```

**Financial cost:** None. RxJS is MIT licensed. Zero subscription, seat, or usage fees.

---

## Decision 4: Worker State Model

**Question:** Should workers maintain internal state between calls, or be stateless?

### Options Evaluated

| Option | Description |
|---|---|
| A — Stateless | Full data serialized on every dispatch |
| B — Stateful | Workers own their data; only deltas sent after hydration |
| **C — Hybrid (stateless protocol, stateful internals)** | Workers appear stateless to the bus; internally cache with version-gated fast path |

### Decision: Option C — Hybrid

**Rationale:** The Constellation worker runs at 60fps. A stateless model serializes the full graph across the thread boundary on every frame — at 500 nodes that is measurable overhead causing frame drops during interaction. Pure stateful (Option B) creates lifecycle coupling between the WorkerBus and worker internals, creating fragile edge cases with the lazy auto-terminate pattern from Decision 2.

The hybrid maintains the WorkerBus's clean external API while enabling a version-gated fast path inside the worker:

```
if incoming.version === cached.version + 1 → apply delta (fast path)
else → full hydration (slow path, automatic fallback)
```

The version counter is a monotonic integer on every message. Workers self-terminate cleanly; the next call triggers full re-hydration automatically.

---

## Decision 5: Vite Bundling Strategy

**Question:** How should worker files be compiled and bundled by Vite/Rollup?

### Options Evaluated

| Option | Description |
|---|---|
| A — Vite `?worker` imports | Native Vite syntax, HMR included |
| B — `?worker&inline` | Workers base64-inlined into main bundle |
| **C — Explicit Rollup entry points** | Workers declared as named inputs in vite.config.ts |
| D — `?worker` with Module Workers | ES module workers, Firefox gap |

### Decision: Option C — Explicit Rollup entry points

**Rationale:**
- Option B is immediately eliminated: inlining workers into the main bundle defeats the purpose of thread separation and increases initial parse time
- Option A duplicates shared dependencies (d3-force appears in both the main bundle and the worker bundle separately)
- Option D has a Firefox module worker gap that, while not blocking for this enterprise tool, introduces an unnecessary compatibility risk

Option C declares workers as named Rollup entry points, enabling shared chunk extraction. d3-force, shared utilities, and type definitions are bundled once and referenced by both the main thread and workers. The configuration is explicit and self-documenting — the consulting firm sees every worker declared in `vite.config.ts` without hunting for `?worker` suffixes.

```ts
// vite.config.ts — every worker is visible here, no magic suffixes
rollupOptions: {
  input: {
    main: 'index.html',
    'worker-constellation': 'src/workers/constellation.worker.ts',
    'worker-ml': 'src/workers/ml.worker.ts',       // S2 placeholder
    'worker-risk': 'src/workers/risk.worker.ts',   // S3 placeholder
  }
}
```

---

## Consequences

### Positive
- A single WorkerBus API covers all compute features across all 8 sprints
- Observable streaming enables the Constellation 60fps tick loop and future progressive computations
- Explicit Rollup entries prevent dependency duplication across worker bundles
- Version-gated hybrid state model eliminates serialization overhead at 60fps without coupling worker lifecycle to bus architecture
- Full audit trail for consulting firm handoff (~Aug 2026)

### Negative / Mitigated
- RxJS dependency (~8kb gzipped after tree-shaking) — acceptable for a desktop-class enterprise tool
- Stream subscriptions require explicit `unsubscribe()` in React `useEffect` cleanup — mitigated by enforcing the cleanup pattern in every streaming hook
- Explicit Rollup entries require a 2-line `vite.config.ts` addition per new worker — acceptable given ~4–5 total workers across 8 sprints
- Worker HMR requires page refresh (not hot reload) in development — not disruptive given worker logic does not affect component rendering directly

---

## Reference Implementation

The Constellation worker (`src/workers/constellation.worker.ts`) is the reference implementation for all subsequent workers. It demonstrates:

1. The full message protocol (single + stream response modes)
2. The hybrid state model (version-gated fast path)
3. Structured clone-safe data transfer
4. Clean cancellation via `CANCEL` message

All future workers (ml.worker.ts, risk.worker.ts) follow this pattern.
