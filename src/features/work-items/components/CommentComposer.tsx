/**
 * CommentComposer — comment input with @mention support.
 *
 * Features:
 *   - Auto-growing textarea (no fixed height)
 *   - @mention typeahead: typing @ triggers a floating profile picker
 *   - ⌘Enter / Ctrl+Enter to submit; Shift+Enter for newline
 *   - Writes to comment_mentions table after posting
 *   - Replying to another comment shows a quoted preview bar above the input
 *   - Character limit: 10,000 with remaining counter at 9,500+
 *
 * @mention resolution:
 *   When user types @, we query the profiles table for all team members.
 *   The query runs once and caches in component state.
 *   On selection, we insert "@display_name" into the draft.
 *   After posting, we parse the body for @names and write to comment_mentions.
 */

import {
  useState, useRef, useCallback, useEffect,
  type KeyboardEvent, type ChangeEvent,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PaperPlaneTilt, X, At } from '@phosphor-icons/react'
import { db } from '@/lib/supabase'
import { formatShortcut } from '@/lib/platform'
import { useAddComment } from '../useWorkItemMutations'
import {
  profileDisplayName,
  profileInitials,
  type WorkItemComment,
  type WorkItemProfile,
} from '../workItem.types'

const MAX_CHARS = 10_000

// ─── @MENTION PICKER ─────────────────────────────────────────────────────────

function MentionPicker({
  query,
  profiles,
  onSelect,
}: {
  query:    string
  profiles: WorkItemProfile[]
  onSelect: (p: WorkItemProfile) => void
}) {
  const filtered = profiles.filter((p) =>
    profileDisplayName(p).toLowerCase().includes(query.toLowerCase()) ||
    p.email.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 6)

  if (filtered.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1    }}
      exit={  { opacity: 0, y: 6, scale: 0.97  }}
      className="
        absolute bottom-full left-0 mb-1.5 z-50
        bg-[#161b22] border border-white/10 rounded-xl shadow-2xl
        py-1 min-w-[200px] max-h-[200px] overflow-y-auto
      "
    >
      {filtered.map((p) => (
        <button
          key={p.id}
          onMouseDown={(e) => { e.preventDefault(); onSelect(p) }}
          className="
            w-full flex items-center gap-2.5 px-3 py-2
            hover:bg-white/5 transition-colors text-left
          "
        >
          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
            {profileInitials(p)}
          </div>
          <div className="min-w-0">
            <div className="text-sm text-slate-200 truncate">{profileDisplayName(p)}</div>
            <div className="text-[10px] text-slate-500 truncate">{p.title ?? p.role}</div>
          </div>
        </button>
      ))}
    </motion.div>
  )
}

// ─── REPLY PREVIEW BAR ────────────────────────────────────────────────────────

