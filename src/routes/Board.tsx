/**
 * Board — Sprint Board (S1B-002).
 *
 * ROUTE:
 *   /board/all       → cross-project view (default from sidebar)
 *   /board/:id       → single-project view (from project page)
 *
 * The board is sprint-centric: it defaults to showing ALL work items in
 * active sprints across every project. Project is a filter, not the entry point.
 *
 * KEYBOARD SHORTCUTS (board-level):
 *   /         → toggle board search (NOT Command Palette)
 *   G then S  → group by status
 *   G then A  → group by assignee
 *   G then P  → group by priority
 *   G then T  → group by type
 *   G then J  → group by project
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { WorkItemDetail } from '@/features/work-items'
import { useKanbanBoard, KanbanBoard, BoardHeader } from '@/features/kanban'

// ─── UUID VALIDATION ────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUUID(s: string | undefined): s is string {
  return !!s && UUID_RE.test(s)
}

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
          <div className="flex items-center gap-2 px-3 py-3 border-b border-white/5">
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="h-3 bg-white/5 rounded w-16" />
            <div className="flex-1" />
            <div className="h-3 bg-white/5 rounded w-6" />
          </div>
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

function BoardEmpty({ isCrossProject }: { isCrossProject: boolean }) {
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
            {isCrossProject
              ? 'No items in active sprints'
              : 'No work items in this scope'
            }
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            {isCrossProject
              ? 'Try switching to "All Sprints" or check that projects have active sprints.'
              : 'Try selecting a different sprint scope or viewing all sprints.'
            }
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function Board() {
  const { id: rawId }               = useParams<{ id: string }>()
  const projectId                   = isValidUUID(rawId) ? rawId : undefined
  const [searchParams, setSearchParams] = useSearchParams()
  const { session }                 = useAuth()

  // Work item detail panel — open via ?item=<uuid>
  const itemParam                   = searchParams.get('item')
  const [openItemId, setOpenItemId] = useState<string | null>(itemParam ?? null)

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

  // ── Kanban data layer (cross-project when no valid UUID) ───────────────────
  const board = useKanbanBoard(projectId)

  // ── Board-level search state (separate from Command Palette) ───────────────
  const [showBoardSearch, setShowBoardSearch] = useState(false)

  const toggleBoardSearch = useCallback(() => {
    setShowBoardSearch(v => {
      if (v) {
        // Closing search — clear the search filter
        board.setFilters({ ...board.filters, search: '' })
      }
      return !v
    })
  }, [board])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    if (openItemId) return

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
        if (e.key === 'j' || e.key === 'J') { e.preventDefault(); board.setGroupBy('project')   }
        return
      }

      if (e.key === 'g' || e.key === 'G') {
        gPressed = true
        gTimer = setTimeout(() => { gPressed = false }, 800)
        return
      }

      // / → toggle BOARD search (not Command Palette)
      if (e.key === '/') {
        e.preventDefault()
        e.stopPropagation()
        toggleBoardSearch()
      }
    }

    window.addEventListener('keydown', onKeyDown, true) // capture phase to beat Command Palette
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      clearTimeout(gTimer)
    }
  }, [openItemId, board, toggleBoardSearch])

  return (
    <div className="h-screen flex flex-col bg-background relative">
      {/* ── Board Header ───────────────────────────────────────────────────── */}
      <BoardHeader
        // Sprint scope
        sprintScope={board.sprintScope}
        onSprintScopeChange={board.setSprintScope}
        isCrossProject={board.isCrossProject}

        // Group
        groupBy={board.groupBy}
        onGroupChange={board.setGroupBy}

        // Filters
        filters={board.filters}
        onFiltersChange={board.setFilters}
        onClearFilters={board.clearFilters}
        hasActiveFilter={board.hasActiveFilter}

        // Stats
        totalItems={board.totalItems}
        filteredCount={board.filteredCount}

        // Data for filter dropdowns
        teamMembers={board.teamMembers}
        allLabels={board.allLabels}
        availableProjects={board.availableProjects}

        // Board-level search
        showSearch={showBoardSearch}
        onToggleSearch={toggleBoardSearch}
      />

      {/* ── Board Body ─────────────────────────────────────────────────────── */}
      {board.isLoading && <BoardSkeleton />}

      {board.isError && <BoardError />}

      {!board.isLoading && !board.isError && board.totalItems === 0 && (
        <BoardEmpty isCrossProject={board.isCrossProject} />
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
