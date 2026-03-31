/**
 * ConstellationView.tsx — Main page component for the Constellation View
 *
 * THIS FILE HAS ONE JOB:
 * Orchestrate all Constellation layers — data fetching, WebGL rendering,
 * worker physics, and the detail panel — into a single full-screen view.
 *
 * MIGRATION NOTE (from @xyflow/react → sigma.js):
 * Sprint 1B replaced the @xyflow/react renderer with sigma.js WebGL.
 * Rationale: see ADR-002. The data pipeline (useConstellationData, transformData.ts)
 * is unchanged. DetailPanel and all panels are unchanged. Only the renderer changed.
 *
 * COMPONENT STRUCTURE:
 *   ConstellationView (this file)
 *     └── CSS animated background       — deep-space ambience (Layer 1)
 *     └── ConstellationSigmaCanvas      — sigma.js WebGL nodes + edges (Layer 2)
 *     └── ConstellationSettlingBar      — alpha indicator (Layer 3)
 *     └── Info panel (top-left)         — project count, instructions
 *     └── Legend panel (top-right)      — pulse condition legend
 *     └── DetailPanel (right drawer)    — selected project details
 *
 * DATA FLOW:
 *   Supabase → useConstellationData → projects/propagation
 *   projects/propagation → buildConstellationGraph → WorkerBus → d3-force ticks
 *   ticks → ConstellationSigmaCanvas (direct WebGL, no React state for positions)
 *   project click → selectedProjectId state → DetailPanel
 *
 * UPGRADE PATH (Sprint 2):
 *   - Replace CSS background with WebGL shader (THREE.js or custom fragment shader)
 *   - Add custom sigma node program with per-node bloom glow
 *   - Add Rive state machines for node enter/exit/select animations
 *
 * ADR references: ADR-001 (Web Workers), ADR-002 (sigma.js renderer)
 */

import { useState, useMemo, useCallback, useRef } from 'react'
import { useConstellationData }  from './useConstellationData'
import { ConstellationSigmaCanvas } from './ConstellationSigmaCanvas'
import { buildConstellationGraph }  from './transformSigmaData'
import { PULSE_COLORS }             from './transformData'
import type { Project }             from '@/types'
import type { PropagationResult }   from './transformData'

// ─── CANVAS DIMENSIONS ───────────────────────────────────────────────────────
// Used for the d3-force center force. Matches the viewport.
const CANVAS_W = typeof window !== 'undefined' ? window.innerWidth  : 1440
const CANVAS_H = typeof window !== 'undefined' ? window.innerHeight : 900

// ─── DETAIL PANEL ─────────────────────────────────────────────────────────────
// Reused from the original @xyflow implementation.
// Slides in from the right when a node is selected.

