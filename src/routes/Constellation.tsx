/**
 * Constellation View — /constellation
 *
 * A force-directed graph showing all 150 projects as glowing nodes,
 * clustered by program, colored by health score, sized by budget.
 *
 * WHY CANVAS NOT SVG:
 * 150+ nodes with continuous force simulation = thousands of DOM updates
 * per second if using SVG elements. Canvas draws everything as pixels in
 * a single <canvas> element — one draw call per frame regardless of node
 * count. For data this size, canvas is 10-50x faster than SVG.
 *
 * HOW D3 FORCE SIMULATION WORKS:
 * D3's force simulation treats each node as a particle in a physics engine.
 * Forces push/pull nodes toward target positions:
 *   - forceCenter: pulls everything toward the canvas center
 *   - forceCollide: prevents nodes from overlapping (like repulsion)
 *   - forceManyBody: general repulsion between nodes (like magnets)
 *   - forceX/forceY: soft gravity pulling nodes toward program cluster centers
 *
 * Each animation frame, the simulation advances and calls our draw function.
 * We clear the canvas and redraw every node at its current position.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3-force'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowsOut, Info } from '@phosphor-icons/react'
import { useProjects } from '@/hooks/useProjects'
import type { Project } from '@/types'

// ─── PROGRAM CLUSTER CENTERS ─────────────────────────────────────────────────
// 5 programs arranged in a pentagon — each gets a gravity anchor.
// Nodes are softly attracted to their program's center via forceX/forceY.
// Positions expressed as fractions of canvas width/height (0–1).

// Dynamic cluster positions — 5 programs arranged in a pentagon
const CLUSTER_POSITIONS = [
  { x: 0.5,  y: 0.18 },   // top
  { x: 0.82, y: 0.38 },   // upper right
  { x: 0.72, y: 0.75 },   // lower right
  { x: 0.28, y: 0.75 },   // lower left
  { x: 0.18, y: 0.38 },   // upper left
]

const CLUSTER_COLORS = [
  '#3b82f6',  // blue
  '#8b5cf6',  // violet
  '#06b6d4',  // cyan
  '#10b981',  // emerald
  '#f59e0b',  // amber
]

// ─── HEALTH SCORE → COLOR ─────────────────────────────────────────────────────

function healthColor(score: number | null): string {
  if (score === null) return '#475569'   // slate — unscored
  if (score >= 70) return '#10b981'      // emerald — healthy
  if (score >= 40) return '#f59e0b'      // amber — at risk
  return '#ef4444'                       // red — critical
}

function healthGlow(score: number | null): string {
  if (score === null) return 'rgba(71,85,105,0.3)'
  if (score >= 70) return 'rgba(16,185,129,0.25)'
  if (score >= 40) return 'rgba(245,158,11,0.25)'
  return 'rgba(239,68,68,0.3)'
}

// ─── NODE RADIUS — proportional to budget ─────────────────────────────────────

function nodeRadius(budget: number | null, budgetExtent: [number, number]): number {
  if (!budget) return 5
  const [min, max] = budgetExtent
  const normalized = max > min ? (budget - min) / (max - min) : 0.5
  return 5 + normalized * 14  // 5px min, 19px max
}

// ─── D3 NODE TYPE ─────────────────────────────────────────────────────────────

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  project: Project
  programIndex: number
  radius: number
  color: string
  glow: string
  isPulsing: boolean   // critical projects pulse
}

// ─── CONSTELLATION CANVAS ─────────────────────────────────────────────────────

function ConstellationCanvas({
  projects,
  programMap,
  onHover,
  onSelect,
}: {
  projects: Project[]
  programMap: Map<string, number>   // program_id → cluster index
  onHover: (p: Project | null) => void
  onSelect: (p: Project) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simulationRef = useRef<d3.Simulation<SimNode, never> | null>(null)
  const nodesRef = useRef<SimNode[]>([])
  const frameRef = useRef<number>(0)
  const hoveredRef = useRef<string | null>(null)
  const pulseRef = useRef(0)

  // Derive budget extent for radius scaling
  const budgets = projects.map(p => p.budget_total ?? 0).filter(Boolean)
  const budgetExtent: [number, number] = [
    Math.min(...budgets),
    Math.max(...budgets),
  ]

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = canvas

    pulseRef.current += 0.04

    // Clear
    ctx.clearRect(0, 0, width, height)

    // Background subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.02)'
    ctx.lineWidth = 1
    for (let x = 0; x < width; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke()
    }
    for (let y = 0; y < height; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
    }

    // Draw cluster label halos (background glow at cluster centers)
    for (const [idx, clusterPos] of CLUSTER_POSITIONS.entries()) {
      if (idx >= CLUSTER_COLORS.length) break
      const cx = clusterPos.x * width
      const cy = clusterPos.y * height
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 80)
      gradient.addColorStop(0, CLUSTER_COLORS[idx] + '12')
      gradient.addColorStop(1, 'transparent')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(cx, cy, 80, 0, Math.PI * 2)
      ctx.fill()
    }

    // Draw edges (thin lines between nodes in the same program)
    // Only draw within-program edges for visual clustering
    const programGroups = new Map<number, SimNode[]>()
    for (const node of nodesRef.current) {
      const g = programGroups.get(node.programIndex) ?? []
      g.push(node)
      programGroups.set(node.programIndex, g)
    }

    for (const [idx, members] of programGroups.entries()) {
      if (!members[0]?.x || !members[0]?.y) continue
      // Connect each node to the cluster center with a faint line
      const clusterPos = CLUSTER_POSITIONS[idx] ?? CLUSTER_POSITIONS[0]
      const cx = clusterPos.x * width
      const cy = clusterPos.y * height
      const color = CLUSTER_COLORS[idx] ?? CLUSTER_COLORS[0]

      for (const node of members) {
        if (node.x === undefined || node.y === undefined) continue
        ctx.beginPath()
        ctx.moveTo(node.x, node.y)
        ctx.lineTo(cx, cy)
        ctx.strokeStyle = color + '18'
        ctx.lineWidth = 0.5
        ctx.stroke()
      }
    }

    // Draw nodes
    for (const node of nodesRef.current) {
      if (node.x === undefined || node.y === undefined) continue
      const { x, y, radius, color, glow, isPulsing, id } = node
      const isHovered = hoveredRef.current === id

      // Pulse radius for critical nodes
      const pulseExtra = isPulsing
        ? Math.sin(pulseRef.current * 2) * 3
        : 0

      const r = radius + (isHovered ? 4 : 0) + pulseExtra

      // Outer glow
      const glowRadius = r + (isHovered ? 16 : 8)
      const gradient = ctx.createRadialGradient(x, y, r * 0.3, x, y, glowRadius)
      gradient.addColorStop(0, glow)
      gradient.addColorStop(1, 'transparent')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(x, y, glowRadius, 0, Math.PI * 2)
      ctx.fill()

      // Node body
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = color + (isHovered ? 'ff' : 'cc')
      ctx.fill()

      // Node border
      ctx.strokeStyle = isHovered ? '#ffffff44' : color + '66'
      ctx.lineWidth = isHovered ? 1.5 : 0.5
      ctx.stroke()

      // Center highlight (makes nodes look 3D)
      const shine = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r)
      shine.addColorStop(0, 'rgba(255,255,255,0.25)')
      shine.addColorStop(1, 'transparent')
      ctx.fillStyle = shine
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    frameRef.current = requestAnimationFrame(draw)
  }, [])

  // Initialize simulation when projects change
  useEffect(() => {
    if (!canvasRef.current || projects.length === 0) return
    const canvas = canvasRef.current
    const { width, height } = canvas

    // Build nodes
    const nodes: SimNode[] = projects.map(p => {
      const programIdx = p.program_id ? (programMap.get(p.program_id) ?? 0) : 0
      return {
        id: p.id,
        project: p,
        programIndex: programIdx,
        radius: nodeRadius(p.budget_total, budgetExtent),
        color: healthColor(p.health_score),
        glow: healthGlow(p.health_score),
        isPulsing: (p.health_score ?? 100) < 30,
        x: width / 2 + (Math.random() - 0.5) * 100,
        y: height / 2 + (Math.random() - 0.5) * 100,
      }
    })
    nodesRef.current = nodes

    // Force simulation
    const sim = d3.forceSimulation<SimNode>(nodes)
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
      .force('collide', d3.forceCollide<SimNode>(n => n.radius + 3).strength(0.7))
      .force('charge', d3.forceManyBody().strength(-30))
      .force('x', d3.forceX<SimNode>(n => {
        const pos = CLUSTER_POSITIONS[n.programIndex] ?? CLUSTER_POSITIONS[0]
        return pos.x * width
      }).strength(0.15))
      .force('y', d3.forceY<SimNode>(n => {
        const pos = CLUSTER_POSITIONS[n.programIndex] ?? CLUSTER_POSITIONS[0]
        return pos.y * height
      }).strength(0.15))
      .alphaDecay(0.008)   // slow decay = longer animation before settling

    simulationRef.current = sim

    // Start draw loop
    frameRef.current = requestAnimationFrame(draw)

    return () => {
      sim.stop()
      cancelAnimationFrame(frameRef.current)
    }
  }, [projects.length])

  // Hit detection on mousemove
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    let found: SimNode | null = null
    for (const node of nodesRef.current) {
      if (node.x === undefined || node.y === undefined) continue
      const dx = node.x - mx
      const dy = node.y - my
      if (Math.sqrt(dx * dx + dy * dy) <= node.radius + 6) {
        found = node
        break
      }
    }

    hoveredRef.current = found?.id ?? null
    canvas.style.cursor = found ? 'pointer' : 'default'
    onHover(found?.project ?? null)
  }, [onHover])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    for (const node of nodesRef.current) {
      if (node.x === undefined || node.y === undefined) continue
      const dx = node.x - mx
      const dy = node.y - my
      if (Math.sqrt(dx * dx + dy * dy) <= node.radius + 6) {
        onSelect(node.project)
        return
      }
    }
  }, [onSelect])

  // Resize handler
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      canvas.width = width
      canvas.height = height
    })
    ro.observe(canvas.parentElement!)
    canvas.width = canvas.parentElement!.clientWidth
    canvas.height = canvas.parentElement!.clientHeight
    return () => ro.disconnect()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onMouseLeave={() => { hoveredRef.current = null; onHover(null) }}
      className="w-full h-full"
    />
  )
}

// ─── TOOLTIP ─────────────────────────────────────────────────────────────────

function ProjectTooltip({ project, pos }: {
  project: Project
  pos: { x: number; y: number }
}) {
  const health = project.health_score
  const healthLabel = health === null ? 'Unscored'
    : health >= 70 ? 'Healthy' : health >= 40 ? 'At Risk' : 'Critical'
  const healthColor = health === null ? 'text-slate-400'
    : health >= 70 ? 'text-emerald-400' : health >= 40 ? 'text-amber-400' : 'text-red-400'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.1 }}
      className="
        fixed z-50 pointer-events-none
        bg-[#1c2333]/95 border border-white/10 rounded-xl
        shadow-2xl backdrop-blur-sm
        px-4 py-3 w-52
      "
      style={{
        left: Math.min(pos.x + 16, window.innerWidth - 220),
        top: Math.min(pos.y - 10, window.innerHeight - 140),
      }}
    >
      <div className="font-semibold text-slate-100 text-sm leading-tight mb-2">
        {project.name}
      </div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-500">Health</span>
        <span className={`font-bold ${healthColor}`}>
          {health !== null ? health.toFixed(0) : '—'} · {healthLabel}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-500">Risk</span>
        <span className="text-slate-300">
          {project.risk_score !== null ? project.risk_score.toFixed(0) : '—'}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-slate-500">Budget</span>
        <span className="text-slate-300">
          {project.budget_total
            ? `$${(project.budget_total / 1000).toFixed(0)}k`
            : '—'}
        </span>
      </div>
      <div className="text-[10px] text-blue-400 font-medium">
        Click to open project →
      </div>
    </motion.div>
  )
}

// ─── LEGEND ───────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="absolute bottom-6 left-6 bg-[#0d1117]/80 border border-white/8 rounded-xl px-4 py-3 backdrop-blur-sm">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-semibold">
        Health Score
      </div>
      <div className="space-y-1.5">
        {[
          { color: '#10b981', label: 'Healthy (70–100)' },
          { color: '#f59e0b', label: 'At Risk (40–69)' },
          { color: '#ef4444', label: 'Critical (0–39)' },
          { color: '#475569', label: 'Unscored' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-[11px] text-slate-400">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-slate-600">
        Node size = budget · Clusters = programs
      </div>
    </div>
  )
}

// ─── CONSTELLATION PAGE ───────────────────────────────────────────────────────

export default function Constellation() {
  const navigate = useNavigate()
  const { data: projects = [], isLoading } = useProjects({ pageSize: 150 })
  const [hovered, setHovered] = useState<Project | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  // Build program → cluster index map from the data
  const programMap = new Map<string, number>()
  let programCounter = 0
  for (const p of projects) {
    if (p.program_id && !programMap.has(p.program_id)) {
      programMap.set(p.program_id, programCounter % CLUSTER_POSITIONS.length)
      programCounter++
    }
  }

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }, [])

  return (
    <div
      className="relative w-full h-screen bg-[#0d1117] overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4
                      bg-gradient-to-b from-[#0d1117] to-transparent pointer-events-none">
        <div>
          <div className="flex items-center gap-2">
            <ArrowsOut size={18} className="text-violet-400" weight="bold" />
            <h1 className="text-lg font-bold text-slate-100">Constellation View</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {projects.length} projects · {programMap.size} programs · hover to inspect · click to open
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600 pointer-events-auto">
          <Info size={12} />
          <span>Force simulation settles in ~5s</span>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-500">Initializing constellation...</p>
          </div>
        </div>
      )}

      {/* Canvas */}
      {!isLoading && (
        <ConstellationCanvas
          projects={projects}
          programMap={programMap}
          onHover={setHovered}
          onSelect={p => navigate(`/project/${p.id}`)}
        />
      )}

      {/* Tooltip */}
      <AnimatePresence>
        {hovered && (
          <ProjectTooltip key={hovered.id} project={hovered} pos={mousePos} />
        )}
      </AnimatePresence>

      {/* Legend */}
      <Legend />
    </div>
  )
}

