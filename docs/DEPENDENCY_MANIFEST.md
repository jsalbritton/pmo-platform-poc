# Software Dependency Manifest

**Last updated:** Sprint 1B (2026-03-30)
**Purpose:** Reference for IT software portal packaging and air-gapped / restricted-network installation
**Owner:** Jeremy Salbritton, Global IT Lead

---

## The Problem This Document Solves

Developer workstations in a regulated enterprise environment may not have direct access
to the public npm registry (`registry.npmjs.org`). Before any developer can work on
this codebase, all packages must be available through an approved internal channel.

**Options for your Azure environment:**
1. **Azure Artifacts** — Microsoft's private npm registry, integrates with Azure DevOps pipelines. Recommended.
2. **Verdaccio** — lightweight self-hosted npm proxy, can be deployed inside the VNET
3. **Pre-packaged tarballs** — every package exported as a `.tgz` and hosted on an internal file share
4. **npm pack** bundle — a single archive of all node_modules, deployed as-is to developer machines

The choice of mechanism is deferred (see [DEFERRED_DECISIONS.md](DEFERRED_DECISIONS.md) → Internal Package Registry). This document provides the full dependency list required regardless of mechanism.

---

## Summary Counts

| Category | Count |
|---|---|
| Direct runtime dependencies | 26 |
| Direct devDependencies | 20 |
| **Total direct** | **46** |
| Transitive (total installed) | ~186 |

The `package-lock.json` file is the authoritative source for the exact version of every transitive dependency. The list below covers direct dependencies only — the lock file covers the rest.

---

## Runtime Dependencies (shipped to users)

These packages are bundled into the production build. They must be available at build time.

| Package | Version | Purpose | License | Source |
|---|---|---|---|---|
| `@dnd-kit/core` | 6.3.1 | Sprint board drag-and-drop | MIT | npmjs.org |
| `@dnd-kit/sortable` | 10.0.0 | Sortable list extension | MIT | npmjs.org |
| `@dnd-kit/utilities` | 3.2.2 | DnD Kit utility helpers | MIT | npmjs.org |
| `@phosphor-icons/react` | 2.1.7 | Icon library | MIT | npmjs.org |
| `@sentry/react` | 10.46.0 | Error monitoring (POC only) | MIT | npmjs.org |
| `@supabase/supabase-js` | 2.39.7 | Database client (POC only → Azure in prod) | MIT | npmjs.org |
| `@tanstack/react-query` | 5.28.6 | Server state management | MIT | npmjs.org |
| `@tanstack/react-table` | 8.13.2 | Table/data grid | MIT | npmjs.org |
| `@xstate/react` | 6.1.0 | State machine React bindings | MIT | npmjs.org |
| `@xyflow/react` | 12.4.4 | Legacy flowchart renderer (retained for non-Constellation views) | MIT | npmjs.org |
| `canvas-confetti` | 1.9.4 | Sprint completion celebration animation | MIT | npmjs.org |
| `class-variance-authority` | 0.7.1 | Variant-based CSS utility | MIT | npmjs.org |
| `clsx` | 2.1.1 | Conditional className builder | MIT | npmjs.org |
| `cmdk` | 1.0.0 | Command palette | MIT | npmjs.org |
| `d3-force` | 3.0.0 | Force simulation physics (runs in Web Worker) | ISC | npmjs.org |
| `framer-motion` | 11.1.9 | UI animation physics | MIT | npmjs.org |
| `graphology` | 0.26.0 | Graph data model for sigma.js | MIT | npmjs.org |
| `react` | 18.2.0 | UI framework | MIT | npmjs.org |
| `react-compiler-runtime` | 19.1.0-rc.3 | React Compiler runtime (optimised re-renders) | MIT | npmjs.org |
| `react-dom` | 18.2.0 | DOM renderer for React | MIT | npmjs.org |
| `react-error-boundary` | 6.1.1 | Declarative error boundaries | MIT | npmjs.org |
| `react-router-dom` | 6.30.3 | Client-side routing | MIT | npmjs.org |
| `sigma` | 3.0.2 | WebGL graph renderer (Constellation View) | MIT | npmjs.org |
| `tailwind-merge` | 2.5.2 | Tailwind class conflict resolution | MIT | npmjs.org |
| `web-vitals` | 5.2.0 | Core Web Vitals measurement | Apache 2.0 | npmjs.org |
| `xstate` | 5.30.0 | Finite state machines (approval workflows) | MIT | npmjs.org |
| `zod` | 4.3.6 | Runtime schema validation | MIT | npmjs.org |
| `zustand` | 5.0.12 | Lightweight client state | MIT | npmjs.org |

---

## Dev Dependencies (build tools only, not shipped to users)

These packages are required to build the application but are not included in the
production bundle. They must be available on developer workstations and CI/CD agents.

| Package | Version | Purpose | License |
|---|---|---|---|
| `@babel/core` | 8.0.0-rc.3 | JavaScript transpiler (React Compiler integration) | MIT |
| `@playwright/test` | 1.58.2 | End-to-end browser testing | Apache 2.0 |
| `@rolldown/plugin-babel` | 0.2.2 | Rolldown/Vite Babel plugin | MIT |
| `@tanstack/react-query-devtools` | 5.28.6 | React Query browser devtools | MIT |
| `@types/canvas-confetti` | 1.9.0 | TypeScript types for canvas-confetti | MIT |
| `@types/d3-force` | 3.0.10 | TypeScript types for d3-force | MIT |
| `@types/node` | 22.13.0 | TypeScript types for Node.js | MIT |
| `@types/react` | 18.2.79 | TypeScript types for React | MIT |
| `@types/react-dom` | 18.2.25 | TypeScript types for React DOM | MIT |
| `@vitejs/plugin-react` | 6.0.1 | Vite React plugin (JSX transform, HMR) | MIT |
| `autoprefixer` | 10.4.19 | CSS vendor prefix automation | MIT |
| `babel-plugin-react-compiler` | 1.0.0 | React Compiler Babel plugin | MIT |
| `postcss` | 8.4.38 | CSS post-processor | MIT |
| `tailwindcss` | 3.4.3 | Utility-first CSS framework | MIT |
| `tailwindcss-animate` | 1.0.7 | Tailwind animation utilities | MIT |
| `typescript` | 5.4.5 | TypeScript compiler | Apache 2.0 |
| `vite` | 8.0.3 | Build tool and dev server | MIT |
| `wrangler` | 4.78.0 | Cloudflare Workers CLI (deployment tooling) | MIT/Apache 2.0 |

