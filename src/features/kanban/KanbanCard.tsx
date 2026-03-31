/**
 * KanbanCard — draggable work item card for the sprint board.
 *
 * DESIGN PHILOSOPHY (D-052: Alcon dark navy system):
 *   - Dark navy glassmorphism surface — sits against kanban-board-bg gradient
 *   - Type bar: vivid OKLCH color left-edge accent (3px, full card height)
 *   - Priority icon + title on row 1
 *   - Metadata chips on row 2 (type, points, due date, labels, assignee)
 *   - Overdue: red border glow
 *   - Hover: cyan border + ambient glow — zero Framer Motion overhead
 *   - Entry: @starting-style CSS animation (kanban-card-enter) — compositor thread
 *
 * PERFORMANCE (D-052):
 *   - content-visibility: auto (.cv-auto) — browser skips render for offscreen cards.
 *     Only applied to non-overlay cards since overlay is always visible.
 *   - contain-intrinsic-size: auto 96px (.cis-card) — stable scroll bar hint.
 *   - React.memo — skips re-render when sibling cards reorder (no prop change).
 *
 * TYPE COLOR BAR (fixed from v1):
 *   v1 used a fragile ternary string-matching on Tailwind class names.
 *   v2 uses TYPE_BAR_COLORS — a clean record of OKLCH values keyed by type,
 *   fully consistent with the Alcon OKLCH token system.
 *
 * DRAG-AND-DROP:
 *   useSortable provides transform + transition for smooth DnD.
 *   isDragging → opacity 0.35, placeholder stays in DOM flow.
 *   isDragOverlay → no DnD bindings, enhanced shadow, slight tilt.
 */

import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Warning,
  ArrowUp,
  ArrowUpRight,
  ArrowDown,
  Minus,
  CalendarBlank,
  Lightning,
} from '@phosphor-icons/react'
import {
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  TYPE_CONFIG,
  profileDisplayName,
  profileInitials,
} from '@/features/work-items/workItem.types'
import type { KanbanItem } from './useKanbanBoard'

// ─── PRIORITY ICON MAP ───────────────────────────────────────────────────────

const PriorityIcon: Record<string, typeof Warning> = {
  urgent:      Warning,
  high:        ArrowUp,
  medium:      ArrowUpRight,
  low:         ArrowDown,
  no_priority: Minus,
}

// ─── TYPE COLOR BAR ───────────────────────────────────────────────────────────
// OKLCH values for the 3px left-edge type accent bar.
// Vivid, perceptually uniform — designed for dark navy card surfaces.
// Alcon palette: cyan for features, teal for delivery, red for defects,
// violet for architecture, gold for investigations.

const TYPE_BAR_COLORS: Record<string, string> = {
  story:   'oklch(75% 0.140 230)',   // Alcon bright cyan  — features / stories
  task:    'oklch(70% 0.110 245)',   // Alcon sky blue     — standard tasks
  bug:     'oklch(62% 0.205 25)',    // Alcon red          — defects / incidents
  epic:    'oklch(72% 0.185 285)',   // Alcon violet       — epics / architecture
  spike:   'oklch(70% 0.125 75)',    // Alcon gold         — spikes / investigations
  subtask: 'oklch(65% 0.130 165)',   // Alcon teal         — sub-tasks
}

const DEFAULT_BAR_COLOR = 'oklch(60% 0.025 265)'  // desaturated navy — unknown types

// ─── OVERDUE HELPERS ─────────────────────────────────────────────────────────

function isOverdue(item: KanbanItem): boolean {
  if (!item.due_date) return false
  if (item.status === 'done' || item.status === 'cancelled') return false
  return new Date(item.due_date) < new Date()
}

function formatDueDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diff === 0)  return 'Today'
  if (diff === 1)  return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < 0)    return `${Math.abs(diff)}d overdue`
  if (diff <= 7)   return `${diff}d`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

