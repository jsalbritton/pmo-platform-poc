/**
 * RiskEdge.tsx — Custom @xyflow edge for the Constellation View
 *
 * THIS FILE HAS ONE JOB:
 * Render a connection line between two projects, styled by relationship type.
 * Shows propagation reasons and constrained resources in tooltip on hover.
 * Purely visual — no data fetching, no business logic.
 *
 * RECEIVES: edge.data (RiskEdgeData from transformData.ts)
 * RENDERS: colored/dashed line with tooltip
 *
 * EDGE COLOR BY RELATIONSHIP (D-043):
 *   shared_resource (≥120%) → red, dashed, animated
 *   shared_resource (101-119%) → lighter red, dashed
 *   same_pm → purple, solid
 *   same_program → blue, solid
 *   same_vertical + resource → green, dotted
 *
 * ARCHITECTURE REF: Constellation_View_Architecture.html, D-043
 */

import { memo, useState } from 'react'
import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react'
import {
  edgeColor,
  edgeStrokeWidth,
  edgeDashArray,
  type RiskEdgeData,
} from './transformData'

// ─── EDGE TOOLTIP ────────────────────────────────────────────────────────────

function EdgeTooltip({
  reasons,
  constrainedResources,
  x,
  y,
}: {
  reasons: string[]
  constrainedResources: RiskEdgeData['constrainedResources']
  x: number
  y: number
}) {
  return (
    <foreignObject
      x={x - 110}
      y={y - 80}
      width={220}
      height={120}
      className="pointer-events-none overflow-visible"
    >
      <div className="
        bg-slate-900/95 border border-slate-700 rounded-lg
        px-3 py-2 shadow-2xl backdrop-blur-sm
        text-[10px] text-slate-300
      ">
        {/* Propagation reasons */}
        <div className="font-semibold text-slate-100 text-[11px] mb-1">Risk Propagation</div>
        {reasons.map((reason, i) => (
          <div key={i} className="text-slate-400 leading-relaxed">• {reason}</div>
        ))}

        {/* Constrained resources */}
        {constrainedResources.length > 0 && (
          <div className="mt-1.5 pt-1.5 border-t border-slate-700">
            <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wide mb-0.5">
              Constrained Resources
            </div>
            {constrainedResources.map((cr, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-slate-500 truncate" style={{ maxWidth: '100px' }}>
                  {cr.user_id.slice(0, 8)}…
                </span>
                <span
                  className="font-bold"
                  style={{
                    color: cr.total_allocation_pct >= 120 ? '#ef4444'
                      : cr.total_allocation_pct > 100 ? '#f87171'
                      : '#fbbf24',
                  }}
                >
                  {cr.total_allocation_pct}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </foreignObject>
  )
}

// ─── RISK EDGE COMPONENT ─────────────────────────────────────────────────────

function RiskEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false)

  const edgeData = data as unknown as RiskEdgeData
  const { exposureWeight, relationships, reasons, constrainedResources } = edgeData

  // Compute visual properties from the central mapping in transformData.ts
  const color = edgeColor(relationships)
  const strokeWidth = edgeStrokeWidth(exposureWeight)
  const dashArray = edgeDashArray(relationships)

  // Path calculation — smooth step for clean routing
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 16,
  })

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Invisible wider hit area for hover detection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={strokeWidth + 12}
        className="cursor-pointer"
      />

      {/* Visible edge line */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth,
          strokeDasharray: dashArray === 'none' ? undefined : dashArray,
          opacity: hovered ? 0.9 : 0.5,
          transition: 'opacity 0.2s ease',
        }}
      />

      {/* Hover tooltip */}
      {hovered && reasons.length > 0 && (
        <EdgeTooltip
          reasons={reasons}
          constrainedResources={constrainedResources}
          x={labelX}
          y={labelY}
        />
      )}
    </g>
  )
}

export default memo(RiskEdgeComponent)
