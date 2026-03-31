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

import { useState, useEffect, useCallback, useRef, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { WorkItemDetail } from '@/features/work-items'
import { useKanbanBoard, KanbanBoard, BoardHeader } from '@/features/kanban'
import type { KanbanFilters } from '@/features/kanban'

// ─── UUID VALIDATION ────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUUID(s: string | undefined): s is string {
  return !!s && UUID_RE.test(s)
}

// ─── CROSS-PROJECT ITEM LIMIT ────────────────────────────────────────────────
// @dnd-kit registers a DragSensor for every useSortable card. At 1000+ items
// this saturates the event-listener budget and hangs the browser. Cap cross-
// project renders at 300 items; beyond that ask the user to filter first.
const CROSS_PROJECT_ITEM_LIMIT = 300

// ─── ERROR BOUNDARY ──────────────────────────────────────────────────────────

interface ErrorBoundaryState { error: Error | null }

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Board] Render error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 px-6 max-w-md">
            <div className="w-10 h-10 mx-auto rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 7v4M10 13h.01M3 17h14L10 3 3 17z" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-red-600">Board render error</p>
            <p className="text-xs text-gray-500 font-mono bg-gray-50 rounded-lg px-3 py-2 text-left break-all">
              {this.state.error.message}
            </p>
            <button
              className="text-xs text-blue-600 hover:text-blue-500 underline cursor-pointer"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── TOO-MANY-ITEMS OVERLAY ──────────────────────────────────────────────────

interface TooManyItemsProps {
  totalItems:  number
  projects:    { id: string; name: string }[]
  onFilter:    (projectIds: string[]) => void
}

function TooManyItems({ totalItems, projects, onFilter }: TooManyItemsProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4 px-6 max-w-sm">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="2" y="2" width="5" height="18" rx="1.5" stroke="#f59e0b" strokeWidth="1.5"/>
            <rect x="9" y="5" width="5" height="15" rx="1.5" stroke="#f59e0b" strokeWidth="1.5"/>
            <rect x="16" y="8" width="5" height="12" rx="1.5" stroke="#f59e0b" strokeWidth="1.5"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">
            {totalItems.toLocaleString()} items across all sprints
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Rendering the full cross-project board would freeze your browser. Filter to one or more projects to load the board.
          </p>
        </div>
        <div className="flex flex-col gap-1.5 mt-2 max-h-48 overflow-y-auto">
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => onFilter([p.id])}
              className="
                text-xs text-left px-3 py-2 rounded-lg
                bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300
                text-gray-700 hover:text-gray-900
                transition-colors cursor-pointer
              "
            >
              {p.name}
            </button>
          ))}
        </div>
        {projects.length > 1 && (
          <button
            onClick={() => onFilter(projects.map(p => p.id))}
            className="text-xs text-blue-600 hover:text-blue-500 underline cursor-pointer"
          >
            Show all {projects.length} projects together
          </button>
        )}
      </div>
    </div>
  )
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
            bg-white border border-gray-200
          "
        >
          <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-100">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
            <div className="h-3 bg-gray-100 rounded w-16" />
            <div className="flex-1" />
            <div className="h-3 bg-gray-100 rounded w-6" />
          </div>
          <div className="px-2 py-2 space-y-1.5">
            {Array.from({ length: 2 + (i % 3) }).map((_, j) => (
              <div
                key={j}
                className="
                  rounded-lg bg-gray-50 border border-gray-100
                  px-3 py-2.5 space-y-2
                "
              >
                <div className="h-3 bg-gray-100 rounded w-4/5" />
                <div className="flex gap-1.5">
                  <div className="h-2.5 bg-gray-100 rounded w-10" />
                  <div className="h-2.5 bg-gray-100 rounded w-8" />
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
        <p className="text-sm text-red-600 font-medium">
          Failed to load board data
        </p>
        <p className="text-xs text-gray-400">
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
        <div className="w-12 h-12 mx-auto rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="5" height="18" rx="1" stroke="#475569" strokeWidth="1.5"/>
            <rect x="10" y="3" width="5" height="12" rx="1" stroke="#475569" strokeWidth="1.5"/>
            <rect x="17" y="3" width="5" height="8" rx="1" stroke="#475569" strokeWidth="1.5"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">
            {isCrossProject
              ? 'No items in active sprints'
              : 'No work items in this scope'
            }
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
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
        board.setFilters({ ...board.filters, search: '' } as KanbanFilters)
      }
      return !v
    })
  }, [board])

  // ── Default "My Items" filter on first cross-project load ────────────────
  // When the Sprint Board opens in cross-project mode and no filters are set,
  // default to the signed-in user's assignee so the board renders immediately
  // instead of hitting the 1,000-item gate. Users can clear this to see all.
  const hasSetDefaultFilter = useRef(false)
  useEffect(() => {
    if (
      !hasSetDefaultFilter.current &&
      board.isCrossProject &&
      !board.isLoading &&
      currentUserId &&
      (board.filters.assignees ?? []).length === 0 &&
      (board.filters.projects ?? []).length === 0
    ) {
      hasSetDefaultFilter.current = true
      board.setFilters({ ...board.filters, assignees: [currentUserId] } as KanbanFilters)
    }
  }, [board.isCrossProject, board.isLoading, currentUserId, board])

  // ── Too-many-items guard ──────────────────────────────────────────────────
  // Only block rendering when BOTH assignees AND projects are unfiltered —
  // i.e. the user explicitly cleared all filters and is trying to render everything.
  const tooManyItems =
    board.isCrossProject &&
    !board.isLoading &&
    !board.isError &&
    board.filteredCount > CROSS_PROJECT_ITEM_LIMIT &&
    (board.filters.projects ?? []).length === 0 &&
    (board.filters.assignees ?? []).length === 0

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
    <div className="h-screen flex flex-col kanban-board-bg relative">
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

      {/* Too-many-items guard — render this INSTEAD of the board */}
      {tooManyItems && (
        <TooManyItems
          totalItems={board.totalItems}
          projects={board.availableProjects ?? []}
          onFilter={(ids) => board.setFilters({ ...board.filters, projects: ids } as KanbanFilters)}
        />
      )}

      {!board.isLoading && !board.isError && board.totalItems > 0 && !tooManyItems && (
        <ErrorBoundary>
          <KanbanBoard
            visibleColumns={board.visibleColumns}
            hiddenColumns={board.hiddenColumns}
            collapsedColumns={board.collapsedColumns}
            onToggleCollapse={board.toggleCollapse}
            onCardClick={openItem}
            onMoveItem={board.moveItem}
            onSetWipLimit={board.setWipLimit}
          />
        </ErrorBoundary>
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
