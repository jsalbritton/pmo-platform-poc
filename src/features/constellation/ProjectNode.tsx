/**
 * ProjectNode.tsx — Custom @xyflow node for the Constellation View
 *
 * THIS FILE HAS ONE JOB:
 * Render a single project as a circle with Pulse-driven colors, sparkline,
 * signal chips, and momentum arrow. Purely visual — no data fetching,
 * no business logic.
 *
 * RECEIVES: node.data (ProjectNodeData from transformData.ts)
 * RENDERS: colored circle + name + sparkline + signal chips
 *
 * PULSE → VISUAL MAPPING:
 *   healthy  → green, normal size, static
 *   watch    → amber, slightly larger, signal chips on hover
 *   elevated → red, larger, signal chips always visible, momentum arrow
 *   critical → dark red, largest, pulsing glow animation, all data visible
 *   dormant  → gray at 60% opacity, faded
 *
 * ARCHITECTURE REF: Constellation_View_Architecture.html, Step 4
 */

import { memo } from 'react'
// @xyflow/react removed in S1A — constellation renders via sigma.js.
// This file is preserved as reference. Local stubs keep TS happy without the dependency.
const Position = { Top: 'top' as const, Bottom: 'bottom' as const, Left: 'left' as const, Right: 'right' as const }
type NodeProps = { data: Record<string, unknown> }
function Handle(_props: { type: string; position: string; className?: string }) { return null }
import { PULSE_COLORS, type ProjectNodeData } from './transformData'

// ─── SPARKLINE (SVG mini chart) ──────────────────────────────────────────────

function Sparkline({ scores, color }: { scores: number[]; color: string }) {
  if (scores.length < 2) return null

  const width = 36
  const height = 12
  const max = Math.max(...scores, 100)
  const min = Math.min(...scores, 0)
  const range = max - min || 1

  const points = scores
    .map((score, i) => {
      const x = (i / (scores.length - 1)) * width
      const y = height - ((score - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} className="mt-1">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
    </svg>
  )
}

// ─── SIGNAL CHIPS ────────────────────────────────────────────────────────────

const SIGNAL_LABELS: Record<string, string> = {
  budget: 'BUD',
  schedule: 'SCH',
  delivery: 'DEL',
  scope: 'SCP',
  risks: 'RSK',
  execution: 'EXE',
}

function SignalChips({ signals, borderColor }: { signals: string[]; borderColor: string }) {
  if (!signals || signals.length === 0) return null

  return (
    <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
      {signals.map((s) => (
        <span
          key={s}
          className="text-[7px] font-bold px-1 py-px rounded"
          style={{
            color: borderColor,
            backgroundColor: `${borderColor}20`,
            border: `1px solid ${borderColor}40`,
          }}
        >
          {SIGNAL_LABELS[s] ?? s.slice(0, 3).toUpperCase()}
        </span>
      ))}
    </div>
  )
}

// ─── MOMENTUM ARROW ──────────────────────────────────────────────────────────

function MomentumArrow({ momentum }: { momentum: string | null }) {
  if (!momentum || momentum === 'stable') return null

  const arrows: Record<string, { symbol: string; color: string }> = {
    recovering: { symbol: '↑', color: '#34d399' },
    declining:  { symbol: '↓', color: '#f87171' },
    volatile:   { symbol: '↕', color: '#fbbf24' },
  }

  const { symbol, color } = arrows[momentum] ?? { symbol: '·', color: '#94a3b8' }

  return (
    <span
      className="absolute -top-1 -right-1 text-[10px] font-bold leading-none"
      style={{ color }}
    >
      {symbol}
    </span>
  )
}

// ─── PROJECT NODE COMPONENT ─────────────────────────────────────────────────

function ProjectNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as ProjectNodeData
  const {
    name,
    condition,
    momentum,
    signals,
    healthScore,
    sparkline,
  } = nodeData

  // Resolve colors from the central mapping
  const colors = condition ? PULSE_COLORS[condition] : {
    fill: '#475569',
    border: '#64748b',
    glow: 'rgba(71,85,105,0.2)',
    label: 'Unscored',
  }

  // Size by condition severity
  const sizeClass = condition === 'critical' ? 'w-16 h-16'
    : condition === 'elevated' ? 'w-14 h-14'
    : condition === 'watch' ? 'w-13 h-13'
    : 'w-12 h-12'

  // Dormant fades out
  const opacity = condition === 'dormant' ? 0.5 : 1

  // Critical nodes pulse
  const pulseAnimation = condition === 'critical'
    ? 'animate-pulse'
    : ''

  // Show signals: always for elevated/critical, hover-only handled via CSS group
  const alwaysShowSignals = condition === 'elevated' || condition === 'critical'

  return (
    <div className="relative group" style={{ opacity }}>
      {/* Invisible handles for @xyflow edge connections */}
      <Handle type="target" position={Position.Top} className="!opacity-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-0 !h-0" />

      {/* Glow ring */}
      <div
        className={`absolute inset-0 rounded-full blur-md ${pulseAnimation}`}
        style={{
          backgroundColor: colors.glow,
          transform: 'scale(1.4)',
        }}
      />

      {/* Node circle */}
      <div
        className={`
          relative ${sizeClass} rounded-full flex flex-col items-center justify-center
          cursor-pointer transition-transform duration-200
          hover:scale-110 hover:z-10
        `}
        style={{
          backgroundColor: colors.fill,
          border: `2px solid ${colors.border}`,
          boxShadow: `0 0 20px ${colors.glow}`,
        }}
      >
        {/* Momentum arrow */}
        <MomentumArrow momentum={momentum} />

        {/* Project name (truncated) */}
        <span className="text-[8px] font-semibold text-white text-center leading-tight px-1 select-none">
          {name.length > 12 ? name.slice(0, 11) + '…' : name}
        </span>

        {/* Health score badge */}
        {healthScore !== null && (
          <span className="text-[7px] font-bold text-white/70 mt-0.5">
            {Math.round(healthScore)}
          </span>
        )}
      </div>

      {/* Sparkline — below the node */}
      {sparkline.length >= 2 && (
        <div className="flex justify-center">
          <Sparkline scores={sparkline} color={colors.border} />
        </div>
      )}

      {/* Signal chips — always shown for elevated/critical, hover for others */}
      <div className={alwaysShowSignals ? '' : 'hidden group-hover:block'}>
        <SignalChips signals={signals ?? []} borderColor={colors.border} />
      </div>

      {/* Hover tooltip with details */}
      <div className="
        absolute left-1/2 -translate-x-1/2 -bottom-20 z-50
        hidden group-hover:block
        bg-slate-900/95 border border-slate-700 rounded-lg
        px-3 py-2 w-44 pointer-events-none
        shadow-2xl backdrop-blur-sm
      ">
        <div className="text-[11px] font-semibold text-slate-100 truncate">{name}</div>
        <div className="flex justify-between mt-1 text-[10px]">
          <span className="text-slate-500">Condition</span>
          <span style={{ color: colors.border }} className="font-bold">{colors.label}</span>
        </div>
        {healthScore !== null && (
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">Health</span>
            <span className="text-slate-300">{Math.round(healthScore)}</span>
          </div>
        )}
        {momentum && momentum !== 'stable' && (
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">Momentum</span>
            <span className="text-slate-300 capitalize">{momentum}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Memo prevents re-render when parent re-renders but this node's data hasn't changed
export default memo(ProjectNodeComponent)
