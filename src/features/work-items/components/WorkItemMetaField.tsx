/**
 * WorkItemMetaField — reusable inline-edit field for the sidebar.
 *
 * Renders as a label + value pair.  Clicking the value area transitions it
 * into edit mode with a Framer Motion scale/fade.  Pressing Escape cancels;
 * pressing Enter (or clicking away for text fields) commits the change.
 *
 * Variants:
 *   text       — single-line text input
 *   date       — native <input type="date"> with styled wrapper
 *   number     — number input with optional suffix (e.g. "pts", "h")
 *   readonly   — display only, no edit affordance
 */

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PencilSimple } from '@phosphor-icons/react'

type MetaFieldVariant = 'text' | 'date' | 'number' | 'readonly'

interface WorkItemMetaFieldProps {
  label:       string
  value:       string | number | null | undefined
  placeholder?: string
  suffix?:     string
  variant?:    MetaFieldVariant
  onSave?:     (value: string) => void
  className?:  string
}

export function WorkItemMetaField({
  label,
  value,
  placeholder = '—',
  suffix,
  variant = 'text',
  onSave,
  className = '',
}: WorkItemMetaFieldProps) {
  const [editing, setEditing]   = useState(false)
  const [draft,   setDraft]     = useState(String(value ?? ''))
  const inputRef  = useRef<HTMLInputElement>(null)

  // Sync draft if external value changes (Realtime update)
  useEffect(() => {
    if (!editing) setDraft(String(value ?? ''))
  }, [value, editing])

  // Auto-focus on enter edit mode
  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const displayValue = value != null && value !== '' ? String(value) : null
  const isEditable   = variant !== 'readonly' && !!onSave

  function handleCommit() {
    const trimmed = draft.trim()
    if (trimmed !== String(value ?? '')) onSave?.(trimmed)
    setEditing(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter')  { e.preventDefault(); handleCommit() }
    if (e.key === 'Escape') { setDraft(String(value ?? '')); setEditing(false) }
  }

  return (
    <div className={`group ${className}`}>
      {/* Label row */}
      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1">
        {label}
      </div>

      {/* Value row */}
      <AnimatePresence mode="wait" initial={false}>
        {editing ? (
          <motion.div
            key="editing"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={  { opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.1 }}
          >
            <input
              ref={inputRef}
              type={variant === 'date' ? 'date' : variant === 'number' ? 'number' : 'text'}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={handleCommit}
              onKeyDown={handleKeyDown}
              className="
                w-full bg-blue-50 border border-blue-200 rounded-md
                px-2 py-1 text-sm text-gray-900
                focus:outline-none focus:ring-1 focus:ring-blue-300
                placeholder:text-gray-400
              "
              placeholder={placeholder}
            />
          </motion.div>
        ) : (
          <motion.button
            key="display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={  { opacity: 0 }}
            transition={{ duration: 0.1 }}
            onClick={() => isEditable && setEditing(true)}
            disabled={!isEditable}
            className={`
              w-full text-left rounded-md px-2 py-1
              text-sm transition-colors
              ${displayValue ? 'text-gray-800' : 'text-gray-400 italic'}
              ${isEditable
                ? 'hover:bg-gray-50 cursor-text group-hover:bg-gray-100'
                : 'cursor-default'
              }
            `}
          >
            {displayValue
              ? <span>{displayValue}{suffix && <span className="text-gray-500 ml-1 text-xs">{suffix}</span>}</span>
              : <span>{placeholder}</span>
            }
            {isEditable && (
              <PencilSimple
                size={10}
                className="inline ml-1.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                weight="bold"
              />
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
