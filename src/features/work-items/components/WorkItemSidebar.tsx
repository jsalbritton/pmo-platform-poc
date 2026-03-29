/**
 * WorkItemSidebar — right metadata panel.
 *
 * Sections (top to bottom):
 *   1. Dates — Start date, Due date (with overdue highlight)
 *   2. Effort — Story points, Estimated hours, Actual hours (+ burndown bar)
 *   3. Reporter — read-only profile chip
 *   4. Sprint — current sprint + move button
 *   5. Labels — tag chips with inline add/remove
 *   6. Dependencies — blocked-by / blocks (from dependencies table)
 */

import { useState, type KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  Lightning,
  Tag,
  GitBranch,
  UserCircle,
  Plus,
  X as XIcon,
  Warning,
  ArrowRight,
} from '@phosphor-icons/react'
import { WorkItemMetaField } from './WorkItemMetaField'
import {
  useUpdateWorkItem,
  useUpdateLabels,
} from '../useWorkItemMutations'
import {
  profileDisplayName,
  profileInitials,
  type WorkItemFull,
} from '../workItem.types'

// ─── SECTION WRAPPER ─────────────────────────────────────────────────────────

function SidebarSection({
  icon,
  label,
  children,
}: {
  icon:     React.ReactNode
  label:    string
  children: React.ReactNode
}) {
  return (
    <div className="py-3 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2 mb-2 px-4">
        <span className="text-slate-600">{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
          {label}
        </span>
      </div>
      <div className="px-4">{children}</div>
    </div>
  )
}

// ─── EFFORT BURNDOWN BAR ─────────────────────────────────────────────────────

function EffortBar({ estimated, actual }: { estimated: number | null; actual: number | null }) {
  if (!estimated) return null
  const pct     = Math.min(((actual ?? 0) / estimated) * 100, 120)
  const overrun  = pct > 100
  const color    = overrun ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] text-slate-600 mb-1">
        <span>{actual ?? 0}h logged</span>
        <span>{estimated}h estimated</span>
      </div>
      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      {overrun && (
        <div className="flex items-center gap-1 mt-1 text-[10px] text-red-400">
          <Warning size={10} weight="fill" />
          <span>{Math.round(pct - 100)}% over estimate</span>
        </div>
      )}
    </div>
  )
}

// ─── LABEL CHIPS ─────────────────────────────────────────────────────────────

