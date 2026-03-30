/**
 * Approval Workflow Hooks
 * 
 * TanStack Query hooks for fetching, caching, and mutating approval workflow data.
 * 
 * LEARNING NOTES FOR JEREMY:
 * - useQuery is for fetching data; it caches by queryKey
 * - useMutation is for creating/updating/deleting; it invalidates caches
 * - staleTime controls how long data is fresh (no refetch)
 * - queryKey arrays should match your data structure (namespace/filter pattern)
 * - Always join to get nested data in one query (Supabase FK joins)
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { db } from '@/lib/supabase';

/**
 * Type Definitions
 * 
 * LEARNING NOTE: These types mirror your database schema.
 * We extend them with nested relationships (e.g., workflow inside request).
 */

export interface ApprovalWorkflow {
  id: string;
  name: string;
  description: string;
  entity_type: 'work_item' | 'budget_change' | 'resource_allocation' | 'project_status' | 'scope_change';
  trigger_condition: Record<string, unknown>;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  steps?: ApprovalStep[];
}

export interface ApprovalStep {
  id: string;
  workflow_id: string;
  step_order: number;
  name: string;
  approver_type: string; // 'user' | 'role' | 'team'
  approver_value: string; // user UUID, role name, or team ID
  approval_mode: string; // 'single' | 'all'
  sla_hours: number;
  created_at: string;
}

export interface ApprovalRequester {
  id: string;
  display_name: string;
  full_name: string;
  avatar_url?: string;
}

export interface ApprovalRequest {
  id: string;
  workflow_id: string;
  entity_type: string;
  entity_id: string;
  project_id: string;
  current_step: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
  requested_by: string;
  requested_at: string;
  completed_at?: string;
  metadata: Record<string, unknown>;
  
  // Joined relations
  workflow?: ApprovalWorkflow;
  project?: {
    id: string;
    name: string;
    code: string;
  };
  requester?: ApprovalRequester;
}

export interface ApprovalActionRecord {
  id: string;
  request_id: string;
  step_order: number;
  actor_id: string;
  action: 'submitted' | 'approved' | 'rejected' | 'requested_changes' | 'cancelled' | 'expired';
  comment?: string;
  acted_at: string;
  
  // Joined relation
  actor?: ApprovalRequester;
}

export interface ApprovalStats {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  avgResolutionHours: number;
  oldestPending?: string; // ISO timestamp of oldest pending request
  byEntityType: Record<string, number>;
}

/**
 * Query Key Factory
 * 
 * LEARNING NOTE: Query keys should be arrays that represent your data hierarchy.
 * This makes it easy to invalidate groups of queries (e.g., all approval data).
 * 
 * Pattern: ['approval', 'workflows'] for all workflows
 *          ['approval', 'requests', { status: 'pending' }] for filtered requests
 */
export const approvalKeys = {
  all: ['approval'] as const,
  workflows: ['approval', 'workflows'] as const,
  workflowsActive: ['approval', 'workflows', 'active'] as const,
  requests: ['approval', 'requests'] as const,
  requestsByStatus: (status: string) => ['approval', 'requests', { status }] as const,
  requestsByEntity: (entityType: string) => ['approval', 'requests', { entityType }] as const,
  requestsFiltered: (filters: ApprovalFilters) => ['approval', 'requests', filters] as const,
  actions: (requestId: string) => ['approval', 'actions', requestId] as const,
  stats: ['approval', 'stats'] as const,
};

/**
 * Fetch all active approval workflows with their steps
 */
