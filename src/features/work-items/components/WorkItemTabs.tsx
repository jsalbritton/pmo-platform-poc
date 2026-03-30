/**
 * WorkItemTabs — animated tab navigation bar.
 *
 * Tabs: Comments | Activity | Attachments | Time
 *
 * The active indicator is a Framer Motion layoutId element that
 * slides smoothly between tabs — Linear's exact pattern.
 * Badge counts (unread comments, attachment count) show on each tab.
 */

import { motion } from 'framer-motion'
import {
  ChatCircle,
  ClockCounterClockwise,
  Paperclip,
  Timer,
} from '@phosphor-icons/react'
import type { WorkItemTab, WorkItemFull } from '../workItem.types'

// ─── TAB DEFINITION ───────────────────────────────────────────────────────────

interface TabDef {
  id:    WorkItemTab
  label: string
  icon:  React.ElementType
  count: (item: WorkItemFull) => number | null
}

const TABS: TabDef[] = [
  {
    id:    'comments',
    label: 'Comments',
    icon:  ChatCircle,
    count: (item) => {
      // Count all flat comments (including nested replies)
      let total = 0
      for (const c of item.comments) {
        total++
        total += (c.replies?.length ?? 0)
      }
      return total > 0 ? total : null
    },
  },
  {
    id:    'activity',
    label: 'Activity',
    icon:  ClockCounterClockwise,
    count: () => null,
  },
  {
    id:    'attachments',
    label: 'Files',
    icon:  Paperclip,
    count: (item) => item.attachments.length > 0 ? item.attachments.length : null,
  },
  {
    id:    'time',
    label: 'Time',
    icon:  Timer,
    count: (item) => item.time_entries.length > 0 ? item.time_entries.length : null,
  },
]

// ─── COMPONENT ────────────────────────────────────────────────────────────────

interface WorkItemTabsProps {
  activeTab:    WorkItemTab
  onTabChange:  (tab: WorkItemTab) => void
  item:         WorkItemFull
}

export function WorkItemTabs({ activeTab, onTabChange, item }: WorkItemTabsProps) {
  return (
    <div className="
      flex items-end gap-0 border-b border-gray-100
      px-5 flex-shrink-0 bg-white
    ">
      {TABS.map(({ id, label, icon: Icon, count }) => {
        const isActive  = activeTab === id
        const badgeCount = count(item)

        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`
              relative flex items-center gap-1.5 px-3 py-3
              text-xs font-medium transition-colors
              ${isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}
            `}
          >
            <Icon size={13} weight={isActive ? 'bold' : 'regular'} />
            {label}

            {/* Badge */}
            {badgeCount !== null && (
              <span className={`
                text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none
                ${isActive
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-500'
                }
              `}>
                {badgeCount}
              </span>
            )}

            {/* Animated active indicator */}
            {isActive && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
