/**
 * WorkItemSubTasks — checklist of sub-tasks with a progress ring.
 *
 * Visual design:
 *   - Circular progress ring (SVG) showing done / total
 *   - Each sub-task renders as a checkbox row with inline title
 *   - Checking a sub-task triggers optimistic status update (done / in_progress)
 *   - Framer Motion layout animation reorders done items to the bottom
 *   - "Add sub-task" inline form appended at bottom
 *
 * The ring is animated — it draws on mount and re-draws when progress changes.
 */

import { useState, type KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, CheckCircle, Circle } from '@phosphor-icons/react'
import { db } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { workItemKeys } from '../useWorkItem'
import { useToggleSubTask } from '../useWorkItemMutations'
import type { WorkItem, WorkItemFull } from '../workItem.types'

// ─── PROGRESS RING ────────────────────────────────────────────────────────────

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r   = 14
  const circ = 2 * Math.PI * r
  const pct  = total > 0 ? done / total : 0
  const dash = pct * circ

  return (
    <svg width={36} height={36} viewBox="0 0 36 36" className="flex-shrink-0">
      {/* Track */}
      <circle
        cx={18} cy={18} r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={3}
      />
      {/* Progress */}
      <motion.circle
        cx={18} cy={18} r={r}
        fill="none"
        stroke={pct >= 1 ? '#3fb950' : '#58a6ff'}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={circ}
        animate={{ strokeDashoffset: circ - dash }}
        initial={{ strokeDashoffset: circ }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ transformOrigin: '50% 50%', transform: 'rotate(-90deg)' }}
      />
      {/* Label */}
      <text
        x={18} y={22}
        textAnchor="middle"
        fontSize={9}
        fontWeight={600}
        fill={pct >= 1 ? '#3fb950' : '#94a3b8'}
        fontFamily="'JetBrains Mono', monospace"
      >
        {total > 0 ? `${done}/${total}` : '—'}
      </text>
    </svg>
  )
}

// ─── SUB-TASK ROW ─────────────────────────────────────────────────────────────

function SubTaskRow({
  task,
  parentId,
}: {
  task:     WorkItem
  parentId: string
}) {
  const isDone = task.status === 'done'
  const { mutate: toggle } = useToggleSubTask(parentId)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0  }}
      exit={  { opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-2.5 py-1.5 group"
    >
      <button
        onClick={() => toggle({ subTaskId: task.id, done: !isDone })}
        className="flex-shrink-0 mt-0.5 transition-colors"
      >
        {isDone ? (
          <CheckCircle size={16} weight="fill" className="text-emerald-400" />
        ) : (
          <Circle size={16} weight="regular" className="text-slate-600 group-hover:text-slate-400 transition-colors" />
        )}
      </button>
      <span className={`text-sm leading-relaxed flex-1 min-w-0 ${isDone ? 'line-through text-slate-600' : 'text-slate-300'}`}>
        {task.title}
      </span>
    </motion.div>
  )
}

// ─── ADD SUB-TASK INLINE FORM ─────────────────────────────────────────────────

function AddSubTask({
  parentId,
  projectId,
}: {
  parentId:  string
  projectId: string
}) {
  const [adding, setAdding] = useState(false)
  const [title,  setTitle]  = useState('')
  const queryClient         = useQueryClient()

  async function handleAdd() {
    const trimmed = title.trim()
    if (!trimmed) { setAdding(false); return }

    const { error } = await db
      .from('work_items')
      .insert({
        parent_id:  parentId,
        project_id: projectId,
        title:      trimmed,
        type:       'task',
        status:     'todo',
        priority:   'medium',
      })

    if (!error) {
      queryClient.invalidateQueries({ queryKey: workItemKeys.detail(parentId) })
    }

    setTitle('')
    setAdding(false)
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter')  handleAdd()
    if (e.key === 'Escape') { setTitle(''); setAdding(false) }
  }

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="
          flex items-center gap-1.5 mt-1 text-xs text-slate-600
          hover:text-slate-400 transition-colors py-1
        "
      >
        <Plus size={12} weight="bold" />
        Add sub-task
      </button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="mt-1 flex items-center gap-2"
    >
      <Circle size={16} className="text-slate-700 flex-shrink-0" />
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKey}
        onBlur={handleAdd}
        placeholder="Sub-task title…"
        className="
          flex-1 bg-transparent border-b border-blue-500/40 pb-0.5
          text-sm text-slate-200 focus:outline-none
          focus:border-blue-500/80 placeholder:text-slate-600
          transition-colors
        "
      />
    </motion.div>
  )
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

interface WorkItemSubTasksProps {
  item: WorkItemFull
}

export function WorkItemSubTasks({ item }: WorkItemSubTasksProps) {
  const { sub_tasks } = item
  if (sub_tasks.length === 0 && item.type !== 'epic' && item.type !== 'story') {
    // Only show the add button — no section header if no tasks exist
    return (
      <div className="px-5 py-2">
        <AddSubTask parentId={item.id} projectId={item.project_id} />
      </div>
    )
  }

  const done  = sub_tasks.filter((t) => t.status === 'done').length
  const total = sub_tasks.length

  return (
    <div className="px-5 py-3">
      {/* Section header */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
          Sub-tasks
        </div>
        <div className="flex-1" />
        <ProgressRing done={done} total={total} />
      </div>

      {/* Task list */}
      <AnimatePresence initial={false}>
        {sub_tasks.map((t) => (
          <SubTaskRow key={t.id} task={t} parentId={item.id} />
        ))}
      </AnimatePresence>

      <AddSubTask parentId={item.id} projectId={item.project_id} />
    </div>
  )
}
