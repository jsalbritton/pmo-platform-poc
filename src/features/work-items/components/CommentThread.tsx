/**
 * CommentThread — threaded comment display (1 level deep).
 *
 * Layout:
 *   [Avatar]  Author · time
 *             Comment body (with @mention highlights)
 *             [Reply] [Edit] [Delete] (own comments only)
 *
 *   └─ Replies (indented 20px, same structure)
 *
 * Features:
 *   - @mention text rendered as a highlighted badge inline
 *   - Framer Motion stagger animation on initial load
 *   - Optimistic delete (grayed out instantly, removed on confirm)
 *   - Reply button sets replyTo state on parent CommentComposer
 *   - Empty state with a friendly prompt
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChatCircle, ArrowBendUpLeft, Trash } from '@phosphor-icons/react'
import { useDeleteComment } from '../useWorkItemMutations'
import { CommentComposer } from './CommentComposer'
import {
  profileDisplayName,
  profileInitials,
  relativeTime,
  type WorkItemComment,
} from '../workItem.types'

// ─── BODY RENDERER — @mention highlights ────────────────────────────────────

function CommentBody({ text }: { text: string }) {
  // Highlight @Name patterns
  const parts = text.split(/(@\w[\w\s-]*\w|\n)/)
  return (
    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part === '\n') return <br key={i} />
        if (part.startsWith('@')) {
          return (
            <span key={i} className="text-blue-400 bg-blue-500/10 rounded px-0.5 font-medium">
              {part}
            </span>
          )
        }
        return part
      })}
    </p>
  )
}

// ─── SINGLE COMMENT ──────────────────────────────────────────────────────────

function CommentCard({
  comment,
  workItemId,
  currentUserId,
  onReply,
  isReply = false,
}: {
  comment:       WorkItemComment
  workItemId:    string
  currentUserId: string
  onReply:       (c: WorkItemComment) => void
  isReply?:      boolean
}) {
  const { mutate: deleteComment, isPending: deleting } = useDeleteComment(workItemId)
  const isOwn = comment.author_id === currentUserId

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: deleting ? 0.4 : 1, y: 0 }}
      exit={  { opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.18 }}
      className={`flex gap-2.5 ${isReply ? 'ml-8 mt-2' : ''}`}
    >
      {/* Avatar */}
      <div className="
        w-7 h-7 rounded-full bg-slate-700 flex-shrink-0
        flex items-center justify-center text-[10px] font-bold text-slate-400
        mt-0.5
      ">
        {profileInitials(comment.author)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-xs font-semibold text-slate-200">
            {profileDisplayName(comment.author)}
          </span>
          <span className="text-[10px] text-slate-600">
            {relativeTime(comment.created_at)}
          </span>
          {comment.is_edited && (
            <span className="text-[10px] text-slate-700 italic">edited</span>
          )}
        </div>

        {/* Body */}
        <CommentBody text={comment.body} />

        {/* Actions */}
        <div className="flex items-center gap-3 mt-1.5 opacity-0 hover:opacity-100 transition-opacity group-hover:opacity-100">
          {!isReply && (
            <button
              onClick={() => onReply(comment)}
              className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-blue-400 transition-colors"
            >
              <ArrowBendUpLeft size={11} weight="bold" />
              Reply
            </button>
          )}
          {isOwn && (
            <button
              onClick={() => deleteComment(comment.id)}
              disabled={deleting}
              className="flex items-center gap-1 text-[11px] text-slate-700 hover:text-red-400 transition-colors"
            >
              <Trash size={11} weight="bold" />
              Delete
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

interface CommentThreadProps {
  comments:      WorkItemComment[]
  workItemId:    string
  currentUserId: string
  composerRef:   React.RefObject<HTMLTextAreaElement | null>
}

export function CommentThread({
  comments,
  workItemId,
  currentUserId,
  composerRef,
}: CommentThreadProps) {
  const [replyTo, setReplyTo] = useState<WorkItemComment | null>(null)

  if (comments.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-center px-6">
          <div className="w-10 h-10 rounded-2xl bg-white/3 border border-white/8 flex items-center justify-center">
            <ChatCircle size={20} weight="duotone" className="text-slate-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">No comments yet</p>
            <p className="text-xs text-slate-600 mt-0.5">
              Start the conversation — questions, updates, blockers.
            </p>
          </div>
        </div>

        <CommentComposer
          workItemId={workItemId}
          currentUserId={currentUserId}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          composerRef={composerRef}
        />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Comment list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 group">
        <AnimatePresence initial={false}>
          {comments.map((comment, i) => (
            <motion.div
              key={comment.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.18 }}
            >
              <CommentCard
                comment={comment}
                workItemId={workItemId}
                currentUserId={currentUserId}
                onReply={setReplyTo}
              />

              {/* Replies */}
              {(comment.replies ?? []).length > 0 && (
                <div className="mt-2 space-y-3 border-l border-white/5 pl-0.5">
                  <AnimatePresence initial={false}>
                    {comment.replies!.map((reply) => (
                      <CommentCard
                        key={reply.id}
                        comment={reply}
                        workItemId={workItemId}
                        currentUserId={currentUserId}
                        onReply={setReplyTo}
                        isReply
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Composer */}
      <CommentComposer
        workItemId={workItemId}
        currentUserId={currentUserId}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        composerRef={composerRef}
      />
    </div>
  )
}
