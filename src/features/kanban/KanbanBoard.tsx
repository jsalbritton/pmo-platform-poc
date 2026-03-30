/**
 * KanbanBoard — DnD context provider + horizontal column layout.
 *
 * This is the core rendering engine for the Kanban board. It:
 *   1. Wraps everything in DndContext from @dnd-kit
 *   2. Handles onDragStart / onDragEnd events
 *   3. Renders columns in a horizontal scrollable row
 *   4. Shows a DragOverlay with the active card (lifted out of the DOM flow)
 *   5. Detects which column the card is over for visual highlighting
 *
 * DRAG-AND-DROP ARCHITECTURE:
 *   @dnd-kit uses "sensors" to detect drag intent. We use PointerSensor
 *   with a 5px distance threshold — this prevents accidental drags when
 *   the user just wants to click a card.
 *
 *   On drag end:
 *   - If the card lands in a different column → fire moveItem mutation
 *     (this changes status/priority/assignee/type based on groupBy)
 *   - If the card lands in the same column at a different position →
 *     fire moveItem with new board_position
 *   - If the card lands back where it started → no-op
 *
 * OVERLAY:
 *   The DragOverlay renders a clone of the card being dragged. This
 *   "lifts" the card out of the column flow so it follows the cursor
 *   smoothly. The original card gets opacity: 0.35 via isDragging prop.
 */

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { KanbanColumn, CollapsedStrip } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'
import type { KanbanItem, KanbanColumnData } from './useKanbanBoard'

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface KanbanBoardProps {
  visibleColumns:    KanbanColumnData[]
  hiddenColumns:     KanbanColumnData[]
  collapsedColumns:  Set<string>
  onToggleCollapse:  (id: string) => void
  onCardClick:       (id: string) => void
  onMoveItem:        (args: { itemId: string; newColumnId: string; newPosition: number }) => void
  onSetWipLimit:     (columnId: string, limit: number | null) => void
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Find which column contains a given item ID */
function findColumnForItem(
  columns: KanbanColumnData[],
  itemId: string,
): KanbanColumnData | undefined {
  return columns.find((col) => col.items.some((i) => i.id === itemId))
}

/** Extract column ID from a droppable ID like "column:in_progress" */
function parseDroppableColumnId(droppableId: string | undefined): string | null {
  if (!droppableId) return null
  if (typeof droppableId === 'string' && droppableId.startsWith('column:')) {
    return droppableId.slice(7)
  }
  return null
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export function KanbanBoard({
  visibleColumns,
  hiddenColumns,
  collapsedColumns,
  onToggleCollapse,
  onCardClick,
  onMoveItem,
  onSetWipLimit,
}: KanbanBoardProps) {
  const [activeItem, setActiveItem] = useState<KanbanItem | null>(null)
  const [overColumnId, setOverColumnId] = useState<string | null>(null)

  // ── Sensors ─────────────────────────────────────────────────────────────────
  // PointerSensor with 5px distance: prevents click-vs-drag ambiguity
  // KeyboardSensor: allows arrow keys for accessibility
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // ── Drag handlers ───────────────────────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current
    if (data?.type === 'card') {
      setActiveItem(data.item as KanbanItem)
    }
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event
    if (!over) {
      setOverColumnId(null)
      return
    }

    // Check if hovering over a column directly
    const colId = parseDroppableColumnId(over.id as string)
    if (colId) {
      setOverColumnId(colId)
      return
    }

    // If hovering over another card, find its column
    const allColumns = [...visibleColumns, ...hiddenColumns]
    const overCol = findColumnForItem(allColumns, over.id as string)
    setOverColumnId(overCol?.id ?? null)
  }, [visibleColumns, hiddenColumns])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveItem(null)
    setOverColumnId(null)

    if (!over) return

    const itemId = active.id as string
    const allColumns = [...visibleColumns, ...hiddenColumns]

    // Determine source column
    const sourceCol = findColumnForItem(allColumns, itemId)
    if (!sourceCol) return

    // Determine target column
    let targetColId = parseDroppableColumnId(over.id as string)
    if (!targetColId) {
      // Dropped on a card — find that card's column
      const targetCol = findColumnForItem(allColumns, over.id as string)
      targetColId = targetCol?.id ?? null
    }

    if (!targetColId) return

    // Calculate new position
    const targetCol = allColumns.find((c) => c.id === targetColId)
    if (!targetCol) return

    // If dropped on a specific card, insert near that card's position
    const overItemIndex = targetCol.items.findIndex((i) => i.id === (over.id as string))
    let newPosition: number

    if (overItemIndex >= 0) {
      // Insert at the position of the card we're hovering over
      newPosition = overItemIndex
    } else {
      // Dropped on the column itself (empty area) — append to end
      newPosition = targetCol.items.length
    }

    // Only fire mutation if something actually changed
    const sourceIndex = sourceCol.items.findIndex((i) => i.id === itemId)
    if (sourceCol.id === targetColId && sourceIndex === newPosition) return

    onMoveItem({
      itemId,
      newColumnId: targetColId,
      newPosition,
    })
  }, [visibleColumns, hiddenColumns, onMoveItem])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col flex-1 min-h-0">
        {/* ── Columns ──────────────────────────────────────────────────────── */}
        <div className="flex-1 flex gap-2 overflow-x-auto px-4 pb-4 pt-1 items-start">
          {visibleColumns.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              isCollapsed={collapsedColumns.has(col.id)}
              onToggle={() => onToggleCollapse(col.id)}
              onCardClick={onCardClick}
              onSetWipLimit={(limit) => onSetWipLimit(col.id, limit)}
              isOverColumn={overColumnId === col.id}
            />
          ))}
        </div>

        {/* ── Collapsed columns strip ──────────────────────────────────────── */}
        <CollapsedStrip
          columns={hiddenColumns}
          onExpand={(id) => onToggleCollapse(id)}
        />
      </div>

      {/* ── Drag Overlay ───────────────────────────────────────────────────── */}
      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <div className="w-[248px]">
            <KanbanCard
              item={activeItem}
              onClick={() => {}}
              isDragOverlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
