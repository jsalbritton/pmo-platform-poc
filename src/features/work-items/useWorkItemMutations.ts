/**
 * useWorkItemMutations.ts — optimistic mutations for work item detail
 *
 * OPTIMISTIC UPDATE PATTERN (every mutation here follows this):
 *
 *   onMutate:   1. Cancel in-flight queries for this item
 *               2. Snapshot the current cache value (rollback target)
 *               3. Apply the change directly to the cache — UI updates instantly
 *   onError:    4. Roll back to the snapshot
 *   onSettled:  5. Re-fetch to sync with DB truth (resolves any drift)
 *
 * WHY THIS MATTERS:
 *   A PMO tool is used in meetings, real-time standups, live reviews.
 *   A 500ms wait for a status change to reflect breaks the flow.
 *   Optimistic updates make the UI feel instantaneous — the network
 *   catches up invisibly.  The rollback ensures data integrity on error.
 *
 * TEACHING NOTE:
 *   Notice `cancelQueries` in onMutate. Without this, an in-flight refetch
 *   could land AFTER our optimistic update and overwrite it with stale data.
 *   `cancelQueries` tells React Query to abort any pending fetches for this
 *   key before we write to the cache.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '@/lib/supabase'
import { workItemKeys } from './useWorkItem'
import type {
  WorkItemFull,
  WorkItemUpdate,
  WorkItemStatus,
  WorkItemPriority,
  WorkItemComment,
} from './workItem.types'

// ─── HELPER ───────────────────────────────────────────────────────────────────

/** Apply a partial update to a cached WorkItemFull snapshot */
function applyUpdate(prev: WorkItemFull | undefined, patch: WorkItemUpdate): WorkItemFull | undefined {
  if (!prev) return prev
  return { ...prev, ...patch, updated_at: new Date().toISOString() }
}

// ─── UPDATE WORK ITEM FIELD ───────────────────────────────────────────────────

/**
 * useUpdateWorkItem — generic field-level mutation.
 * Used by inline-edit components for title, description, dates, points, etc.
 *
 * Usage:
 *   const { mutate } = useUpdateWorkItem(workItemId)
 *   mutate({ title: 'New title' })
 */
export function useUpdateWorkItem(id: string) {
  const queryClient = useQueryClient()
  const key = workItemKeys.detail(id)

  return useMutation({
    mutationFn: async (patch: WorkItemUpdate) => {
      const { data, error } = await db
        .from('work_items')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw new Error(`Failed to update work item: ${error.message}`)
      return data
    },

    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key })
      const snapshot = queryClient.getQueryData<WorkItemFull>(key)
      queryClient.setQueryData<WorkItemFull>(key, (prev) => applyUpdate(prev, patch))
      return { snapshot }
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) queryClient.setQueryData(key, ctx.snapshot)
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
      // Also invalidate the list so board cards stay in sync
      queryClient.invalidateQueries({ queryKey: workItemKeys.lists() })
    },
  })
}

// ─── STATUS CHANGE ────────────────────────────────────────────────────────────

/**
 * useUpdateWorkItemStatus — dedicated status mutation.
 * Separate from the generic update so the status bar can use it independently.
 */
export function useUpdateWorkItemStatus(id: string) {
  const { mutate, isPending } = useUpdateWorkItem(id)

  return {
    updateStatus: (status: WorkItemStatus) => mutate({ status }),
    isPending,
  }
}

// ─── PRIORITY CHANGE ─────────────────────────────────────────────────────────

export function useUpdateWorkItemPriority(id: string) {
  const { mutate, isPending } = useUpdateWorkItem(id)

  return {
    updatePriority: (priority: WorkItemPriority) => mutate({ priority }),
    isPending,
  }
}

// ─── ASSIGNEE CHANGE ─────────────────────────────────────────────────────────

export function useUpdateWorkItemAssignee(id: string) {
  const { mutate, isPending } = useUpdateWorkItem(id)

  return {
    updateAssignee: (assigneeId: string | null) => mutate({ assignee_id: assigneeId }),
    isPending,
  }
}

// ─── SUB-TASK TOGGLE ─────────────────────────────────────────────────────────

/**
 * useToggleSubTask — marks a sub-task done / reverts to in_progress.
 * Updates both the sub-task's status AND its parent's cache entry.
 */
