/**
 * ActivityFeed — unified audit timeline for a work item.
 *
 * Reads from activity_log where entity_id = work_item_id.
 * Each entry renders as a timeline row with:
 *   - Actor avatar + name
 *   - Human-readable action description (built from action + changes)
 *   - Relative timestamp
 *
 * Action types rendered:
 *   created        → "created this item"
 *   updated        → "changed [field] from X to Y"
 *   status_changed → "moved to [Status badge]"
 *   comment_added  → "commented" (body preview)
 *   attachment_added → "attached [filename]"
 *   assigned       → "assigned to [name]"
 *
 * The feed grows from top (newest first when reversed).
 */

import {
  Plus,
  PencilSimple,
  ArrowRight,
  ChatCircle,
  Paperclip,
  UserCircle,
  ClockCounterClockwise,
} from '@phosphor-icons/react'
import {
  STATUS_CONFIG,
  profileDisplayName,
  profileInitials,
  relativeTime,
  type ActivityLogEntry,
  type WorkItemStatus,
} from '../workItem.types'

// ─── ACTION RENDERER ─────────────────────────────────────────────────────────

function ActionText({ entry }: { entry: ActivityLogEntry }) {
  const changes = entry.changes as Record<string, { from: unknown; to: unknown }> | null

  switch (entry.action) {
    case 'created':
      return <span className="text-gray-700">created this item</span>

    case 'status_changed':
    case 'updated': {
      if (changes?.status) {
        const toStatus  = String(changes.status.to) as WorkItemStatus
        const cfg       = STATUS_CONFIG[toStatus] ?? STATUS_CONFIG.backlog
        return (
          <span className="text-gray-600">
            moved to{' '}
            <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
          </span>
        )
      }
      if (changes?.title) {
        return <span className="text-gray-600">updated the title</span>
      }
      if (changes?.description) {
        return <span className="text-gray-600">updated the description</span>
      }
      if (changes?.assignee_id) {
        return <span className="text-gray-600">changed the assignee</span>
      }
      if (changes?.priority) {
        return (
          <span className="text-gray-600">
            changed priority to{' '}
            <span className="text-gray-700 font-medium capitalize">
              {String(changes.priority.to ?? '').replace('_', ' ')}
            </span>
          </span>
        )
      }
      if (changes?.due_date) {
        const to = changes.due_date.to
        return (
          <span className="text-gray-600">
            {to ? `set due date to ${String(to)}` : 'removed the due date'}
          </span>
        )
      }
      // Generic fallback
      const fields = Object.keys(changes ?? {}).join(', ')
      return <span className="text-gray-600">updated {fields || 'this item'}</span>
    }

    case 'comment_added': {
      const meta    = entry.metadata as Record<string, unknown> | null
      const preview = String(meta?.body ?? '').slice(0, 60)
      return (
        <span className="text-gray-600">
          commented:{' '}
          <span className="italic text-gray-500">"{preview}{preview.length >= 60 ? '…' : ''}"</span>
        </span>
      )
    }

    case 'attachment_added': {
      const meta = entry.metadata as Record<string, unknown> | null
      return (
        <span className="text-gray-600">
          attached{' '}
          <span className="text-gray-700 font-medium">{String(meta?.file_name ?? 'a file')}</span>
        </span>
      )
    }

    case 'assigned': {
      const meta = entry.metadata as Record<string, unknown> | null
      return (
        <span className="text-gray-600">
          assigned to{' '}
          <span className="text-gray-700 font-medium">{String(meta?.assignee_name ?? 'someone')}</span>
        </span>
      )
    }

    default:
      return <span className="text-gray-500">{entry.action.replace(/_/g, ' ')}</span>
  }
}

// Action → icon mapping
function ActionIcon({ action }: { action: string }) {
  const cls = 'text-gray-400'
  if (action === 'created')          return <Plus       size={12} weight="bold"    className={cls} />
  if (action.includes('comment'))    return <ChatCircle size={12} weight="bold"    className={cls} />
  if (action.includes('attachment')) return <Paperclip  size={12} weight="bold"    className={cls} />
  if (action.includes('status'))     return <ArrowRight size={12} weight="bold"    className={cls} />
  if (action.includes('assign'))     return <UserCircle size={12} weight="duotone" className={cls} />
  return <PencilSimple size={12} weight="bold" className={cls} />
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

interface ActivityFeedProps {
  entries: ActivityLogEntry[]
}

export function ActivityFeed({ entries }: ActivityFeedProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
        <div className="w-10 h-10 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center">
          <ClockCounterClockwise size={20} weight="duotone" className="text-gray-400" />
        </div>
        <p className="text-sm text-gray-500">No activity yet</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 overflow-y-auto flex-1">
      <div className="relative">
        {/* Vertical timeline line */}
        <div className="absolute left-[13px] top-2 bottom-2 w-px bg-gray-100" />

        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="scroll-reveal-left flex gap-3"
            >
              {/* Timeline node */}
              <div className="
                relative z-10 w-7 h-7 rounded-full
                bg-white border border-gray-200
                flex items-center justify-center flex-shrink-0
              ">
                {entry.actor ? (
                  <span className="text-[9px] font-bold text-gray-600">
                    {profileInitials(entry.actor)}
                  </span>
                ) : (
                  <ActionIcon action={entry.action} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-start gap-1.5 flex-wrap">
                  {entry.actor && (
                    <span className="text-xs font-semibold text-gray-700">
                      {profileDisplayName(entry.actor)}
                    </span>
                  )}
                  <span className="text-xs"><ActionText entry={entry} /></span>
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {relativeTime(entry.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
