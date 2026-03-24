'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { type CandidateNote } from '@/types'
import { formatDateTime } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CONTENT_LENGTH = 10_000

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface NoteFormProps {
  /** When provided the form is in edit mode; otherwise it creates a new note. */
  note?: CandidateNote
  candidateId: string
  onSuccess: () => void
  onCancel?: () => void
}

function NoteForm({ note, candidateId, onSuccess, onCancel }: NoteFormProps) {
  const [content, setContent] = useState(note?.content ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isEdit = Boolean(note)
  const charsRemaining = MAX_CONTENT_LENGTH - content.length

  // Auto-focus the textarea when form mounts
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const trimmed = content.trim()
    if (!trimmed) {
      setError('Note content is required')
      return
    }
    if (trimmed.length > MAX_CONTENT_LENGTH) {
      setError(`Note must not exceed ${MAX_CONTENT_LENGTH} characters`)
      return
    }

    setError(null)

    try {
      const url = isEdit
        ? `/api/candidates/${candidateId}/notes/${note!.id}`
        : `/api/candidates/${candidateId}/notes`

      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      })

      if (!res.ok) {
        const body = (await res.json()) as { error?: string; details?: string[] }
        throw new Error(
          body.details?.join(', ') ?? body.error ?? 'Failed to save note'
        )
      }

      startTransition(() => {
        router.refresh()
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor={isEdit ? `note-edit-${note!.id}` : 'note-new'} className="sr-only">
          {isEdit ? 'Edit note' : 'New note'}
        </label>
        <textarea
          ref={textareaRef}
          id={isEdit ? `note-edit-${note!.id}` : 'note-new'}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a note about this candidate…"
          rows={4}
          maxLength={MAX_CONTENT_LENGTH}
          disabled={isPending}
          aria-describedby={error ? (isEdit ? `note-edit-error-${note!.id}` : 'note-new-error') : undefined}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 resize-none"
        />
        <div className="mt-1 flex items-start justify-between gap-2">
          {error ? (
            <p
              id={isEdit ? `note-edit-error-${note!.id}` : 'note-new-error'}
              className="text-xs text-red-600"
              role="alert"
            >
              {error}
            </p>
          ) : (
            <span />
          )}
          <p
            className={`text-xs ml-auto flex-shrink-0 ${
              charsRemaining < 200 ? 'text-orange-600' : 'text-gray-400'
            }`}
            aria-live="polite"
          >
            {charsRemaining.toLocaleString()} remaining
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="btn btn-secondary btn-sm"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isPending || !content.trim()}
          className="btn btn-primary btn-sm"
        >
          {isPending
            ? isEdit
              ? 'Saving…'
              : 'Adding…'
            : isEdit
              ? 'Save Changes'
              : 'Add Note'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------

interface NoteItemProps {
  note: CandidateNote
  candidateId: string
}

function NoteItem({ note, candidateId }: NoteItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('Delete this note? This cannot be undone.')) return

    setDeleteError(null)
    setIsDeleting(true)

    try {
      const res = await fetch(
        `/api/candidates/${candidateId}/notes/${note.id}`,
        { method: 'DELETE' }
      )

      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? 'Failed to delete note')
      }

      startTransition(() => {
        router.refresh()
      })
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete note'
      )
      setIsDeleting(false)
    }
  }

  if (isEditing) {
    return (
      <li className="p-4 bg-white border border-primary-300 rounded-lg shadow-sm">
        <NoteForm
          note={note}
          candidateId={candidateId}
          onSuccess={() => setIsEditing(false)}
          onCancel={() => setIsEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className="group p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
      {/* Note body */}
      <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
        {note.content}
      </p>

      {/* Footer: timestamp + actions */}
      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="text-xs text-gray-400">
          <time dateTime={new Date(note.createdAt).toISOString()}>
            {formatDateTime(note.createdAt)}
          </time>
          {note.updatedAt !== note.createdAt && (
            <span className="ml-1 italic">(edited)</span>
          )}
        </div>

        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            onClick={() => setIsEditing(true)}
            disabled={isPending || isDeleting}
            className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-50"
            aria-label="Edit this note"
          >
            Edit
          </button>
          <span className="text-gray-300" aria-hidden="true">
            |
          </span>
          <button
            onClick={handleDelete}
            disabled={isPending || isDeleting}
            className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
            aria-label="Delete this note"
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {deleteError && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {deleteError}
        </p>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface CandidateNotesProps {
  candidateId: string
  notes: CandidateNote[]
}

export function CandidateNotes({ candidateId, notes }: CandidateNotesProps) {
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="card overflow-hidden p-0">
      {/* ── Card header ─────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Notes
          {notes.length > 0 && (
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
              {notes.length}
            </span>
          )}
        </h3>

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-secondary btn-sm"
            aria-label="Add a new note"
          >
            <svg
              className="w-3.5 h-3.5 mr-1.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Note
          </button>
        )}
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* ── New-note form ─────────────────────────────────────────── */}
        {showForm && (
          <div className="p-4 border border-dashed border-gray-300 rounded-lg bg-white">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              New Note
            </p>
            <NoteForm
              candidateId={candidateId}
              onSuccess={() => setShowForm(false)}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {/* ── Notes list ────────────────────────────────────────────── */}
        {notes.length === 0 && !showForm ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg
                className="w-7 h-7 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </div>
            <h4 className="text-base font-medium text-gray-900 mb-1">
              No notes yet
            </h4>
            <p className="text-sm text-gray-500 mb-4">
              Add notes to keep track of important details about this candidate.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="btn btn-secondary btn-md"
            >
              Add First Note
            </button>
          </div>
        ) : (
          notes.length > 0 && (
            <ul className="space-y-3" aria-label="Candidate notes">
              {notes.map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  candidateId={candidateId}
                />
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  )
}
