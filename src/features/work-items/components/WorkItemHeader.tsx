/**
 * WorkItemHeader — top bar of the work item detail panel.
 *
 * Shows:
 *   - Item type badge (Epic / Story / Task / Bug / Spike)
 *   - Breadcrumb: Project → Sprint (if set) → Item ID
 *   - Keyboard shortcut hints (? for legend)
 *   - Copy permalink button
 *   - Full-screen expand toggle
 *   - Close button (Escape key also closes)
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  ArrowsOut,
  ArrowsIn,
  Link,
  Check,
  CaretRight,
  Question,
} from '@phosphor-icons/react'
import {
  TYPE_CONFIG,
  type WorkItemFull,
  type WorkItemType,
} from '../workItem.types'
import { formatShortcut } from '@/lib/platform'

// ─── KEYBOARD SHORTCUT LEGEND ─────────────────────────────────────────────────

const SHORTCUTS = [
  { key: 'E',                              label: 'Edit title'           },
  { key: 'S',                              label: 'Change status'        },
  { key: 'A',                              label: 'Assign'               },
  { key: 'C',                              label: 'Focus comment input'  },
  { key: formatShortcut('mod+enter'),      label: 'Submit comment'       },
  { key: 'Esc',                            label: 'Close / cancel edit'  },
  { key: formatShortcut('mod+shift+c'),    label: 'Copy permalink'       },
  { key: '?',                              label: 'Show shortcuts'       },
]

function ShortcutLegend({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={  { opacity: 0, y: -8, scale: 0.96  }}
      className="
        absolute top-full right-0 mt-2 z-50
        bg-white border border-gray-200 rounded-xl shadow-lg
        p-4 min-w-[220px]
      "
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
          Keyboard shortcuts
        </span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={12} weight="bold" />
        </button>
      </div>
      <div className="space-y-1.5">
        {SHORTCUTS.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <span className="text-[11px] text-gray-600">{label}</span>
            <kbd className="
              text-[10px] font-mono bg-gray-50 border border-gray-200
              rounded px-1.5 py-0.5 text-gray-600 whitespace-nowrap
            ">
              {key}
            </kbd>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

interface WorkItemHeaderProps {
  item:         WorkItemFull
  isExpanded:   boolean
  onExpand:     () => void
  onClose:      () => void
}

export function WorkItemHeader({
  item,
  isExpanded,
  onExpand,
  onClose,
}: WorkItemHeaderProps) {
  const [copied,       setCopied]       = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const typeCfg = TYPE_CONFIG[item.type as WorkItemType] ?? TYPE_CONFIG.task

  // Build a short item ID from the uuid (first 8 chars) — cosmetic only
  const shortId = item.id.split('-')[0].toUpperCase()

  function handleCopyLink() {
    const url = `${window.location.origin}/work-item/${item.id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="
      flex items-center gap-2 px-4 py-3
      border-b border-gray-100 bg-white
      flex-shrink-0
    ">
      {/* Type badge */}
      <span className={`
        inline-flex items-center text-[10px] font-semibold
        px-2 py-0.5 rounded-full border
        ${typeCfg.color} ${typeCfg.bg} border-white/10
        flex-shrink-0
      `}>
        {typeCfg.label}
      </span>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-[11px] text-gray-500 min-w-0 flex-1">
        <span className="truncate hover:text-gray-700 cursor-pointer transition-colors">
          Project
        </span>
        {item.sprint_id && (
          <>
            <CaretRight size={10} weight="bold" />
            <span className="truncate hover:text-gray-700 cursor-pointer transition-colors">
              Sprint
            </span>
          </>
        )}
        <CaretRight size={10} weight="bold" />
        <span className="font-mono text-gray-400">{shortId}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0 relative">

        {/* Keyboard shortcuts */}
        <div className="relative">
          <button
            onClick={() => setShowShortcuts((v) => !v)}
            title="Keyboard shortcuts (?)"
            className="
              p-1.5 rounded-lg text-gray-400
              hover:text-gray-600 hover:bg-gray-50
              transition-colors
            "
          >
            <Question size={14} weight="bold" />
          </button>

          <AnimatePresence>
            {showShortcuts && (
              <ShortcutLegend onClose={() => setShowShortcuts(false)} />
            )}
          </AnimatePresence>
        </div>

        {/* Copy permalink */}
        <button
          onClick={handleCopyLink}
          title={`Copy permalink (${formatShortcut('mod+shift+c')})`}
          className="
            p-1.5 rounded-lg text-gray-400
            hover:text-gray-600 hover:bg-gray-50
            transition-colors relative
          "
        >
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.span
                key="check"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1,   opacity: 1 }}
                exit={  { scale: 0.6, opacity: 0 }}
                className="text-emerald-600"
              >
                <Check size={14} weight="bold" />
              </motion.span>
            ) : (
              <motion.span
                key="link"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1,   opacity: 1 }}
                exit={  { scale: 0.6, opacity: 0 }}
              >
                <Link size={14} weight="bold" />
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Expand / collapse */}
        <button
          onClick={onExpand}
          title={isExpanded ? 'Collapse panel' : 'Expand panel'}
          className="
            p-1.5 rounded-lg text-gray-400
            hover:text-gray-600 hover:bg-gray-50
            transition-colors
          "
        >
          {isExpanded
            ? <ArrowsIn  size={14} weight="bold" />
            : <ArrowsOut size={14} weight="bold" />
          }
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          title="Close (Esc)"
          className="
            p-1.5 rounded-lg text-gray-400
            hover:text-red-600 hover:bg-red-50
            transition-colors
          "
        >
          <X size={14} weight="bold" />
        </button>
      </div>
    </div>
  )
}
