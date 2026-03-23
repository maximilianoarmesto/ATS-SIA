import { ApplicationStatus, ApplicationStage } from '@prisma/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_APPLICATION_STATUSES: ApplicationStatus[] = [
  'APPLIED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEWING',
  'OFFER_SENT',
  'HIRED',
  'REJECTED',
  'WITHDRAWN',
]

const VALID_APPLICATION_STAGES: ApplicationStage[] = [
  'APPLICATION',
  'SCREENING',
  'ASSESSMENT',
  'INTERVIEW_1',
  'INTERVIEW_2',
  'FINAL_ROUND',
  'OFFER',
  'CLOSED',
]

const URL_REGEX = /^https?:\/\/.+/

// ---------------------------------------------------------------------------
// Input shape types
// ---------------------------------------------------------------------------

export interface CreateApplicationInput {
  candidateId: string
  roleId: string
  status?: ApplicationStatus
  stage?: ApplicationStage
  resumeUrl?: string
  coverLetter?: string
  notes?: string
  rating?: number
  source?: string
}

export interface UpdateApplicationInput {
  status?: ApplicationStatus
  stage?: ApplicationStage
  resumeUrl?: string | null
  coverLetter?: string | null
  notes?: string | null
  rating?: number | null
  source?: string | null
}

// ---------------------------------------------------------------------------
// Validation result — discriminated union shared across validation modules
// ---------------------------------------------------------------------------

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: string[] }

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function collectOptionalString(
  field: string,
  value: unknown,
  maxLength: number,
  errors: string[]
): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') {
    errors.push(`${field} must be a string`)
    return undefined
  }
  const trimmed = value.trim()
  if (trimmed.length > maxLength) {
    errors.push(`${field} must not exceed ${maxLength} characters`)
    return undefined
  }
  return trimmed
}

function collectOptionalUrl(
  field: string,
  value: unknown,
  errors: string[]
): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') {
    errors.push(`${field} must be a string`)
    return undefined
  }
  if (!URL_REGEX.test(value)) {
    errors.push(`${field} must be a valid URL starting with http:// or https://`)
    return undefined
  }
  return value
}

function collectOptionalRating(
  value: unknown,
  errors: string[]
): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    errors.push('Rating must be an integer between 1 and 5')
    return undefined
  }
  return n
}

// ---------------------------------------------------------------------------
// validateCreateApplication
// ---------------------------------------------------------------------------

export function validateCreateApplication(
  raw: Record<string, unknown>
): ValidationResult<CreateApplicationInput> {
  const errors: string[] = []

  // candidateId — required non-empty string
  if (
    !raw.candidateId ||
    typeof raw.candidateId !== 'string' ||
    !raw.candidateId.trim()
  ) {
    errors.push('Candidate ID is required')
  }

  // roleId — required non-empty string
  if (!raw.roleId || typeof raw.roleId !== 'string' || !raw.roleId.trim()) {
    errors.push('Role ID is required')
  }

  // status — optional enum
  if (
    raw.status !== undefined &&
    raw.status !== null &&
    raw.status !== ''
  ) {
    if (!VALID_APPLICATION_STATUSES.includes(raw.status as ApplicationStatus)) {
      errors.push(
        `Status must be one of: ${VALID_APPLICATION_STATUSES.join(', ')}`
      )
    }
  }

  // stage — optional enum
  if (
    raw.stage !== undefined &&
    raw.stage !== null &&
    raw.stage !== ''
  ) {
    if (!VALID_APPLICATION_STAGES.includes(raw.stage as ApplicationStage)) {
      errors.push(
        `Stage must be one of: ${VALID_APPLICATION_STAGES.join(', ')}`
      )
    }
  }

  // resumeUrl — optional URL
  if (raw.resumeUrl !== undefined && raw.resumeUrl !== null && raw.resumeUrl !== '') {
    collectOptionalUrl('Resume URL', raw.resumeUrl, errors)
  }

  // coverLetter — optional, max 10000
  collectOptionalString('Cover letter', raw.coverLetter, 10000, errors)

  // notes — optional, max 5000
  collectOptionalString('Notes', raw.notes, 5000, errors)

  // rating — optional integer 1–5
  collectOptionalRating(raw.rating, errors)

  // source — optional, max 200
  collectOptionalString('Source', raw.source, 200, errors)

  if (errors.length > 0) return { success: false, errors }

  const data: CreateApplicationInput = {
    candidateId: (raw.candidateId as string).trim(),
    roleId: (raw.roleId as string).trim(),
  }

  if (raw.status) data.status = raw.status as ApplicationStatus
  if (raw.stage) data.stage = raw.stage as ApplicationStage

  const resumeUrl = collectOptionalUrl('Resume URL', raw.resumeUrl, [])
  if (resumeUrl !== undefined) data.resumeUrl = resumeUrl

  const coverLetter = collectOptionalString('Cover letter', raw.coverLetter, 10000, [])
  if (coverLetter !== undefined) data.coverLetter = coverLetter

  const notes = collectOptionalString('Notes', raw.notes, 5000, [])
  if (notes !== undefined) data.notes = notes

  const rating = collectOptionalRating(raw.rating, [])
  if (rating !== undefined) data.rating = rating

  const source = collectOptionalString('Source', raw.source, 200, [])
  if (source !== undefined) data.source = source

  return { success: true, data }
}

