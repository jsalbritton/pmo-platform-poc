# ADR-002: Constellation View Renderer

**Date:** 2026-03-30
**Status:** Accepted
**Author:** Jeremy Salbritton (Global IT Lead)
**Scope:** Sprint 1B — Constellation View component

**Related documents:**
- [System Overview](../architecture/SYSTEM_OVERVIEW.md)
- [ADR-001: Web Workers Architecture](ADR-001-web-workers-architecture.md)

---

## Context

The Constellation View is the headline demo feature of the PMO Platform POC. It renders
a force-directed graph of all active projects with edges representing resource and
organisational relationships, driven by a d3-force simulation running in a Web Worker.

The initial Sprint 1A implementation used **@xyflow/react (React Flow)** as both the
layout engine and the renderer. Sprint 1B introduces the d3-force Web Worker
(ADR-001) which takes over layout responsibility, leaving only rendering to be decided.

The question: what renders the nodes and edges on screen?

---

## Decision Drivers

1. **Performance ceiling** — the portfolio manages 20+ projects today, with sub-projects
   and workstream dependencies potentially reaching 300–500 nodes in production
2. **Visual quality** — the Q4 2026 consulting demo must be visually differentiated;
   the rendering layer is where "never seen before" is won or lost
3. **Long-term handoff** — the consulting firm building production should receive
   a renderer they can extend, not one they must rewrite
4. **Learning investment** — Jeremy is the sole developer with no prior graphics
   programming experience; the renderer must be learnable within sprint cadence

---

## Options Evaluated

### Option A — @xyflow/react (keep existing)

Continue using React Flow as both layout source and renderer. Node positions come from
React Flow's built-in layout; the Web Worker is not used for layout in this option.

**Why rejected:**
- React Flow is a React component renderer — every node position update triggers
  a React reconciliation cycle. At 60fps tick rate, this is 60 reconciler runs per
  second for data that only the canvas needs.
- React Flow's performance degrades visibly above 200–300 nodes due to DOM overhead.
- Abandoning the WorkerBus d3-force simulation (ADR-001) would make the entire
  Web Workers architecture irrelevant.

### Option B — Canvas 2D

Draw nodes and edges imperatively on an HTML `<canvas>` element using the 2D API.
Positions from the Web Worker tick stream update the canvas directly via `clearRect`
+ redraw on each tick.

**Performance:** Handles 3,000+ animated nodes at 60fps without degradation.
**Why not chosen as final answer:** Canvas 2D and WebGL (Option C) have the same
performance profile for the node counts expected in this application. Canvas 2D
was initially recommended but challenged on long-term grounds (see below).

### Option C — sigma.js v3 (WebGL via purpose-built graph renderer)

sigma.js is a WebGL-accelerated graph renderer designed specifically for force-directed
layouts. It accepts a graphology `Graph` model and renders nodes and edges via WebGL
programs.

**Why this is materially different from "just WebGL":**
sigma.js is not a general WebGL library (unlike pixi.js or Three.js). It is purpose-built
for the exact problem — rendering large force-directed graphs with pan/zoom/hover/select
interaction. The WebGL complexity is encapsulated; the API is declarative attribute
updates on a graph model, not shader programming.

---

## The Challenge That Changed the Recommendation

Canvas 2D was the initial recommendation. It was challenged on two grounds:

**1. Node count trajectory:**
The portfolio manages projects. Projects have sub-projects. Sub-projects have
workstream dependencies. The Constellation view's full vision is the dependency graph,
not just the top-level project list. At that depth, Canvas 2D and WebGL diverge.
Canvas 2D degrades above 300 animated nodes. WebGL does not degrade until 50,000+.

**2. Visual quality for the demo:**
Canvas 2D glow effects are simulated radial gradients. WebGL glow is a real fragment
shader — it bleeds, pulses, and responds to selection state correctly. The demo moment
that makes the consulting firm say "we need to build this" requires the WebGL quality.
A Canvas 2D implementation looks like a prototype. A sigma.js implementation looks
like a product.

