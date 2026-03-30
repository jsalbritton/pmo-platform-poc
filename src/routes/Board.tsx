/**
 * Board — Sprint Kanban board (Sprint 1B, S1B-002).
 *
 * ROUTE: /board/:id  (project ID in URL path)
 * URL PARAMS: ?item=<uuid>  (opens WorkItemDetail panel)
 *
 * ARCHITECTURE:
 *   Board.tsx is the route-level orchestrator. It:
 *     1. Reads projectId from URL params
 *     2. Initialises useKanbanBoard (data, grouping, filtering, DnD mutations)
 *     3. Renders BoardHeader (sprint selector, group-by, filters)
 *     4. Renders KanbanBoard (DnD columns + cards)
 *     5. Renders WorkItemDetail slide-over (click card → panel opens)
 *
 * KEYBOARD SHORTCUTS (board-level):
 *   N         → focus new-item input in the first visible column
 *   /         → toggle search bar
 *   1-7       → switch to column N (when status grouping)
 *   G then S  → group by status
 *   G then A  → group by assignee
 *   G then P  → group by priority
 *   G then T  → group by type
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { WorkItemDetail } from '@/features/work-items'
import { useKanbanBoard, KanbanBoard, BoardHeader } from '@/features/kanban'

// ─── LOADING SKELETON ────────────────────────────────────────────────────────

function BoardSkeleton() {
  return (
    <div className="flex-1 flex gap-2 px-4 pt-4 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="
            w-[260px] flex-shrink-0 rounded-xl
            bg-[#0d1117] border border-white/8
          "
        >
          {/* Header skeleton */}
          <div className="flex items-center gap-2 px-3 py-3 border-b border-white/5">
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="h-3 bg-white/5 rounded w-16" />
            <div className="flex-1" />
            <div className="h-3 bg-white/5 rounded w-6" />
          </div>
          {/* Card skeletons */}
          <div className="px-2 py-2 space-y-1.5">
            {Array.from({ length: 2 + (i % 3) }).map((_, j) => (
              <div
                key={j}
                className="
                  rounded-lg bg-[#161b22] border border-white/5
                  px-3 py-2.5 space-y-2
                "
              >
                <div className="h-3 bg-white/5 rounded w-4/5" />
                <div className="flex gap-1.5">
                  <div className="h-2.5 bg-white/5 rounded w-10" />
                  <div className="h-2.5 bg-white/5 rounded w-8" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── ERROR STATE ─────────────────────────────────────────────────────────────

function BoardError() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-2 px-6">
        <p className="text-sm text-red-400 font-medium">
          Failed to load board data
        </p>
        <p className="text-xs text-slate-600">
          Check your connection and try refreshing the page.
        </p>
      </div>
    </div>
  )
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────

function BoardEmpty({ hasSprint }: { hasSprint: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-3 px-6">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-white/3 border border-white/8 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="5" height="18" rx="1" stroke="#475569" strokeWidth="1.5"/>
            <rect x="10" y="3" width="5" height="12" rx="1" stroke="#475569" strokeWidth="1.5"/>
            <rect x="17" y="3" width="5" height="8" rx="1" stroke="#475569" strokeWidth="1.5"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-400">
            {hasSprint ? 'No items in this sprint' : 'No work items yet'}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            {hasSprint
              ? 'Try selecting a different sprint or viewing all sprints.'
              : 'Create your first work item to get started.'
            }
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function Board() {
  const { id: projectId }           = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { session }                 = useAuth()

  // Work item detail panel — open via ?item=<uuid>
  const itemParam                   = searchParams.get('item')
  const [openItemId, setOpenItemId] = useState<string | null>(itemParam ?? null)

  // URL sync
  const openItem = useCallback((id: string) => {
    setOpenItemId(id)
    setSearchParams({ item: id }, { replace: true })
  }, [setSearchParams])

  const closeItem = useCallback(() => {
    setOpenItemId(null)
    setSearchParams({}, { replace: true })
  }, [setSearchParams])

  useEffect(() => {
    setOpenItemId(itemParam ?? null)
  }, [itemParam])

  const currentUserId = session?.user.id ?? ''

  // ── Kanban data layer ────────────────────────────────────────────────────────
  const board = useKanbanBoard(projectId)

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    if (openItemId) return // detail panel handles its own shortcuts

    let gPressed = false
    let gTimer: ReturnType<typeof setTimeout>

    function onKeyDown(e: KeyboardEvent) {
      const active = document.activeElement
      const isInput = active?.tagName === 'INPUT' ||
                      active?.tagName === 'TEXTAREA' ||
                      (active as HTMLElement)?.isContentEditable

      if (isInput) return

      // G + key combos for group-by
      if (gPressed) {
        gPressed = false
        clearTimeout(gTimer)
        if (e.key === 's' || e.key === 'S') { e.preventDefault(); board.setGroupBy('status')   }
        if (e.key === 'a' || e.key === 'A') { e.preventDefault(); board.setGroupBy('assignee')  }
        if (e.key === 'p' || e.key === 'P') { e.preventDefault(); board.setGroupBy('priority')  }
        if (e.key === 't' || e.key === 'T') { e.preventDefault(); board.setGroupBy('type')      }
        return
      }

      if (e.key === 'g' || e.key === 'G') {
        gPressed = true
        gTimer = setTimeout(() => { gPressed = false }, 800)
        return
      }

      // / → toggle search
      if (e.key === '/') {
        e.preventDefault()
        board.setFilters({ ...board.filters, search: board.filters.search ? '' : ' ' })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      clearTimeout(gTimer)
    }
  }, [openItemId, board])

  return (
    <div className="h-screen flex flex-col bg-background relative">
      {/* ── Board Header ───────────────────────────────────────────────────── */}
      <BoardHeader
        sprints={board.sprints}
        selectedSprintId={board.selectedSprintId}
        onSprintChange={board.setSelectedSprintId}
        groupBy={board.groupBy}
        onGroupChange={board.setGroupBy}
        filters={board.filters}
        onFiltersChange={board.setFilters}
        onClearFilters={board.clearFilters}
        hasActiveFilter={board.hasActiveFilter}
        totalItems={board.totalItems}
        filteredCount={board.filteredCount}
        teamMembers={board.teamMembers}
        allLabels={board.allLabels}
      />

      {/* ── Board Body ─────────────────────────────────────────────────────── */}
      {board.isLoading && <BoardSkeleton />}

      {board.isError && <BoardError />}

      {!board.isLoading && !board.isError && board.totalItems === 0 && (
        <BoardEmpty hasSprint={Boolean(board.selectedSprintId)} />
      )}

      {!board.isLoading && !board.isError && board.totalItems > 0 && (
        <KanbanBoard
          visibleColumns={board.visibleColumns}
          hiddenColumns={board.hiddenColumns}
          collapsedColumns={board.collapsedColumns}
          onToggleCollapse={board.toggleCollapse}
          onCardClick={openItem}
          onMoveItem={board.moveItem}
          onSetWipLimit={board.setWipLimit}
        />
      )}

      {/* ── Work Item Detail slide-over ─────────────────────────────────────── */}
      <WorkItemDetail
        workItemId={openItemId}
        currentUserId={currentUserId}
        teamMembers={board.teamMembers}
        onClose={closeItem}
      />
    </div>
  )
}
