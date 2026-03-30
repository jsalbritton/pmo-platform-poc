/**
 * Approval UI State Store
 * 
 * Zustand store for managing client-side UI state for the approval workflow interface.
 * This is separate from server state (which is in TanStack Query).
 * 
 * LEARNING NOTES FOR JEREMY:
 * - Zustand is lightweight state management (simpler than Redux/Recoil)
 * - Store is a hook that you call from React components: const { filterStatus, setFilterStatus } = useApprovalStore()
 * - Zustand automatically batches updates (efficient re-renders)
 * - Persist plugin can save state to localStorage if needed
 * 
 * SEPARATION OF CONCERNS:
 * - Server state: approval requests/workflows/actions → TanStack Query (useApprovalRequests)
 * - UI state: which request is selected, what filters are active → Zustand (useApprovalStore)
 * This pattern keeps each tool doing what it's best at.
 */

import { create } from 'zustand';

/**
 * ApprovalStoreState: The shape of our UI state store
 */
export interface ApprovalStoreState {
  // Selection
  selectedRequestId: string | null;
  detailPanelOpen: boolean;

  // Filtering
  filterStatus: 'all' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
  filterEntityType: 'all' | 'work_item' | 'budget_change' | 'resource_allocation' | 'project_status' | 'scope_change';

  // Sorting
  sortBy: 'newest' | 'oldest' | 'priority';

  // Actions
  setSelectedRequest: (id: string | null) => void;
  setFilterStatus: (status: ApprovalStoreState['filterStatus']) => void;
  setFilterEntityType: (entityType: ApprovalStoreState['filterEntityType']) => void;
  setSortBy: (sortBy: ApprovalStoreState['sortBy']) => void;
  toggleDetailPanel: () => void;
  clearFilters: () => void;
}

/**
 * Create the approval store
 * 
 * LEARNING NOTE: The create() function takes a callback that receives
 * the set and get functions for updating and reading state.
 */
export const useApprovalStore = create<ApprovalStoreState>((set, get) => ({
  // Initial state
  selectedRequestId: null,
  detailPanelOpen: false,
  filterStatus: 'all',
  filterEntityType: 'all',
  sortBy: 'newest',

  // Action: Select a request and open the detail panel
  setSelectedRequest: (id: string | null) =>
    set({
      selectedRequestId: id,
      detailPanelOpen: id !== null, // Auto-open panel when selecting
    }),

  /**
   * Action: Set the status filter
   * 
   * LEARNING NOTE: Zustand actions are functions that call set() to update state.
   * They can contain logic before the update (e.g., validation, side effects).
   */
  setFilterStatus: (status) =>
    set({
      filterStatus: status,
      selectedRequestId: null, // Clear selection when filtering
    }),

  /**
   * Action: Set the entity type filter
   */
  setFilterEntityType: (entityType) =>
    set({
      filterEntityType: entityType,
      selectedRequestId: null, // Clear selection when filtering
    }),

  /**
   * Action: Set sort order
   */
  setSortBy: (sortBy) =>
    set({ sortBy }),

  /**
   * Action: Toggle detail panel visibility
   * 
   * LEARNING NOTE: get() lets you read current state inside an action.
   * This is useful when new state depends on old state.
   */
  toggleDetailPanel: () => {
    const { detailPanelOpen } = get();
    set({ detailPanelOpen: !detailPanelOpen });
  },

  /**
   * Action: Reset all filters to defaults
   */
  clearFilters: () =>
    set({
      filterStatus: 'all',
      filterEntityType: 'all',
      sortBy: 'newest',
      selectedRequestId: null,
      detailPanelOpen: false,
    }),
}));

/**
 * USAGE EXAMPLE (in a React component):
 * 
 * import { useApprovalStore } from '@/stores/approvalStore';
 * 
 * export function ApprovalFilters() {
 *   const { filterStatus, setFilterStatus, clearFilters } = useApprovalStore();
 * 
 *   return (
 *     <div>
 *       <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
 *         <option value="all">All</option>
 *         <option value="pending">Pending</option>
 *         <option value="approved">Approved</option>
 *       </select>
 *       <button onClick={clearFilters}>Reset</button>
 *     </div>
 *   );
 * }
 * 
 * COMBINING WITH QUERY HOOKS:
 * 
 * export function ApprovalList() {
 *   const { filterStatus, filterEntityType } = useApprovalStore();
 *   const { data: requests } = useApprovalRequests({
 *     status: filterStatus === 'all' ? undefined : filterStatus,
 *     entity_type: filterEntityType === 'all' ? undefined : filterEntityType,
 *   });
 * 
 *   return (
 *     <div>
 *       {requests?.map((req) => (
 *         <RequestCard key={req.id} request={req} />
 *       ))}
 *     </div>
 *   );
 * }
 */
