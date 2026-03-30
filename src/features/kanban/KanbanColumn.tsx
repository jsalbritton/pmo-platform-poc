/**
 * KanbanColumn — a single droppable column on the Kanban board.
 *
 * LAYOUT:
 *   ┌─────────────────────────────────┐
 *   │ ● Status Label          12 / 15 │  ← header (dot + label + count/WIP)
 *   │─────────────────────────────────│
 *   │ ┌─────────────────────────────┐ │
 *   │ │  KanbanCard                 │ │  ← draggable cards
 *   │ └─────────────────────────────┘ │
 *   │ ┌─────────────────────────────┐ │
 *   │ │  KanbanCard                 │ │
 *   │ └─────────────────────────────┘ │
 *   │        + Add item               │  ← inline add button
 *   └─────────────────────────────────┘
 *
 * FEATURES:
 *   - useDroppable from @dnd-kit marks this as a drop target
 *   - WIP limit: yellow header when at limit, red when over
 *   - Column count badge
 *   - Collapse/expand toggle (chevron icon)
 *   - Over-drop highlight (blue border glow when card is dragged over)
 *   - Scrollable card area (columns can have many items)
 *   - Empty state with dashed border drop zone
 */

import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  CaretDown,
  CaretRight,
  Plus,
  Gauge,
} from '@phosphor-icons/react'
import { KanbanCard } from './KanbanCard'
import type { KanbanColumnData } from './useKanbanBoard'

// ─── COMPONENT ───────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  column:        KanbanColumnData
  isCollapsed:   boolean
  onToggle:      () => void
  onCardClick:   (id: string) => void
  onSetWipLimit: (limit: number | null) => void
  isOverColumn:  boolean   // true when a dragged card is hovering over this column
}

export function KanbanColumn({
  column,
  isCollapsed,
  onToggle,
  onCardClick,
  onSetWipLimit,
  isOverColumn,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${column.id}`,
    data: { type: 'column', columnId: column.id },
  })

  const isActive = isOver || isOverColumn
  const count    = column.items.length
  const itemIds  = column.items.map((i) => i.id)

  // WIP limit status
  const wipStatus =
    column.wipLimit === null      ? 'none'    :
    count > column.wipLimit       ? 'over'    :
    count === column.wipLimit     ? 'at'      :
                                    'under'

  // ── Collapsed state ─────────────────────────────────────────────────────────
  if (isCollapsed) {
    return (
      <button
        onClick={onToggle}
        className="
          flex-shrink-0 w-10 rounded-xl
          bg-white border border-gray-200
          flex flex-col items-center py-3 gap-2
          hover:bg-gray-50 hover:border-gray-300
          transition-colors cursor-pointer
          group
        "
      >
        <CaretRight size={12} className="text-gray-500 group-hover:text-gray-600" />
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: column.dotColor }}
        />
        <span className="
          text-[10px] font-medium text-gray-500
          [writing-mode:vertical-lr] [text-orientation:mixed]
          group-hover:text-gray-600
        ">
          {column.label}
        </span>
        {count > 0 && (
          <span className="text-[10px] text-gray-400 font-mono mt-1">
            {count}
          </span>
        )}
      </button>
    )
  }

  // ── Expanded state ──────────────────────────────────────────────────────────
  return (
    <div
      className={`
        flex flex-col min-w-[260px] w-[260px] max-w-[320px]
        rounded-xl bg-white
        border transition-colors duration-150
        ${isActive
          ? 'border-blue-400/40 bg-blue-50/50'
          : wipStatus === 'over'
          ? 'border-red-300'
          : wipStatus === 'at'
          ? 'border-amber-300'
          : 'border-gray-200'
        }
      `}
    >
      {/* ── Column Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 flex-shrink-0">
        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className="text-gray-400 hover:text-gray-600 transition-colors p-0.5 -ml-0.5"
          aria-label={`Collapse ${column.label} column`}
        >
          <CaretDown size={12} weight="bold" />
        </button>

        {/* Status dot */}
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: column.dotColor }}
        />

        {/* Label */}
        <span className={`text-xs font-semibold ${column.color} flex-1 truncate`}>
          {column.label}
        </span>

        {/* Count + WIP */}
        <div className="flex items-center gap-1.5">
          {/* WIP limit indicator */}
          {column.wipLimit !== null && (
            <button
              onClick={() => {
                // Toggle WIP: click to remove limit
                onSetWipLimit(null)
              }}
              className={`
                flex items-center gap-0.5 text-[10px] font-mono px-1 py-0.5 rounded
                transition-colors cursor-pointer
                ${wipStatus === 'over'
                  ? 'text-red-600 bg-red-50'
                  : wipStatus === 'at'
                  ? 'text-amber-600 bg-amber-50'
                  : 'text-gray-500 bg-gray-100'
                }
              `}
              title="Click to remove WIP limit"
            >
              <Gauge size={10} weight="bold" />
              {column.wipLimit}
            </button>
          )}

          {/* Item count */}
          <span className={`
            text-[11px] font-mono font-medium
            px-1.5 py-0.5 rounded
            ${wipStatus === 'over'
              ? 'text-red-600 bg-red-50'
              : 'text-gray-500 bg-gray-100'
            }
          `}>
            {count}
          </span>
        </div>
      </div>

      {/* ── Card Area (scrollable) ─────────────────────────────────────────── */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5 min-h-[120px]"
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {column.items.map((item) => (
            <KanbanCard
              key={item.id}
              item={item}
              onClick={onCardClick}
            />
          ))}
        </SortableContext>

        {/* Empty state */}
        {count === 0 && (
          <div className={`
            flex items-center justify-center
            h-20 rounded-lg border border-dashed
            transition-colors
            ${isActive
              ? 'border-blue-400/40 bg-blue-50/50'
              : 'border-gray-200'
            }
          `}>
            <span className="text-[11px] text-gray-400">
              {isActive ? 'Drop here' : 'No items'}
            </span>
          </div>
        )}
      </div>

      {/* ── Add Item Button ────────────────────────────────────────────────── */}
      <button className="
        flex items-center gap-1.5 px-3 py-2
        text-[11px] text-gray-400
        hover:text-gray-600 hover:bg-gray-50
        border-t border-gray-100
        transition-colors rounded-b-xl
      ">
        <Plus size={12} weight="bold" />
        Add item
      </button>
    </div>
  )
}

// ─── COLLAPSED STRIP ─────────────────────────────────────────────────────────
// Renders a compact row of collapsed columns (used at bottom of board)

interface CollapsedStripProps {
  columns:     KanbanColumnData[]
  onExpand:    (id: string) => void
}

export function CollapsedStrip({ columns, onExpand }: CollapsedStripProps) {
  if (columns.length === 0) return null

  return (
    <div className="flex items-center gap-2 px-2 py-2 border-t border-gray-100 bg-gray-50/50">
      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mr-1">
        Hidden
      </span>
      {columns.map((col) => (
        <button
          key={col.id}
          onClick={() => onExpand(col.id)}
          className="
            flex items-center gap-1.5 px-2.5 py-1 rounded-lg
            bg-gray-50 border border-gray-200
            hover:bg-gray-100 hover:border-gray-300
            transition-colors text-[11px]
          "
        >
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: col.dotColor }}
          />
          <span className={`${col.color} font-medium`}>{col.label}</span>
          {col.items.length > 0 && (
            <span className="text-gray-400 font-mono">{col.items.length}</span>
          )}
        </button>
      ))}
    </div>
  )
}
