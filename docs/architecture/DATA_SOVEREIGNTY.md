# Data Sovereignty & Firewall Containment Policy

**Status:** Active — applies to all sprints
**Last updated:** Sprint 1B (2026-03-30)
**Owner:** Jeremy Salbritton, Global IT Lead
**Review required before:** Production deployment (~Aug 2026)

---

## Purpose

This document defines what data can and cannot leave the company's network perimeter,
which external services are permitted, and the architectural rules that ensure
compliance. It is a binding constraint on all implementation decisions.

The primary business case for self-hosting the PMO Platform in production is
**data sovereignty** — project data, resource data, financial forecasts, and
organisational structure must not reside on third-party infrastructure unless
explicitly approved.

---

## The Rule

> **Default: everything stays inside the firewall.**
> External calls require explicit justification and approval.

---

## Data Classification

| Data type | Examples | Classification | May leave firewall? |
|---|---|---|---|
| Project metadata | Names, descriptions, statuses | Confidential | **No** |
| Work items | Tasks, sprints, assignments | Confidential | **No** |
| Resource data | Team members, allocations, capacity | Confidential | **No** |
| Financial data | Budget forecasts, variance | Restricted | **No** |
| Organisational structure | Reporting lines, teams | Confidential | **No** |
| Computed outputs | Risk scores, timeline forecasts | Confidential | **No** |
| Anonymous telemetry | Error traces without PII | Internal | **Conditional** (see Sentry section) |
| Static assets | App bundle, icons, fonts | Public | **Yes** (CDN acceptable) |

---

## Approved External Services (POC Phase Only)

The following external services are approved **for the POC phase only**. Each has a
documented migration path to an in-firewall equivalent for production.

### Supabase (Data Layer)

| Item | Detail |
|---|---|
| What it is | Cloud-hosted PostgreSQL + auth + API |
| Why it's used in POC | Zero infrastructure setup, production-quality RLS |
| Data it receives | All project, sprint, work item, and user data |
| Risk | Data stored on US cloud servers |
| **Production migration** | Self-hosted Supabase on Azure Private Cloud (recommended) — see [Production Migration Plan](PRODUCTION_MIGRATION_PLAN.md) |
| Migration effort | Low (Path A) — one environment variable change, < 10 lines total code change |
| Migration target | Before consulting firm handoff (~Aug 2026) |
| **Auth decision deadline** | End of Sprint 3 — Entra ID OIDC vs. Supabase-internal auth must be decided |

### Railway (API Deployment — S1A)

| Item | Detail |
|---|---|
| What it is | PaaS platform hosting the FastAPI backend |
| Why it's used in POC | Rapid deployment, zero infrastructure management |
| Data it receives | JWT-authenticated API calls only; no project data stored |
| **Production migration** | Azure App Service or AKS, inside private network |
| Migration target | Before consulting firm handoff |

### Sentry (Error Monitoring)

| Item | Detail |
|---|---|
| What it is | Cloud-hosted error tracking and web vitals |
| Why it's used in POC | Operational visibility during development |
| Data it receives | Error stack traces, web vitals metrics |
| **PII rule** | Sentry `beforeSend` hook MUST strip any user data, project names, or IDs from error payloads before transmission |
| **Production decision** | **Deferred** — options are self-hosted Sentry, Azure Monitor, or Glitchtip. See [DEFERRED_DECISIONS.md](../DEFERRED_DECISIONS.md) |

---

## Prohibited External Calls

The following are explicitly prohibited in both POC and production:

### AI / ML APIs

**No project data may be sent to external AI APIs.**

This includes but is not limited to:
- OpenAI API
- Anthropic API
- Google Vertex AI
- Azure OpenAI (cloud endpoint — not private endpoint)
- Any SaaS ML inference service

**Why:** Project data contains commercially sensitive information about transportation
and warehouse operations, resource allocations, and strategic timelines. Sending this
data to third-party AI services creates unacceptable data sovereignty and IP risk.

**The approved approach:**
All ML inference runs inside the browser's Web Worker thread using local models:
- Sprint 2: TensorFlow.js or ONNX Runtime Web (both run entirely in-browser, no network calls)
- Sprint 3+: Models are bundled with the application or fetched from the internal Azure CDN

See [DEFERRED_DECISIONS.md](../DEFERRED_DECISIONS.md) → AI Policy Review section for
the full policy items that require review before Sprint 2 ML implementation begins.

### Analytics Services

No analytics beacons, tracking pixels, or third-party analytics SDKs.
If usage analytics are required, they are captured via internal logging only.

### Font / Icon CDNs (Production)

In production, all fonts and icons must be self-hosted inside the Azure private cloud.
In POC, Google Fonts or CDN-hosted icon sets are acceptable.

---

## Approved Internal Network Flow (Production Target)

```
User Browser
    │
    │ HTTPS (TLS 1.3, internal CA)
    ▼
Azure Application Gateway (WAF enabled)
    │
    │ Internal VNET routing
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Azure Private Cloud (VNET)                                          │
│                                                                      │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │  Static SPA  │    │  PostgREST /     │    │  PostgreSQL 15   │  │
│  │  (Azure CDN, │    │  FastAPI         │    │  (Azure DB for   │  │
│  │  private)    │    │  (App Service)   │    │   PostgreSQL)    │  │
│  └──────────────┘    └──────────────────┘    └──────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────┐                           │
│  │  Azure Entra ID (auth)               │                           │
│  │  (existing organisational identity)  │                           │
│  └──────────────────────────────────────┘                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Rules (Enforced by Convention)

These rules apply to all implementation decisions:

1. **No API keys for external AI services in any environment file.** The `.env.*` files
   are gitignored, but no key that transmits data to an external AI should exist at all.

2. **All ML models run client-side in Web Workers.** If a model file must be fetched,
   it comes from the internal Azure CDN, not an external CDN.

3. **Sentry `beforeSend` is mandatory before production.** Until implemented, the
   `VITE_SENTRY_DSN` env var must remain empty in production deployments.

4. **Any new external service integration requires an update to this document**
   and approval before merging.

5. **The Supabase URL in `.env.local` is the POC Supabase project.** Any developer
   standing up a local environment uses a local Supabase instance, not the shared POC
   project. Instructions in the project README.

---

## Audit Trail

| Date | Change | Author |
|---|---|---|
| 2026-03-30 | Initial document created — Sprint 1B | Jeremy Salbritton |
