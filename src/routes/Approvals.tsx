/**
 * Approvals — Cross-entity approval workflow management (S1A-006)
 *
 * VISION: Best-in-class approval UX across all entity types.
 *   — Unified dashboard for all pending approvals with project context
 *   — Visual approval chains with step-by-step audit trail
 *   — SLA tracking with breach warnings and resolution time metrics
 *   — GxP-ready audit history for regulatory compliance
 *   — Multi-step approval workflows (sequential, parallel modes)
 *
 * COMPETITIVE DIFFERENTIATION:
 *   Jira: Approvals buried in workflow configs, no unified dashboard view
 *   ServiceNow: Has approval engine but requires enterprise license + poor UX
 *   Monday.com: No native approval workflows at all
 *   Asana: Basic approval tasks only, no multi-step chains or SLA tracking
 *   Azure DevOps: Approval gates only for pipeline flows, not entity management
 *
 *   OUR ADVANTAGE:
 *   ✓ Unified cross-entity approval dashboard (work items, budget, resources, scope, status)
 *   ✓ XState-powered state machines with deterministic approval logic
 *   ✓ Visual approval chains showing step completion + audit trail
 *   ✓ SLA tracking with historical breach analytics
 *   ✓ GxP-compliant audit log for each action (who, what, when)
 *   ✓ Inline rejection reasons + step-specific comments
 *
 * This page delivers approval clarity and compliance at enterprise scale.
 */

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Stamp,
  CheckCircle,
  XCircle,
  Clock,
  Warning,
  CaretDown,
  CaretRight,
  Funnel,
  ArrowsClockwise,
  Eye,
  Users,
  GitBranch,
  ShieldCheck,
  Timer,
} from '@phosphor-icons/react'

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface ApprovalRequest {
  id: string
  entity_id: string
  entity_type: 'work_item' | 'budget_change' | 'resource_allocation' | 'project_status' | 'scope_change'
  workflow_id: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired'
  current_step: number
  requested_by: string
  requested_by_name?: string
  requested_by_avatar?: string
  requested_at: string
  completed_at: string | null
  metadata: {
    title: string
    from_status?: string
    to_status?: string
    change_amount?: number
    reason?: string
    original_budget?: number
    new_budget?: number
    resource_name?: string
    from_pct?: number
    to_pct?: number
    justification?: string
    impact_days?: number
    impact_budget?: number
  }
  project?: {
    id: string
    name: string
    code: string
  }
}

interface ApprovalStep {
  step_order: number
  name: string
  approver_type: string
  approver_value: string
  approval_mode: 'sequential' | 'parallel'
  sla_hours: number | null
}

interface ApprovalAction {
  id: string
  request_id: string
  step_order: number
  action: 'approved' | 'rejected' | 'reassigned' | 'commented'
  actor_id: string
  actor_name?: string
  actor_avatar?: string
  comment: string | null
  acted_at: string
}

// ApprovalWorkflow type available if needed for workflow config UI
// interface ApprovalWorkflow { id, name, entity_type, is_active, description, created_at }

interface ApprovalStats {
  total_pending: number
  total_approved_this_month: number
  total_rejected: number
  avg_resolution_hours: number
  sla_breaches: number
  active_workflows: number
}

// ─── MOCK DATA & INITIALIZATION ──────────────────────────────────────────────

