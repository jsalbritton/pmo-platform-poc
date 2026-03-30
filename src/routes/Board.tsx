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
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/lib/supabase'
import { WorkItemDetail } from '@/features/work-items'
import { useKanbanBoard, KanbanBoard, BoardHeader } from '@/features/kanban'

// ─── UUID VALIDATION ────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUUID(s: string | undefined): s is string {
  return !!s && UUID_RE.test(s)
}

// ─── PROJECT PICKER ─────────────────────────────────────────────────────────

interface ProjectSummary {
  id: string
  name: string
  code: string
  status: string
  item_count: number
}

function ProjectPicker() {
  const navigate = useNavigate()

  const { data: projects, isLoading } = useQuery({
    queryKey: ['board-project-picker'],
    queryFn: async (): Promise<ProjectSummary[]> => {
      const { data, error } = await db
        .from('projects')
        .select('id, name, code, status')
        .in('status', ['active', 'planning'])
        .order('name')

      if (error) throw error

      // Get item counts per project
      const results: ProjectSummary[] = []
      for (const p of data ?? []) {
        const { count } = await db
          .from('work_items')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', p.id)
          .is('parent_id', null)

        results.push({ ...p, item_count: count ?? 0 })
      }
      return results
    },
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-6 h-6 mx-auto border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading projects…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/3 border border-white/8 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="5" height="18" rx="1" stroke="#58a6ff" strokeWidth="1.5"/>
              <rect x="10" y="3" width="5" height="12" rx="1" stroke="#58a6ff" strokeWidth="1.5"/>
              <rect x="17" y="3" width="5" height="8" rx="1" stroke="#58a6ff" strokeWidth="1.5"/>
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-200">Select a Project</h2>
          <p className="text-sm text-slate-500 mt-1">Choose a project to view its Sprint Board</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(projects ?? []).map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/board/${p.id}`)}
              className="
                text-left px-4 py-3.5 rounded-xl
                bg-[#0d1117] border border-white/8
                hover:border-blue-500/40 hover:bg-[#161b22]
                transition-all duration-150 group cursor-pointer
              "
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-blue-400/80 bg-blue-500/10 px-1.5 py-0.5 rounded">
                  {p.code}
                </span>
                <span className={`
                  text-[10px] uppercase tracking-wider font-medium
                  ${p.status === 'active' ? 'text-emerald-400' : 'text-amber-400'}
                `}>
                  {p.status}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-200 group-hover:text-white truncate">
                {p.name}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                {p.item_count} work item{p.item_count !== 1 ? 's' : ''}
              </p>
            </button>
          ))}
        </div>

        {(projects ?? []).length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-slate-500">No active projects found.</p>
          </div>
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
  const { id: rawId }               = useParams<{ id: string }>()
  const projectId                   = isValidUUID(rawId) ? rawId : undefined
  const [searchParams, setSearchParams] = useSearchParams()
  const { session }                 = useAuth()

  // If no valid project UUID → show project picker
  if (!projectId) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="flex items-center gap-3 px-6 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="5" height="18" rx="1" stroke="#58a6ff" strokeWidth="1.5"/>
              <rect x="10" y="3" width="5" height="12" rx="1" stroke="#58a6ff" strokeWidth="1.5"/>
              <rect x="17" y="3" width="5" height="8" rx="1" stroke="#58a6ff" strokeWidth="1.5"/>
            </svg>
            <h1 className="text-base font-semibold text-slate-200">Sprint Board</h1>
          </div>
        </div>
        <ProjectPicker />
      </div>
    )
  }

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
