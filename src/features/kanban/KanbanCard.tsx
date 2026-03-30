/**
 * KanbanCard — compact draggable work item card for the sprint board.
 *
 * DESIGN PHILOSOPHY (Linear-inspired, PMO-adapted):
 *   - Dense but readable — every visible field earns its pixel
 *   - Type badge (left edge color bar) for instant visual scanning
 *   - Priority icon + story points on same line as title (no wasted rows)
 *   - Assignee avatar bottom-right, labels bottom-left
 *   - Overdue items get a red accent
 *   - Hover: subtle lift + border glow (spring physics)
 *   - Click: opens WorkItemDetail panel (not part of drag)
 *   - Drag: opacity drop + shadow, card "lifts" from board
 *
 * ACCESSIBILITY:
 *   - role="button" + tabIndex + keyboard Enter/Space to open
 *   - aria-label describes the card for screen readers
 *   - Drag handle is the entire card (consistent with Linear/Jira)
 *
 * PERFORMANCE:
 *   - No internal state — pure props-driven render
 *   - React.memo for skip re-renders when sibling cards move
 *   - useSortable provides transform + transition for smooth DnD
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

// ─── OVERDUE CHECK ───────────────────────────────────────────────────────────

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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }

  const typeCfg     = TYPE_CONFIG[item.type]
  const priorityCfg = PRIORITY_CONFIG[item.priority]
  const Icon        = PriorityIcon[item.priority]
  const overdue     = isOverdue(item)
  const statusCfg   = STATUS_CONFIG[item.status]

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={isDragOverlay ? undefined : style}
      {...(isDragOverlay ? {} : attributes)}
      {...(isDragOverlay ? {} : listeners)}
      role="button"
      tabIndex={0}
      aria-label={`${item.type}: ${item.title}, ${priorityCfg.label} priority, ${statusCfg.label}`}
      onClick={(e) => {
        // Don't open detail if user is dragging
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
      className={`
        group relative rounded-lg border
        bg-[#161b22] hover:bg-[#1c2129]
        transition-all duration-150
        cursor-grab active:cursor-grabbing
        ${overdue
          ? 'border-red-500/30 hover:border-red-500/50'
          : 'border-white/8 hover:border-white/15'
        }
        ${isDragOverlay
          ? 'shadow-2xl shadow-black/40 ring-1 ring-blue-500/30 scale-[1.02]'
          : 'hover:shadow-lg hover:shadow-black/20'
        }
        ${isDragging ? 'ring-1 ring-blue-500/20' : ''}
      `}
    >
      {/* ── Type color bar (left edge) ──────────────────────────────────────── */}
      <div
        className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full ${typeCfg.bg}`}
        style={{ backgroundColor: typeCfg.color.replace('text-', '').includes('violet')
          ? '#bc8cff'
          : typeCfg.color.includes('blue')
          ? '#58a6ff'
          : typeCfg.color.includes('red')
          ? '#f85149'
          : typeCfg.color.includes('amber')
          ? '#d29922'
          : '#8b949e'
        }}
      />

      <div className="pl-3.5 pr-3 py-2.5">
        {/* ── Row 1: Priority + Title ────────────────────────────────────────── */}
        <div className="flex items-start gap-1.5">
          <Icon
            size={14}
            weight="bold"
            className={`${priorityCfg.color} flex-shrink-0 mt-0.5`}
          />
          <h3 className="text-[13px] leading-[1.35] font-medium text-slate-200 line-clamp-2 min-w-0">
            {item.title}
          </h3>
        </div>

        {/* ── Row 2: Metadata chips ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between mt-2">
          {/* Left: type + labels + due date */}
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            {/* Type badge */}
            <span className={`
              text-[10px] font-semibold uppercase tracking-wider
              ${typeCfg.color} ${typeCfg.bg}
              px-1.5 py-0.5 rounded
            `}>
              {typeCfg.label}
            </span>

            {/* Project code (visible in cross-project mode) */}
            {item.project_info && (
              <span className="
                text-[10px] font-mono font-medium text-cyan-400/70
                bg-cyan-500/8 px-1.5 py-0.5 rounded
              ">
                {(item.project_info as { code: string }).code}
              </span>
            )}

            {/* Story points */}
            {item.story_points != null && (
              <span className="
                text-[10px] font-mono font-bold text-slate-400
                bg-white/5 px-1.5 py-0.5 rounded
              ">
                {item.story_points}pt
              </span>
            )}

            {/* Due date */}
            {item.due_date && (
              <span className={`
                flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded
                ${overdue
                  ? 'text-red-400 bg-red-500/10 font-medium'
                  : 'text-slate-500 bg-white/3'
                }
              `}>
                <CalendarBlank size={10} weight="bold" />
                {formatDueDate(item.due_date)}
              </span>
            )}

            {/* Labels (max 2 visible) */}
            {(item.labels ?? []).slice(0, 2).map((label) => (
              <span
                key={label}
                className="text-[10px] text-slate-500 bg-white/4 px-1.5 py-0.5 rounded truncate max-w-[80px]"
              >
                {label}
              </span>
            ))}
            {(item.labels ?? []).length > 2 && (
              <span className="text-[10px] text-slate-600">
                +{(item.labels ?? []).length - 2}
              </span>
            )}
          </div>

          {/* Right: assignee avatar */}
          <div className="flex-shrink-0 ml-2">
            {item.assignee ? (
              <div
                className="
                  w-5 h-5 rounded-full bg-blue-500/20
                  flex items-center justify-center
                  text-[8px] font-bold text-blue-400
                  ring-1 ring-white/10
                "
                title={profileDisplayName(item.assignee as any)}
              >
                {profileInitials(item.assignee as any)}
              </div>
            ) : (
              <div
                className="
                  w-5 h-5 rounded-full bg-white/5
                  flex items-center justify-center
                  ring-1 ring-white/5
                "
                title="Unassigned"
              >
                <Lightning size={10} weight="bold" className="text-slate-700" />
              </div>
            )}
          </div>
        </div>

        {/* ── Blocked indicator ─────────────────────────────────────────────── */}
        {item.status === 'blocked' && (
          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-red-400 font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Blocked
          </div>
        )}
      </div>
    </div>
  )
})
