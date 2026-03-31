# System Architecture Overview

**Last updated:** Sprint 1B (2026-03-30)
**Next review:** End of Sprint 1B

---

## Purpose

This document describes the end-to-end architecture of the PMO Platform POC —
what exists, why it exists, and how data flows through the system. It is the
primary reference for understanding the whole before reading any individual file.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  USER'S BROWSER (Main Thread)                                        │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  React Application (Vite + TypeScript)                        │   │
│  │                                                               │   │
│  │  ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐  │   │
│  │  │  Router    │  │ React Query │  │  Component Tree      │  │   │
│  │  │ (react-    │  │ (server     │  │  (UI / views)        │  │   │
│  │  │  router)   │  │  state)     │  │                      │  │   │
│  │  └────────────┘  └──────┬──────┘  └──────────┬───────────┘  │   │
│  │                         │                     │              │   │
│  │              ┌──────────▼─────────────────────▼──────────┐  │   │
│  │              │          WorkerBus (singleton)             │  │   │
│  │              │  dispatch() → Promise  stream() → Observable│  │   │
│  │              └──────────────────────┬────────────────────┘  │   │
│  └────────────────────────────────────│───────────────────────┘   │
│                                        │                            │
│  ┌─────────────────────────────────────▼───────────────────────┐   │
│  │  Web Workers (off-thread, isolated JS contexts)              │   │
│  │                                                               │   │
│  │  ┌──────────────────┐ ┌──────────────┐ ┌─────────────────┐  │   │
│  │  │ constellation.   │ │ ml.worker    │ │ risk.worker     │  │   │
│  │  │ worker           │ │ (S2)         │ │ (S3)            │  │   │
│  │  │ d3-force sim     │ │ ML inference │ │ Risk cascade    │  │   │
│  │  │ 60fps ticks      │ │ (stub)       │ │ (stub)          │  │   │
│  │  └──────────────────┘ └──────────────┘ └─────────────────┘  │   │
│  └───────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
            │ HTTPS (JWT-authenticated, RLS-enforced)
            ▼
┌─────────────────────────────────┐
│  Supabase (cloud-hosted POC)    │
│  PostgreSQL + Row Level Security│
│  Auth (JWT / Entra ID planned)  │
└─────────────────────────────────┘
            │
            │  Production target (post-consulting build):
            ▼
