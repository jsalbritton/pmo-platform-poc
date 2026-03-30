/**
 * useResources — data hooks for the resources/team domain
 *
 * PATTERN: each hook = queryKey + queryFn + TanStack Query options.
 * Resources domain manages team members, allocations, utilization analytics.
 */

import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/supabase'
import type { Allocation, Project } from '@/types'

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface AllocationWithProject extends Allocation {
  project: Pick<Project, 'id' | 'name' | 'code' | 'status' | 'health_score'> | null
}

export interface TeamMember {
  id: string
  full_name: string
  display_name: string | null
  role: string
  department: string | null
  title: string | null
  avatar_url: string | null
  is_active: boolean
  allocations: AllocationWithProject[]
  total_allocation: number  // sum of allocation_pct across all projects
}

export interface DepartmentStats {
  department: string
  headcount: number
  avgUtilization: number
  overAllocated: number
  underUtilized: number
  optimallyAllocated: number
  members: TeamMember[]
}

export interface ResourceStats {
  totalPeople: number
  avgUtilization: number
  overAllocated: number
  underUtilized: number
  optimallyAllocated: number
  totalAllocations: number
}

// ─── QUERY KEYS ───────────────────────────────────────────────────────────────

export const resourceKeys = {
  all: () => ['resources'] as const,
  team: () => ['resources', 'team'] as const,
  stats: () => ['resources', 'stats'] as const,
  departments: () => ['resources', 'departments'] as const,
}

// ─── FETCH FUNCTIONS ────────────────────────────────────────────────────────

/**
 * Fetch all active team members with their project allocations.
 * Returns structured TeamMember objects with computed total_allocation.
 */
async function fetchTeamWithAllocations(): Promise<TeamMember[]> {
  // Get all active profiles, ordered by name
  const { data: profiles, error: profErr } = await db
    .from('profiles')
    .select('id, full_name, display_name, role, department, title, avatar_url, is_active')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  if (profErr) throw new Error(`Failed to fetch profiles: ${profErr.message}`)

  // Get all active allocations with joined project metadata
  const { data: allocations, error: allocErr } = await db
    .from('allocations')
    .select('*, project:projects!project_id(id, name, code, status, health_score)')
    .eq('is_active', true)

  if (allocErr) throw new Error(`Failed to fetch allocations: ${allocErr.message}`)

  // Build team member objects with their allocations
  const allocs = (allocations ?? []) as AllocationWithProject[]
  return (profiles ?? []).map(p => {
    const memberAllocs = allocs.filter(a => a.user_id === p.id)
    const totalAlloc = memberAllocs.reduce((sum, a) => sum + (a.allocation_pct ?? 0), 0)
    return {
      ...p,
      allocations: memberAllocs,
      total_allocation: totalAlloc,
    }
  })
}

/**
 * Compute overall resource statistics across all team members.
 */
async function computeResourceStats(): Promise<ResourceStats> {
  const team = await fetchTeamWithAllocations()
  const totalPeople = team.length
  const utilizations = team.map(m => m.total_allocation)
  const avgUtilization = totalPeople > 0
    ? Math.round(utilizations.reduce((a, b) => a + b, 0) / totalPeople)
    : 0

  return {
    totalPeople,
    avgUtilization,
    overAllocated: team.filter(m => m.total_allocation > 100).length,
    underUtilized: team.filter(m => m.total_allocation < 50 && m.total_allocation > 0).length,
    optimallyAllocated: team.filter(m => m.total_allocation >= 50 && m.total_allocation <= 100).length,
    totalAllocations: team.reduce((s, m) => s + m.allocations.length, 0),
  }
}

/**
 * Compute per-department utilization and allocation statistics.
 */
async function computeDepartmentStats(): Promise<DepartmentStats[]> {
  const team = await fetchTeamWithAllocations()
  
  // Group team members by department
  const deptMap = new Map<string, TeamMember[]>()
  team.forEach(m => {
    const dept = m.department ?? 'Unassigned'
    if (!deptMap.has(dept)) deptMap.set(dept, [])
    deptMap.get(dept)!.push(m)
  })

  // Compute stats per department
  return Array.from(deptMap.entries())
    .map(([department, members]) => {
      const totalAlloc = members.reduce((s, m) => s + m.total_allocation, 0)
      return {
        department,
        headcount: members.length,
        avgUtilization: Math.round(totalAlloc / members.length),
        overAllocated: members.filter(m => m.total_allocation > 100).length,
        underUtilized: members.filter(m => m.total_allocation < 50 && m.total_allocation > 0).length,
        optimallyAllocated: members.filter(m => m.total_allocation >= 50 && m.total_allocation <= 100).length,
        members: members.sort((a, b) => b.total_allocation - a.total_allocation),
      }
    })
    .sort((a, b) => b.headcount - a.headcount)
}

// ─── HOOKS ──────────────────────────────────────────────────────────────────

/**
 * Fetch all active team members with their allocations.
 * Cache: 2 minutes. Use for rendering team lists, allocation cards.
 */
export function useTeamMembers() {
  return useQuery({
    queryKey: resourceKeys.team(),
    queryFn: fetchTeamWithAllocations,
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * Fetch overall resource statistics (utilization, overallocation, etc.).
 * Cache: 2 minutes. Use for KPI cards at the top of the Resources page.
 */
export function useResourceStats() {
  return useQuery({
    queryKey: resourceKeys.stats(),
    queryFn: computeResourceStats,
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * Fetch per-department utilization and capacity statistics.
 * Cache: 2 minutes. Use for department sections and capacity planning.
 */
export function useDepartmentStats() {
  return useQuery({
    queryKey: resourceKeys.departments(),
    queryFn: computeDepartmentStats,
    staleTime: 2 * 60 * 1000,
  })
}