interface KanbanCardProps {
  item:     KanbanItem
  onClick:  (id: string) => void
  isDragOverlay?: boolean
}

export const KanbanCard = memo(function KanbanCard({
  item,
  onClick,
  isDragOverlay = false,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { type: 'card', item },
  })

  const typeCfg     = TYPE_CONFIG[item.type]     ?? TYPE_CONFIG['task']
  const priorityCfg = PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG['no_priority']
  const Icon        = PriorityIcon[item.priority] ?? PriorityIcon['no_priority']
  const overdue     = isOverdue(item)
  const statusCfg   = STATUS_CONFIG[item.status] ?? STATUS_CONFIG['todo']
  const barColor    = TYPE_BAR_COLORS[item.type] ?? DEFAULT_BAR_COLOR

  // ── Dynamic border / shadow based on state ──────────────────────────────────
  const borderColor =
    isDragOverlay ? 'oklch(75% 0.140 230 / 0.60)'  :  // lifted: strong cyan ring
    isDragging    ? 'oklch(75% 0.140 230 / 0.45)'  :  // source: medium cyan ring
    overdue       ? 'oklch(62% 0.205 25  / 0.45)'  :  // overdue: red border
                    'oklch(75% 0.140 230 / 0.14)'      // default: subtle cyan ghost

  const boxShadow =
    isDragOverlay
      ? '0 24px 64px oklch(12% 0.030 265 / 0.60), 0 4px 16px oklch(75% 0.140 230 / 0.15), inset 0 1px 0 oklch(100% 0 0 / 0.10)'
      : '0 1px 3px oklch(12% 0.030 265 / 0.35), inset 0 1px 0 oklch(100% 0 0 / 0.05)'

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={{
        // ── DnD transform (from useSortable) ─────────────────────────────────
        ...(isDragOverlay ? {} : {
          transform: CSS.Transform.toString(transform),
          transition,
        }),
        // ── Dark navy glassmorphism surface ──────────────────────────────────
        // background: deep navy at 95% opacity — solid enough to read on any
        // background, premium enough to feel like the Alcon brand surface.
        background: 'oklch(30% 0.148 265 / 0.95)',
        border: `1px solid ${borderColor}`,
        boxShadow,
        opacity: isDragging ? 0.35 : 1,
      }}
      {...(isDragOverlay ? {} : attributes)}
      {...(isDragOverlay ? {} : listeners)}
      role="button"
      tabIndex={0}
      aria-label={`${item.type}: ${item.title}, ${priorityCfg.label} priority, ${statusCfg.label}`}
      onClick={(e) => {
        if (isDragging) return
        e.stopPropagation()
        onClick(item.id)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(item.id)
        }
      }}
      className={[
        // ── Shape & interaction ───────────────────────────────────────────────
        'group relative rounded-xl',
        'cursor-grab active:cursor-grabbing',
        // ── Hover: strengthen border + glow (pure CSS, no JS) ────────────────
        'hover:shadow-[0_2px_12px_oklch(75%_0.140_230_/_0.12),inset_0_1px_0_oklch(100%_0_0_/_0.08)]',
        // ── CSS entry animation (D-052 @starting-style) ──────────────────────
        // Only on real cards; drag overlay should not entrance-animate.
        !isDragOverlay ? 'kanban-card-enter' : '',
        // ── content-visibility (D-052) ────────────────────────────────────────
        // Skip render for offscreen cards in scrollable column.
        // Must NOT apply to drag overlay — it's always visible.
        !isDragOverlay ? 'cv-auto cis-card' : '',
        // ── Drag overlay: slight tilt for "lifted" feel ───────────────────────
        isDragOverlay ? 'scale-[1.02] rotate-[0.6deg]' : '',
      ].join(' ')}
    >
      {/* ── Type color bar (left edge) ──────────────────────────────────────── */}
      {/* v2: OKLCH type color map — no fragile Tailwind class string-matching  */}
      <div
        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
        style={{ background: barColor }}
      />

      <div className="pl-3.5 pr-3 py-2.5">

        {/* ── Row 1: Priority icon + Title ────────────────────────────────────── */}
        <div className="flex items-start gap-1.5">
          <Icon
            size={14}
            weight="bold"
            className={`${priorityCfg.color} flex-shrink-0 mt-0.5`}
          />
          <h3 className="text-[13px] leading-[1.35] font-medium text-slate-100 line-clamp-2 min-w-0">
            {item.title}
          </h3>
        </div>

        {/* ── Row 2: Metadata chips ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between mt-2">

          {/* Left: type badge + project code + points + due date + labels */}
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">

            {/* Type badge — uses typeCfg.color for text hue, dark navy bg */}
            <span
              className={`
                text-[10px] font-semibold uppercase tracking-wider
                ${typeCfg.color}
                px-1.5 py-0.5 rounded
              `}
              style={{ background: 'oklch(100% 0 0 / 0.07)' }}
            >
              {typeCfg.label}
            </span>

            {/* Project code (cross-project mode) */}
            {item.project_info && (
              <span
                className="text-[10px] font-mono font-medium text-cyan-300 px-1.5 py-0.5 rounded"
                style={{ background: 'oklch(75% 0.140 230 / 0.12)' }}
              >
                {(item.project_info as { code: string }).code}
              </span>
            )}

            {/* Story points */}
            {item.story_points != null && (
              <span
                className="text-[10px] font-mono font-bold text-slate-300 px-1.5 py-0.5 rounded"
                style={{ background: 'oklch(100% 0 0 / 0.07)' }}
              >
                {item.story_points}pt
              </span>
            )}

            {/* Due date */}
            {item.due_date && (
              <span
                className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded ${
                  overdue ? 'text-red-300 font-medium' : 'text-slate-400'
                }`}
                style={{
                  background: overdue
                    ? 'oklch(62% 0.205 25 / 0.18)'
                    : 'oklch(100% 0 0 / 0.07)',
                }}
              >
                <CalendarBlank size={10} weight="bold" />
                {formatDueDate(item.due_date)}
              </span>
            )}

            {/* Labels (max 2 visible) */}
            {(item.labels ?? []).slice(0, 2).map((label) => (
              <span
                key={label}
                className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded truncate max-w-[80px]"
                style={{ background: 'oklch(100% 0 0 / 0.07)' }}
              >
                {label}
              </span>
            ))}
            {(item.labels ?? []).length > 2 && (
              <span className="text-[10px] text-slate-500">
                +{(item.labels ?? []).length - 2}
              </span>
            )}
          </div>

          {/* Right: assignee avatar */}
          <div className="flex-shrink-0 ml-2">
            {item.assignee ? (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-cyan-200"
                style={{
                  background: 'oklch(75% 0.140 230 / 0.18)',
                  boxShadow: '0 0 0 1px oklch(75% 0.140 230 / 0.25)',
                }}
                title={profileDisplayName(item.assignee as any)}
              >
                {profileInitials(item.assignee as any)}
              </div>
            ) : (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{
                  background: 'oklch(100% 0 0 / 0.06)',
                  boxShadow: '0 0 0 1px oklch(100% 0 0 / 0.10)',
                }}
                title="Unassigned"
              >
                <Lightning size={10} weight="bold" className="text-slate-500" />
              </div>
            )}
          </div>
        </div>

        {/* ── Blocked indicator ─────────────────────────────────────────────── */}
        {item.status === 'blocked' && (
          <div
            className="flex items-center gap-1 mt-1.5 text-[10px] text-red-300 font-medium px-1.5 py-0.5 rounded"
            style={{ background: 'oklch(62% 0.205 25 / 0.15)' }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: 'oklch(62% 0.205 25)' }}
            />
            Blocked
          </div>
        )}
      </div>
    </div>
  )
})
