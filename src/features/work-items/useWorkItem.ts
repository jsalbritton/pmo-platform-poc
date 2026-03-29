/**
 * useWorkItem.ts — data fetching for a single work item + Realtime sync
 *
 * PATTERN:
 *   useWorkItem(id)  →  { data: WorkItemFull | undefined, isLoading, isError }
 *
 * What it fetches in one round-trip:
 *   1. The work_item row itself + assignee + reporter (joined)
 *   2. Sub-tasks (children where parent_id = this.id)
 *   3. Comments + author + replies (threaded via buildCommentTree)
 *   4. Attachments + uploader
 *   5. Time entries + user
 *   6. Activity log (last 100 entries for this entity)
 *
 * Realtime subscription:
 *   Once the detail panel is open, we subscribe to:
 *     - work_items  (for field edits from other users)
 *     - comments    (for new / edited / deleted comments)
 *     - activity_log (for the activity feed)
 *   On any change: invalidate the ['work-item', id] cache key → React Query
 *   triggers a background refetch, so the UI stays live without polling.
 *
 * TEACHING NOTE — Why not subscribe to the individual rows?
 *   Supabase Realtime broadcasts on table-level filters (e.g. work_item_id=X).
 *   We could optimistically apply the delta to the cache, but that requires
 *   deeply merging comment threads and activity arrays — a lot of fragile code.
 *   The safer pattern for a POC: receive the event, invalidate the cache key,
 *   let React Query do one cheap re-fetch.  Upgrading to delta-apply is a
 *   Sprint 3 optimisation once the data shapes are stable.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { db } from '@/lib/supabase'
import {
  buildCommentTree,
  type WorkItemFull,
  type WorkItemComment,
  type WorkItemAttachment,
  type WorkItemTimeEntry,
  type ActivityLogEntry,
  type WorkItemProfile,
} from './workItem.types'

// ─── QUERY KEY ────────────────────────────────────────────────────────────────

export const workItemKeys = {
  all:    ()           => ['work-items']            as const,
  lists:  ()           => ['work-items', 'list']    as const,
  list:   (projectId: string) => ['work-items', 'list', projectId] as const,
  detail: (id: string) => ['work-item', id]         as const,
}

// ─── FETCH FUNCTION ───────────────────────────────────────────────────────────

async function fetchWorkItemFull(id: string): Promise<WorkItemFull> {
  // ── 1. Core item + joined profiles ──────────────────────────────────────────
  const { data: item, error: itemErr } = await db
    .from('work_items')
    .select(`
      *,
      assignee:profiles!work_items_assignee_id_fkey (
        id, full_name, display_name, email, avatar_url, role, title, department
      ),
      reporter:profiles!work_items_reporter_id_fkey (
        id, full_name, display_name, email, avatar_url, role, title, department
      )
    `)
    .eq('id', id)
    .single()

  if (itemErr) throw new Error(`Failed to fetch work item ${id}: ${itemErr.message}`)

  // ── 2. Sub-tasks (children) ──────────────────────────────────────────────────
  const { data: subTasks, error: subErr } = await db
    .from('work_items')
    .select('*')
    .eq('parent_id', id)
    .order('board_position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (subErr) throw new Error(`Failed to fetch sub-tasks: ${subErr.message}`)

  // ── 3. Comments + author (flat — we'll tree-ify client-side) ────────────────
  const { data: rawComments, error: commErr } = await db
    .from('comments')
    .select(`
      *,
      author:profiles!comments_author_id_fkey (
        id, full_name, display_name, email, avatar_url, role, title, department
      )
    `)
    .eq('work_item_id', id)
    .order('created_at', { ascending: true })

  if (commErr) throw new Error(`Failed to fetch comments: ${commErr.message}`)

  // Shape comments: the DB may not yet have parent_comment_id if migration
  // hasn't run (safe fallback — treated as flat)
  const flatComments: WorkItemComment[] = (rawComments ?? []).map((c: Record<string, unknown>) => ({
    id:                c.id as string,
    work_item_id:      c.work_item_id as string,
    author_id:         c.author_id as string,
    body:              c.body as string,
    is_edited:         c.is_edited as boolean,
    parent_comment_id: (c.parent_comment_id as string | null) ?? null,
    created_at:        c.created_at as string,
    updated_at:        c.updated_at as string,
    author:            (c.author as WorkItemProfile | null) ?? null,
  }))

  const threadedComments = buildCommentTree(flatComments)

  // ── 4. Attachments + uploader ────────────────────────────────────────────────
  const { data: attachments, error: attErr } = await db
    .from('attachments')
    .select(`
      *,
      uploader:profiles!attachments_uploaded_by_fkey (
        id, full_name, display_name, email, avatar_url, role, title, department
      )
    `)
    .eq('work_item_id', id)
    .order('created_at', { ascending: false })

  if (attErr) throw new Error(`Failed to fetch attachments: ${attErr.message}`)

  // ── 5. Time entries + user ───────────────────────────────────────────────────
  const { data: timeEntries, error: teErr } = await db
    .from('time_entries')
    .select(`
      *,
      user:profiles!time_entries_user_id_fkey (
        id, full_name, display_name, email, avatar_url, role, title, department
      )
    `)
    .eq('work_item_id', id)
    .order('date', { ascending: false })

  if (teErr) throw new Error(`Failed to fetch time entries: ${teErr.message}`)

  // ── 6. Activity log ──────────────────────────────────────────────────────────
  const { data: activity, error: actErr } = await db
    .from('activity_log')
    .select(`
      *,
      actor:profiles!activity_log_actor_id_fkey (
        id, full_name, display_name, email, avatar_url, role, title, department
      )
    `)
    .eq('entity_id', id)
    .eq('entity_type', 'work_item')
    .order('created_at', { ascending: false })
    .limit(100)

  if (actErr) throw new Error(`Failed to fetch activity: ${actErr.message}`)

  // ── Assemble & return ────────────────────────────────────────────────────────
  return {
    ...(item as WorkItemFull),
    assignee:     (item as Record<string, unknown>).assignee as WorkItemFull['assignee'],
    reporter:     (item as Record<string, unknown>).reporter as WorkItemFull['reporter'],
    sub_tasks:    (subTasks ?? []) as WorkItemFull['sub_tasks'],
    comments:     threadedComments,
    attachments:  (attachments ?? []) as WorkItemAttachment[],
    time_entries: (timeEntries ?? []) as WorkItemTimeEntry[],
    dependencies: [],   // loaded lazily — most items have none
    activity:     (activity ?? []) as ActivityLogEntry[],
  }
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────

/**
 * useWorkItem — fetches and subscribes to a single work item.
 *
 * Usage:
 *   const { data, isLoading, isError } = useWorkItem(workItemId)
 *
 * Returns undefined while loading. Components should gate on isLoading.
 */
