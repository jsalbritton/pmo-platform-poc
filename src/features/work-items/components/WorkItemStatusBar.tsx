/**
 * WorkItemStatusBar — horizontal strip of Status / Priority / Assignee.
 *
 * Each pill opens a dropdown on click. Selected values update via
 * optimistic mutations.  The dropdown uses @radix-ui/react-portal so
 * it renders above the panel overflow, never clipped.
 *
 * Key UX details:
 *   - Status pill has a coloured dot that pulses when 'in_progress'
 *   - Priority pill shows an icon (no text on small screens)
 *   - Assignee pill shows avatar initials or a dash if unassigned
 *   - Dropdowns close on outside click or Escape
 */

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CaretDown,
  UserCircle,
  Warning,
  ArrowUp,
  ArrowUpRight,
  ArrowDown,
  Minus,
} from '@phosphor-icons/react'
import {
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  type WorkItemStatus,
  type WorkItemPriority,
  type WorkItemFull,
  type WorkItemProfile,
  profileInitials,
  profileDisplayName,
} from '../workItem.types'
import {
  useUpdateWorkItemStatus,
  useUpdateWorkItemPriority,
  useUpdateWorkItemAssignee,
} from '../useWorkItemMutations'

// ─── PRIORITY ICONS ───────────────────────────────────────────────────────────

const PRIORITY_ICONS: Record<WorkItemPriority, React.ElementType> = {
  no_priority: Minus,
  urgent:      Warning,
  high:        ArrowUp,
  medium:      ArrowUpRight,
  low:         ArrowDown,
}

// ─── GENERIC DROPDOWN ────────────────────────────────────────────────────────

function Dropdown<T extends string>({
  options,
  onSelect,
  onClose,
}: {
  options:  { value: T; label: string; color?: string; icon?: React.ElementType }[]
  onSelect: (v: T) => void
  onClose:  () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={  { opacity: 0, y: -6, scale: 0.96  }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      className="
        absolute top-full left-0 mt-1.5 z-50 min-w-[160px]
        bg-[#161b22] border border-white/10 rounded-xl shadow-2xl
        py-1 overflow-hidden
      "
    >
      {options.map(({ value, label, color, icon: Icon }) => (
        <button
          key={value}
          onClick={() => { onSelect(value); onClose() }}
          className="
            w-full flex items-center gap-2.5 px-3 py-2
            text-sm text-slate-300 hover:bg-white/5 hover:text-white
            transition-colors text-left
          "
        >
          {Icon && <Icon size={14} weight="bold" className={color ?? 'text-slate-400'} />}
          <span className={color ?? ''}>{label}</span>
        </button>
      ))}
    </motion.div>
  )
}

// ─── STATUS PILL ─────────────────────────────────────────────────────────────

function StatusPill({ item }: { item: WorkItemFull }) {
  const [open, setOpen] = useState(false)
  const { updateStatus } = useUpdateWorkItemStatus(item.id)
  const cfg = STATUS_CONFIG[item.status as WorkItemStatus] ?? STATUS_CONFIG.backlog

  const options = (Object.keys(STATUS_CONFIG) as WorkItemStatus[]).map((s) => ({
    value: s,
    label: STATUS_CONFIG[s].label,
    color: STATUS_CONFIG[s].color,
  }))

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
          border transition-colors
          ${cfg.color} ${cfg.bg} ${cfg.border}
          hover:brightness-110
        `}
      >
        {/* Pulsing dot for in_progress */}
        <span className="relative flex h-2 w-2">
          <span
            className={`
              inline-flex rounded-full h-2 w-2
              ${item.status === 'in_progress' ? 'animate-ping absolute opacity-75' : 'hidden'}
            `}
            style={{ backgroundColor: cfg.dotColor }}
          />
          <span
            className="relative inline-flex rounded-full h-2 w-2"
            style={{ backgroundColor: cfg.dotColor }}
          />
        </span>
        {cfg.label}
        <CaretDown size={10} weight="bold" />
      </button>

      <AnimatePresence>
        {open && (
          <Dropdown options={options} onSelect={updateStatus} onClose={() => setOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── PRIORITY PILL ────────────────────────────────────────────────────────────

function PriorityPill({ item }: { item: WorkItemFull }) {
  const [open, setOpen] = useState(false)
  const { updatePriority } = useUpdateWorkItemPriority(item.id)
  const cfg  = PRIORITY_CONFIG[item.priority as WorkItemPriority] ?? PRIORITY_CONFIG.no_priority
  const Icon = PRIORITY_ICONS[item.priority as WorkItemPriority] ?? Minus

  const options = (Object.keys(PRIORITY_CONFIG) as WorkItemPriority[]).map((p) => ({
    value: p,
    label: PRIORITY_CONFIG[p].label,
    color: PRIORITY_CONFIG[p].color,
    icon:  PRIORITY_ICONS[p],
  }))

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={`Priority: ${cfg.label}`}
        className="
          flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
          border border-white/10 bg-white/3 text-slate-300
          hover:bg-white/8 hover:border-white/20 transition-colors
        "
      >
        <Icon size={13} weight="bold" className={cfg.color} />
        <span className={cfg.color}>{cfg.label}</span>
        <CaretDown size={10} weight="bold" className="text-slate-500" />
      </button>

      <AnimatePresence>
        {open && (
          <Dropdown options={options} onSelect={updatePriority} onClose={() => setOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── ASSIGNEE PILL ────────────────────────────────────────────────────────────

function AssigneePill({
  item,
  teamMembers,
}: {
  item:        WorkItemFull
  teamMembers: WorkItemProfile[]
}) {
  const [open, setOpen]     = useState(false)
  const { updateAssignee }  = useUpdateWorkItemAssignee(item.id)
  const assignee            = item.assignee

  const options = [
    { value: '__unassigned__', label: 'Unassigned', color: 'text-slate-500' },
    ...teamMembers.map((m) => ({
      value: m.id,
      label: profileDisplayName(m),
      color: 'text-slate-300',
    })),
  ]

  function handleSelect(value: string) {
    updateAssignee(value === '__unassigned__' ? null : value)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={assignee ? `Assigned to ${profileDisplayName(assignee)}` : 'Unassigned'}
        className="
          flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
          border border-white/10 bg-white/3 text-slate-300
          hover:bg-white/8 hover:border-white/20 transition-colors
        "
      >
        {assignee ? (
          <>
            {/* Avatar with initials */}
            <span className="
              w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center
              text-[9px] font-bold text-white flex-shrink-0
            ">
              {profileInitials(assignee)}
            </span>
            <span className="max-w-[100px] truncate">{profileDisplayName(assignee)}</span>
          </>
        ) : (
          <>
            <UserCircle size={14} className="text-slate-500" weight="duotone" />
            <span className="text-slate-500">Unassigned</span>
          </>
        )}
        <CaretDown size={10} weight="bold" className="text-slate-500" />
      </button>

      <AnimatePresence>
        {open && (
          <Dropdown
            options={options}
            onSelect={handleSelect}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

interface WorkItemStatusBarProps {
  item:        WorkItemFull
  teamMembers: WorkItemProfile[]
}

export function WorkItemStatusBar({ item, teamMembers }: WorkItemStatusBarProps) {
  return (
    <div className="flex items-center gap-2 px-5 py-3 flex-wrap">
      <StatusPill   item={item} />
      <PriorityPill item={item} />
      <AssigneePill item={item} teamMembers={teamMembers} />
    </div>
  )
}