function ReplyPreview({
  comment,
  onCancel,
}: {
  comment:  WorkItemComment
  onCancel: () => void
}) {
  const previewText = comment.body.length > 80
    ? comment.body.slice(0, 80) + '…'
    : comment.body

  return (
    <div className="
      flex items-start gap-2 px-3 py-2
      bg-white/3 border-l-2 border-blue-500/50 rounded-r-lg
      mb-2
    ">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold text-blue-400 mb-0.5">
          Replying to {profileDisplayName(comment.author)}
        </div>
        <div className="text-[11px] text-slate-500 truncate">{previewText}</div>
      </div>
      <button
        onClick={onCancel}
        className="text-slate-600 hover:text-slate-400 transition-colors flex-shrink-0 mt-0.5"
      >
        <X size={12} weight="bold" />
      </button>
    </div>
  )
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

interface CommentComposerProps {
  workItemId:     string
  currentUserId:  string
  replyTo?:       WorkItemComment | null
  onCancelReply?: () => void
  composerRef?:   React.RefObject<HTMLTextAreaElement | null>
}

export function CommentComposer({
  workItemId,
  currentUserId,
  replyTo,
  onCancelReply,
  composerRef,
}: CommentComposerProps) {
  const [body,        setBody]        = useState('')
  const [profiles,    setProfiles]    = useState<WorkItemProfile[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const internalRef                   = useRef<HTMLTextAreaElement>(null)
  const textareaRef                   = (composerRef as React.RefObject<HTMLTextAreaElement>) ?? internalRef

  const { mutate: addComment, isPending } = useAddComment(workItemId, currentUserId)

  // Load profiles once for @mention resolution
  useEffect(() => {
    db.from('profiles')
      .select('id, full_name, display_name, email, avatar_url, role, title, department')
      .eq('is_active', true)
      .then(({ data }) => setProfiles((data as WorkItemProfile[]) ?? []))
  }, [])

  // Auto-resize
  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
  }, [textareaRef])

  useEffect(() => { autoResize() }, [body, autoResize])

  // @mention detection: scan backwards from cursor
  function detectMention(text: string, cursor: number): string | null {
    const before = text.slice(0, cursor)
    const atIdx  = before.lastIndexOf('@')
    if (atIdx === -1) return null
    const between = before.slice(atIdx + 1)
    if (/\s/.test(between)) return null   // space after @ = not a mention
    return between
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const newBody = e.target.value.slice(0, MAX_CHARS)
    setBody(newBody)
    const cursor = e.target.selectionStart
    setMentionQuery(detectMention(newBody, cursor))
  }

  function handleMentionSelect(p: WorkItemProfile) {
    const cursor  = textareaRef.current?.selectionStart ?? body.length
    const before  = body.slice(0, cursor)
    const after   = body.slice(cursor)
    const atIdx   = before.lastIndexOf('@')
    const name    = profileDisplayName(p)
    const newBody = before.slice(0, atIdx) + `@${name} ` + after
    setBody(newBody)
    setMentionQuery(null)
    textareaRef.current?.focus()
  }

  async function handleSubmit() {
    const trimmed = body.trim()
    if (!trimmed || isPending) return

    addComment({
      body:            trimmed,
      parentCommentId: replyTo?.id ?? null,
    })

    setBody('')
    setMentionQuery(null)
    onCancelReply?.()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Escape dismisses @mention picker first, then clears reply
    if (e.key === 'Escape') {
      if (mentionQuery !== null) { setMentionQuery(null); return }
      onCancelReply?.()
    }
    // ⌘Enter / Ctrl+Enter submits
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
    // Enter inside mention picker: select first result (handled in picker)
  }

  const charsUsed      = body.length
  const showCharLimit  = charsUsed > 9_500
  const charsRemaining = MAX_CHARS - charsUsed

  return (
    <div className="px-4 py-3 border-t border-white/5 flex-shrink-0">
      {replyTo && (
        <ReplyPreview comment={replyTo} onCancel={() => onCancelReply?.()} />
      )}

      <div className="relative">
        {/* @mention picker */}
        <AnimatePresence>
          {mentionQuery !== null && (
            <MentionPicker
              query={mentionQuery}
              profiles={profiles}
              onSelect={handleMentionSelect}
            />
          )}
        </AnimatePresence>

        <div className="
          flex items-end gap-2
          bg-white/3 border border-white/8 rounded-xl
          focus-within:border-blue-500/40 focus-within:bg-white/4
          transition-colors
        ">
          {/* @mention button */}
          <button
            type="button"
            onClick={() => { setBody((b) => b + '@'); textareaRef.current?.focus() }}
            className="p-2.5 pb-2 text-slate-600 hover:text-blue-400 transition-colors flex-shrink-0"
            title="Mention someone"
          >
            <At size={14} weight="bold" />
          </button>

          <textarea
            ref={textareaRef}
            value={body}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'}
            className="
              flex-1 bg-transparent resize-none overflow-hidden
              text-sm text-slate-200 py-2.5
              focus:outline-none placeholder:text-slate-600
              leading-relaxed
            "
          />

          <div className="flex items-end gap-1 p-1.5 flex-shrink-0">
            {showCharLimit && (
              <span className={`text-[10px] tabular-nums mr-1 ${charsRemaining < 100 ? 'text-red-400' : 'text-slate-600'}`}>
                {charsRemaining}
              </span>
            )}
            <button
              onClick={handleSubmit}
              disabled={!body.trim() || isPending}
              className="
                p-2 rounded-lg bg-blue-600 text-white
                hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors
              "
              title={`Submit (${formatShortcut('mod+enter')})`}
            >
              <PaperPlaneTilt size={14} weight="fill" />
            </button>
          </div>
        </div>

        <div className="text-[10px] text-slate-700 mt-1.5 px-1">
          <kbd className="font-mono">{formatShortcut('mod+enter')}</kbd> submit &nbsp;·&nbsp;
          <kbd className="font-mono">{formatShortcut('shift+enter')}</kbd> new line &nbsp;·&nbsp;
          <kbd className="font-mono">@</kbd> mention
        </div>
      </div>
    </div>
  )
}
