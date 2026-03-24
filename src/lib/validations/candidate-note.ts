// ---------------------------------------------------------------------------
// Validation for candidate notes
// ---------------------------------------------------------------------------

// Maximum length for a note's content (matches common DB text field limits
// while keeping notes reasonably concise).
const MAX_CONTENT_LENGTH = 10_000

// ---------------------------------------------------------------------------
// Input shape types
// ---------------------------------------------------------------------------

export interface CreateCandidateNoteInput {
  content: string
}

export interface UpdateCandidateNoteInput {
  content: string
}

// ---------------------------------------------------------------------------
// Validation result — discriminated union (shared pattern across the project)
// ---------------------------------------------------------------------------

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: string[] }

// ---------------------------------------------------------------------------
// validateCreateCandidateNote
//
// Rules:
//   content — required non-empty string, max 10 000 characters
// ---------------------------------------------------------------------------

export function validateCreateCandidateNote(
  raw: Record<string, unknown>
): ValidationResult<CreateCandidateNoteInput> {
  const errors: string[] = []

  if (
    !raw.content ||
    typeof raw.content !== 'string' ||
    !raw.content.trim()
  ) {
    errors.push('Note content is required')
  } else if (raw.content.trim().length > MAX_CONTENT_LENGTH) {
    errors.push(
      `Note content must not exceed ${MAX_CONTENT_LENGTH} characters`
    )
  }

  if (errors.length > 0) return { success: false, errors }

  return {
    success: true,
    data: { content: (raw.content as string).trim() },
  }
}

// ---------------------------------------------------------------------------
// validateUpdateCandidateNote
//
// Rules:
//   content — required non-empty string, max 10 000 characters
//             (full-replace semantics — the entire note body is replaced)
// ---------------------------------------------------------------------------

export function validateUpdateCandidateNote(
  raw: Record<string, unknown>
): ValidationResult<UpdateCandidateNoteInput> {
  const errors: string[] = []

  if (
    !raw.content ||
    typeof raw.content !== 'string' ||
    !raw.content.trim()
  ) {
    errors.push('Note content is required')
  } else if (raw.content.trim().length > MAX_CONTENT_LENGTH) {
    errors.push(
      `Note content must not exceed ${MAX_CONTENT_LENGTH} characters`
    )
  }

  if (errors.length > 0) return { success: false, errors }

  return {
    success: true,
    data: { content: (raw.content as string).trim() },
  }
}