**3. Consulting firm handoff:**
Handing the consulting firm Canvas 2D means they rewrite the renderer in production.
Handing them sigma.js means they extend it. The correct handoff is the right tool.

The initial recommendation defaulted to ease of implementation disguised as a
technical argument. The correct long-term answer is sigma.js.

---

## Decision: Option C — sigma.js v3

**Rationale:**

sigma.js + d3-force Worker is the correct architecture for the Constellation view
because the two components have a clean separation of concerns:

- **d3-force worker** owns physics — where nodes go
- **sigma.js** owns rendering — what nodes look like and how users interact with them

The WorkerBus tick stream (`ConstellationTick`) feeds positions directly into
graphology node attributes. sigma.js reads those attributes and renders them via WebGL.
React state is only updated for two things: selected node ID (for the detail panel)
and current alpha value (for the settling indicator). The 60fps rendering path is
entirely off React.

**Financial cost:** None. sigma.js is MIT licensed. graphology is MIT licensed.
Zero subscription, seat, or usage fees.

---

## Architecture

```
Supabase projects data
    │
    ▼
useConstellationData()          ← React Query, Realtime subscription
    │
    ├── buildConstellationGraph() → ConstellationGraph (for d3-force worker)
    │       │
    │       ▼
    │   WorkerBus.stream('constellation', 'CONSTELLATION_TICK', graph)
    │       │  60fps Observable tick stream
    │       ▼
    │   graphRef.current.mergeNodeAttributes(id, {x, y})   ← direct graphology mutation
    │   sigmaRef.current.refresh({ skipIndexation: true }) ← direct WebGL draw
    │       (no React state update, no reconciler)
    │
    └── buildSigmaNodeAttributes() → graphology node attributes (color, size, label…)
            │
            ▼
        new Sigma(graph, container)  ← WebGL renderer, mounted once on useEffect
            │
            ├── clickNode → onNodeSelect(id) → React state → DetailPanel
            └── downNode + mousemove → drag → workerBus.dispatch('CONSTELLATION_DRAG')
```

---

## Consequences

### Positive
- Handles 50,000+ nodes — no foreseeable performance ceiling for this application
- WebGL rendering quality enables custom shaders for glow, pulse, and selection halos in Sprint 2
- sigma.js + graphology is the standard pairing for production graph visualisations
- Drag interaction ties directly back to the d3-force worker via `CONSTELLATION_DRAG` dispatch
- The consulting firm receives an extendable WebGL graph renderer

### Negative / Mitigated
- sigma.js and graphology add ~380kb to the bundle (combined, uncompressed) — acceptable
  for a desktop-class enterprise tool; tree-shaking reduces real impact
- Custom node programs (glow shaders, pulse animations) require WebGL knowledge — tabled
  as Sprint 2 visual polish items, documented as upgrade path in `ConstellationSigmaCanvas.tsx`
- sigma does not render labels by default at scale (intentional — label clutter at 100+ nodes
  is a UX problem). Labels are rendered in the overlay HTML layer instead.

---

## Upgrade Path (Sprint 2+)

The current implementation uses sigma's default `NodeCircleProgram` (flat filled circles).
The Sprint 2 visual upgrade replaces this with a custom fragment shader that adds:

- Per-node radial bloom glow (colour matches `PULSE_COLORS[condition].glow`)
- "Breathing" animation on `critical` condition nodes (time uniform in shader)
- Selection halo (ring expands on click, matches `borderColor` attribute)

Reference: https://www.sigmajs.org/docs/advanced/custom-rendering/

---

## Files Introduced

| File | Purpose |
|---|---|
| `src/features/constellation/ConstellationSigmaCanvas.tsx` | sigma lifecycle, tick loop, drag interaction |
| `src/features/constellation/transformSigmaData.ts` | Project → graphology/worker attribute transforms |
| `src/features/constellation/ConstellationView.tsx` | Updated orchestrator (replaced @xyflow) |
