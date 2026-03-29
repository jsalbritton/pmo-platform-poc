/**
 * ConstellationView.tsx — Main page component for the Constellation View
 *
 * THIS FILE HAS ONE JOB:
 * Mount the @xyflow/react canvas with our custom node and edge types,
 * wire up the data hook, and render the detail panel on node click.
 *
 * THIS IS THE DEMO HEADLINE FEATURE (D-040):
 * "Watch what happens when one project goes critical — see the cascade
 * across 35 connected projects, with the exact resource constraints
 * that cause it."
 *
 * COMPONENT STRUCTURE:
 * - ConstellationView (this file) — page layout, ReactFlow mount, detail panel
 * - ProjectNode (imported) — custom node renderer
 * - RiskEdge (imported) — custom edge renderer
 * - useConstellationData (imported) — TanStack hook, returns nodes/edges
 * - transformData (used internally by hook) — pure transform
 *
 * ARCHITECTURE REF: Constellation_View_Architecture.html, Steps 4-5
 */

import { useCallback, useState, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import ProjectNode from './ProjectNode'
import RiskEdge from './RiskEdge'
import { useConstellationData } from './useConstellationData'
import { PULSE_COLORS, type ProjectNodeData, type RiskEdgeData } from './transformData'
import type { Project } from '@/types'

// ─── CUSTOM NODE/EDGE TYPE REGISTRATION ──────────────────────────────────────
// Defined outside component so @xyflow doesn't re-create on every render.
// These map the type strings in transformData.ts to actual React components.

const nodeTypes = { projectNode: ProjectNode }
const edgeTypes = { riskEdge: RiskEdge }

// ─── MINIMAP COLOR ───────────────────────────────────────────────────────────

function minimapNodeColor(node: Node): string {
  const data = node.data as unknown as ProjectNodeData
  if (!data?.condition) return '#475569'
  return PULSE_COLORS[data.condition]?.fill ?? '#475569'
}

// ─── DETAIL PANEL ────────────────────────────────────────────────────────────
// Slides in from the right when a node is clicked. Shows project details,
// pulse breakdown, and re-score button.

function DetailPanel({
  project,
  propagation,
  isRescoring,
  onRescore,
  onClose,
}: {
  project: Project
  propagation: { affected_count?: number; affected_projects?: { name: string; pulse_condition: string }[] } | null
  isRescoring: boolean
  onRescore: (id: string) => void
  onClose: () => void
}) {
  const condition = project.pulse_condition
  const colors = condition ? PULSE_COLORS[condition] : null

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
            className="text-slate-500 hover:text-slate-300 text-lg leading-none ml-2"
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
          <span
            className="text-sm font-bold"
            style={{ color: colors?.border ?? '#64748b' }}
          >
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

        {/* Signal chips */}
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

      {/* Risk Propagation Summary */}
      {propagation && propagation.affected_count && propagation.affected_count > 0 && (
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
                <div key={ap.name} className="flex items-center gap-2 text-[11px]">
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
            transition-colors
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

// ─── CONSTELLATION VIEW PAGE ─────────────────────────────────────────────────

export default function ConstellationView() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  const {
    nodes: rawNodes,
    edges: rawEdges,
    isLoading,
    isError,
    error,
    projects,
    propagation,
    rescore,
    isRescoring,
  } = useConstellationData(selectedProjectId ?? undefined)

  // @xyflow needs controlled state for nodes/edges (enables drag, layout updates)
  const [nodes, setNodes, onNodesChange] = useNodesState(rawNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges)

  // Sync when hook data changes (Realtime update, re-score, etc.)
  useMemo(() => {
    setNodes(rawNodes)
    setEdges(rawEdges)
  }, [rawNodes, rawEdges, setNodes, setEdges])

  // Node click → open detail panel
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedProjectId(node.id)
  }, [])

  // Find the full project object for the detail panel
  const selectedProject = projects.find(p => p.id === selectedProjectId)

  // ─── LOADING STATE ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500">Initializing constellation…</p>
          <p className="text-xs text-slate-600">Loading {projects.length || '150'} projects</p>
        </div>
      </div>
    )
  }

  // ─── ERROR STATE ───────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="w-full h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm text-red-400">Failed to load constellation</p>
          <p className="text-xs text-slate-500">{error?.message}</p>
        </div>
      </div>
    )
  }

  // ─── MAIN RENDER ───────────────────────────────────────────────────────────

  return (
    <div className="relative w-full h-screen bg-[#0d1117]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={3}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      >
        {/* Dot grid background */}
        <Background color="#1e293b" gap={20} size={1} />

        {/* Zoom controls — bottom left */}
        <Controls
          showInteractive={false}
          className="!bg-slate-800/80 !border-slate-700 !rounded-lg !shadow-lg"
        />

        {/* Minimap — bottom right, colored by Pulse condition */}
        <MiniMap
          nodeColor={minimapNodeColor}
          maskColor="rgba(13,17,23,0.85)"
          className="!bg-slate-900 !border-slate-700 !rounded-lg"
          pannable
          zoomable
        />

        {/* Top-left info panel */}
        <Panel position="top-left" className="!m-4">
          <div className="bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
              <h1 className="text-sm font-bold text-slate-100">Constellation View</h1>
            </div>
            <p className="text-[11px] text-slate-500">
              {nodes.length} projects · Click node to inspect · Scroll to zoom
            </p>
          </div>
        </Panel>

        {/* Legend — top-right */}
        <Panel position="top-right" className="!m-4">
          <div className="bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 backdrop-blur-sm">
            <div className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold mb-2">
              Pulse Condition
            </div>
            <div className="space-y-1.5">
              {(Object.entries(PULSE_COLORS) as [string, { fill: string; label: string }][]).map(
                ([, { fill, label }]) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: fill }} />
                    <span className="text-[10px] text-slate-400">{label}</span>
                  </div>
                )
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-1">
              <div className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold mb-1">
                Edges (D-043)
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-red-500 rounded" style={{ borderTop: '2px dashed #ef4444' }} />
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
            </div>
          </div>
        </Panel>
      </ReactFlow>

      {/* Detail Panel — slides in on node click */}
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
