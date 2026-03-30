# Approval System - Quick Start Guide

## What You Built

Three interconnected modules that work together:

1. **State Machine** (`approvalMachine.ts`) - Models workflow states and transitions
2. **Query Hooks** (`useApprovals.ts`) - Fetches/mutates Supabase data
3. **UI Store** (`approvalStore.ts`) - Tracks UI selections and filters

## Minimal Working Example

### 1. Fetch and Display Requests

```typescript
import { useApprovalRequests } from '@/hooks/useApprovals';
import { useApprovalStore } from '@/stores/approvalStore';

export function ApprovalList() {
  const { filterStatus } = useApprovalStore();
  const { data: requests, isLoading } = useApprovalRequests({
    status: filterStatus === 'all' ? undefined : filterStatus,
  });

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {requests?.map((req) => (
        <div key={req.id}>
          <h3>{req.workflow?.name}</h3>
          <p>Status: {req.status}</p>
          <p>Step: {req.current_step}</p>
        </div>
      ))}
    </div>
  );
}
```

### 2. Approve a Request

```typescript
import { useApprovalMutations } from '@/hooks/useApprovals';

export function ApprovalButton({ requestId, currentStep, totalSteps }: Props) {
  const { approve } = useApprovalMutations();
  const currentUserId = 'user-uuid'; // Get from auth

  const handleApprove = async () => {
    await approve.mutateAsync({
      requestId,
      actorId: currentUserId,
      comment: 'Approved',
      currentStep,
      totalSteps,
    });
    // Cache automatically refetched!
  };

  return <button onClick={handleApprove}>Approve</button>;
}
```

### 3. Use Filters

```typescript
import { useApprovalStore } from '@/stores/approvalStore';

export function Filters() {
  const { filterStatus, setFilterStatus, clearFilters } = useApprovalStore();

  return (
    <div>
      <select 
        value={filterStatus} 
        onChange={(e) => setFilterStatus(e.target.value as any)}
      >
        <option value="all">All</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>
      <button onClick={clearFilters}>Reset</button>
    </div>
  );
}
```

### 4. Show Statistics

```typescript
import { useApprovalStats } from '@/hooks/useApprovals';

export function Stats() {
  const { stats } = useApprovalStats();

  return (
    <div>
      <p>Pending: {stats.totalPending}</p>
      <p>Approved: {stats.totalApproved}</p>
      <p>Rejected: {stats.totalRejected}</p>
      <p>Avg Time: {stats.avgResolutionHours}h</p>
    </div>
  );
}
```

## State Machine (Advanced)

If you want to use XState for UI orchestration:

```typescript
import { useActor } from '@xstate/react';
import { approvalMachine } from '@/machines/approvalMachine';

export function ApprovalWorkflow({ requestId, workflowId }: Props) {
  const [snapshot, send] = useActor(approvalMachine, {
    input: {
      requestId,
      workflowId,
      entityType: 'work_item',
      entityId: 'entity-uuid',
      projectId: 'project-uuid',
      currentStep: 1,
      totalSteps: 3,
      metadata: {},
      history: [],
      currentActor: null,
    },
  });

  return (
    <div>
      <p>State: {snapshot.value}</p>
      <button onClick={() => send({ type: 'SUBMIT', actor: 'user-id' })}>
        Submit
      </button>
      <button onClick={() => send({ type: 'APPROVE', actor: 'user-id' })}>
        Approve
      </button>
    </div>
  );
}
```

## Import Checklist

All imports use the `@/` path alias:

```typescript
// Hooks
import { 
  useApprovalRequests,
  useApprovalWorkflows,
  useApprovalStats,
  useApprovalActions,
  useApprovalMutations,
} from '@/hooks/useApprovals';

// Types
import type {
  ApprovalRequest,
  ApprovalWorkflow,
  ApprovalStats,
} from '@/hooks/useApprovals';

// Store
import { useApprovalStore } from '@/stores/approvalStore';

// Machine
import { approvalMachine } from '@/machines/approvalMachine';
import type { ApprovalContext } from '@/machines/approvalMachine';
```

## Key Patterns

### Pattern 1: List with Filter
```typescript
const { filterStatus } = useApprovalStore();
const { data } = useApprovalRequests({
  status: filterStatus === 'all' ? undefined : filterStatus,
});
```

### Pattern 2: Mutation with Error Handling
```typescript
const { approve } = useApprovalMutations();

try {
  await approve.mutateAsync({ ... });
  // Success toast
} catch (err) {
  // Error toast
}
```

### Pattern 3: Conditional Rendering Based on Status
```typescript
{request?.status === 'pending' && (
  <ApprovalControls requestId={request.id} />
)}
{request?.status === 'approved' && (
  <p>✓ Approved by {lastAction.actor?.display_name}</p>
)}
```

### Pattern 4: Action History
```typescript
const { data: actions } = useApprovalActions(requestId);

{actions?.map((action) => (
  <div key={action.id}>
    <p>{action.actor?.display_name} {action.action}</p>
    <p>{action.comment}</p>
    <small>{new Date(action.acted_at).toLocaleString()}</small>
  </div>
))}
```

## TypeScript Tips

All types are exported and ready to use:

```typescript
import type {
  ApprovalRequest,
  ApprovalWorkflow,
  ApprovalStep,
  ApprovalAction,
  ApprovalStats,
} from '@/hooks/useApprovals';

import type { ApprovalStoreState } from '@/stores/approvalStore';

import type { ApprovalContext, ApprovalEvent } from '@/machines/approvalMachine';
```

## Debugging

### Check Cache Keys
```typescript
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();
console.log(queryClient.getQueryData(['approval', 'requests']));
```

### Check Store State
```typescript
const store = useApprovalStore.getState();
console.log(store);
```

### Check Machine State
```typescript
const [snapshot] = useActor(approvalMachine);
console.log(snapshot.value); // current state
console.log(snapshot.context); // current context
```

## Common Gotchas

1. **Filter doesn't update list?**
   - Make sure useApprovalRequests is called with the filter object
   - Check that filterStatus state is actually changing

2. **Data doesn't refetch after mutation?**
   - useApprovalMutations() automatically invalidates approvalKeys.requests
   - If using custom queryKeys, make sure they're included in invalidation

3. **Machine and hooks out of sync?**
   - Machine is for UI orchestration, not server state
   - Always use hooks for Supabase data
   - Only use machine if you need animation/transition timing

4. **TypeScript errors on filter?**
   - filterStatus is a string, but needs type: 
   - `setFilterStatus(e.target.value as 'pending' | 'approved' | ...)`

## Next: Build Components

Now you have the foundation. Build these components:

1. **ApprovalList** - Display filtered requests
2. **ApprovalDetail** - Show request + action history
3. **ApprovalForm** - Create new workflow or request
4. **ApprovalAction** - Approve/reject UI
5. **ApprovalWorkflowBuilder** - Configure workflows (admin)

All components use the hooks and store you just built!
