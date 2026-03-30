/**
 * CommandPalette — ⌘K global search and navigation
 *
 * Triggered by ⌘K (Mac) or Ctrl+K (Windows). Provides instant fuzzy search
 * across projects, plus quick navigation to any route.
 *
 * Built on cmdk — a headless command palette primitive. We own all the
 * rendering; cmdk handles keyboard navigation, filtering, and accessibility.
 *
 * Pattern: CommandPalette is rendered once in App.tsx (outside routes) so
 * it's always mounted and accessible from any page via the keyboard shortcut.
 * The open/close state lives in App.tsx and is passed down as props.
 */

import { useEffect, useCallback, useRef } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from 'react-router-dom'
import {
  Briefcase,
  ArrowsOut,
  UsersThree,
  Brain,
  Gear,
  Kanban,
  MagnifyingGlass,
  ArrowRight,
  Warning,
  CheckCircle,
} from '@phosphor-icons/react'
import { useProjects } from '@/hooks/useProjects'
import type { Project } from '@/types'

// ─── QUICK ACTIONS ────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { id: 'portfolio',     label: 'Portfolio',          icon: Briefcase,  to: '/portfolio' },
  { id: 'constellation', label: 'Constellation View', icon: ArrowsOut,  to: '/constellation' },
  { id: 'board',         label: 'Sprint Board',        icon: Kanban,     to: '/board/all' },
  { id: 'resources',     label: 'Resources',           icon: UsersThree, to: '/resources' },
  { id: 'ai',            label: 'AI Engine',           icon: Brain,      to: '/ai' },
  { id: 'settings',      label: 'Settings',            icon: Gear,       to: '/settings' },
]

// ─── HEALTH ICON ──────────────────────────────────────────────────────────────

function HealthIcon({ score }: { score: number | null }) {
  if (score === null) return <div className="w-2 h-2 rounded-full bg-slate-600" />
  if (score >= 70)    return <CheckCircle size={12} className="text-emerald-400" weight="fill" />
  if (score >= 40)    return <Warning size={12} className="text-amber-400" weight="fill" />
  return <Warning size={12} className="text-red-400" weight="fill" />
}

// ─── PROJECT RESULT ITEM ──────────────────────────────────────────────────────

function ProjectItem({ project, onSelect }: { project: Project; onSelect: () => void }) {
  const health = project.health_score
  const healthText = health === null ? 'Unscored'
    : health >= 70 ? `${health.toFixed(0)} · Healthy`
    : health >= 40 ? `${health.toFixed(0)} · At Risk`
    : `${health.toFixed(0)} · Critical`
  const healthColor = health === null ? 'text-slate-500'
    : health >= 70 ? 'text-emerald-400'
    : health >= 40 ? 'text-amber-400'
    : 'text-red-400'

  return (
    <Command.Item
      value={project.name + ' ' + project.id}
      onSelect={onSelect}
      className="
        flex items-center gap-3 px-3 py-2.5 rounded-lg mx-1
        cursor-pointer text-sm
        aria-selected:bg-white/8 aria-selected:text-slate-100
        text-slate-300 transition-colors
      "
    >
      <HealthIcon score={project.health_score} />
      <span className="flex-1 truncate font-medium">{project.name}</span>
      <span className={`text-xs ${healthColor} tabular-nums flex-shrink-0`}>
        {healthText}
      </span>
      <ArrowRight size={12} className="text-slate-600 flex-shrink-0" />
    </Command.Item>
  )
}

// ─── COMMAND PALETTE ──────────────────────────────────────────────────────────

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { data: projects = [] } = useProjects({ pageSize: 150 })
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Keyboard shortcut: ⌘K / Ctrl+K
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) onClose()
      }
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Focus input when palette opens.
  // autoFocus won't fire on a display:none input, so we do it manually.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const goTo = useCallback((path: string) => {
    navigate(path)
    onClose()
  }, [navigate, onClose])

  const cls = open ? 'is-open' : ''

  return (
    <>
      {/* Backdrop — always in DOM, toggled via .cp-backdrop.is-open.
          CSS: transition-behavior:allow-discrete lets display itself
          transition so both entry AND exit animate in pure CSS. */}
      <div
        className={`cp-backdrop ${cls}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Palette card — always in DOM, toggled via .cp-panel.is-open */}
      <div className={`cp-panel ${cls}`}>
        <Command
          className="
            bg-[#1c2333] border border-white/12 rounded-2xl
            shadow-2xl overflow-hidden
          "
          shouldFilter={true}
          loop
        >
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/8">
            <MagnifyingGlass size={16} className="text-slate-500 flex-shrink-0" />
            <Command.Input
              ref={inputRef}
              placeholder="Search projects, navigate..."
              className="
                flex-1 bg-transparent outline-none text-sm text-slate-100
                placeholder-slate-600
              "
            />
            <button
              onClick={onClose}
              className="
                flex items-center justify-center w-6 h-6 rounded-md
                bg-white/5 border border-white/10
                text-slate-500 hover:text-slate-300 hover:bg-white/10
                transition-colors flex-shrink-0 cursor-pointer
              "
              aria-label="Close"
              title="Close (Esc)"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Results */}
          <Command.List className="overflow-y-auto max-h-96 py-2">
            <Command.Empty className="py-8 text-center text-sm text-slate-500">
              No results found
            </Command.Empty>

            {/* Quick navigation */}
            <Command.Group
              heading={
                <span className="px-4 py-1 text-[10px] uppercase tracking-widest text-slate-600 font-semibold block">
                  Navigate
                </span>
              }
            >
              {QUICK_ACTIONS.map(action => (
                <Command.Item
                  key={action.id}
                  value={action.label}
                  onSelect={() => goTo(action.to)}
                  className="
                    flex items-center gap-3 px-3 py-2 rounded-lg mx-1
                    cursor-pointer text-sm
                    aria-selected:bg-white/8 aria-selected:text-slate-100
                    text-slate-400 transition-colors
                  "
                >
                  <action.icon size={14} className="text-slate-500" />
                  <span>{action.label}</span>
                  <ArrowRight size={12} className="ml-auto text-slate-600" />
                </Command.Item>
              ))}
            </Command.Group>

            {/* Project search */}
            {projects.length > 0 && (
              <Command.Group
                heading={
                  <span className="px-4 py-1 text-[10px] uppercase tracking-widest text-slate-600 font-semibold block mt-1">
                    Projects ({projects.length})
                  </span>
                }
              >
                {projects.map(project => (
                  <ProjectItem
                    key={project.id}
                    project={project}
                    onSelect={() => goTo(`/project/${project.id}`)}
                  />
                ))}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer hints */}
          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/5 text-[11px] text-slate-600">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> open</span>
            <span><kbd className="font-mono">ESC</kbd> close</span>
          </div>
        </Command>
        </div>
    </>
  )
}
