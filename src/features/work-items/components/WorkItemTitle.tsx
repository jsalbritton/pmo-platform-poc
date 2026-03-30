/**
 * WorkItemTitle — inline-editable h1 for the work item title.
 *
 * UX design:
 *   - Click anywhere on the title (or press E) to enter edit mode
 *   - Textarea grows with content — no fixed height, no scrollbar
 *   - ⌘Enter / Ctrl+Enter to save; Escape to cancel
 *   - Autosave on blur (clicking away)
 *   - Character limit hint appears at 200+ characters
 *   - Framer Motion scale + opacity transition on mode switch
 */

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUpdateWorkItem } from '../useWorkItemMutations'
import { formatShortcut } from '@/lib/platform'

interface WorkItemTitleProps {
  itemId:     string
  title:      string
  editSignal: number   // incremented by parent when user presses 'E' globally
}

const MAX_TITLE = 280

export function WorkItemTitle({ itemId, title, editSignal }: WorkItemTitleProps) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(title)
  const textareaRef           = useRef<HTMLTextAreaElement>(null)
  const { mutate }            = useUpdateWorkItem(itemId)

  // Enter edit mode when parent signals E keypress
  useEffect(() => {
    if (editSignal > 0) setEditing(true)
  }, [editSignal])

  // Sync draft with external title changes (Realtime)
  useEffect(() => {
    if (!editing) setDraft(title)
  }, [title, editing])

  // Auto-focus + select-all when edit mode opens
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [editing])

  // Auto-resize textarea to content
  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useEffect(() => {
    if (editing) autoResize()
  }, [draft, editing, autoResize])

  function commit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== title) {
      mutate({ title: trimmed })
    } else {
      setDraft(title)   // revert draft if blank or unchanged
    }
    setEditing(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      commit()
    }
    if (e.key === 'Escape') {
      setDraft(title)
      setEditing(false)
    }
  }

  const charsRemaining = MAX_TITLE - draft.length
  const showCharLimit  = editing && draft.length > 200

  return (
    <div className="px-5 pt-4 pb-2">
      <AnimatePresence mode="wait" initial={false}>
        {editing ? (
          <motion.div
            key="edit"
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 1   }}
            exit={  { opacity: 0.7  }}
            transition={{ duration: 0.1 }}
          >
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => { setDraft(e.target.value); autoResize() }}
              onBlur={commit}
              onKeyDown={handleKeyDown}
              maxLength={MAX_TITLE}
              rows={1}
              className="
                w-full bg-transparent resize-none overflow-hidden
                text-2xl font-bold text-gray-900 leading-tight
                border-b border-blue-300 pb-1
                focus:outline-none focus:border-blue-500
                placeholder:text-gray-400
                transition-colors
              "
              placeholder="Untitled"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-gray-400">
                <kbd className="font-mono">{formatShortcut('mod+enter')}</kbd> save &nbsp;·&nbsp;
                <kbd className="font-mono">Esc</kbd> cancel
              </span>
              {showCharLimit && (
                <span className={`text-[10px] tabular-nums ${charsRemaining < 20 ? 'text-red-600' : 'text-gray-500'}`}>
                  {charsRemaining}
                </span>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.h1
            key="display"
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 1   }}
            exit={  { opacity: 0.7  }}
            transition={{ duration: 0.1 }}
            onClick={() => setEditing(true)}
            title="Click to edit (E)"
            className="
              text-2xl font-bold text-gray-900 leading-tight
              cursor-text hover:text-gray-800 transition-colors
              rounded-sm hover:bg-gray-50 -mx-1 px-1 py-0.5
              select-text
            "
          >
            {title || <span className="text-gray-400 italic font-normal text-xl">Untitled</span>}
          </motion.h1>
        )}
      </AnimatePresence>
    </div>
  )
}
