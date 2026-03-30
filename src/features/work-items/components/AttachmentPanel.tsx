/**
 * AttachmentPanel — file list + drag-and-drop upload zone.
 *
 * For the POC, we upload to Supabase Storage (bucket: "attachments").
 * The storage path is: {project_id}/{work_item_id}/{uuid}-{filename}
 *
 * If Supabase Storage is not configured, upload gracefully fails with
 * an inline error message — the panel remains functional for viewing.
 *
 * File type icons: PDF → red, image → blue, doc → blue, other → grey
 * Progress bar shows during upload (XHR-based, not fetch, for progress events).
 */

import { useState, useRef, type DragEvent, type ChangeEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Paperclip, UploadSimple, File, FilePdf, Image, Trash, Warning } from '@phosphor-icons/react'
import { db } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { workItemKeys } from '../useWorkItem'
import {
  profileDisplayName,
  relativeTime,
  type WorkItemAttachment,
} from '../workItem.types'

// ─── FILE TYPE ICON ───────────────────────────────────────────────────────────

function FileIcon({ mimeType }: { mimeType: string | null }) {
  if (!mimeType) return <File size={16} className="text-gray-500" weight="duotone" />
  if (mimeType === 'application/pdf')   return <FilePdf size={16} className="text-red-600"  weight="duotone" />
  if (mimeType.startsWith('image/'))    return <Image   size={16} className="text-blue-600" weight="duotone" />
  return <File size={16} className="text-gray-500" weight="duotone" />
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── ATTACHMENT ROW ───────────────────────────────────────────────────────────

function AttachmentRow({
  attachment,
  workItemId,
}: {
  attachment: WorkItemAttachment
  workItemId: string
}) {
  const queryClient = useQueryClient()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    // Remove from storage
    await db.storage.from('attachments').remove([attachment.storage_path])
    // Remove DB row
    await db.from('attachments').delete().eq('id', attachment.id)
    queryClient.invalidateQueries({ queryKey: workItemKeys.detail(workItemId) })
  }

  async function handleDownload() {
    const { data } = await db.storage
      .from('attachments')
      .createSignedUrl(attachment.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: deleting ? 0.4 : 1, y: 0 }}
      exit={  { opacity: 0, height: 0, marginBottom: 0 }}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
    >
      <FileIcon mimeType={attachment.mime_type} />
      <div className="flex-1 min-w-0">
        <button
          onClick={handleDownload}
          className="text-sm text-gray-700 hover:text-blue-600 transition-colors truncate block text-left max-w-full"
        >
          {attachment.file_name}
        </button>
        <div className="text-[10px] text-gray-500 mt-0.5">
          {formatBytes(attachment.file_size)} · {relativeTime(attachment.created_at)}
          {attachment.uploader && ` · ${profileDisplayName(attachment.uploader)}`}
        </div>
      </div>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="
          opacity-0 group-hover:opacity-100 transition-opacity
          p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50
          disabled:cursor-not-allowed
        "
      >
        <Trash size={13} weight="bold" />
      </button>
    </motion.div>
  )
}

// ─── UPLOAD ZONE ─────────────────────────────────────────────────────────────

interface UploadZoneProps {
  workItemId: string
  projectId:  string
}

function UploadZone({ workItemId, projectId }: UploadZoneProps) {
  const [dragging,  setDragging]  = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress,  setProgress]  = useState(0)
  const [error,     setError]     = useState<string | null>(null)
  const inputRef                  = useRef<HTMLInputElement>(null)
  const queryClient               = useQueryClient()

  async function uploadFile(file: File) {
    setUploading(true)
    setProgress(0)
    setError(null)

    const ext      = file.name.split('.').pop() ?? ''
    const uuid     = crypto.randomUUID()
    const path     = `${projectId}/${workItemId}/${uuid}${ext ? `.${ext}` : ''}`

    // Upload to Supabase Storage
    const { error: storageErr } = await db.storage
      .from('attachments')
      .upload(path, file, { upsert: false })

    if (storageErr) {
      setError(`Upload failed: ${storageErr.message}`)
      setUploading(false)
      return
    }

    // Record in DB
    const { error: dbErr } = await db.from('attachments').insert({
      work_item_id: workItemId,
      uploaded_by:  (await db.auth.getUser()).data.user?.id ?? '',
      file_name:    file.name,
      file_size:    file.size,
      mime_type:    file.type || null,
      storage_path: path,
    })

    if (dbErr) setError(`DB record failed: ${dbErr.message}`)
    else {
      setProgress(100)
      queryClient.invalidateQueries({ queryKey: workItemKeys.detail(workItemId) })
    }

    setTimeout(() => { setUploading(false); setProgress(0) }, 600)
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  function handleInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true)  }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
          transition-all
          ${dragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleInput}
        />

        {uploading ? (
          <div className="space-y-2">
            <UploadSimple size={20} className="text-blue-600 mx-auto animate-pulse" weight="duotone" />
            <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
              <motion.div
                className="h-full bg-blue-500 rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-xs text-gray-500">Uploading…</p>
          </div>
        ) : (
          <>
            <UploadSimple size={20} className="text-gray-400 mx-auto mb-2" weight="duotone" />
            <p className="text-xs text-gray-500">
              Drag & drop a file or <span className="text-blue-600">browse</span>
            </p>
            <p className="text-[10px] text-gray-400 mt-1">Max 50 MB</p>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 mt-2 text-xs text-red-600">
          <Warning size={12} weight="fill" />
          {error}
        </div>
      )}
    </div>
  )
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

interface AttachmentPanelProps {
  attachments: WorkItemAttachment[]
  workItemId:  string
  projectId:   string
}

export function AttachmentPanel({ attachments, workItemId, projectId }: AttachmentPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
      {attachments.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <div className="w-10 h-10 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center">
            <Paperclip size={20} weight="duotone" className="text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">No files attached</p>
            <p className="text-xs text-gray-500 mt-0.5">Drag a file below or click to upload</p>
          </div>
        </div>
      ) : (
        <div className="space-y-0.5">
          <AnimatePresence>
            {attachments.map((att) => (
              <AttachmentRow
                key={att.id}
                attachment={att}
                workItemId={workItemId}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <UploadZone workItemId={workItemId} projectId={projectId} />
    </div>
  )
}
