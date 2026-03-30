/**
 * kanban feature barrel export
 *
 * Import from here, not from individual component files.
 *
 * Usage:
 *   import { KanbanBoard, useKanbanBoard, BoardHeader } from '@/features/kanban'
 */

export { KanbanBoard }   from './KanbanBoard'
export { KanbanColumn, CollapsedStrip } from './KanbanColumn'
export { KanbanCard }    from './KanbanCard'
export { BoardHeader }   from './BoardHeader'
export {
  useKanbanBoard,
  EMPTY_FILTERS,
  DEFAULT_COLLAPSED,
} from './useKanbanBoard'
export type {
  KanbanItem,
  KanbanColumnData,
  GroupByField,
  KanbanFilters,
  SprintOption,
  SprintScope,
  BoardProject,
} from './useKanbanBoard'
