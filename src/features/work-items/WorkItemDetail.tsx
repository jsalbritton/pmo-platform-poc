/**
 * WorkItemDetail — the slide-over panel for a single work item.
 *
 * PANEL BEHAVIOUR:
 *   - Slides in from the right with spring physics (Framer Motion)
 *   - 50% viewport width in normal mode; full-width when expanded
 *   - Backdrop overlay (30% opacity) does NOT block the board — clicking
 *     outside closes the panel, not the app
 *   - Escape key closes (handled globally via useEffect)
 *
 * LAYOUT (vertical):
 *   ┌─────────────────────────────────────────┐
 *   │  WorkItemHeader  (flex-shrink-0)         │
 *   ├──────────────────────────┬──────────────┤
 *   │  Scrollable left body    │  Sidebar      │
 *   │  ──────────────────────  │  (fixed w)   │
 *   │  WorkItemTitle           │               │
 *   │  WorkItemStatusBar       │               │
 *   │  WorkItemDescription     │               │
 *   │  WorkItemSubTasks        │               │
 *   │  ──────────────────────  │               │
 *   │  WorkItemTabs ──────     │               │
 *   │  Tab content area        │               │
 *   │  (Comments / Activity /  │               │
 *   │   Attachments / Time)    │               │
 *   └──────────────────────────┴──────────────┘
 *
 * KEYBOARD SHORTCUTS (handled globally while panel is open):
 *   E       → enter title edit mode
 *   C       → focus comment composer
 *   Esc     → close panel
 *   ⌘⇧C    → copy permalink
 *
 * LOADING STATES:
 *   Skeleton placeholder shown while data fetches.
 *   Error state shown if fetch fails.
 */

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
// NOTE: inner tab panels use @starting-style CSS (enter-fade) instead of motion.div
import { useWorkItem }       from './useWorkItem'
import { WorkItemHeader }    from './components/WorkItemHeader'
import { WorkItemTitle }     from './components/WorkItemTitle'
import { WorkItemStatusBar } from './components/WorkItemStatusBar'
import { WorkItemDescription } from './components/WorkItemDescription'
import { WorkItemSubTasks }  from './components/WorkItemSubTasks'
import { WorkItemSidebar }   from './components/WorkItemSidebar'
import { WorkItemTabs }      from './components/WorkItemTabs'
import { CommentThread }     from './components/CommentThread'
import { ActivityFeed }      from './components/ActivityFeed'
import { AttachmentPanel }   from './components/AttachmentPanel'
import type { WorkItemTab, WorkItemProfile } from './workItem.types'

// ─── TIME LOG TAB (minimal) ───────────────────────────────────────────────────

