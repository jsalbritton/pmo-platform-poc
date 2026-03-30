/**
 * Approval Workflow State Machine
 * 
 * This XState v5 machine manages the lifecycle of an approval request
 * as it moves through multiple approval steps in a workflow.
 * 
 * LEARNING NOTES FOR JEREMY:
 * - XState v5 uses the setup() + createMachine() pattern
 * - Context holds the mutable state (request data, history)
 * - Events are dispatched from UI or API calls
 * - Guards check conditions before allowing transitions
 * - Actions execute side effects (recording history, updating data)
 * - Sub-states let us model each approval step as distinct
 */

import { setup, assign } from 'xstate';

/**
 * ApprovalAction: Records who did what and when in the approval process
 * This gets persisted to approval_actions table for audit trail
 */
export interface ApprovalAction {
  actor_id: string;
  action: 'submitted' | 'approved' | 'rejected' | 'requested_changes' | 'cancelled' | 'expired';
  comment?: string;
  acted_at: string; // ISO 8601 timestamp
}

/**
 * ApprovalContext: Machine state that persists across transitions
 * LEARNING NOTE: Context in XState is the "memory" of the state machine.
 * Guards and actions can read/modify this to make decisions.
 */
export interface ApprovalContext {
  requestId: string;
  workflowId: string;
  entityType: 'work_item' | 'budget_change' | 'resource_allocation' | 'project_status' | 'scope_change';
  entityId: string;
  projectId: string;
  currentStep: number;
  totalSteps: number;
  metadata: Record<string, unknown>;
  history: ApprovalAction[]; // Audit trail of all actions taken
  currentActor: string | null; // UUID of user taking action
  rejectionReason?: string; // If rejected, why?
}

/**
 * Events that trigger state transitions
 * LEARNING NOTE: Events are the inputs to the state machine.
 * Each event can carry a payload (data object).
 */
export type ApprovalEvent =
  | { type: 'SUBMIT'; actor: string }
  | { type: 'APPROVE'; actor: string; comment?: string }
  | { type: 'REJECT'; actor: string; comment: string }
  | { type: 'REQUEST_CHANGES'; actor: string; comment: string }
  | { type: 'ADVANCE_STEP' }
  | { type: 'CANCEL'; actor: string; comment?: string }
  | { type: 'EXPIRE' };

/**
 * Create the approval workflow machine
 * LEARNING NOTE: setup() declares guards and actions before the machine definition.
 * This makes them reusable and testable.
 */