function LabelChips({ item }: { item: WorkItemFull }) {
  const [adding, setAdding]     = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const { addLabel, removeLabel } = useUpdateLabels(item.id)
  const labels = item.labels ?? []

  function handleAdd() {
    const trimmed = newLabel.trim().toLowerCase().replace(/\s+/g, '-')
    if (trimmed && !labels.includes(trimmed)) {
      addLabel(trimmed, labels)
    }
    setNewLabel('')
    setAdding(false)
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter')  handleAdd()
    if (e.key === 'Escape') { setNewLabel(''); setAdding(false) }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <AnimatePresence>
        {labels.map((l) => (
          <motion.span
            key={l}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1   }}
            exit={  { opacity: 0, scale: 0.8  }}
            className="
              group flex items-center gap-1
              bg-blue-500/10 border border-blue-500/20 rounded-full
              px-2 py-0.5 text-[11px] text-blue-400
            "
          >
            {l}
            <button
              onClick={() => removeLabel(l, labels)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 hover:text-blue-400"
            >
              <XIcon size={9} weight="bold" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>

      {adding ? (
        <input
          autoFocus
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={handleKey}
          onBlur={handleAdd}
          placeholder="label-name"
          className="
            bg-transparent border-b border-blue-500/40
            text-[11px] text-slate-300 focus:outline-none
            placeholder:text-slate-600 w-24 pb-0.5
          "
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="
            flex items-center gap-0.5 text-[11px] text-slate-600
            hover:text-slate-400 transition-colors
          "
        >
          <Plus size={10} weight="bold" />
          Add
        </button>
      )}
    </div>
  )
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

interface WorkItemSidebarProps {
  item: WorkItemFull
}

export function WorkItemSidebar({ item }: WorkItemSidebarProps) {
  const { mutate } = useUpdateWorkItem(item.id)

  // Overdue detection
  const isOverdue = item.due_date
    && item.status !== 'done'
    && item.status !== 'cancelled'
    && new Date(item.due_date) < new Date()

  return (
    <aside className="
      w-[220px] flex-shrink-0 border-l border-white/5
      bg-[#0d1117] overflow-y-auto
    ">

      {/* ── Dates ──────────────────────────────────────────────────────────── */}
      <SidebarSection icon={<Calendar size={12} />} label="Dates">
        <div className="space-y-2">
          <WorkItemMetaField
            label="Start date"
            value={item.start_date ?? undefined}
            variant="date"
            onSave={(v) => mutate({ start_date: v || null })}
          />
          <WorkItemMetaField
            label="Due date"
            value={item.due_date ?? undefined}
            variant="date"
            onSave={(v) => mutate({ due_date: v || null })}
            className={isOverdue ? '[&_button]:text-red-400 [&_button]:font-semibold' : ''}
          />
          {isOverdue && (
            <div className="flex items-center gap-1 text-[10px] text-red-400">
              <Warning size={10} weight="fill" />
              Overdue
            </div>
          )}
        </div>
      </SidebarSection>

      {/* ── Effort ─────────────────────────────────────────────────────────── */}
      <SidebarSection icon={<Lightning size={12} />} label="Effort">
        <div className="space-y-2">
          <WorkItemMetaField
            label="Story points"
            value={item.story_points ?? undefined}
            variant="number"
            suffix="pts"
            onSave={(v) => mutate({ story_points: v ? Number(v) : null })}
          />
          <WorkItemMetaField
            label="Estimated"
            value={item.estimated_hours ?? undefined}
            variant="number"
            suffix="h"
            onSave={(v) => mutate({ estimated_hours: v ? Number(v) : null })}
          />
          <WorkItemMetaField
            label="Logged"
            value={item.actual_hours ?? undefined}
            variant="number"
            suffix="h"
            onSave={(v) => mutate({ actual_hours: v ? Number(v) : null })}
          />
          <EffortBar
            estimated={item.estimated_hours}
            actual={item.actual_hours}
          />
        </div>
      </SidebarSection>

      {/* ── Reporter ───────────────────────────────────────────────────────── */}
      {item.reporter && (
        <SidebarSection icon={<UserCircle size={12} />} label="Reporter">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-300 flex-shrink-0">
              {profileInitials(item.reporter)}
            </div>
            <span className="text-xs text-slate-400 truncate">
              {profileDisplayName(item.reporter)}
            </span>
          </div>
        </SidebarSection>
      )}

      {/* ── Labels ─────────────────────────────────────────────────────────── */}
      <SidebarSection icon={<Tag size={12} />} label="Labels">
        <LabelChips item={item} />
      </SidebarSection>

      {/* ── Dependencies ───────────────────────────────────────────────────── */}
      {item.dependencies.length > 0 && (
        <SidebarSection icon={<GitBranch size={12} />} label="Dependencies">
          <div className="space-y-1.5">
            {item.dependencies.map((dep) => (
              <div key={dep.id} className="flex items-center gap-1.5 text-[11px]">
                <ArrowRight size={10} className={
                  dep.dependency_type === 'blocks'    ? 'text-red-400' :
                  dep.dependency_type === 'blocked_by' ? 'text-amber-400' :
                  'text-slate-500'
                } />
                <span className="text-slate-500 capitalize">{dep.dependency_type.replace('_', ' ')}</span>
                <span className="text-slate-400 font-mono truncate">
                  {dep.depends_on_id.split('-')[0].toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </SidebarSection>
      )}

    </aside>
  )
}