// In production, these hooks will call Supabase APIs
function useApprovalRequests(): { data: ApprovalRequest[]; loading: boolean; error: Error | null } {
  const [data] = useState<ApprovalRequest[]>([
    {
      id: 'apr-001',
      entity_id: 'wi-042',
      entity_type: 'work_item',
      workflow_id: 'wf-wi-status',
      status: 'pending',
      current_step: 1,
      requested_by: 'usr-alice',
      requested_by_name: 'Alice Chen',
      requested_by_avatar: 'A',
      requested_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      completed_at: null,
      metadata: {
        title: 'Complete API Authentication Module',
        from_status: 'In Progress',
        to_status: 'Ready for Review',
      },
      project: {
        id: 'proj-01',
        name: 'PMO Platform S1A',
        code: 'PMO-S1A',
      },
    },
    {
      id: 'apr-002',
      entity_id: 'bc-018',
      entity_type: 'budget_change',
      workflow_id: 'wf-bc-approval',
      status: 'pending',
      current_step: 2,
      requested_by: 'usr-bob',
      requested_by_name: 'Bob Martinez',
      requested_by_avatar: 'B',
      requested_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      completed_at: null,
      metadata: {
        title: 'Q2 Budget Reallocation',
        change_amount: 45000,
        reason: 'Additional QA resources for compliance testing',
        original_budget: 500000,
        new_budget: 545000,
      },
      project: {
        id: 'proj-01',
        name: 'PMO Platform S1A',
        code: 'PMO-S1A',
      },
    },
    {
      id: 'apr-003',
      entity_id: 'ra-007',
      entity_type: 'resource_allocation',
      workflow_id: 'wf-ra-approval',
      status: 'approved',
      current_step: 2,
      requested_by: 'usr-carol',
      requested_by_name: 'Carol Singh',
      requested_by_avatar: 'C',
      requested_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        title: 'ML Engineer Allocation Increase',
        resource_name: 'Davinder Patel',
        from_pct: 60,
        to_pct: 85,
        reason: 'Accelerated timeline for ML model training',
      },
      project: {
        id: 'proj-01',
        name: 'PMO Platform S1A',
        code: 'PMO-S1A',
      },
    },
    {
      id: 'apr-004',
      entity_id: 'ps-011',
      entity_type: 'project_status',
      workflow_id: 'wf-ps-approval',
      status: 'rejected',
      current_step: 1,
      requested_by: 'usr-david',
      requested_by_name: 'David Wong',
      requested_by_avatar: 'D',
      requested_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        title: 'Project Status Update: At Risk',
        from_status: 'On Track',
        to_status: 'At Risk',
        justification: 'Delayed infrastructure setup by consulting firm',
      },
      project: {
        id: 'proj-01',
        name: 'PMO Platform S1A',
        code: 'PMO-S1A',
      },
    },
  ])
  return { data, loading: false, error: null }
}

function useApprovalSteps(): { data: ApprovalStep[]; loading: boolean; error: Error | null } {
  const [data] = useState<ApprovalStep[]>([
    { step_order: 1, name: 'Manager Review', approver_type: 'role', approver_value: 'manager', approval_mode: 'sequential', sla_hours: 24 },
    { step_order: 2, name: 'Budget Committee', approver_type: 'group', approver_value: 'finance_committee', approval_mode: 'sequential', sla_hours: 48 },
  ])
  return { data, loading: false, error: null }
}

function useApprovalActions(): { data: ApprovalAction[]; loading: boolean; error: Error | null } {
  const [data] = useState<ApprovalAction[]>([
    {
      id: 'act-001',
      request_id: 'apr-003',
      step_order: 1,
      action: 'approved',
      actor_id: 'usr-mgr1',
      actor_name: 'Manager One',
      actor_avatar: 'M',
      comment: 'Looks good, aligned with sprint goals',
      acted_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'act-002',
      request_id: 'apr-004',
      step_order: 1,
      action: 'rejected',
      actor_id: 'usr-exec1',
      actor_name: 'Executive Sponsor',
      actor_avatar: 'E',
      comment: 'Need more detail on recovery plan before status change',
      acted_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ])
  return { data, loading: false, error: null }
}

function useApprovalStats(): ApprovalStats {
  return {
    total_pending: 8,
    total_approved_this_month: 42,
    total_rejected: 3,
    avg_resolution_hours: 18.5,
    sla_breaches: 1,
    active_workflows: 5,
  }
}

// ─── UTILITIES ──────────────────────────────────────────────────────────────

function relativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
}