┌─────────────────────────────────┐
│  Azure Private Cloud            │
│  Self-hosted, inside firewall   │
│  (see DATA_SOVEREIGNTY.md)      │
└─────────────────────────────────┘
```

---

## Layer Descriptions

### 1. React Application (Main Thread)

**What it is:** The UI layer. React 18 with TypeScript, bundled by Vite 8, served as a static SPA.

**Why it exists:** Provides the interactive interface for global IT teams to manage 20+ concurrent projects across Transportation and W&D business units.

**Key libraries and why each was chosen:**
| Library | Why chosen |
|---|---|
| `react-router-dom` | SPA routing — each view (Portfolio, Project, Sprint board) is a distinct URL |
| `@tanstack/react-query` | Server state management — handles Supabase fetching, caching, optimistic updates |
| `zustand` | Client-only state — UI state that doesn't belong in the server cache (panel open/close, active filters) |
| `xstate` | Approval workflow state machines — complex multi-step workflows are modelled as state machines, not boolean flags |
| `d3-force` | Force simulation for Constellation view — physics-based graph layout |
| `framer-motion` | UI animation physics — spring-based transitions for panels and interactions |
| `@phosphor-icons/react` | Icon system — consistent icon language across all surfaces |
| `cmdk` | Command palette — keyboard-first navigation |
| `@dnd-kit/*` | Drag-and-drop — sprint board card reordering |

### 2. WorkerBus (Main Thread, Singleton)

**What it is:** A singleton message transport layer between the React application and domain-specific Web Workers.

**Why it exists:** Computationally intensive operations (force simulation, ML inference, risk propagation) cannot run on the main thread without degrading UI rendering. The WorkerBus abstracts the `postMessage` protocol behind a clean `dispatch()` / `stream()` API.

**Data flow:**
```
React component
  → workerBus.stream('constellation', 'CONSTELLATION_TICK', graph)
  → Observable<ConstellationTick>
  → subscriber.next(tick)  ← called 60× per second during simulation
  → setNodes(tick.nodes)   ← React state update
  → Canvas/SVG re-render   ← composited on GPU, main thread not blocked
```

**Files:**
- `src/workers/bus.ts` — WorkerBus class and singleton export
- `src/workers/observable.ts` — Minimal Observable/Subject (custom, no external deps)
- `src/workers/types.ts` — Shared protocol types (both sides import here)

**ADR reference:** [ADR-001](../adr/ADR-001-web-workers-architecture.md) Decisions 1–5

### 3. Web Workers (Off-Thread)

**What they are:** Separate JavaScript execution contexts. They share no memory with the main thread. All communication goes through structured-clone serialisation via `postMessage`.

**Why they exist:** To keep the main thread free for user interactions. A force simulation that saturates the CPU on a background thread is invisible to the user. The same computation on the main thread causes dropped frames, delayed input response, and jank.

**Workers (current and planned):**

| Worker file | Sprint | Responsibility |
|---|---|---|
| `constellation.worker.ts` | S1B | d3-force graph simulation, hybrid state, tick streaming |
| `ml.worker.ts` | S2 | ML risk scoring, anomaly detection (stub in S1B) |
| `risk.worker.ts` | S3 | Risk cascade propagation BFS, critical path analysis (stub in S1B) |

**Hybrid state model (all workers):**
Every worker uses a version-gated state strategy. Full graph hydration on cold start or version gap; delta application on sequential version increments. This prevents re-serialising full graph payloads at 60fps.

### 4. Supabase (Data Layer — POC)

**What it is:** The PostgreSQL-backed data layer for the POC phase. Provides auth, realtime, and RLS-enforced API access.

**Why it exists (POC only):** Supabase provides production-quality features (auth, RLS, realtime subscriptions, REST and client SDK) at zero infrastructure cost during the POC phase. It enables rapid development without standing up a database server.

**Why it will be replaced (production):** Supabase is cloud-hosted in the US. For production, data must remain inside the company's Azure private cloud to meet data sovereignty requirements. The consulting firm will self-host PostgREST + PostgreSQL on Azure, maintaining identical RLS policies and API contracts. The Supabase JS client will be reconfigured to point at the internal endpoint — no application code changes required.

**Data sovereignty compliance:** See [DATA_SOVEREIGNTY.md](DATA_SOVEREIGNTY.md)

---

## Data Flow: Full Request Lifecycle

### Example: Loading the Constellation View

```
1. User navigates to /portfolio → Router renders <Portfolio />
2. useProjects() hook fires → React Query checks cache
3. Cache miss → supabase.from('projects').select('*')
4. Response cached in React Query (5min stale time)
5. Projects passed to <ConstellationView graph={graph} />
6. Component calls startSimulation(graph) from useConstellation()
7. workerBus.stream('constellation', 'CONSTELLATION_TICK', graph) called
8. WorkerBus lazily instantiates constellation.worker (if not alive)
9. Worker receives graph, builds d3 forceSimulation, begins ticking
10. Each tick: worker.postMessage({ kind: 'tick', data: { nodes, alpha } })
11. WorkerBus receives → Subject.next(tick) → Observable subscriber fires
12. setNodes(tick.nodes) → React state update batched
13. Canvas re-renders node positions → GPU composite
14. Repeat steps 10–13 until alpha < 0.01 (stabilised)
15. Worker sends { kind: 'complete' } → stream ends
16. Worker idle timer starts (30s) → terminated if unused
```

### Example: Completing a Sprint

```
1. User clicks "Complete Sprint" button in SprintRow
2. useCompleteSprint mutation fires
3. Optimistic update: React Query cache immediately shows sprint as 'completed'
4. Confetti animation fires (canvas-confetti, main thread, non-blocking)
5. supabase.from('sprints').update({ status: 'completed' }).eq('id', sprintId)
6. On success: React Query invalidates sprint and project queries
7. On error: Rollback to snapshot captured before optimistic update
```

---

## Rendering Architecture (5 Layers)

Decided 2026-03-29. Applied to all major views.

```
Layer 5 (top):    WebGPU Compute        — GPU-accelerated data transforms
Layer 4:          Rive State Machines   — Component-level animation state
Layer 3:          Motion Physics        — Framer Motion spring transitions
Layer 2:          CSS Platform          — Layout, typography, Tailwind utilities
Layer 1 (bottom): WebGL Shader          — Animated background, depth/ambient effects
```

For the Constellation View specifically:
- Layer 1: Animated deep-space WebGL background (Alcon navy #003595 base)
- Layer 2: Canvas overlay for nodes and edges (positioned absolutely over background)
- Layer 3: Framer Motion for panel slides and node selection expand
- Layer 4: Rive for node state animations (idle / active / at-risk / selected)
- Layer 5: d3-force computation (in Web Worker, not rendered on GPU yet — S4 candidate)

---

## Technology Decisions Not Covered by ADRs

These decisions were made without a formal ADR. Each has a brief rationale.

| Decision | Choice | Rationale |
|---|---|---|
| State management | React Query + Zustand | React Query for server state, Zustand for UI state — single-responsibility, no Redux overhead |
| Styling | Tailwind CSS | Utility-first, consistent design tokens, no CSS-in-JS runtime |
| Build tool | Vite 8 | Rolldown bundler, significantly faster than webpack, native ESM |
| Routing | react-router-dom v6 | Industry standard, Sentry integration, v7 upgrade path clear |
| Auth (POC) | Supabase JWT | Zero-config for POC; production replaces with Azure Entra ID |
| Auth (production target) | Azure Entra ID | Organisation standard; OKTA for cloud apps only |

---

## What This Document Does Not Cover

- Database schema (to be documented in `docs/data-model/` as schema stabilises)
- Individual component API documentation (documented inline via JSDoc and per-component docs)
- Deployment and infrastructure (to be documented pre-consulting handoff, ~Aug 2026)
- Security assessment findings (planned for ~Aug 2026, post-SDS)