function DetailPanel({
  project,
  propagation,
  isRescoring,
  onRescore,
  onClose,
}: {
  project:     Project
  propagation: PropagationResult | null
  isRescoring: boolean
  onRescore:   (id: string) => void
  onClose:     () => void
}) {
  const condition = project.pulse_condition
  const colors    = condition ? PULSE_COLORS[condition] : null

  return (
    <div className="
      absolute top-0 right-0 h-full w-80
      bg-slate-900/95 border-l border-slate-700
      backdrop-blur-sm overflow-y-auto
      shadow-2xl z-50
    ">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-100 truncate">{project.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{project.vertical ?? 'No vertical'}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-lg leading-none ml-2 cursor-pointer"
          >
            ×
          </button>
        </div>
      </div>

      {/* Pulse Status */}
      <div className="p-4 border-b border-slate-800">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">
          Pulse Status
        </div>
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: colors?.fill ?? '#475569' }}
          />
          <span className="text-sm font-bold" style={{ color: colors?.border ?? '#64748b' }}>
            {colors?.label ?? 'Unscored'}
          </span>
          {project.pulse_momentum && project.pulse_momentum !== 'stable' && (
            <span className="text-xs text-slate-400 capitalize">
              · {project.pulse_momentum}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-800/50 rounded-lg p-2">
            <div className="text-[9px] text-slate-500 uppercase">Health</div>
            <div className="text-lg font-bold text-slate-200">
              {project.health_score !== null ? Math.round(project.health_score) : '—'}
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2">
            <div className="text-[9px] text-slate-500 uppercase">Risk</div>
            <div className="text-lg font-bold text-slate-200">
              {project.risk_score !== null ? Math.round(project.risk_score) : '—'}
            </div>
          </div>
        </div>

        {project.pulse_signals && project.pulse_signals.length > 0 && (
          <div className="mt-3">
            <div className="text-[9px] text-slate-500 uppercase mb-1">Elevated Signals</div>
            <div className="flex gap-1 flex-wrap">
              {project.pulse_signals.map((s) => (
                <span
                  key={s}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded"
                  style={{
                    color: colors?.border ?? '#64748b',
                    backgroundColor: `${colors?.border ?? '#64748b'}20`,
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Risk Cascade */}
      {propagation && propagation.affected_count != null && propagation.affected_count > 0 && (
        <div className="p-4 border-b border-slate-800">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">
            Risk Cascade (D-043)
          </div>
          <div className="text-sm text-slate-300 mb-2">
            <span className="text-red-400 font-bold">{propagation.affected_count}</span> projects affected
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {propagation.affected_projects?.slice(0, 10).map((ap) => {
              const apColors = PULSE_COLORS[ap.pulse_condition as keyof typeof PULSE_COLORS]
              return (
                <div key={ap.id} className="flex items-center gap-2 text-[11px]">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: apColors?.fill ?? '#475569' }}
                  />
                  <span className="text-slate-400 truncate">{ap.name}</span>
                </div>
              )
            })}
            {(propagation.affected_projects?.length ?? 0) > 10 && (
              <div className="text-[10px] text-slate-600 pl-4">
                +{(propagation.affected_projects?.length ?? 0) - 10} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-4">
        <button
          onClick={() => onRescore(project.id)}
          disabled={isRescoring}
          className="
            w-full py-2 px-3 rounded-lg text-sm font-semibold
            bg-violet-600 hover:bg-violet-500 text-white
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors cursor-pointer
          "
        >
          {isRescoring ? 'Re-scoring…' : 'Re-score Project'}
        </button>
        <p className="text-[10px] text-slate-600 text-center mt-2">
          POST /api/predict/{project.id.slice(0, 8)}… → FastAPI → ML engine
        </p>
      </div>
    </div>
  )
}

// ─── SETTLING BAR ─────────────────────────────────────────────────────────────
// Shows simulation heat as a thin arc at the bottom.
// Fades out as alpha approaches 0 (simulation stabilises).

function ConstellationSettlingBar({ alpha, stabilized }: { alpha: number; stabilized: boolean }) {
  if (stabilized || alpha < 0.02) return null

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
      <div className="flex items-center gap-2">
        <div className="w-32 h-0.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-100"
            style={{
              width:           `${Math.round(alpha * 100)}%`,
              backgroundColor: '#33BBFF',
              opacity:         Math.min(alpha * 3, 0.7),
            }}
          />
        </div>
        <span
          className="text-[10px] text-slate-500 tabular-nums"
          style={{ opacity: Math.min(alpha * 3, 0.7) }}
        >
          settling…
        </span>
      </div>
    </div>
  )
}

// ─── CONSTELLATION VIEW ────────────────────────────────────────────────────────

export default function ConstellationView() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [alpha,             setAlpha]             = useState(1)
  const [isStabilized,      setIsStabilized]       = useState(false)
  // Monotonic version counter — incremented on every data refresh to trigger fast-path hydration
  const versionRef = useRef(1)

  const {
    isLoading,
    isError,
    error,
    projects,
    propagation,
    rescore,
    isRescoring,
  } = useConstellationData(selectedProjectId ?? undefined)

  // Build the ConstellationGraph payload for the d3-force worker.
  // Version increments when data changes — triggers the worker's hybrid state fast path.
  const workerGraph = useMemo(() => {
    versionRef.current += 1
    return buildConstellationGraph(
      projects,
      propagation,
      versionRef.current,
      CANVAS_W,
      CANVAS_H,
    )
  }, [projects, propagation])

  const handleNodeSelect  = useCallback((id: string | null) => setSelectedProjectId(id), [])
  const handleAlphaChange = useCallback((a: number) => setAlpha(a), [])
  const handleStabilized  = useCallback(() => setIsStabilized(true), [])

  const selectedProject = projects.find(p => p.id === selectedProjectId) ?? null

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-[#030d1a] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500">Initializing constellation…</p>
          <p className="text-xs text-slate-600">Loading {projects.length || '—'} projects</p>
        </div>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="w-full h-screen bg-[#030d1a] flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm text-red-400">Failed to load constellation</p>
          <p className="text-xs text-slate-500">{error?.message}</p>
        </div>
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ background: '#030d1a' }}>

      {/* ── Layer 1: Animated deep-space background ──────────────────────────
          CSS radial gradients simulating nebula ambient light.
          Sprint 2 upgrade: replace with WebGL fragment shader for dynamic
          particle drift and light source interaction with nodes.       */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 20% 40%, rgba(0,53,149,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 80% 70%, rgba(51,187,255,0.06) 0%, transparent 50%),
            radial-gradient(ellipse 40% 30% at 50% 20%, rgba(0,53,149,0.08) 0%, transparent 40%),
            #030d1a
          `,
        }}
      />

      {/* ── Layer 2: sigma.js WebGL canvas ───────────────────────────────────
          All node + edge rendering. 60fps tick updates bypass React state. */}
      <ConstellationSigmaCanvas
        projects={projects}
        propagation={propagation}
        workerGraph={workerGraph}
        onNodeSelect={handleNodeSelect}
        onAlphaChange={handleAlphaChange}
        onStabilized={handleStabilized}
        selectedNodeId={selectedProjectId}
      />

      {/* ── Layer 3: Settling indicator ──────────────────────────────────── */}
      <ConstellationSettlingBar alpha={alpha} stabilized={isStabilized} />

      {/* ── Info panel — top-left ─────────────────────────────────────────── */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
            <h1 className="text-sm font-bold text-slate-100">Constellation View</h1>
          </div>
          <p className="text-[11px] text-slate-500">
            {projects.filter(p => p.status !== 'cancelled').length} projects
            · Click to inspect · Scroll to zoom · Drag to pin
          </p>
        </div>
      </div>

      {/* ── Legend panel — top-right ─────────────────────────────────────── */}
      <div className="absolute top-4 right-4 z-10 pointer-events-none"
           style={{ right: selectedProject ? '336px' : '16px', transition: 'right 0.2s ease' }}>
        <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl px-4 py-3 backdrop-blur-sm">
          <div className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold mb-2">
            Pulse Condition
          </div>
          <div className="space-y-1.5">
            {(Object.entries(PULSE_COLORS) as [string, { fill: string; label: string }][]).map(
              ([, { fill, label }]) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: fill }} />
                  <span className="text-[10px] text-slate-400">{label}</span>
                </div>
              )
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-1.5">
            <div className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold mb-1">
              Edges (D-043)
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-px" style={{ borderTop: '2px dashed #ef4444' }} />
              <span className="text-[10px] text-slate-400">Shared resource</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-violet-500 rounded" />
              <span className="text-[10px] text-slate-400">Same PM</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-blue-500 rounded" />
              <span className="text-[10px] text-slate-400">Same program</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-slate-600 rounded" />
              <span className="text-[10px] text-slate-400">Same vertical</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Detail Panel — right drawer ───────────────────────────────────── */}
      {selectedProject && (
        <DetailPanel
          project={selectedProject}
          propagation={propagation}
          isRescoring={isRescoring}
          onRescore={rescore}
          onClose={() => setSelectedProjectId(null)}
        />
      )}
    </div>
  )
}