---

## Runtime Environment Requirements

Beyond npm packages, these tools must be installed on developer workstations and CI/CD agents:

| Tool | Version | Source | Notes |
|---|---|---|---|
| Node.js | ≥ 20.0.0 (LTS) | nodejs.org | Required for npm and Vite. Must be packaged in software portal. |
| npm | ≥ 10.0.0 | bundled with Node.js | Comes with Node.js installer |
| Git | ≥ 2.40 | git-scm.com | Source control. Likely already deployed. |

**Important — Node.js on restricted networks:**
Node.js is distributed as a standalone installer (`.pkg` for macOS, `.msi` for Windows).
It does not require internet access after installation. The installer should be added
to the software portal alongside the npm package archive.

---

## Browser Requirements (end users)

The PMO Platform is a web application. End users need only a browser — no software
portal packaging required for user-facing deployment.

| Browser | Minimum version | Notes |
|---|---|---|
| Chrome | ≥ 111 | Recommended. Full WebGL 2.0, all features |
| Edge (Chromium) | ≥ 111 | Organisation standard browser. Full support. |
| Firefox | ≥ 113 | Supported. ES Module workers behind flag in some versions. |
| Safari | ≥ 16.4 | Supported. iOS Safari: no Web Worker module type. |

**Enterprise recommendation:** Target Chrome/Edge (Chromium-based). Both are consistent
with the WebGL and Web Workers features the Constellation View requires.

---

## How to Create an Offline Install Package

### Option 1: npm pack + tarball (simplest)

On a machine with internet access, run:

```bash
# From the project root
npm install                  # ensure all packages are installed
npm pack                     # creates pmo-platform-2.0.0.tgz (app code only)

# To archive all dependencies as tarballs:
node -e "
const pkg = require('./package.json');
const deps = Object.keys({...pkg.dependencies, ...pkg.devDependencies});
deps.forEach(d => console.log(d));
" | xargs -I{} npm pack {}   # creates one .tgz per package
```

Then move all `.tgz` files to the internal file share or Azure Blob Storage.

### Option 2: Azure Artifacts (recommended for enterprise)

1. Create an Azure Artifacts feed in your Azure DevOps organisation
2. Run `npm publish --registry https://your-org.pkgs.visualstudio.com/...` for each package
3. Configure developer workstations to use the internal registry:
   ```bash
   npm config set registry https://your-org.pkgs.visualstudio.com/...
   ```
4. `npm install` will now pull from Azure Artifacts, never from the public internet

This is the correct long-term solution for the regulated environment.

### Option 3: Verdaccio proxy (self-hosted mirror)

Deploy Verdaccio inside the Azure VNET. Configure it to proxy npmjs.org.
On first request, packages are cached internally. Subsequent requests never touch the internet.

---

## Production Replacement Packages (Path B Migration Only)

If IT architecture governance mandates Azure-native services (Path B in the
[Production Migration Plan](architecture/PRODUCTION_MIGRATION_PLAN.md)), the following
packages replace Supabase dependencies. These are NOT required for Path A.

| Replaces | Azure-native package | Notes |
|---|---|---|
| `@supabase/supabase-js` | `@azure/data-tables` + custom REST client | Or Azure SDK for PostgreSQL direct access |
| Supabase Auth | `@azure/msal-browser` (MSAL) | Microsoft Authentication Library — standard for Entra ID integration |
| Supabase Realtime | `@microsoft/signalr` | Azure SignalR Service client — replaces WebSocket subscription |

**Path A requires no new packages.** The `@supabase/supabase-js` client works unchanged
against a self-hosted Supabase endpoint inside the Azure VNET.

---

## Packages That Phone Home at Runtime

These packages make network calls during normal application operation.
All are currently configured to use the POC (external) endpoints and must be
reconfigured before production deployment inside the firewall:

| Package | What it calls | Production requirement |
|---|---|---|
| `@supabase/supabase-js` | Supabase cloud (US) | Reconfigure to internal Azure PostgreSQL endpoint |
| `@sentry/react` | sentry.io | Disable (VITE_SENTRY_DSN empty) or replace with self-hosted Sentry/Azure Monitor |
| `web-vitals` | Nothing — metrics are sent to Sentry only | No change required at package level |

All other packages operate entirely offline once installed.

---

## Packages NOT Required in Production Build

These packages are dev-only and do not need to be available on end-user machines
or production servers. They only need to be in the software portal for developer
workstations and CI/CD build agents:

`@babel/core`, `@playwright/test`, `@rolldown/plugin-babel`, `@tanstack/react-query-devtools`,
`@types/*`, `@vitejs/plugin-react`, `autoprefixer`, `babel-plugin-react-compiler`,
`postcss`, `tailwindcss`, `tailwindcss-animate`, `typescript`, `vite`, `wrangler`

---

## Audit Trail

| Date | Change | Author |
|---|---|---|
| 2026-03-30 | Initial manifest created — Sprint 1B | Jeremy Salbritton |
