# PMO Platform — Documentation Index

**Organization:** Global IT (Transportation & Warehouse/Distribution)
**Status:** POC — Sprint 1B active
**Consulting handoff target:** ~August 2026

This index is the entry point for all technical documentation. Every document listed
here is a living artefact — it is updated as the codebase evolves and must remain
accurate at handoff time.

---

## Documentation Map

### Architecture
| Document | Purpose | Status |
|---|---|---|
| [System Overview](architecture/SYSTEM_OVERVIEW.md) | End-to-end architecture, data flow, layer diagram | Active |
| [Data Sovereignty Policy](architecture/DATA_SOVEREIGNTY.md) | Firewall containment rules, what can/cannot leave the network | Active |
| [ADR-001: Web Workers](adr/ADR-001-web-workers-architecture.md) | 5-decision Web Workers architecture record | Complete |

### Deferred Decisions
| Document | Purpose | Target Sprint |
|---|---|---|
| [Deferred Decisions Register](DEFERRED_DECISIONS.md) | Policy and architectural items tabled for later resolution | Ongoing |

### Infrastructure & Deployment
| Document | Purpose | Status |
|---|---|---|
| [Dependency Manifest](DEPENDENCY_MANIFEST.md) | All npm packages, versions, licenses, offline install guide, packages that phone home | Active |
| [Production Migration Plan](architecture/PRODUCTION_MIGRATION_PLAN.md) | Supabase POC → Azure private cloud. Two evaluated paths, recommended path, full execution steps, code impact | Active |

### Component Documentation
> Added sprint-by-sprint. Each component that ships gets a corresponding entry here.

| Component | Document | Sprint |
|---|---|---|
| *(S1B in progress)* | — | — |

### Data Model
> Each Supabase table and TypeScript type documented here once stabilized.

| Entity | Document | Sprint |
|---|---|---|
| *(to be added as schema solidifies)* | — | — |

---

## Documentation Principles

**Why each document exists:**
Every document here answers one of three questions:
1. *Why does this exist?* → Architecture Decision Records (ADRs)
2. *How does it work?* → System Overview, component docs
3. *What rules govern it?* → Policy documents (data sovereignty, compliance)

**Living artefacts:**
Documentation is updated at the end of each sprint, not at the end of the project.
A document that describes last sprint's architecture is a liability at handoff time.

**Consulting handoff readiness:**
The consulting firm receiving this codebase will use these documents to understand
design intent before touching a line of code. Prioritise *why* over *what* — the code
explains what; the documents explain why.

---

## Sprint Documentation Checklist

At the end of each sprint, verify:
- [ ] Any new architectural pattern has an ADR or is covered in SYSTEM_OVERVIEW
- [ ] Any new data entity is added to the Data Model section
- [ ] Any new component >100 lines has a documentation entry
- [ ] DEFERRED_DECISIONS.md is updated with any tabled items
- [ ] DATA_SOVEREIGNTY.md is updated if any new external data flow was introduced
