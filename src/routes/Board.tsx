/**
 * Board — Sprint Kanban board (Sprint 1B, S1B-002).
 *
 * Sprint 1B Phase A: This route hosts the WorkItemDetail slide-over panel.
 * The full Kanban board (drag-and-drop columns, card rendering) is S1B-002
 * and will be built in the next sprint increment.
 *
 * For now, this file:
 *   - Loads all work items for the project from Supabase
 *   - Renders a placeholder board structure
 *   - Wires up WorkItemDetail so the panel can be opened from URL params
 *     (/board/:id?item=<work_item_id>) or from any component via state
 *
 * S1B-002 will replace the placeholder grid with @dnd-kit Kanban columns.
 */

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Kanban } from '@phosphor-icons/react'
import { useAuth } from '@/hooks/useAuth'
import { WorkItemDetail } from '@/features/work-items'
import type { WorkItemProfile } from '@/features/work-items'

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function Board() {
  const { id: projectId }           = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { session }                 = useAuth()

  // Work item detail panel — open via ?item=<uuid> URL param
  // This makes panels deep-linkable: share a URL, panel opens to that item.
  const itemParam                   = searchParams.get('item')
  const [openItemId, setOpenItemId] = useState<string | null>(itemParam ?? null)

  // Sync URL param when panel opens/closes
  function openItem(id: string) {
    setOpenItemId(id)
    setSearchParams({ item: id }, { replace: true })
  }

  function closeItem() {
    setOpenItemId(null)
    setSearchParams({}, { replace: true })
  }

  // Sync if someone navigates directly to ?item=xyz
  useEffect(() => {
    setOpenItemId(itemParam ?? null)
  }, [itemParam])

  const currentUserId = session?.user.id ?? ''

  // TEMP: empty team members list until S1B-003 (team member fetching)
  const teamMembers: WorkItemProfile[] = []

  return (
    <div className="min-h-screen bg-background relative">
      {/* ── Board placeholder ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-2xl bg-pmo-cyan/10 border border-pmo-cyan/20">
              <Kanban size={40} weight="duotone" style={{ color: '#39c5cf' }} />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-foreground tracking-tight">Sprint Board</h1>
          <p className="text-muted-foreground text-sm font-mono">project: {projectId}</p>
          <p className="text-muted-foreground/60 text-xs">
            Sprint 1B · S1B-002 · Kanban columns coming next
          </p>

          {/* Demo: open a work item detail panel to test S1B-001 */}
          <div className="pt-4">
            <p className="text-xs text-slate-600 mb-2">
              Test the Work Item Detail panel:
            </p>
            <input
              type="text"
              placeholder="Paste a work item UUID…"
              className="
                bg-white/5 border border-white/10 rounded-lg px-3 py-2
                text-xs text-slate-300 placeholder:text-slate-600
                focus:outline-none focus:border-blue-500/40 w-72
              "
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim()
                  if (val) openItem(val)
                }
              }}
            />
            <p className="text-[10px] text-slate-700 mt-1">Press Enter to open panel</p>
          </div>
        </div>
      </div>

      {/* ── Work Item Detail slide-over ─────────────────────────────────────── */}
      <WorkItemDetail
        workItemId={openItemId}
        currentUserId={currentUserId}
        teamMembers={teamMembers}
        onClose={closeItem}
      />
    </div>
  )
}
