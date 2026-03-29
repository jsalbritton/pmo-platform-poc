/**
 * work-items feature barrel export
 *
 * Import from here, not from individual component files.
 * This gives us a stable import surface as internals change.
 *
 * Usage:
 *   import { WorkItemDetail, useWorkItem, workItemKeys } from '@/features/work-items'
 */

export { WorkItemDetail }     from './WorkItemDetail'
export { useWorkItem, workItemKeys, fetchWorkItemsForProject } from './useWorkItem'
export {
  useUpdateWorkItem,
  useUpdateWorkItemStatus,
  useUpdateWorkItemPriority,
  useUpdateWorkItemAssignee,
  useToggleSubTask,
  useAddComment,
  useDeleteComment,
  useUpdateLabels,
  useUpdateSprint,
} from './useWorkItemMutations'
export type {
  WorkItem,
  WorkItemFull,
  WorkItemComment,
  WorkItemAttachment,
  WorkItemTimeEntry,
  WorkItemDependency,
  ActivityLogEntry,
  WorkItemProfile,
  WorkItemStatus,
  WorkItemPriority,
  WorkItemType,
  WorkItemTab,
  WorkItemUpdate,
  InlineEditField,
} from './workItem.types'
export {
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  TYPE_CONFIG,
  buildCommentTree,
  profileDisplayName,
  profileInitials,
  relativeTime,
} from './workItem.types'
