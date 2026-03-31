# Production Migration Plan: Supabase POC → Azure Private Cloud

**Status:** Planned — execution target ~Aug 2026 (pre-consulting handoff)
**Owner:** Jeremy Salbritton, Global IT Lead
**Last updated:** Sprint 1B (2026-03-30)

---

## Why This Document Exists Now

The POC runs on Supabase cloud (US-hosted). Four services currently cross the firewall:

| Service | POC | Problem in Production |
|---|---|---|
| PostgreSQL database | Supabase cloud | Project data on US servers |
| Auth (JWT) | Supabase Auth | Identity outside company identity provider |
| Realtime (WebSocket) | Supabase Realtime | Persistent connection to `wss://*.supabase.co` |
| REST API | Supabase PostgREST | API endpoint outside VNET |

This document defines the migration path so the consulting firm receiving this codebase has a clear execution contract, not a discovery problem. The decision of *which* migration path to take is made here — before the consulting firm starts — so architectural dependencies don't accumulate during the POC build.

---

## Two Migration Paths Evaluated

### Path A — Self-hosted Supabase on Azure (Recommended)

Run the open-source Supabase stack inside your Azure VNET using Docker/Kubernetes.
Supabase is fully open source and officially supports self-hosting.

**What changes in the application code:** One line — the `VITE_SUPABASE_URL` environment variable points to your internal Azure endpoint instead of `*.supabase.co`. The `@supabase/supabase-js` client works identically.

**What does NOT change:**
- Zero application code changes
- All RLS policies, functions, triggers stay the same
- Auth flow stays the same (Supabase Auth, same JWT shape)
- Realtime WebSocket subscriptions stay the same
- The consulting firm builds against the same API contract

**Infrastructure required inside Azure VNET:**
- Azure Kubernetes Service (AKS) or Azure Container Instances
- Azure Database for PostgreSQL (Flexible Server) — Supabase's self-hosted version uses a managed Postgres
- Azure Blob Storage (Supabase Storage backend)
- Azure Application Gateway (WAF, ingress)
- Azure Private DNS zone

**Honest costs of Path A:**
- Running and patching a self-hosted Supabase stack has operational overhead
- Supabase self-hosted upgrades require coordination with the consulting firm's release cycle
- AKS or Container Instances adds infrastructure management complexity

---

### Path B — Azure-Native Services (Alternative)

Replace each Supabase component with its Azure-native equivalent.

| Supabase component | Azure equivalent |
|---|---|
| PostgreSQL | Azure Database for PostgreSQL Flexible Server |
| PostgREST (REST API) | Azure API Management + custom REST layer |
| Supabase Auth | Azure Entra ID (already org standard) |
| Supabase Realtime | Azure SignalR Service |
| Supabase Storage | Azure Blob Storage |

**What changes in the application code:**
- `src/lib/supabase.ts` → replaced with Azure-native SDK clients
- `src/lib/auth.ts` → replaced with MSAL (Microsoft Authentication Library)
- Every `useConstellationData` Realtime subscription → Azure SignalR client
- Every `db.from('table')` query → custom fetch wrapper against Azure API Management
- Auth session access in mutations → MSAL token acquisition

**The honest assessment of Path B:**
This is a meaningful rewrite of the data layer — not just a config change. The consulting firm estimates 4–6 weeks of migration work for a project of this scale. Path A is one line of config. Path B is weeks of code.

The only reason to choose Path B over Path A is if organisational IT policy prohibits running self-hosted Supabase containers, or if Azure-native services are mandated by architecture governance.

---

## Recommendation

**Path A — Self-hosted Supabase on Azure.**

The data sovereignty requirement is met (everything runs inside the VNET). The code change is one environment variable. The consulting firm preserves the API contract they built against during POC. The RLS policies, triggers, and database functions the POC builds over 8 sprints are portable as-is via `supabase db push` to the self-hosted instance.

**This recommendation changes if:** IT architecture governance mandates Azure-native services only, in which case Path B is the required path. That decision must be made before Sprint 4, when the data model stabilises and migration complexity grows.

---

## Migration Architecture Diagram (Path A)

```
BEFORE (POC):
Browser → HTTPS → Supabase cloud (US) ← outside firewall

AFTER (Production, Path A):
Browser
    │
    │ HTTPS (TLS 1.3, internal CA)
    ▼
Azure Application Gateway (WAF)
    │
    ├─── Static SPA (Azure CDN, private endpoint)
    │
    └─── VNET routing
              │
    ┌─────────▼──────────────────────────────────────┐
    │  Azure VNET (private, no internet egress)       │
    │                                                  │
    │  ┌─────────────────┐   ┌──────────────────┐    │
    │  │ Supabase Stack  │   │ Azure Entra ID   │    │
    │  │ (AKS/ACI)       │   │ (auth, existing) │    │
    │  │                 │   └──────────────────┘    │
    │  │  ┌───────────┐  │                           │
    │  │  │PostgREST  │  │                           │
    │  │  │(API layer)│  │                           │
    │  │  └─────┬─────┘  │                           │
    │  │        │        │                           │
    │  │  ┌─────▼─────┐  │                           │
    │  │  │ Postgres  │←─┼─── Azure DB for PG        │
    │  │  │ (Supabase │  │    (Flexible Server)      │
    │  │  │ managed)  │  │                           │
    │  │  └───────────┘  │                           │
    │  │                 │                           │
    │  │  ┌───────────┐  │                           │
    │  │  │ Realtime  │  │  WebSocket stays inside   │
    │  │  │(WebSocket)│  │  the VNET — no external   │
    │  │  └───────────┘  │  connection               │
    │  └─────────────────┘                           │
    └─────────────────────────────────────────────────┘
```

