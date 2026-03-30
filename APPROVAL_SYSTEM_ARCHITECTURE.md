# Approval Workflow System Architecture

## Overview

The approval workflow system manages multi-step approval processes for PMO entities (work items, budget changes, resource allocations, etc.). It uses a three-layer architecture:

1. **XState Machine** - State management for approval lifecycle
2. **TanStack Query Hooks** - Server state fetching and mutations
3. **Zustand Store** - Client-side UI state

## File Structure

```
src/
├── machines/
│   └── approvalMachine.ts       (XState v5 state machine)
├── hooks/
│   └── useApprovals.ts          (TanStack Query hooks)
└── stores/
    └── approvalStore.ts         (Zustand UI state)
```

## Layer 1: XState State Machine

**File:** `src/machines/approvalMachine.ts`

### Purpose
Models the complete lifecycle of an approval request as it moves through steps.

### Key Concepts

- **States:** idle → submitted → reviewing (step_1...step_5) → {approved|rejected|cancelled|expired}
- **Context:** Holds request data, step tracking, and audit history
- **Events:** SUBMIT, APPROVE, REJECT, REQUEST_CHANGES, CANCEL, EXPIRE
- **Guards:** Check conditions (canAdvance, isLastStep, hasPermission)
- **Actions:** Side-effect-free updates to context (recordAction, advanceStep)

### Example Flow

```
idle
  ↓ [SUBMIT: record action]
submitted
  ↓ [auto-transition]
reviewing.step_1
  ├─ [APPROVE] → reviewing.step_2 (advance) OR approved (if last)
  ├─ [REJECT] → rejected
  └─ [REQUEST_CHANGES] → submitted
```

### Learning Notes

- XState v5 uses `setup()` for reusable guards/actions
- Sub-states (step_1, step_2, etc.) track progress clearly
- Context is immutable; use `assign()` to update
- Machine is independent of React; can test in isolation

## Layer 2: TanStack Query Hooks

**File:** `src/hooks/useApprovals.ts`

### Purpose
Fetch, cache, and mutate approval data from Supabase.

### Key Hooks

1. **useApprovalWorkflows()**
   - Fetches all active workflows with their steps
   - Cache key: `['approval', 'workflows', 'active']`
   - Joins to `approval_steps` table

2. **useApprovalRequests(filters?)**
   - Fetches requests with optional filtering
   - Joins to `approval_workflows`, `projects`, and `profiles`
   - Filters: status, entity_type, project_id

3. **useApprovalStats()**
   - Computes aggregate statistics
   - totalPending, totalApproved, totalRejected
   - avgResolutionHours, oldestPending, byEntityType

4. **useApprovalActions(requestId)**
   - Fetches action history for a specific request
   - Joins to `profiles` for actor details

5. **useApprovalMutations()**
   - Returns three mutations: approve, reject, cancel
   - Each inserts to approval_actions, updates approval_requests
   - Invalidates relevant cache keys on success

### Query Key Strategy

```javascript
approvalKeys = {
  all: ['approval'],
  workflows: ['approval', 'workflows'],
  requests: ['approval', 'requests'],
  requestsByStatus: (status) => ['approval', 'requests', { status }],
  actions: (requestId) => ['approval', 'actions', requestId],
  stats: ['approval', 'stats'],
}
```

### Supabase Join Syntax

```typescript
// Fetch with nested relations in one query
const { data } = await db
  .from('approval_requests')
  .select(`
    *,
    workflow:approval_workflows(*),
    project:projects(id, name, code),
    requester:requested_by(id, display_name, full_name, avatar_url)
  `)
  .eq('status', 'pending');
```

### Learning Notes

- `staleTime: 60000` (1 min) keeps data fresh without constant refetches
- Mutations automatically invalidate related queries
- QueryKey arrays enable smart cache invalidation
- Use TanStack Query DevTools to debug cache hits/misses

## Layer 3: Zustand Store

**File:** `src/stores/approvalStore.ts`

### Purpose
Manage ephemeral UI state (selections, filters, panel visibility).

### State Shape

```typescript
{
  selectedRequestId: string | null;
  detailPanelOpen: boolean;
  filterStatus: 'all' | 'pending' | ... ;
  filterEntityType: 'all' | 'work_item' | ... ;
  sortBy: 'newest' | 'oldest' | 'priority';
}
```

### Actions

- `setSelectedRequest(id)` - Select a request (auto-opens panel)
- `setFilterStatus(status)` - Filter by status
- `setFilterEntityType(entityType)` - Filter by entity type
- `setSortBy(sortBy)` - Change sort order
- `toggleDetailPanel()` - Toggle detail panel visibility
- `clearFilters()` - Reset to defaults

### Usage Example