export function useToggleSubTask(parentId: string) {
  const queryClient = useQueryClient()
  const parentKey = workItemKeys.detail(parentId)

  return useMutation({
    mutationFn: async ({ subTaskId, done }: { subTaskId: string; done: boolean }) => {
      const newStatus = done ? 'done' : 'in_progress'
      const { error } = await db
        .from('work_items')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', subTaskId)

      if (error) throw new Error(`Failed to toggle sub-task: ${error.message}`)
      return { subTaskId, newStatus }
    },

    onMutate: async ({ subTaskId, done }) => {
      await queryClient.cancelQueries({ queryKey: parentKey })
      const snapshot = queryClient.getQueryData<WorkItemFull>(parentKey)

      queryClient.setQueryData<WorkItemFull>(parentKey, (prev) => {
        if (!prev) return prev
        return {
          ...prev,
          sub_tasks: prev.sub_tasks.map((t) =>
            t.id === subTaskId
              ? { ...t, status: done ? 'done' : 'in_progress' }
              : t
          ),
        }
      })

      return { snapshot }
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) queryClient.setQueryData(parentKey, ctx.snapshot)
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: parentKey })
    },
  })
}

// ─── ADD COMMENT ─────────────────────────────────────────────────────────────

/**
 * useAddComment — posts a comment and optimistically appends it.
 *
 * The optimistic comment uses a temporary negative-timestamp ID so it
 * can be identified and replaced once the real row comes back from DB.
 */
export function useAddComment(workItemId: string, currentUserId: string) {
  const queryClient = useQueryClient()
  const key = workItemKeys.detail(workItemId)

  return useMutation({
    mutationFn: async ({
      body,
      parentCommentId,
    }: {
      body:            string
      parentCommentId: string | null
    }) => {
      const { data, error } = await db
        .from('comments')
        .insert({
          work_item_id:      workItemId,
          author_id:         currentUserId,
          body,
          parent_comment_id: parentCommentId,
        })
        .select(`
          *,
          author:profiles!comments_author_id_fkey (
            id, full_name, display_name, email, avatar_url, role, title, department
          )
        `)
        .single()

      if (error) throw new Error(`Failed to add comment: ${error.message}`)
      return data
    },

    onMutate: async ({ body, parentCommentId }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const snapshot = queryClient.getQueryData<WorkItemFull>(key)

      // Build a placeholder comment (author profile missing — shows skeleton)
      const optimisticComment: WorkItemComment = {
        id:                `optimistic-${Date.now()}`,
        work_item_id:      workItemId,
        author_id:         currentUserId,
        body,
        is_edited:         false,
        parent_comment_id: parentCommentId,
        created_at:        new Date().toISOString(),
        updated_at:        new Date().toISOString(),
        author:            null,   // resolved on invalidation
        replies:           [],
      }

      queryClient.setQueryData<WorkItemFull>(key, (prev) => {
        if (!prev) return prev

        // If it's a reply, find the parent and append to its replies
        if (parentCommentId) {
          return {
            ...prev,
            comments: prev.comments.map((c) =>
              c.id === parentCommentId
                ? { ...c, replies: [...(c.replies ?? []), optimisticComment] }
                : c
            ),
          }
        }

        // Top-level comment
        return {
          ...prev,
          comments: [...prev.comments, optimisticComment],
        }
      })

      return { snapshot }
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) queryClient.setQueryData(key, ctx.snapshot)
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

// ─── DELETE COMMENT ───────────────────────────────────────────────────────────

export function useDeleteComment(workItemId: string) {
  const queryClient = useQueryClient()
  const key = workItemKeys.detail(workItemId)

  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await db
        .from('comments')
        .delete()
        .eq('id', commentId)

      if (error) throw new Error(`Failed to delete comment: ${error.message}`)
    },

    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: key })
      const snapshot = queryClient.getQueryData<WorkItemFull>(key)

      queryClient.setQueryData<WorkItemFull>(key, (prev) => {
        if (!prev) return prev
        return {
          ...prev,
          // Remove from top-level OR from nested replies
          comments: prev.comments
            .filter((c) => c.id !== commentId)
            .map((c) => ({
              ...c,
              replies: (c.replies ?? []).filter((r) => r.id !== commentId),
            })),
        }
      })

      return { snapshot }
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) queryClient.setQueryData(key, ctx.snapshot)
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

// ─── ADD LABEL ────────────────────────────────────────────────────────────────

export function useUpdateLabels(workItemId: string) {
  const { mutate, isPending } = useUpdateWorkItem(workItemId)

  return {
    addLabel:    (label: string, current: string[]) =>
      mutate({ labels: [...new Set([...current, label])] }),
    removeLabel: (label: string, current: string[]) =>
      mutate({ labels: current.filter((l) => l !== label) }),
    isPending,
  }
}

// ─── SPRINT ASSIGNMENT ────────────────────────────────────────────────────────

export function useUpdateSprint(workItemId: string) {
  const { mutate, isPending } = useUpdateWorkItem(workItemId)

  return {
    moveTo:         (sprintId: string) => mutate({ sprint_id: sprintId }),
    removeFromSprint: ()               => mutate({ sprint_id: null }),
    isPending,
  }
}