export function useApprovalWorkflows() {
  return useQuery({
    queryKey: approvalKeys.workflowsActive,
    queryFn: async () => {
      const { data, error } = await db
        .from('approval_workflows')
        .select(`
          *,
          steps:approval_steps(*)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw new Error(`Failed to fetch workflows: ${error.message}`);
      return (data || []) as ApprovalWorkflow[];
    },
    staleTime: 60000, // 1 minute
  });
}

/**
 * Fetch approval requests with optional filters
 * 
 * LEARNING NOTE: This query uses Supabase FK joins to fetch related data in one call.
 * The select syntax tells Supabase which nested tables to include.
 */
export interface ApprovalFilters {
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
  entity_type?: string;
  project_id?: string;
}

export function useApprovalRequests(filters?: ApprovalFilters) {
  return useQuery({
    queryKey: filters ? approvalKeys.requestsFiltered(filters) : approvalKeys.requests,
    queryFn: async () => {
      let query = db.from('approval_requests').select(`
        *,
        workflow:approval_workflows(*),
        project:projects(id, name, code),
        requester:requested_by(id, display_name, full_name, avatar_url)
      `);

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.entity_type) {
        query = query.eq('entity_type', filters.entity_type);
      }
      if (filters?.project_id) {
        query = query.eq('project_id', filters.project_id);
      }

      // Fetch newest first
      query = query.order('requested_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw new Error(`Failed to fetch requests: ${error.message}`);
      return (data || []) as ApprovalRequest[];
    },
    staleTime: 60000, // 1 minute
  });
}

/**
 * Compute approval statistics
 * 
 * This hook could be backed by a Postgres stored procedure for efficiency,
 * but we compute it from the data for now.
 */
export function useApprovalStats() {
  const { data: requests, isLoading, error } = useApprovalRequests();

  const stats: ApprovalStats = {
    totalPending: 0,
    totalApproved: 0,
    totalRejected: 0,
    avgResolutionHours: 0,
    oldestPending: undefined,
    byEntityType: {},
  };

  if (requests) {
    // Count by status
    requests.forEach((req) => {
      if (req.status === 'pending') {
        stats.totalPending++;
      } else if (req.status === 'approved') {
        stats.totalApproved++;
      } else if (req.status === 'rejected') {
        stats.totalRejected++;
      }

      // Count by entity type
      stats.byEntityType[req.entity_type] = (stats.byEntityType[req.entity_type] || 0) + 1;
    });

    // Compute average resolution time (only for completed requests)
    const completed = requests.filter((r) => r.completed_at);
    if (completed.length > 0) {
      const totalHours = completed.reduce((sum, req) => {
        const requested = new Date(req.requested_at).getTime();
        const completeTime = new Date(req.completed_at!).getTime();
        const hours = (completeTime - requested) / (1000 * 60 * 60);
        return sum + hours;
      }, 0);
      stats.avgResolutionHours = Math.round(totalHours / completed.length);
    }

    // Find oldest pending request
    const pending = requests.filter((r) => r.status === 'pending');
    if (pending.length > 0) {
      stats.oldestPending = pending.reduce((oldest, req) => {
        return new Date(req.requested_at) < new Date(oldest.requested_at) ? req : oldest;
      }).requested_at;
    }
  }

  return { stats, isLoading, error };
}

/**
 * Fetch action history for a specific approval request
 */
export function useApprovalActions(requestId: string) {
  return useQuery({
    queryKey: approvalKeys.actions(requestId),
    queryFn: async () => {
      const { data, error } = await db
        .from('approval_actions')
        .select(`
          *,
          actor:actor_id(id, display_name, full_name, avatar_url)
        `)
        .eq('request_id', requestId)
        .order('acted_at', { ascending: true });

      if (error) throw new Error(`Failed to fetch actions: ${error.message}`);
      return (data || []) as ApprovalActionRecord[];
    },
    staleTime: 60000, // 1 minute
  });
}

/**
 * Mutations for approval actions
 * 
 * LEARNING NOTE: Mutations modify data and invalidate caches.
 * We call these from UI event handlers (button clicks, form submissions).
 * The mutation functions do two things:
 * 1. Insert/update data in Supabase
 * 2. Invalidate query keys so React re-fetches fresh data
 */
export function useApprovalMutations() {
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: async ({
      requestId,
      actorId,
      comment,
      currentStep,
      totalSteps,
    }: {
      requestId: string;
      actorId: string;
      comment?: string;
      currentStep: number;
      totalSteps: number;
    }) => {
      // Insert action record
      const { error: actionError } = await db
        .from('approval_actions')
        .insert({
          request_id: requestId,
          step_order: currentStep,
          actor_id: actorId,
          action: 'approved',
          comment,
          acted_at: new Date().toISOString(),
        });

      if (actionError) throw actionError;

      // Update request status
      const isLastStep = currentStep === totalSteps;
      const { error: updateError } = await db
        .from('approval_requests')
        .update({
          status: isLastStep ? 'approved' : 'pending',
          current_step: isLastStep ? currentStep : currentStep + 1,
          completed_at: isLastStep ? new Date().toISOString() : null,
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      return { requestId, isLastStep };
    },
    onSuccess: () => {
      // Invalidate all relevant approval caches
      queryClient.invalidateQueries({ queryKey: approvalKeys.requests });
      queryClient.invalidateQueries({ queryKey: approvalKeys.stats });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({
      requestId,
      actorId,
      comment,
      currentStep,
    }: {
      requestId: string;
      actorId: string;
      comment: string;
      currentStep: number;
    }) => {
      // Insert action record
      const { error: actionError } = await db
        .from('approval_actions')
        .insert({
          request_id: requestId,
          step_order: currentStep,
          actor_id: actorId,
          action: 'rejected',
          comment,
          acted_at: new Date().toISOString(),
        });

      if (actionError) throw actionError;

      // Update request status
      const { error: updateError } = await db
        .from('approval_requests')
        .update({
          status: 'rejected',
          completed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      return { requestId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalKeys.requests });
      queryClient.invalidateQueries({ queryKey: approvalKeys.stats });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({
      requestId,
      actorId,
      comment,
    }: {
      requestId: string;
      actorId: string;
      comment?: string;
    }) => {
      // Insert action record
      const { error: actionError } = await db
        .from('approval_actions')
        .insert({
          request_id: requestId,
          step_order: 0,
          actor_id: actorId,
          action: 'cancelled',
          comment,
          acted_at: new Date().toISOString(),
        });

      if (actionError) throw actionError;

      // Update request status
      const { error: updateError } = await db
        .from('approval_requests')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      return { requestId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalKeys.requests });
      queryClient.invalidateQueries({ queryKey: approvalKeys.stats });
    },
  });

  return {
    approve: approveMutation,
    reject: rejectMutation,
    cancel: cancelMutation,
  };
}