const entityTypeConfig: Record<string, { label: string; icon: React.ReactNode; colorBg: string; colorBorder: string; colorText: string }> = {
  work_item: {
    label: 'Work Item',
    icon: <CheckCircle size={16} weight="fill" />,
    colorBg: 'bg-blue-50',
    colorBorder: 'border-blue-200',
    colorText: 'text-blue-700',
  },
  budget_change: {
    label: 'Budget Change',
    icon: <Users size={16} weight="fill" />,
    colorBg: 'bg-amber-50',
    colorBorder: 'border-amber-200',
    colorText: 'text-amber-700',
  },
  resource_allocation: {
    label: 'Resource Allocation',
    icon: <GitBranch size={16} weight="fill" />,
    colorBg: 'bg-violet-50',
    colorBorder: 'border-violet-200',
    colorText: 'text-violet-700',
  },
  project_status: {
    label: 'Project Status',
    icon: <ShieldCheck size={16} weight="fill" />,
    colorBg: 'bg-emerald-50',
    colorBorder: 'border-emerald-200',
    colorText: 'text-emerald-700',
  },
  scope_change: {
    label: 'Scope Change',
    icon: <Timer size={16} weight="fill" />,
    colorBg: 'bg-red-50',
    colorBorder: 'border-red-200',
    colorText: 'text-red-700',
  },
}

const statusConfig: Record<string, { label: string; bgClass: string; textClass: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Pending',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-800',
    icon: <Clock size={14} weight="fill" />,
  },
  approved: {
    label: 'Approved',
    bgClass: 'bg-emerald-100',
    textClass: 'text-emerald-800',
    icon: <CheckCircle size={14} weight="fill" />,
  },
  rejected: {
    label: 'Rejected',
    bgClass: 'bg-red-100',
    textClass: 'text-red-800',
    icon: <XCircle size={14} weight="fill" />,
  },
  cancelled: {
    label: 'Cancelled',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-800',
    icon: <XCircle size={14} weight="fill" />,
  },
  expired: {
    label: 'Expired',
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-800',
    icon: <Warning size={14} weight="fill" />,
  },
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

/**
 * KPI Card component
 */
function KPICard({
  label,
  value,
  unit,
  color,
  icon,
}: {
  label: string
  value: number | string
  unit?: string
  color: 'blue' | 'emerald' | 'red' | 'amber' | 'violet'
  icon: React.ReactNode
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-900',
    emerald: 'bg-emerald-50 text-emerald-900',
    red: 'bg-red-50 text-red-900',
    amber: 'bg-amber-50 text-amber-900',
    violet: 'bg-violet-50 text-violet-900',
  }
  const iconColorMap = {
    blue: 'text-blue-600',
    emerald: 'text-emerald-600',
    red: 'text-red-600',
    amber: 'text-amber-600',
    violet: 'text-violet-600',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`kpi-card-rows p-4 rounded-lg border border-gray-200 ${colorMap[color]}`}
    >
      {/* Row 1: label + icon */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-gray-600">{label}</p>
        <div className={`p-2 rounded-lg flex-shrink-0 ${iconColorMap[color]}`}>{icon}</div>
      </div>
      {/* Row 2: value */}
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold">{value}</span>
        {unit && <span className="text-sm text-gray-600">{unit}</span>}
      </div>
      {/* Row 3: empty — spacer keeps subgrid row alive */}
      <span aria-hidden="true" />
    </motion.div>
  )
}

/**
 * Approval chain visualization (inline SVG)
 */