```typescript
import { useApprovalStore } from '@/stores/approvalStore';
import { useApprovalRequests } from '@/hooks/useApprovals';

export function ApprovalList() {
  // UI state from Zustand
  const { filterStatus, filterEntityType } = useApprovalStore();
  
  // Server state from TanStack Query
  const { data: requests } = useApprovalRequests({
    status: filterStatus === 'all' ? undefined : filterStatus,
    entity_type: filterEntityType === 'all' ? undefined : filterEntityType,
  });

  return (
    <div>
      {requests?.map((req) => (
        <RequestCard key={req.id} request={req} />
      ))}
    </div>
  );
}
```

### Learning Notes

- Zustand is lightweight; no Provider boilerplate
- Stores are just hooks you call from components
- Use `get()` to read state inside actions
- Separate UI state from server state for clarity

## Integration Pattern

### Complete Flow Example

1. **User submits approval request**
   ```typescript
   // In component
   const { approve } = useApprovalMutations();
   const actor = useCurrentUser(); // Get from auth hook
   
   await approve.mutateAsync({
     requestId: 'abc-123',
     actorId: actor.id,
     comment: 'Looks good!',
     currentStep: 1,
     totalSteps: 3,
   });
   ```

2. **Mutation updates Supabase**
   - Inserts to `approval_actions` table
   - Updates `approval_requests` status/current_step
   - Invalidates `approvalKeys.requests` cache

3. **TanStack Query refetches**
   - Component re-renders with fresh data
   - UI shows "Approved" badge

4. **Machine updates (optional)**
   - If using XState in component: `send({ type: 'APPROVE', ... })`
   - Machine transitions: reviewing.step_1 → reviewing.step_2

## Database Schema Reference

### approval_workflows
```
id (uuid, pk)
name (text)
description (text)
entity_type (text) - work_item|budget_change|resource_allocation|project_status|scope_change
trigger_condition (jsonb)
is_active (boolean)
created_by (uuid, fk→profiles)
created_at (timestamptz)
updated_at (timestamptz)
```

### approval_steps
```
id (uuid, pk)
workflow_id (uuid, fk→approval_workflows)
step_order (integer)
name (text)
approver_type (text) - user|role|team
approver_value (text)
approval_mode (text) - single|all
sla_hours (integer, default 48)
created_at (timestamptz)
```

### approval_requests
```
id (uuid, pk)
workflow_id (uuid, fk→approval_workflows)
entity_type (text)
entity_id (uuid)
project_id (uuid, fk→projects)
current_step (integer, default 1)
status (text) - pending|approved|rejected|cancelled|expired
requested_by (uuid, fk→profiles)
requested_at (timestamptz)
completed_at (timestamptz, nullable)
metadata (jsonb)
```

### approval_actions
```
id (uuid, pk)
request_id (uuid, fk→approval_requests)
step_order (integer)
actor_id (uuid, fk→profiles)
action (text) - submitted|approved|rejected|requested_changes|cancelled|expired
comment (text, nullable)
acted_at (timestamptz)
```

## Best Practices

1. **Always use query keys consistently** - Use the `approvalKeys` factory
2. **Invalidate after mutations** - Ensures UI sees latest data
3. **Keep UI state separate** - Zustand for ephemeral, TanStack Query for persistent
4. **Use machine guards** - Prevent invalid transitions (e.g., skip step)
5. **Record audit trail** - Every action gets recorded to approval_actions
6. **Handle loading/error states** - Check `isLoading`, `error` from hooks
7. **Batch updates** - Zustand automatically batches; TanStack Query does too
8. **Test machine in isolation** - You can test state transitions without React

## Common Patterns

### Fetch and Display with Filtering
```typescript
const { filterStatus } = useApprovalStore();
const { data: requests, isLoading } = useApprovalRequests({
  status: filterStatus === 'all' ? undefined : filterStatus,
});
```

### Handle Approval Action
```typescript
const { approve } = useApprovalMutations();

const handleApprove = async (requestId: string) => {
  try {
    await approve.mutateAsync({
      requestId,
      actorId: currentUserId,
      comment: userComment,
      currentStep: 1,
      totalSteps: 3,
    });
    // Success! Cache automatically refetched by TanStack Query
  } catch (error) {
    console.error('Approval failed:', error);
  }
};
```

### Display Statistics
```typescript
const { stats, isLoading } = useApprovalStats();

return (
  <div>
    <p>Pending: {stats.totalPending}</p>
    <p>Approved: {stats.totalApproved}</p>
    <p>Avg Resolution: {stats.avgResolutionHours}h</p>
  </div>
);
```

## Next Steps

1. Create UI components that use these hooks (ApprovalList, ApprovalDetail, ApprovalForm)
2. Add XState actor integration if you need time-based expiration or SLA tracking
3. Consider implementing a Postgres stored procedure for stats (currently computed in JS)
4. Add real-time updates using Supabase Realtime if needed
5. Integrate with the request creation flow (trigger workflows when new entities created)
