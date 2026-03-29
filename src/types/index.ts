/**
 * PMO Platform — Shared TypeScript Types
 *
 * These interfaces EXACTLY mirror the Supabase database schema.
 * Field names match database column names 1:1 — no aliasing.
 *
 * Source of truth: public schema, project qffzpdhnrkfbkzgrnvsy
 * Last verified: 2026-03-28
 *
 * Why exact column name matching matters: Supabase's JS client returns
 * column names verbatim. If our type says `end_date` but the DB column
 * is `target_end`, every query returns undefined silently — no runtime
 * error, just missing data. TypeScript catches this at compile time only
 * if the types match the actual schema.
 */

// ─── ENUMS / UNION TYPES ─────────────────────────────────────────────────────
// These are enforced at the application layer — DB uses text columns with
// check constraints or no constraint (application-level enforcement).

// Status values match DB column values exactly — underscores, not hyphens.
// Confirmed from live data: active(92), completed(27), on_hold(16), planning(15)
export type ProjectStatus =
  | 'planning'
  | 'active'
  | 'on_track'
  | 'at_risk'
  | 'critical'
  | 'completed'
  | 'on_hold'
  | 'cancelled'

export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical'

export type ProjectClassification =
  | 'public'
  | 'internal'
  | 'business_use_only'
  | 'confidential'
  | 'restricted'

export type ProjectHealthStatus = 'green' | 'yellow' | 'red'

// Pulse model — S0-007
// Replaces raw number display with condition language across all personas.
export type PulseCondition = 'healthy' | 'watch' | 'elevated' | 'critical' | 'dormant'
export type PulseMomentum  = 'recovering' | 'stable' | 'declining' | 'volatile'
export type PulseSignal    = 'budget' | 'schedule' | 'delivery' | 'scope' | 'risks' | 'execution'

// ─── PROJECT ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  program_id: string | null
  name: string
  code: string | null
  description: string | null
  owner_id: string | null
  status: ProjectStatus
  priority: ProjectPriority
  category: string | null
  vertical: string | null
  start_date: string | null          // ISO date string (date, not timestamp)
  target_end: string | null          // End date — DB column is target_end, not end_date
  actual_end: string | null
  budget_total: number | null
  budget_spent: number | null        // Defaults to 0 in DB
  health_score: number | null        // 0–100; computed by ML engine
  health_status: ProjectHealthStatus | null  // 'green' | 'yellow' | 'red'
  health_updated: string | null
  risk_score: number | null          // 0–100; ML-predicted risk
  risk_factors: Record<string, unknown>[]    // jsonb array
  metadata: Record<string, unknown>          // jsonb object
  tags: string[]
  classification: ProjectClassification
  scored_at: string | null
  // Pulse model — S0-007. Replaces raw number display for all personas.
  pulse_condition:  PulseCondition | null    // healthy/watch/elevated/critical/dormant
  pulse_momentum:   PulseMomentum | null     // recovering/stable/declining/volatile
  pulse_signals:    PulseSignal[] | null     // elevated signal dimensions: budget, schedule, …
  pulse_updated_at: string | null
  created_at: string
  updated_at: string
}

// ─── SPRINT ───────────────────────────────────────────────────────────────────

export type SprintStatus = 'planned' | 'active' | 'completed' | 'cancelled'

export interface Sprint {
  id: string
  project_id: string
  phase_id: string | null
  name: string
  goal: string | null
  sprint_number: number
  status: SprintStatus
  start_date: string                 // date type — ISO date string
  end_date: string
  capacity_points: number | null
  committed_pts: number | null       // Story points committed at sprint start
  completed_pts: number | null       // Story points completed
  velocity: number | null            // Actual velocity (completed_pts / capacity)
  retro_notes: string | null
  created_at: string
  updated_at: string
}

// ─── PROFILE / USER ───────────────────────────────────────────────────────────
// The `profiles` table extends auth.users. Survives auth provider migration.

export type ProfileRole =
  | 'admin'
  | 'program_manager'
  | 'project_manager'
  | 'developer'
  | 'viewer'

export interface Profile {
  id: string
  email: string
  full_name: string
  display_name: string | null
  avatar_url: string | null
  role: ProfileRole
  department: string | null
  title: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── RISK ─────────────────────────────────────────────────────────────────────

export type RiskType = 'risk' | 'issue' | 'dependency'
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical'
export type RiskStatus = 'open' | 'mitigated' | 'accepted' | 'closed'

export interface Risk {
  id: string
  project_id: string
  type: RiskType                     // 'risk' | 'issue' | 'dependency'
  title: string
  description: string | null
  category: string | null
  probability: number | null         // 0–1
  impact: number | null              // 0–1
  risk_score: number | null          // probability * impact * 100
  mitigation: string | null
  resolution: string | null
  owner_id: string | null
  status: RiskStatus
  severity: RiskSeverity | null
  raised_by: string | null
  raised_date: string | null
  target_date: string | null         // DB column: target_date (not due_date)
  resolved_date: string | null
  ai_generated: boolean              // DB column: ai_generated (not ml_flagged)
  created_at: string
  updated_at: string
}

// ─── ALLOCATION ───────────────────────────────────────────────────────────────

export interface Allocation {
  id: string
  user_id: string
  project_id: string
  role_on_project: string | null
  allocation_pct: number             // 0–100; % of time allocated to this project
  start_date: string
  end_date: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── PROGRAM ──────────────────────────────────────────────────────────────────

export interface Program {
  id: string
  name: string
  description: string | null
  owner_id: string | null
  status: string
  created_at: string
  updated_at: string
}

// ─── QUERY HELPERS ───────────────────────────────────────────────────────────

/**
 * A project row enriched with joined data — used when the query
 * joins profiles, programs, or risk counts.
 */
export interface ProjectWithMeta extends Project {
  owner?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>
  program?: Pick<Program, 'id' | 'name'>
  open_risks?: number
}

/**
 * Summary stats for the portfolio header bar.
 */
export interface PortfolioStats {
  total: number
  onTrack: number
  atRisk: number
  critical: number
  avgHealthScore: number
}