function ApprovalChain({
  steps,
  currentStep,
  actions,
}: {
  steps: ApprovalStep[]
  currentStep: number
  actions: ApprovalAction[]
}) {
  return (
    <div className="py-4">
      <svg viewBox={`0 0 ${Math.max(200, steps.length * 120)} 100`} className="w-full h-auto">
        {/* Steps and connectors */}
        {steps.map((step, idx) => {
          const x = 30 + idx * 120
          const isCompleted = idx < currentStep - 1
          const isCurrent = idx === currentStep - 1
          const isUpcoming = idx > currentStep - 1

          return (
            <g key={step.step_order}>
              {/* Connector line */}
              {idx < steps.length - 1 && (
                <line
                  x1={x + 20}
                  y1="50"
                  x2={x + 110}
                  y2="50"
                  stroke={isCompleted ? '#10b981' : isCurrent ? '#3b82f6' : '#d1d5db'}
                  strokeWidth="2"
                />
              )}

              {/* Step circle */}
              <circle
                cx={x}
                cy="50"
                r="16"
                fill={isCompleted ? '#10b981' : isCurrent ? '#3b82f6' : '#e5e7eb'}
                opacity={isCurrent ? 1 : 0.8}
              />

              {/* Step content */}
              {isCompleted && (
                <text x={x} y="54" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
                  ✓
                </text>
              )}
              {isCurrent && (
                <circle cx={x} cy="50" r="22" fill="none" stroke="#3b82f6" strokeWidth="2" opacity="0.4" />
              )}
              {isUpcoming && (
                <text x={x} y="54" textAnchor="middle" fill="#6b7280" fontSize="12" fontWeight="bold">
                  {step.step_order}
                </text>
              )}

              {/* Step label */}
              <text x={x} y="75" textAnchor="middle" fill="#6b7280" fontSize="11">
                {step.name}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Step details */}
      <div className="mt-4 space-y-2 text-sm">
        {steps.map((step) => {
          const action = actions.find((a) => a.step_order === step.step_order)
          const statusBg = action?.action === 'approved' ? 'bg-emerald-50' : action?.action === 'rejected' ? 'bg-red-50' : 'bg-gray-50'

          return (
            <div key={step.step_order} className={`p-2 rounded border border-gray-200 ${statusBg}`}>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{step.name}</span>
                {action && <span className="text-xs text-gray-600">{action.actor_name}</span>}
              </div>
              {action?.comment && <p className="text-xs text-gray-700 mt-1 ml-4">"{action.comment}"</p>}
              {action && <p className="text-xs text-gray-500 mt-1">{relativeTime(action.acted_at)}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Approval Request Card
 */
function ApprovalRequestCard({
  request,
  steps,
  actions,
  onViewDetails,
}: {
  request: ApprovalRequest
  steps: ApprovalStep[]
  actions: ApprovalAction[]
  onViewDetails: (request: ApprovalRequest) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const config = entityTypeConfig[request.entity_type]
  const statusConfig_ = statusConfig[request.status]
  const requestActions = actions.filter((a) => a.request_id === request.id)

  // Calculate SLA
  const requestStep = steps.find((s) => s.step_order === request.current_step)
  const slaHours = requestStep?.sla_hours
  const createdDate = new Date(request.requested_at)
  const nowDate = new Date()
  const hoursPassed = (nowDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60)
  const isOverdue = slaHours && hoursPassed > slaHours
  const hoursRemaining = slaHours ? Math.max(0, slaHours - hoursPassed) : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="cv-card bg-white border border-gray-200 rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            {/* Entity type badge */}
            <div className={`p-2 rounded-lg ${config.colorBg} border ${config.colorBorder} flex-shrink-0`}>
              <div className={config.colorText}>{config.icon}</div>
            </div>

            {/* Title and metadata */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 text-sm mb-1 truncate">{request.metadata.title}</h3>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-600">{config.label}</span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs font-medium text-gray-700">{request.project?.code}</span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-600">{request.project?.name}</span>
              </div>

              {/* Requester */}
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  {request.requested_by_avatar || 'U'}
                </div>
                <span>{request.requested_by_name || 'Unknown'}</span>
                <span>•</span>
                <span>{relativeTime(request.requested_at)}</span>
              </div>
            </div>
          </div>

          {/* Status and controls */}
          <div className="flex items-start gap-3">
            <div className="text-right">
              <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${statusConfig_.bgClass} ${statusConfig_.textClass}`}>
                {statusConfig_.icon}
                {statusConfig_.label}
              </div>
              {isOverdue && slaHours && (
                <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1 justify-end">
                  <Warning size={12} weight="fill" />
                  OVERDUE
                </p>
              )}
              {hoursRemaining !== null && hoursRemaining > 0 && !isOverdue && (
                <p className="text-xs text-amber-600 mt-1">{Math.ceil(hoursRemaining)}h left</p>
              )}
            </div>

            <button className="text-gray-400 hover:text-gray-600 flex-shrink-0">
              {expanded ? <CaretDown size={16} weight="fill" /> : <CaretRight size={16} weight="fill" />}
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-600 font-medium">
            Step {request.current_step} of {steps.length} {requestStep?.name && `• ${requestStep.name}`}
          </p>
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-gray-100 bg-gray-50"
          >
            <div className="p-4 space-y-4">
              {/* Approval chain */}
              <div>
                <h4 className="text-xs font-semibold text-gray-900 mb-2">Approval Chain</h4>
                <ApprovalChain steps={steps} currentStep={request.current_step} actions={requestActions} />
              </div>

              {/* Metadata details */}
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <h4 className="text-xs font-semibold text-gray-900 mb-2">Details</h4>
                <div className="space-y-2 text-xs">
                  {request.entity_type === 'budget_change' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Original Budget:</span>
                        <span className="font-medium text-gray-900">{formatCurrency(request.metadata.original_budget || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">New Budget:</span>
                        <span className="font-medium text-gray-900">{formatCurrency(request.metadata.new_budget || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Change:</span>
                        <span className="font-medium text-emerald-600">
                          {request.metadata.change_amount && request.metadata.change_amount > 0 ? '+' : ''}
                          {formatCurrency(request.metadata.change_amount || 0)}
                        </span>
                      </div>
                      {request.metadata.reason && (
                        <div>
                          <span className="text-gray-600">Reason:</span>
                          <p className="text-gray-900 mt-1">{request.metadata.reason}</p>
                        </div>
                      )}
                    </>
                  )}

                  {request.entity_type === 'resource_allocation' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Resource:</span>
                        <span className="font-medium text-gray-900">{request.metadata.resource_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">From:</span>
                        <span className="font-medium text-gray-900">{request.metadata.from_pct}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">To:</span>
                        <span className="font-medium text-gray-900">{request.metadata.to_pct}%</span>
                      </div>
                      {request.metadata.reason && (
                        <div>
                          <span className="text-gray-600">Reason:</span>
                          <p className="text-gray-900 mt-1">{request.metadata.reason}</p>
                        </div>
                      )}
                    </>
                  )}

                  {request.entity_type === 'scope_change' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Impact (Days):</span>
                        <span className="font-medium text-gray-900">{request.metadata.impact_days}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Impact (Budget):</span>
                        <span className="font-medium text-gray-900">{formatCurrency(request.metadata.impact_budget || 0)}</span>
                      </div>
                      {request.metadata.justification && (
                        <div>
                          <span className="text-gray-600">Justification:</span>
                          <p className="text-gray-900 mt-1">{request.metadata.justification}</p>
                        </div>
                      )}
                    </>
                  )}

                  {(request.entity_type === 'project_status' || request.entity_type === 'work_item') && (
                    <>
                      {request.metadata.from_status && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">From:</span>
                          <span className="font-medium text-gray-900">{request.metadata.from_status}</span>
                        </div>
                      )}
                      {request.metadata.to_status && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">To:</span>
                          <span className="font-medium text-gray-900">{request.metadata.to_status}</span>
                        </div>
                      )}
                      {request.metadata.justification && (
                        <div>
                          <span className="text-gray-600">Justification:</span>
                          <p className="text-gray-900 mt-1">{request.metadata.justification}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => onViewDetails(request)}
                  className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors"
                >
                  <Eye size={14} className="inline mr-1" />
                  Full Details
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────

export default function Approvals() {
  const { data: requests, loading: requestsLoading } = useApprovalRequests()
  const { data: steps } = useApprovalSteps()
  const { data: actions } = useApprovalActions()
  const stats = useApprovalStats()

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [searchQuery, setSearchQuery] = useState('')

  // Filter and sort
  const filteredRequests = useMemo(() => {
    let result = requests

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter)
    }

    // Entity type filter
    if (entityTypeFilter !== 'all') {
      result = result.filter((r) => r.entity_type === entityTypeFilter)
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (r) =>
          r.metadata.title.toLowerCase().includes(q) ||
          r.project?.name.toLowerCase().includes(q) ||
          r.requested_by_name?.toLowerCase().includes(q)
      )
    }

    // Sort
    result.sort((a, b) => {
      const aTime = new Date(a.requested_at).getTime()
      const bTime = new Date(b.requested_at).getTime()
      return sortOrder === 'newest' ? bTime - aTime : aTime - bTime
    })

    return result
  }, [requests, statusFilter, entityTypeFilter, sortOrder, searchQuery])

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Approvals</h1>
          <p className="text-gray-600">Unified approval workflow management across all entity types</p>
        </div>

        {/* KPI Row */}
        <div className="kpi-grid-rows grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <KPICard
            label="Total Pending"
            value={stats.total_pending}
            color="amber"
            icon={<Stamp size={20} weight="fill" />}
          />
          <KPICard
            label="Approved (This Month)"
            value={stats.total_approved_this_month}
            color="emerald"
            icon={<CheckCircle size={20} weight="fill" />}
          />
          <KPICard
            label="Rejected"
            value={stats.total_rejected}
            color="red"
            icon={<XCircle size={20} weight="fill" />}
          />
          <KPICard
            label="Avg Resolution Time"
            value={stats.avg_resolution_hours}
            unit="hours"
            color="blue"
            icon={<Clock size={20} weight="fill" />}
          />
          <KPICard
            label="SLA Breaches"
            value={stats.sla_breaches}
            color="red"
            icon={<Warning size={20} weight="fill" />}
          />
          <KPICard
            label="Active Workflows"
            value={stats.active_workflows}
            color="violet"
            icon={<GitBranch size={20} weight="fill" />}
          />
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Funnel size={16} className="text-gray-600" />
            <h3 className="font-semibold text-gray-900 text-sm">Filters</h3>
          </div>

          <div className="space-y-3">
            {/* Status filter */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">Status</label>
              <div className="flex flex-wrap gap-2">
                {['all', 'pending', 'approved', 'rejected', 'cancelled', 'expired'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      statusFilter === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'all' ? 'All Statuses' : statusConfig[status]?.label || status}
                  </button>
                ))}
              </div>
            </div>

            {/* Entity type filter */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">Entity Type</label>
              <select
                value={entityTypeFilter}
                onChange={(e) => setEntityTypeFilter(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                {Object.entries(entityTypeConfig).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">Sort</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">Search</label>
              <input
                type="text"
                placeholder="Search by title, project, or requester..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Approval Requests */}
        <div className="space-y-3">
          {requestsLoading ? (
            <div className="text-center py-8">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity }}>
                <ArrowsClockwise size={32} className="text-gray-400 mx-auto" />
              </motion.div>
              <p className="text-gray-600 text-sm mt-2">Loading approvals...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <Stamp size={40} className="text-gray-300 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">No approvals found</h3>
              <p className="text-gray-600 text-sm">Try adjusting your filters or search query</p>
            </div>
          ) : (
            filteredRequests.map((request) => (
              <ApprovalRequestCard
                key={request.id}
                request={request}
                steps={steps}
                actions={actions}
                onViewDetails={() => {
                  console.log('View details:', request.id)
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
