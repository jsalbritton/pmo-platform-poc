/**
 * WorkItemDescription — inline-editable description with markdown hints.
 *
 * No external rich-text dependency.  Uses a contenteditable-style textarea
 * that grows with content and supports basic keyboard shortcuts.
 *
 * Markdown shortcut support (visual only — stored as plain text for MVP):
 *   **text** rendered as bold, `code` rendered as monospace
 *   Full Tiptap upgrade path is documented in INFRA_SETUP_GUIDE.md
 *
 * Click anywhere to enter edit mode.
 * ⌘Enter saves, Escape cancels, blur saves.
 *
 * Displays a placeholder with an example prompt when description is empty.
 */

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUpdateWorkItem } from '../useWorkItemMutations'

interface WorkItemDescriptionProps {
  itemId:      string
  description: string | null
}

// ─── MARKDOWN-LIKE RENDERER ───────────────────────────────────────────────────
// Simple inline rendering: **bold** → <strong>, `code` → <code>
// This is presentational only — underlying value is plain text.

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let i = 0
  let key = 0

  while (i < text.length) {
    // Bold: **...**
    if (text[i] === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2)
      if (end !== -1) {
        parts.push(<strong key={key++} className="font-semibold text-slate-100">{text.slice(i + 2, end)}</strong>)
        i = end + 2
        continue
      }
    }
    // Inline code: `...`
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1)
      if (end !== -1) {
        parts.push(
          <code key={key++} className="font-mono text-[0.85em] bg-white/8 rounded px-1 text-blue-300">
            {text.slice(i + 1, end)}
          </code>
        )
        i = end + 1
        continue
      }
    }
    // Plain text — accumulate until special char
    let j = i + 1
    while (j < text.length && text[j] !== '*' && text[j] !== '`') j++
    parts.push(text.slice(i, j))
    i = j
  }

  return parts
}

function RenderedDescription({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="text-sm text-slate-300 leading-relaxed space-y-1.5">
      {lines.map((line, idx) => (
        <p key={idx} className={line === '' ? 'h-2' : ''}>
          {line === '' ? null : renderInline(line)}
        </p>
      ))}
    </div>
  )
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function WorkItemDescription({ itemId, description }: WorkItemDescriptionProps) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(description ?? '')
  const textareaRef           = useRef<HTMLTextAreaElement>(null)
  const { mutate }            = useUpdateWorkItem(itemId)

  // Sync if Realtime updates the description
  useEffect(() => {
    if (!editing) setDraft(description ?? '')
  }, [description, editing])

  // Auto-focus on edit mode open
  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus()
      const len = textareaRef.current?.value.length ?? 0
      textareaRef.current?.setSelectionRange(len, len)
    }
  }, [editing])

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 120)}px`
  }, [])

  useEffect(() => {
    if (editing) autoResize()
  }, [draft, editing, autoResize])

  function commit() {
    const trimmed = draft.trim()
    const prev    = (description ?? '').trim()
    if (trimmed !== prev) {
      mutate({ description: trimmed || null })
    }
    setEditing(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      commit()
    }
    if (e.key === 'Escape') {
      setDraft(description ?? '')
      setEditing(false)
    }
  }

  const isEmpty = !description || description.trim() === ''

  return (
    <div className="px-5 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2">
        Description
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {editing ? (
          <motion.div
            key="edit"
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 1   }}
            exit={  { opacity: 0.8  }}
            transition={{ duration: 0.1 }}
          >
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => { setDraft(e.target.value); autoResize() }}
              onBlur={commit}
              onKeyDown={handleKeyDown}
              rows={5}
              className="
                w-full min-h-[120px] bg-white/3 border border-blue-500/30 rounded-xl
                px-3 py-2.5 text-sm text-slate-200 leading-relaxed resize-none
                focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20
                placeholder:text-slate-600
                transition-colors
              "
              placeholder="Describe what this work item entails, acceptance criteria, technical notes…

Tip: **bold text**, `inline code`"
            />
            <div className="text-[10px] text-slate-600 mt-1 px-1">
              <kbd className="font-mono">⌘↵</kbd> save &nbsp;·&nbsp;
              <kbd className="font-mono">Esc</kbd> cancel
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="display"
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 1   }}
            exit={  { opacity: 0.8  }}
            transition={{ duration: 0.1 }}
            onClick={() => setEditing(true)}
            className="
              w-full text-left rounded-xl px-3 py-2.5
              hover:bg-white/3 transition-colors cursor-text
              border border-transparent hover:border-white/5
            "
          >
            {isEmpty ? (
              <span className="text-sm text-slate-600 italic leading-relaxed">
                Add a description — acceptance criteria, technical notes, context…
              </span>
            ) : (
              <RenderedDescription text={description!} />
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
