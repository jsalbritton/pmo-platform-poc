/**
 * KanbanColumn — a single droppable column on the Kanban board.
 *
 * DESIGN (D-052: Alcon dark navy system):
 *   ┌─────────────────────────────────┐
 *   │ ● Status Label          12 / 15 │  ← dark glass header
 *   │─────────────────────────────────│
 *   │ ┌─────────────────────────────┐ │
 *   │ │  KanbanCard (dark glass)    │ │  ← draggable cards
 *   │ └─────────────────────────────┘ │
 *   │        + Add item               │  ← ghost add button
 *   └─────────────────────────────────┘
 *
 * Column surface: deep navy glass (slightly darker than cards so cards
 * float above the column tray). Border: subtle cyan ghost.
 *
 * Drop highlight: cyan border strengthens when a card is dragged over.
 * WIP over limit: red accent on header count and column border.
 * WIP at limit: amber accent.
 *
 * FEATURES:
 *   - useDroppable from @dnd-kit marks this as a drop target
 *   - WIP limit: amber header at limit, red when over
 *   - Collapse/expand toggle (chevron)
 *   - Empty state: dashed ghost drop zone
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
  isOverColumn:  boolean
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

  const wipStatus =
    column.wipLimit === null  ? 'none'  :
    count > column.wipLimit   ? 'over'  :
    count === column.wipLimit ? 'at'    :
                                'under'

  // ── Dynamic column border / shadow ─────────────────────────────────────────
  const columnBorder =
    isActive       ? '1px solid oklch(75% 0.140 230 / 0.40)' :  // drag-over: cyan
    wipStatus === 'over' ? '1px solid oklch(62% 0.205 25  / 0.35)' :  // WIP over: red
    wipStatus === 'at'   ? '1px solid oklch(70% 0.125 75  / 0.35)' :  // WIP at: amber
                           '1px solid oklch(75% 0.140 230 / 0.10)'    // default: ghost cyan

  const columnShadow =
    isActive
      ? '0 0 0 1px oklch(75% 0.140 230 / 0.15), 0 8px 32px oklch(75% 0.140 230 / 0.06)'
      : '0 2px 8px oklch(12% 0.030 265 / 0.25)'

  // ── Collapsed state ─────────────────────────────────────────────────────────
  if (isCollapsed) {
    return (
      <button
        onClick={onToggle}
        style={{
          background: 'oklch(26% 0.142 265 / 0.90)',
          border: '1px solid oklch(75% 0.140 230 / 0.10)',
        }}
        className="
          flex-shrink-0 w-10 rounded-xl
          flex flex-col items-center py-3 gap-2
          hover:border-[oklch(75%_0.140_230_/_0.25)]
          transition-colors cursor-pointer group
        "
      >
        <CaretRight size={12} className="text-slate-400 group-hover:text-slate-300" />
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: column.dotColor }}
        />
        <span
          className="
            text-[10px] font-medium text-slate-400
            [writing-mode:vertical-lr] [text-orientation:mixed]
            group-hover:text-slate-300
          "
        >
          {column.label}
        </span>
        {count > 0 && (
          <span className="text-[10px] text-slate-500 font-mono mt-1">
            {count}
          </span>
        )}
      </button>
    )
  }

  // ── Expanded state ──────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col min-w-[260px] w-[260px] max-w-[320px] rounded-xl transition-all duration-150"
      style={{
        background: 'oklch(26% 0.142 265 / 0.90)',
        border: columnBorder,
        boxShadow: columnShadow,
      }}
    >
      {/* ── Column Header ──────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
        style={{ borderBottom: '1px solid oklch(75% 0.140 230 / 0.07)' }}
      >
        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className="text-slate-500 hover:text-slate-300 transition-colors p-0.5 -ml-0.5"
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
          {/* WIP limit badge */}
          {column.wipLimit !== null && (
            <button
              onClick={() => onSetWipLimit(null)}
              className={`
                flex items-center gap-0.5 text-[10px] font-mono px-1 py-0.5 rounded
                transition-colors cursor-pointer
                ${wipStatus === 'over'  ? 'text-red-300'   :
                  wipStatus === 'at'    ? 'text-amber-300' :
                                         'text-slate-400'  }
              `}
              style={{
                background:
                  wipStatus === 'over' ? 'oklch(62% 0.205 25  / 0.15)' :
                  wipStatus === 'at'   ? 'oklch(70% 0.125 75  / 0.15)' :
                                        'oklch(100% 0 0 / 0.06)',
              }}
              title="Click to remove WIP limit"
            >
              <Gauge size={10} weight="bold" />
              {column.wipLimit}
            </button>
          )}

          {/* Item count */}
          <span
            className={`
              text-[11px] font-mono font-medium px-1.5 py-0.5 rounded
              ${wipStatus === 'over' ? 'text-red-300' : 'text-slate-300'}
            `}
            style={{
              background:
                wipStatus === 'over'
                  ? 'oklch(62% 0.205 25 / 0.15)'
                  : 'oklch(100% 0 0 / 0.08)',
            }}
          >
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
          <div
            className="flex items-center justify-center h-20 rounded-lg transition-colors"
            style={{
              border: `1px dashed ${
                isActive
                  ? 'oklch(75% 0.140 230 / 0.35)'
                  : 'oklch(75% 0.140 230 / 0.10)'
              }`,
              background: isActive ? 'oklch(75% 0.140 230 / 0.04)' : 'transparent',
            }}
          >
            <span className={`text-[11px] ${isActive ? 'text-cyan-400' : 'text-slate-600'}`}>
              {isActive ? 'Drop here' : 'No items'}
            </span>
          </div>
        )}
      </div>

      {/* ── Add Item Button ────────────────────────────────────────────────── */}
      <button
        className="flex items-center gap-1.5 px-3 py-2 text-[11px] text-slate-500 hover:text-slate-300 transition-colors rounded-b-xl"
        style={{ borderTop: '1px solid oklch(75% 0.140 230 / 0.06)' }}
      >
        <Plus size={12} weight="bold" />
        Add item
      </button>
    </div>
  )
}

// ─── COLLAPSED STRIP ─────────────────────────────────────────────────────────

interface CollapsedStripProps {
  columns:  KanbanColumnData[]
  onExpand: (id: string) => void
}

export function CollapsedStrip({ columns, onExpand }: CollapsedStripProps) {
  if (columns.length === 0) return null

  return (
    <div
      className="flex items-center gap-2 px-2 py-2"
      style={{ borderTop: '1px solid oklch(75% 0.140 230 / 0.08)' }}
    >
      <span className="text-[10px] text-slate-600 uppercase tracking-wider font-medium mr-1">
        Hidden
      </span>
      {columns.map((col) => (
        <button
          key={col.id}
          onClick={() => onExpand(col.id)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors text-[11px]"
          style={{
            background: 'oklch(26% 0.142 265 / 0.80)',
            border: '1px solid oklch(75% 0.140 230 / 0.10)',
          }}
        >
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: col.dotColor }}
          />
          <span className={`${col.color} font-medium`}>{col.label}</span>
          {col.items.length > 0 && (
            <span className="text-slate-500 font-mono">{col.items.length}</span>
          )}
        </button>
      ))}
    </div>
  )
}