---

## Detailed Migration Steps (Path A Execution)

### Phase 1: Infrastructure provisioning (2–3 weeks, consulting firm)

- [ ] Create Azure VNET with appropriate subnet segmentation
- [ ] Provision Azure Database for PostgreSQL Flexible Server (inside VNET)
- [ ] Deploy Supabase self-hosted stack to AKS/ACI
- [ ] Configure Azure Application Gateway with WAF policies
- [ ] Set up Azure Private DNS zone for internal endpoint resolution
- [ ] Configure TLS certificates (internal CA or Azure Certificate Manager)
- [ ] Smoke-test self-hosted Supabase with a fresh project (no data)

### Phase 2: Schema and data migration (1–2 weeks, consulting firm)

- [ ] Export full schema from POC Supabase: `supabase db dump --schema-only`
- [ ] Apply schema to self-hosted instance: `supabase db push`
- [ ] Verify all RLS policies, triggers, and functions migrated correctly
- [ ] Export data from POC: `supabase db dump --data-only`
- [ ] Import data to self-hosted instance
- [ ] Verify row counts and spot-check data integrity
- [ ] Run `supabase db lint` on self-hosted to catch any policy gaps

### Phase 3: Application configuration (1 day)

- [ ] Update `VITE_SUPABASE_URL` in production environment to internal Azure endpoint
- [ ] Update `VITE_SUPABASE_ANON_KEY` to the self-hosted instance's anon key
- [ ] Update CORS configuration on self-hosted Supabase to allow the app domain
- [ ] Update `src/lib/monitoring.ts` — disable or redirect Sentry (see DATA_SOVEREIGNTY.md)
- [ ] Configure `src/config/session.ts` with production session parameters

### Phase 4: Auth integration (1–2 weeks, depends on Entra ID decision)

Two options for authentication in production:

**Option 4A — Keep Supabase Auth (simplest)**
Supabase self-hosted includes the GoTrue auth service. Users authenticate against the
self-hosted Supabase Auth — no connection to any external service.
- Pros: Zero code changes. Identical auth flow.
- Cons: User accounts live in Supabase, not in company's Entra ID directory.
  IT admins must manage two identity sources.

**Option 4B — Entra ID via SAML/OIDC (recommended for enterprise)**
Supabase self-hosted supports external OIDC providers. Configure Entra ID as the
OIDC provider so users log in with their company credentials.
- Pros: Single identity source. IT admins manage access in Entra ID (existing process).
  Offboarding a user removes PMO access automatically.
- Cons: ~2 days of Supabase OIDC configuration and testing.
- Code change: Update `src/lib/auth.ts` redirect URLs for the production Entra ID tenant.

**Recommendation:** Option 4B. The enterprise identity management argument is too strong.
Managing a separate user database for a tool used by global IT is an operational liability.

### Phase 5: Cutover (zero-downtime, 1 day)

- [ ] Run both POC (Supabase cloud) and production (Azure self-hosted) in parallel for 48h
- [ ] Validate all features against production environment before cutover
- [ ] Update DNS to point app domain at Azure Application Gateway
- [ ] Monitor error rates, latency, and WebSocket connection stability for 24h post-cutover
- [ ] After 72h stable: decommission POC Supabase project

### Phase 6: Post-migration validation

- [ ] Verify zero outbound connections to `*.supabase.co` from network monitoring
- [ ] Confirm WebSocket connections resolve to internal Azure endpoint only
- [ ] Run the Security Design Specification (SDS) review (planned ~Aug 2026)
- [ ] Update DATA_SOVEREIGNTY.md — remove Supabase from "Approved External Services"

---

## Code Changes Required (Path A Summary)

| File | Change | Effort |
|---|---|---|
| `.env.production` | `VITE_SUPABASE_URL` → internal Azure URL | 1 line |
| `.env.production` | `VITE_SUPABASE_ANON_KEY` → self-hosted key | 1 line |
| `src/lib/auth.ts` | Redirect URLs for production domain | ~5 lines |
| `src/lib/monitoring.ts` | Sentry DSN → empty or internal | 1 line |
| `src/features/constellation/useConstellationData.ts` | No change — Realtime API identical | None |

**Total application code change: < 10 lines.**

Everything else — the WorkerBus, sigma.js renderer, all components, all hooks, all RLS policies — is portable without modification.

---

## The WebSocket Risk (Addressed)

Jeremy raised the risk that a restricted developer workstation trying to run the app
will hit the Supabase WebSocket connection (`wss://*.supabase.co`) at the network
layer before hitting the npm registry problem.

**For development environments:**
Use a local Supabase instance (`npx supabase start`) which runs entirely on the
developer's machine and makes no external network calls. This is documented in the
project README and is the standard local development approach for Supabase-based apps.

**For the production transition:**
The migration plan above eliminates the WebSocket external call entirely. Post-migration,
the only external traffic from the application is:
- Static asset delivery (Azure CDN, private endpoint — inside VNET)
- All API + WebSocket traffic (Azure VNET internal)

---

## Decision Required Before Sprint 4

**Auth Path (4A vs 4B)** must be decided before the consulting firm begins the
production build. Waiting until Sprint 7 means the consulting firm discovers the
identity architecture at handoff and must retrofit it.

Add to IT architecture review agenda: *"PMO Platform production auth: Supabase-internal
users vs. Entra ID OIDC integration?"*

Target decision date: End of Sprint 3 (approximately 6 weeks from Sprint 1B completion).

---

## Audit Trail

| Date | Change | Author |
|---|---|---|
| 2026-03-30 | Initial migration plan created — Sprint 1B | Jeremy Salbritton |
