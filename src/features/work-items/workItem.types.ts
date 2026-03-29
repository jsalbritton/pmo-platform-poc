/**
 * workItem.types.ts — Domain types for the work-item feature
 *
 * These extend the raw Supabase-generated Database types with:
 *   - Narrowed string-literal unions for status/priority/type
 *   - Enriched "joined" shapes that include related records
 *   - UI-layer types (inline-edit state, tab identity, etc.)
 *
 * RULE: Components import from this file, not from database.types.ts directly.
 * database.types.ts is a generated file (supabase gen types) — it will be
 * overwritten.  These hand-crafted types are stable.
 */

// ─── ENUMS ────────────────────────────────────────────────────────────────────

export type WorkItemStatus =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'in_review'
  | 'done'
  | 'blocked'
  | 'cancelled'

export type WorkItemPriority =
  | 'no_priority'
  | 'urgent'
  | 'high'
  | 'medium'
  | 'low'

export type WorkItemType =
  | 'epic'
  | 'story'
  | 'task'
  | 'bug'
  | 'spike'

// ─── PROFILE SHAPE (minimal — what we join onto work items) ──────────────────

export interface WorkItemProfile {
  id:           string
  full_name:    string
  display_name: string | null
  email:        string
  avatar_url:   string | null
  role:         string
  title:        string | null
  department:   string | null
}

// ─── CORE WORK ITEM ───────────────────────────────────────────────────────────

export interface WorkItem {
  id:              string
  title:           string
  description:     string | null
  type:            WorkItemType
  status:          WorkItemStatus
  priority:        WorkItemPriority

  project_id:      string
  sprint_id:       string | null
  phase_id:        string | null
  parent_id:       string | null   // non-null → this is a sub-task

  assignee_id:     string | null
  reporter_id:     string | null

  story_points:    number | null
  estimated_hours: number | null
  actual_hours:    number | null

  start_date:      string | null   // ISO date
  due_date:        string | null   // ISO date
  completed_at:    string | null   // ISO timestamp

  labels:          string[] | null
  board_position:  number | null
  metadata:        Record<string, unknown> | null

  created_at:      string
  updated_at:      string
}

// ─── COMMENT ──────────────────────────────────────────────────────────────────
// NOTE: parent_comment_id is added by Migration 015 (pending Jeremy's approval).
// The field is optional here — the UI degrades gracefully to flat comments if
// the migration has not yet run (parent_comment_id will be undefined/null on all rows).

export interface WorkItemComment {
  id:                string
  work_item_id:      string
  author_id:         string
  body:              string
  is_edited:         boolean
  parent_comment_id: string | null   // null → top-level; set → reply
  created_at:        string
  updated_at:        string

  // Joined
  author:            WorkItemProfile | null
  replies?:          WorkItemComment[]   // populated client-side by grouping
}

// ─── ATTACHMENT ───────────────────────────────────────────────────────────────

export interface WorkItemAttachment {
  id:            string
  work_item_id:  string
  uploaded_by:   string
  file_name:     string
  file_size:     number | null
  mime_type:     string | null
  storage_path:  string
  created_at:    string

  // Joined
  uploader:      WorkItemProfile | null
}

// ─── TIME ENTRY ───────────────────────────────────────────────────────────────

export interface WorkItemTimeEntry {
  id:           string
  work_item_id: string
  user_id:      string
  date:         string   // ISO date (YYYY-MM-DD)
  hours:        number
  notes:        string | null
  created_at:   string

  // Joined
  user:         WorkItemProfile | null
}

// ─── DEPENDENCY ───────────────────────────────────────────────────────────────

export interface WorkItemDependency {
  id:               string
  work_item_id:     string
  depends_on_id:    string
  dependency_type:  string   // 'blocks' | 'blocked_by' | 'relates_to'
  relationship:     string
  notes:            string | null
  created_at:       string
}

// ─── ACTIVITY LOG ENTRY ───────────────────────────────────────────────────────

export interface ActivityLogEntry {
  id:          string
  entity_id:   string
  entity_type: string
  action:      string   // 'created' | 'updated' | 'status_changed' | 'comment_added' | ...
  actor_id:    string | null
  changes:     Record<string, unknown> | null
  metadata:    Record<string, unknown> | null
  project_id:  string | null
  created_at:  string

  // Joined
  actor:       WorkItemProfile | null
}

// ─── FULL DETAIL SHAPE (loaded in WorkItemDetail) ────────────────────────────

export interface WorkItemFull extends WorkItem {
  assignee:    WorkItemProfile | null
  reporter:    WorkItemProfile | null

  // Sub-items (children)
  sub_tasks:   WorkItem[]

  // Related records
  comments:    WorkItemComment[]
  attachments: WorkItemAttachment[]
  time_entries: WorkItemTimeEntry[]
  dependencies: WorkItemDependency[]
  activity:    ActivityLogEntry[]
}

