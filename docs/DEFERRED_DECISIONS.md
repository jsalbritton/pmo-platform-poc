# Deferred Decisions Register

This register captures decisions that were explicitly tabled during development.
Each entry has a target sprint for resolution. Unresolved items at consulting
handoff become backlog items for the consulting firm with full context preserved.

---

## AI Policy Review

**Status:** Tabled — resolve before Sprint 2 ML implementation begins
**Target sprint:** S1B end / S2 start
**Owner:** Jeremy Salbritton

### What needs to be decided

Before Sprint 2 implements ML features inside the `ml.worker`, the following
policy questions must be answered:

#### 1. Approved model sources

- What ML model formats are approved for use? (TensorFlow.js SavedModel, ONNX, custom)
- Where may model files be hosted? (bundled in app, Azure internal CDN, other)
- What is the maximum acceptable model bundle size for browser delivery?
- Is WebAssembly-compiled inference (e.g., ONNX Runtime Web) approved?

#### 2. Model training data policy

- May historical project data be used to train or fine-tune models?
- If so, what anonymisation is required before training data export?
- Who approves training data exports?
- Does this fall under any existing data governance policy?

#### 3. External AI API prohibition (see DATA_SOVEREIGNTY.md)

The current policy prohibits all external AI API calls. This needs formal sign-off
from the appropriate stakeholder (IT leadership / legal) before it can be treated
as a binding written policy rather than a design decision.

**Action required:** Formal written approval of the prohibition documented here and
in DATA_SOVEREIGNTY.md.

#### 4. Sentry AI interaction capture

When Sentry error monitoring is active, could any AI inference inputs or outputs
appear in stack traces or breadcrumbs? The `beforeSend` hook implementation must
specifically scrub:
- Any payload that passed through `ml.worker`
- Model inference inputs (which may contain project data)
- Model outputs (which may indirectly reveal project structure)

#### 5. Future: Azure OpenAI Private Endpoint

Azure OpenAI offers a private endpoint option that keeps traffic inside the VNET.
Is this an approved exception to the external AI API prohibition? If so, what
governance process controls which models can be accessed?

**This is not approved yet.** It is captured here so the question is not lost.

---

## Error Monitoring (Production)

**Status:** Tabled — resolve before production deployment
**Target sprint:** Pre-handoff
**Owner:** Jeremy Salbritton

Current state: Sentry cloud is used in POC with `VITE_SENTRY_DSN` empty in production.

Options for production:
1. **Self-hosted Sentry** (Docker, inside Azure VNET) — full feature parity, highest effort
2. **Azure Monitor + Application Insights** — native Azure, integrates with Entra ID, less rich than Sentry
3. **Glitchtip** — open source Sentry-compatible, lower operational overhead than full Sentry
4. **Remove Sentry entirely** — no external error monitoring; rely on Azure Monitor logs only

Decision criteria: data sovereignty compliance, operational overhead, feature needs.

---

## Authentication (Production)

**Status:** Tabled — **decision required by end of Sprint 3**
**Target sprint:** S3 end (before data model stabilises)
**Owner:** Jeremy Salbritton

Current state: Supabase JWT auth used in POC.

Production target: Azure Entra ID (on-premise identity, organisation standard).
OKTA is used for cloud apps only — this is an on-premise-targeted application.

Two options evaluated in [Production Migration Plan](architecture/PRODUCTION_MIGRATION_PLAN.md):
- **Option 4A**: Keep Supabase-internal auth (self-hosted) — zero code change, but IT manages a second identity store
- **Option 4B**: Entra ID via OIDC (recommended) — users log in with company credentials, IT manages access in Entra ID as normal

**Why this must be decided at Sprint 3, not later:**
The consulting firm building production needs the identity architecture decided before
they begin the production build. Discovering it at handoff means retrofitting auth
into a delivered system — the highest-cost migration scenario.

**Action required:** Add to IT architecture review: *"PMO Platform production auth:
Supabase-internal vs. Entra ID OIDC integration?"*

---

## Security Design Specification (SDS)

**Status:** Tabled — create ~Aug 2026
**Target:** Pre-consulting handoff
**Owner:** Jeremy Salbritton + planned Sr. Security Auditor

The SDS is the formal security architecture document required before handing the
codebase to the consulting firm. It must cover:

- [ ] Authentication flow (Azure Entra ID integration)
- [ ] JWT validation mechanism (current: HS256/PyJWT)
- [ ] Row Level Security policy audit
- [ ] Data encryption at rest and in transit
- [ ] Sentry `beforeSend` implementation and data scrubbing rules
- [ ] AI/ML data flow security (informed by AI Policy Review above)
- [ ] Network topology (Azure VNET, WAF, private endpoints)
- [ ] Secrets management (Azure Key Vault integration)
- [ ] Penetration test scope and findings

---

## Internal Package Registry

**Status:** Tabled — resolve before any developer onboarding in restricted network
**Target sprint:** Pre-developer onboarding
**Owner:** Jeremy Salbritton

Developer workstations may not have direct access to the public npm registry.
All 46 direct dependencies (~186 total with transitive) must be available through
an internal channel before a developer can run `npm install`.

See [DEPENDENCY_MANIFEST.md](../DEPENDENCY_MANIFEST.md) for the full package list,
offline install options, and the packages that make network calls at runtime.

Options to decide between:

1. **Azure Artifacts** — native Microsoft, integrates with Azure DevOps CI/CD pipelines, supports npm feeds. Recommended for long-term.
2. **Verdaccio** — open source npm proxy, deployable inside Azure VNET, low operational overhead
3. **Pre-packaged tarballs** — simpler but requires manual updates when packages change

Decision criteria: IT policy on approved internal registries, existing Azure DevOps usage, operational overhead.

---

## Audit Trail

| Date | Item added | Added by |
|---|---|---|
| 2026-03-30 | AI Policy Review | Jeremy Salbritton |
| 2026-03-30 | Error Monitoring (production) | Jeremy Salbritton |
| 2026-03-30 | Authentication (production) | Jeremy Salbritton |
| 2026-03-30 | Security Design Specification | Jeremy Salbritton |
| 2026-03-30 | Internal Package Registry | Jeremy Salbritton |