export function useWorkItem(id: string | null) {
  const queryClient = useQueryClient()

  // ── Realtime subscription ────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return

    // One channel per open detail panel.
    // We subscribe to three tables filtered by work_item_id / entity_id.
    const channel = db.channel(`work-item-detail:${id}`)

    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'work_items', filter: `id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: workItemKeys.detail(id) })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `work_item_id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: workItemKeys.detail(id) })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_log', filter: `entity_id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: workItemKeys.detail(id) })
        }
      )
      .subscribe()

    return () => {
      db.removeChannel(channel)
    }
  }, [id, queryClient])

  // ── Query ────────────────────────────────────────────────────────────────────
  return useQuery({
    queryKey: workItemKeys.detail(id ?? ''),
    queryFn:  () => fetchWorkItemFull(id!),
    enabled:  Boolean(id),
    staleTime: 30_000,   // 30 s — Realtime handles freshness; this prevents
                         //         unnecessary fetches on panel re-focus
  })
}

// ─── WORK ITEMS LIST (for board / backlog) ────────────────────────────────────

/**
 * fetchWorkItemsForProject — flat list used by the Kanban board.
 * Does NOT join related records (too expensive for a board-level query).
 */
export async function fetchWorkItemsForProject(projectId: string) {
  const { data, error } = await db
    .from('work_items')
    .select(`
      id, title, type, status, priority, story_points,
      assignee_id, sprint_id, board_position, labels, due_date,
      parent_id, created_at, updated_at,
      assignee:profiles!work_items_assignee_id_fkey (
        id, full_name, display_name, email, avatar_url
      )
    `)
    .eq('project_id', projectId)
    .is('parent_id', null)   // top-level items only — sub-tasks fetched in detail
    .order('board_position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch work items: ${error.message}`)
  return data ?? []
}