// ─── UI STATE TYPES ───────────────────────────────────────────────────────────

/** Which tab is open in the detail panel */
export type WorkItemTab = 'comments' | 'activity' | 'attachments' | 'time'

/** Which field is in inline-edit mode (null = none) */
export type InlineEditField =
  | 'title'
  | 'description'
  | 'status'
  | 'priority'
  | 'assignee'
  | 'due_date'
  | 'start_date'
  | 'story_points'
  | 'estimated_hours'
  | 'labels'
  | null

/** Update payload for optimistic mutations */
export type WorkItemUpdate = Partial<Omit<
  WorkItem,
  'id' | 'project_id' | 'created_at' | 'updated_at'
>>

// ─── DISPLAY MAPS ─────────────────────────────────────────────────────────────
// Centralised here so every component uses identical labels/colours.

export const STATUS_CONFIG: Record<WorkItemStatus, {
  label:     string
  color:     string   // Tailwind text colour class
  bg:        string   // Tailwind bg colour class
  border:    string   // Tailwind border colour class
  dotColor:  string   // inline SVG dot colour (hex)
}> = {
  backlog:     { label: 'Backlog',     color: 'text-slate-400',   bg: 'bg-slate-500/15',   border: 'border-slate-500/30',   dotColor: '#64748b' },
  todo:        { label: 'Todo',        color: 'text-slate-300',   bg: 'bg-slate-400/15',   border: 'border-slate-400/30',   dotColor: '#94a3b8' },
  in_progress: { label: 'In Progress', color: 'text-blue-400',    bg: 'bg-blue-500/15',    border: 'border-blue-500/30',    dotColor: '#58a6ff' },
  in_review:   { label: 'In Review',   color: 'text-violet-400',  bg: 'bg-violet-500/15',  border: 'border-violet-500/30',  dotColor: '#bc8cff' },
  done:        { label: 'Done',        color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', dotColor: '#3fb950' },
  blocked:     { label: 'Blocked',     color: 'text-red-400',     bg: 'bg-red-500/15',     border: 'border-red-500/30',     dotColor: '#f85149' },
  cancelled:   { label: 'Cancelled',   color: 'text-slate-500',   bg: 'bg-slate-600/15',   border: 'border-slate-600/30',   dotColor: '#475569' },
}

export const PRIORITY_CONFIG: Record<WorkItemPriority, {
  label:    string
  color:    string
  iconName: string
}> = {
  no_priority: { label: 'No priority', color: 'text-slate-500', iconName: 'Minus'          },
  urgent:      { label: 'Urgent',      color: 'text-red-400',   iconName: 'Warning'         },
  high:        { label: 'High',        color: 'text-orange-400', iconName: 'ArrowUp'        },
  medium:      { label: 'Medium',      color: 'text-amber-400', iconName: 'ArrowUpRight'    },
  low:         { label: 'Low',         color: 'text-blue-400',  iconName: 'ArrowDown'       },
}

export const TYPE_CONFIG: Record<WorkItemType, {
  label: string
  color: string
  bg:    string
}> = {
  epic:  { label: 'Epic',  color: 'text-violet-400', bg: 'bg-violet-500/15' },
  story: { label: 'Story', color: 'text-blue-400',   bg: 'bg-blue-500/15'   },
  task:  { label: 'Task',  color: 'text-slate-300',  bg: 'bg-slate-500/15'  },
  bug:   { label: 'Bug',   color: 'text-red-400',    bg: 'bg-red-500/15'    },
  spike: { label: 'Spike', color: 'text-amber-400',  bg: 'bg-amber-500/15'  },
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Build a tree of comments from a flat list.
 *  Top-level comments (parent_comment_id == null) go in root.
 *  Replies are nested under their parent's `.replies` array.
 *  Depth limit: 1 level (replies cannot have sub-replies — GitHub PR style).
 */
export function buildCommentTree(flat: WorkItemComment[]): WorkItemComment[] {
  const map = new Map<string, WorkItemComment>()
  const roots: WorkItemComment[] = []

  // First pass: index all comments
  for (const c of flat) {
    map.set(c.id, { ...c, replies: [] })
  }

  // Second pass: nest replies
  for (const [, c] of map) {
    if (c.parent_comment_id && map.has(c.parent_comment_id)) {
      map.get(c.parent_comment_id)!.replies!.push(c)
    } else {
      roots.push(c)
    }
  }

  return roots
}

/** Returns the display name for a profile: display_name > full_name > email prefix */
export function profileDisplayName(p: WorkItemProfile | null): string {
  if (!p) return 'Unknown'
  return p.display_name ?? p.full_name ?? p.email.split('@')[0]
}

/** Returns initials (≤2 chars) for an avatar fallback */
export function profileInitials(p: WorkItemProfile | null): string {
  const name = profileDisplayName(p)
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

/** Human-readable relative time (e.g. "3m ago", "2h ago", "Mar 15") */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)   return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60)   return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)   return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)    return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