const approvalMachine = setup({
  types: {
    context: {} as ApprovalContext,
    events: {} as ApprovalEvent,
    input: {} as ApprovalContext,
  },
  guards: {
    /**
     * canAdvance: Can we move to the next step?
     * LEARNING NOTE: Guards are pure functions that return boolean.
     * They prevent invalid transitions (e.g., moving to step 10 when there are only 5 steps).
     */
    canAdvance: ({ context }) => context.currentStep < context.totalSteps,

    /**
     * isLastStep: Are we at the final approval step?
     */
    isLastStep: ({ context }) => context.currentStep === context.totalSteps,

    /**
     * hasPermission: Does the current actor have permission to approve?
     * In a real app, you'd check the approver_type/approver_value from approval_steps.
     * For now, we assume permission is validated before dispatching the event.
     */
    hasPermission: ({ context }) => {
      return context.currentActor !== null;
    },
  },
  actions: {
    /**
     * recordAction: Add an action to the audit trail
     * LEARNING NOTE: Actions in XState use assign() to update context.
     * They're side-effect free (no DB calls here—mutations happen via React hooks).
     */
    recordAction: assign({
      history: ({ context, event }) => {
        if (event.type === 'SUBMIT') {
          return [
            ...context.history,
            {
              actor_id: event.actor,
              action: 'submitted' as const,
              acted_at: new Date().toISOString(),
            },
          ];
        }
        if (event.type === 'APPROVE') {
          return [
            ...context.history,
            {
              actor_id: event.actor,
              action: 'approved' as const,
              comment: event.comment,
              acted_at: new Date().toISOString(),
            },
          ];
        }
        if (event.type === 'REJECT') {
          return [
            ...context.history,
            {
              actor_id: event.actor,
              action: 'rejected' as const,
              comment: event.comment,
              acted_at: new Date().toISOString(),
            },
          ];
        }
        if (event.type === 'REQUEST_CHANGES') {
          return [
            ...context.history,
            {
              actor_id: event.actor,
              action: 'requested_changes' as const,
              comment: event.comment,
              acted_at: new Date().toISOString(),
            },
          ];
        }
        if (event.type === 'CANCEL') {
          return [
            ...context.history,
            {
              actor_id: event.actor,
              action: 'cancelled' as const,
              comment: event.comment,
              acted_at: new Date().toISOString(),
            },
          ];
        }
        return context.history;
      },
    }),

    /**
     * advanceStep: Move to the next approval step
     * This happens after an approval succeeds and we're not at the last step
     */
    advanceStep: assign({
      currentStep: ({ context }) => context.currentStep + 1,
    }),

    /**
     * storeRejectionReason: Save why a request was rejected
     */
    storeRejectionReason: assign({
      rejectionReason: ({ event }) => {
        return event.type === 'REJECT' ? event.comment : undefined;
      },
    }),

    /**
     * clearActor: Reset currentActor after action is recorded
     */
    clearActor: assign({
      currentActor: null,
    }),
  },
}).createMachine({
  /**
   * Machine root: initial state is 'idle'
   * LEARNING NOTE: A state machine starts in the initial state.
   * From there, it can only transition via valid events.
   */
  id: 'approval-workflow',
  initial: 'idle',
  context: ({ input }: { input: ApprovalContext }): ApprovalContext => ({
    ...input,
  }),

  states: {
    /**
     * idle: Request hasn't been submitted yet
     * Valid transitions: SUBMIT -> submitted
     */
    idle: {
      on: {
        SUBMIT: {
          target: 'submitted',
          actions: ['recordAction'],
        },
      },
    },

    /**
     * submitted: Request has been created and is waiting for review
     * Transitions to 'reviewing' and enters the first step's sub-state
     */
    submitted: {
      always: {
        target: 'reviewing.step_1',
      },
    },

    /**
     * reviewing: Compound state for the approval process
     * LEARNING NOTE: Compound states have sub-states. Here, we have step_1, step_2, etc.
     * Each step is a separate sub-state for clarity and to track progress.
     * 
     * In a real app, you'd dynamically create these based on totalSteps.
     * For now, we'll support up to step_5 as an example.
     */
    reviewing: {
      initial: 'step_1',
      states: {
        /**
         * step_1 through step_5: Distinct approval steps
         * Each step can be approved (advance), rejected, or request changes (go back).
         */
        step_1: {
          on: {
            APPROVE: [
              {
                guard: 'isLastStep',
                target: '#approval-workflow.approved',
                actions: ['recordAction'],
              },
              {
                target: 'step_2',
                actions: ['recordAction', 'advanceStep'],
              },
            ],
            REJECT: {
              target: '#approval-workflow.rejected',
              actions: ['recordAction', 'storeRejectionReason'],
            },
            REQUEST_CHANGES: {
              target: '#approval-workflow.submitted',
              actions: ['recordAction'],
            },
          },
        },

        step_2: {
          on: {
            APPROVE: [
              {
                guard: 'isLastStep',
                target: '#approval-workflow.approved',
                actions: ['recordAction'],
              },
              {
                target: 'step_3',
                actions: ['recordAction', 'advanceStep'],
              },
            ],
            REJECT: {
              target: '#approval-workflow.rejected',
              actions: ['recordAction', 'storeRejectionReason'],
            },
            REQUEST_CHANGES: {
              target: 'step_1',
              actions: ['recordAction'],
            },
          },
        },

        step_3: {
          on: {
            APPROVE: [
              {
                guard: 'isLastStep',
                target: '#approval-workflow.approved',
                actions: ['recordAction'],
              },
              {
                target: 'step_4',
                actions: ['recordAction', 'advanceStep'],
              },
            ],
            REJECT: {
              target: '#approval-workflow.rejected',
              actions: ['recordAction', 'storeRejectionReason'],
            },
            REQUEST_CHANGES: {
              target: 'step_2',
              actions: ['recordAction'],
            },
          },
        },

        step_4: {
          on: {
            APPROVE: [
              {
                guard: 'isLastStep',
                target: '#approval-workflow.approved',
                actions: ['recordAction'],
              },
              {
                target: 'step_5',
                actions: ['recordAction', 'advanceStep'],
              },
            ],
            REJECT: {
              target: '#approval-workflow.rejected',
              actions: ['recordAction', 'storeRejectionReason'],
            },
            REQUEST_CHANGES: {
              target: 'step_3',
              actions: ['recordAction'],
            },
          },
        },

        step_5: {
          on: {
            APPROVE: {
              target: '#approval-workflow.approved',
              actions: ['recordAction'],
            },
            REJECT: {
              target: '#approval-workflow.rejected',
              actions: ['recordAction', 'storeRejectionReason'],
            },
            REQUEST_CHANGES: {
              target: 'step_4',
              actions: ['recordAction'],
            },
          },
        },
      },

      /**
       * While in reviewing state, handle cancellation and expiration
       */
      on: {
        CANCEL: {
          target: 'cancelled',
          actions: ['recordAction'],
        },
        EXPIRE: {
          target: 'expired',
          actions: ['recordAction'],
        },
      },
    },

    /**
     * approved: Terminal state—request was fully approved
     * No further transitions from here
     */
    approved: {
      type: 'final',
    },

    /**
     * rejected: Terminal state—request was rejected at some step
     * No further transitions from here
     */
    rejected: {
      type: 'final',
    },

    /**
     * cancelled: Terminal state—request was manually cancelled
     */
    cancelled: {
      type: 'final',
    },

    /**
     * expired: Terminal state—SLA was exceeded without completion
     */
    expired: {
      type: 'final',
    },
  },
});

export { approvalMachine };
export type ApprovalMachine = typeof approvalMachine;