function TimeTab({ item }: { item: import('./workItem.types').WorkItemFull }) {
  const totalLogged = item.time_entries.reduce((sum, e) => sum + e.hours, 0)
  const estimated   = item.estimated_hours ?? 0

  if (item.time_entries.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 py-16 text-center px-6">
        <p className="text-sm text-gray-500">No time logged yet</p>
        {estimated > 0 && (
          <p className="text-xs text-gray-400">{estimated}h estimated</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
      <div className="text-xs text-gray-500 mb-3">
        {totalLogged}h logged{estimated > 0 ? ` of ${estimated}h estimated` : ''}
      </div>
      {item.time_entries.map((entry) => (
        <div key={entry.id} className="flex items-center justify-between py-2 border-b border-gray-100">
          <div>
            <div className="text-sm text-gray-700">{entry.date}</div>
            {entry.notes && <div className="text-xs text-gray-500 mt-0.5">{entry.notes}</div>}
          </div>
          <div className="text-sm font-medium text-gray-800 tabular-nums">{entry.hours}h</div>
        </div>
      ))}
    </div>
  )
}

// ─── SKELETON ─────────────────────────────────────────────────────────────────

function WorkItemSkeleton() {
  return (
    <div className="animate-pulse p-5 space-y-4">
      <div className="h-4 bg-gray-100 rounded w-1/3" />
      <div className="h-7 bg-gray-100 rounded w-3/4" />
      <div className="flex gap-2">
        <div className="h-7 bg-gray-100 rounded-lg w-24" />
        <div className="h-7 bg-gray-100 rounded-lg w-20" />
        <div className="h-7 bg-gray-100 rounded-lg w-28" />
      </div>
      <div className="space-y-2 pt-2">
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-5/6" />
        <div className="h-3 bg-gray-100 rounded w-4/6" />
      </div>
    </div>
  )
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

interface WorkItemDetailProps {
  workItemId:    string | null
  currentUserId: string
  teamMembers:   WorkItemProfile[]
  onClose:       () => void
}

export function WorkItemDetail({
  workItemId,
  currentUserId,
  teamMembers,
  onClose,
}: WorkItemDetailProps) {
  const [activeTab,    setActiveTab]    = useState<WorkItemTab>('comments')
  const [isExpanded,   setIsExpanded]   = useState(false)
  const [editSignal,   setEditSignal]   = useState(0)   // incremented to trigger title edit
  const composerRef = useRef<HTMLTextAreaElement | null>(null)

  const { data: item, isLoading, isError } = useWorkItem(workItemId)

  // ── Global keyboard shortcuts while panel is open ─────────────────────────
  useEffect(() => {
    if (!workItemId) return

    function onKeyDown(e: KeyboardEvent) {
      const active = document.activeElement
      const isInput = active?.tagName === 'INPUT' ||
                      active?.tagName === 'TEXTAREA' ||
                      (active as HTMLElement)?.isContentEditable

      // Escape closes (or cancels current edit — handled by child components)
      if (e.key === 'Escape' && !isInput) {
        onClose()
        return
      }

      // Skip if already typing somewhere
      if (isInput) return

      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        setEditSignal((n) => n + 1)
      }
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        setActiveTab('comments')
        setTimeout(() => composerRef.current?.focus(), 50)
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'c') {
        e.preventDefault()
        navigator.clipboard.writeText(`${window.location.origin}/work-item/${workItemId}`)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [workItemId, onClose])

  const isOpen = Boolean(workItemId)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={  { opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-30 bg-black/30"
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0,       opacity: 1   }}
            exit={  { x: '100%',   opacity: 0   }}
            transition={{
              type:      'spring',
              stiffness: 320,
              damping:   36,
              mass:      1,
            }}
            className={`
              fixed top-0 right-0 bottom-0 z-40
              bg-white border-l border-gray-200
              flex flex-col shadow-xl
              transition-[width]
              ${isExpanded ? 'w-full' : 'w-[min(700px,55vw)]'}
            `}
            // Prevent backdrop click from propagating through the panel
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── HEADER ──────────────────────────────────────────────────── */}
            {item && (
              <WorkItemHeader
                item={item}
                isExpanded={isExpanded}
                onExpand={() => setIsExpanded((v) => !v)}
                onClose={onClose}
              />
            )}

            {/* ── BODY ────────────────────────────────────────────────────── */}
            {isLoading && <WorkItemSkeleton />}

            {isError && (
              <div className="flex-1 flex items-center justify-center text-sm text-red-600 p-8 text-center">
                Failed to load work item. Check your connection and try again.
              </div>
            )}

            {item && (
              <div className="flex-1 flex min-h-0">

                {/* ── LEFT: scrollable body ────────────────────────────── */}
                <div className="flex-1 flex flex-col min-w-0 min-h-0">

                  {/* Scrollable meta section */}
                  <div className="overflow-y-auto flex-shrink-0 border-b border-gray-100" style={{ maxHeight: '55%' }}>
                    <WorkItemTitle
                      itemId={item.id}
                      title={item.title}
                      editSignal={editSignal}
                    />
                    <WorkItemStatusBar
                      item={item}
                      teamMembers={teamMembers}
                    />
                    <WorkItemDescription
                      itemId={item.id}
                      description={item.description}
                    />
                    <WorkItemSubTasks item={item} />
                  </div>

                  {/* Tab bar */}
                  <WorkItemTabs
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    item={item}
                  />

                  {/* Tab content — fills remaining height.
                      CSS @starting-style (enter-fade) handles the fade-in
                      on mount. No AnimatePresence needed — new tab appears
                      immediately and fades in, old tab unmounts instantly.
                      This eliminates the mode="wait" double-delay jank. */}
                  <div className="flex-1 flex flex-col min-h-0">
                    {activeTab === 'comments' && (
                      <div key="comments" className="enter-fade flex-1 flex flex-col min-h-0">
                        <CommentThread
                          comments={item.comments}
                          workItemId={item.id}
                          currentUserId={currentUserId}
                          composerRef={composerRef}
                        />
                      </div>
                    )}

                    {activeTab === 'activity' && (
                      <div key="activity" className="enter-fade flex-1 flex flex-col min-h-0">
                        <ActivityFeed entries={item.activity} />
                      </div>
                    )}

                    {activeTab === 'attachments' && (
                      <div key="attachments" className="enter-fade flex-1 flex flex-col min-h-0">
                        <AttachmentPanel
                          attachments={item.attachments}
                          workItemId={item.id}
                          projectId={item.project_id}
                        />
                      </div>
                    )}

                    {activeTab === 'time' && (
                      <div key="time" className="enter-fade flex-1 flex flex-col min-h-0">
                        <TimeTab item={item} />
                      </div>
                    )}
                  </div>
                </div>

                {/* ── RIGHT: sidebar ───────────────────────────────────── */}
                <WorkItemSidebar item={item} />
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