// ---------------------------------------------------------------------------
// validateUpdateApplication
// ---------------------------------------------------------------------------

export function validateUpdateApplication(
  raw: Record<string, unknown>
): ValidationResult<UpdateApplicationInput> {
  const errors: string[] = []

  const knownFields: (keyof UpdateApplicationInput)[] = [
    'status',
    'stage',
    'resumeUrl',
    'coverLetter',
    'notes',
    'rating',
    'source',
  ]
  const providedFields = knownFields.filter((f) => f in raw)
  if (providedFields.length === 0) {
    errors.push('At least one field must be provided for update')
    return { success: false, errors }
  }

  // status — optional enum
  if ('status' in raw && raw.status !== null && raw.status !== '') {
    if (!VALID_APPLICATION_STATUSES.includes(raw.status as ApplicationStatus)) {
      errors.push(
        `Status must be one of: ${VALID_APPLICATION_STATUSES.join(', ')}`
      )
    }
  }

  // stage — optional enum
  if ('stage' in raw && raw.stage !== null && raw.stage !== '') {
    if (!VALID_APPLICATION_STAGES.includes(raw.stage as ApplicationStage)) {
      errors.push(
        `Stage must be one of: ${VALID_APPLICATION_STAGES.join(', ')}`
      )
    }
  }

  // resumeUrl — nullable URL
  if ('resumeUrl' in raw && raw.resumeUrl !== null && raw.resumeUrl !== '') {
    collectOptionalUrl('Resume URL', raw.resumeUrl, errors)
  }

  // coverLetter — nullable, max 10000
  if ('coverLetter' in raw && raw.coverLetter !== null) {
    collectOptionalString('Cover letter', raw.coverLetter, 10000, errors)
  }

  // notes — nullable, max 5000
  if ('notes' in raw && raw.notes !== null) {
    collectOptionalString('Notes', raw.notes, 5000, errors)
  }

  // rating — nullable integer 1–5
  if ('rating' in raw && raw.rating !== null && raw.rating !== '') {
    collectOptionalRating(raw.rating, errors)
  }

  // source — nullable, max 200
  if ('source' in raw && raw.source !== null) {
    collectOptionalString('Source', raw.source, 200, errors)
  }

  if (errors.length > 0) return { success: false, errors }

  const data: UpdateApplicationInput = {}

  if ('status' in raw && raw.status)
    data.status = raw.status as ApplicationStatus

  if ('stage' in raw && raw.stage)
    data.stage = raw.stage as ApplicationStage

  if ('resumeUrl' in raw)
    data.resumeUrl =
      raw.resumeUrl && typeof raw.resumeUrl === 'string'
        ? (raw.resumeUrl as string).trim()
        : null

  if ('coverLetter' in raw)
    data.coverLetter =
      raw.coverLetter && typeof raw.coverLetter === 'string'
        ? (raw.coverLetter as string).trim()
        : null

  if ('notes' in raw)
    data.notes =
      raw.notes && typeof raw.notes === 'string'
        ? (raw.notes as string).trim()
        : null

  if ('rating' in raw)
    data.rating =
      raw.rating !== null && raw.rating !== ''
        ? collectOptionalRating(raw.rating, []) ?? null
        : null

  if ('source' in raw)
    data.source =
      raw.source && typeof raw.source === 'string'
        ? (raw.source as string).trim()
        : null

  return { success: true, data }
}
