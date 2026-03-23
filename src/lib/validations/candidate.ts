import { CandidateStatus } from '@prisma/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ACCEPTED_RESUME_MIME_TYPE = 'application/pdf'
export const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

const VALID_CANDIDATE_STATUSES: CandidateStatus[] = [
  'ACTIVE',
  'HIRED',
  'INACTIVE',
  'BLACKLISTED',
]

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^\+?[\d\s\-().]{7,20}$/
const URL_REGEX = /^https?:\/\/.+/

// ---------------------------------------------------------------------------
// Input shape types
// ---------------------------------------------------------------------------

export interface CreateCandidateInput {
  email: string
  firstName: string
  lastName: string
  phone?: string
  linkedinUrl?: string
  portfolioUrl?: string
  resumeUrl?: string
  location?: string
  summary?: string
  status?: CandidateStatus
}

export interface UpdateCandidateInput {
  email?: string
  firstName?: string
  lastName?: string
  phone?: string | null
  linkedinUrl?: string | null
  portfolioUrl?: string | null
  resumeUrl?: string | null
  location?: string | null
  summary?: string | null
  status?: CandidateStatus
}

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: string[] }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// validateCreateCandidate
// ---------------------------------------------------------------------------

export function validateCreateCandidate(
  raw: Record<string, unknown>
): ValidationResult<CreateCandidateInput> {
  const errors: string[] = []

  // email — required
  if (!raw.email || typeof raw.email !== 'string' || !raw.email.trim()) {
    errors.push('Email is required')
  } else if (!EMAIL_REGEX.test(raw.email.trim())) {
    errors.push('Email must be a valid email address')
  }

  // firstName — required
  if (
    !raw.firstName ||
    typeof raw.firstName !== 'string' ||
    !raw.firstName.trim()
  ) {
    errors.push('First name is required')
  } else if (raw.firstName.trim().length > 100) {
    errors.push('First name must not exceed 100 characters')
  }

  // lastName — required
  if (
    !raw.lastName ||
    typeof raw.lastName !== 'string' ||
    !raw.lastName.trim()
  ) {
    errors.push('Last name is required')
  } else if (raw.lastName.trim().length > 100) {
    errors.push('Last name must not exceed 100 characters')
  }

  // phone — optional
  if (raw.phone !== undefined && raw.phone !== null && raw.phone !== '') {
    if (typeof raw.phone !== 'string') {
      errors.push('Phone must be a string')
    } else if (!PHONE_REGEX.test(raw.phone.trim())) {
      errors.push('Phone must be a valid phone number (7–20 digits)')
    }
  }

  // linkedinUrl — optional URL
  collectOptionalUrl('LinkedIn URL', raw.linkedinUrl, errors)

  // portfolioUrl — optional URL
  collectOptionalUrl('Portfolio URL', raw.portfolioUrl, errors)

  // resumeUrl — optional URL (set by upload handler, may be pre-validated)
  if (raw.resumeUrl !== undefined && raw.resumeUrl !== null && raw.resumeUrl !== '') {
    collectOptionalUrl('Resume URL', raw.resumeUrl, errors)
  }

  // location — optional, max 200
  collectOptionalString('Location', raw.location, 200, errors)

  // summary — optional, max 2000
  collectOptionalString('Summary', raw.summary, 2000, errors)

  // status — optional enum
  if (raw.status !== undefined && raw.status !== null && raw.status !== '') {
    if (!VALID_CANDIDATE_STATUSES.includes(raw.status as CandidateStatus)) {
      errors.push(
        `Status must be one of: ${VALID_CANDIDATE_STATUSES.join(', ')}`
      )
    }
  }

  if (errors.length > 0) return { success: false, errors }

  const data: CreateCandidateInput = {
    email: (raw.email as string).trim().toLowerCase(),
    firstName: (raw.firstName as string).trim(),
    lastName: (raw.lastName as string).trim(),
  }

  if (raw.phone && typeof raw.phone === 'string')
    data.phone = raw.phone.trim()
  if (raw.linkedinUrl && typeof raw.linkedinUrl === 'string')
    data.linkedinUrl = raw.linkedinUrl.trim()
  if (raw.portfolioUrl && typeof raw.portfolioUrl === 'string')
    data.portfolioUrl = raw.portfolioUrl.trim()
  if (raw.resumeUrl && typeof raw.resumeUrl === 'string')
    data.resumeUrl = raw.resumeUrl.trim()
  if (raw.location && typeof raw.location === 'string')
    data.location = raw.location.trim()
  if (raw.summary && typeof raw.summary === 'string')
    data.summary = raw.summary.trim()
  if (raw.status) data.status = raw.status as CandidateStatus

  return { success: true, data }
}

// ---------------------------------------------------------------------------
// validateUpdateCandidate
// ---------------------------------------------------------------------------

export function validateUpdateCandidate(
  raw: Record<string, unknown>
): ValidationResult<UpdateCandidateInput> {
  const errors: string[] = []

  // At least one field must be provided
  const knownFields: (keyof UpdateCandidateInput)[] = [
    'email',
    'firstName',
    'lastName',
    'phone',
    'linkedinUrl',
    'portfolioUrl',
    'resumeUrl',
    'location',
    'summary',
    'status',
  ]
  const providedFields = knownFields.filter((f) => f in raw)
  if (providedFields.length === 0) {
    errors.push('At least one field must be provided for update')
    return { success: false, errors }
  }

  // email — optional, but must be valid if provided
  if ('email' in raw) {
    if (!raw.email || typeof raw.email !== 'string' || !raw.email.trim()) {
      errors.push('Email must not be empty')
    } else if (!EMAIL_REGEX.test(raw.email.trim())) {
      errors.push('Email must be a valid email address')
    }
  }

  // firstName
  if ('firstName' in raw) {
    if (
      !raw.firstName ||
      typeof raw.firstName !== 'string' ||
      !raw.firstName.trim()
    ) {
      errors.push('First name must not be empty')
    } else if ((raw.firstName as string).trim().length > 100) {
      errors.push('First name must not exceed 100 characters')
    }
  }

  // lastName
  if ('lastName' in raw) {
    if (
      !raw.lastName ||
      typeof raw.lastName !== 'string' ||
      !raw.lastName.trim()
    ) {
      errors.push('Last name must not be empty')
    } else if ((raw.lastName as string).trim().length > 100) {
      errors.push('Last name must not exceed 100 characters')
    }
  }

  // phone — nullable
  if ('phone' in raw && raw.phone !== null && raw.phone !== '') {
    if (typeof raw.phone !== 'string') {
      errors.push('Phone must be a string')
    } else if (!PHONE_REGEX.test(raw.phone.trim())) {
      errors.push('Phone must be a valid phone number (7–20 digits)')
    }
  }

  // linkedinUrl — nullable
  if ('linkedinUrl' in raw && raw.linkedinUrl !== null && raw.linkedinUrl !== '') {
    collectOptionalUrl('LinkedIn URL', raw.linkedinUrl, errors)
  }

  // portfolioUrl — nullable
  if ('portfolioUrl' in raw && raw.portfolioUrl !== null && raw.portfolioUrl !== '') {
    collectOptionalUrl('Portfolio URL', raw.portfolioUrl, errors)
  }

  // resumeUrl — nullable
  if ('resumeUrl' in raw && raw.resumeUrl !== null && raw.resumeUrl !== '') {
    collectOptionalUrl('Resume URL', raw.resumeUrl, errors)
  }

  // location — nullable, max 200
  if ('location' in raw && raw.location !== null && raw.location !== '') {
    collectOptionalString('Location', raw.location, 200, errors)
  }

  // summary — nullable, max 2000
  if ('summary' in raw && raw.summary !== null && raw.summary !== '') {
    collectOptionalString('Summary', raw.summary, 2000, errors)
  }

  // status
  if ('status' in raw) {
    if (!VALID_CANDIDATE_STATUSES.includes(raw.status as CandidateStatus)) {
      errors.push(
        `Status must be one of: ${VALID_CANDIDATE_STATUSES.join(', ')}`
      )
    }
  }

  if (errors.length > 0) return { success: false, errors }

  const data: UpdateCandidateInput = {}

  if ('email' in raw && raw.email && typeof raw.email === 'string')
    data.email = raw.email.trim().toLowerCase()
  if ('firstName' in raw && raw.firstName && typeof raw.firstName === 'string')
    data.firstName = (raw.firstName as string).trim()
  if ('lastName' in raw && raw.lastName && typeof raw.lastName === 'string')
    data.lastName = (raw.lastName as string).trim()
  if ('phone' in raw)
    data.phone =
      raw.phone && typeof raw.phone === 'string' ? raw.phone.trim() : null
  if ('linkedinUrl' in raw)
    data.linkedinUrl =
      raw.linkedinUrl && typeof raw.linkedinUrl === 'string'
        ? (raw.linkedinUrl as string).trim()
        : null
  if ('portfolioUrl' in raw)
    data.portfolioUrl =
      raw.portfolioUrl && typeof raw.portfolioUrl === 'string'
        ? (raw.portfolioUrl as string).trim()
        : null
  if ('resumeUrl' in raw)
    data.resumeUrl =
      raw.resumeUrl && typeof raw.resumeUrl === 'string'
        ? (raw.resumeUrl as string).trim()
        : null
  if ('location' in raw)
    data.location =
      raw.location && typeof raw.location === 'string'
        ? (raw.location as string).trim()
        : null
  if ('summary' in raw)
    data.summary =
      raw.summary && typeof raw.summary === 'string'
        ? (raw.summary as string).trim()
        : null
  if ('status' in raw) data.status = raw.status as CandidateStatus

  return { success: true, data }
}

// ---------------------------------------------------------------------------
// validateResumeFile
// ---------------------------------------------------------------------------

export function validateResumeFile(
  file: File
): ValidationResult<File> {
  const errors: string[] = []

  if (file.type !== ACCEPTED_RESUME_MIME_TYPE) {
    errors.push(
      `Resume must be a PDF file (received: ${file.type || 'unknown'})`
    )
  }

  if (file.size > MAX_RESUME_SIZE_BYTES) {
    const maxMb = MAX_RESUME_SIZE_BYTES / (1024 * 1024)
    errors.push(`Resume file size must not exceed ${maxMb} MB`)
  }

  if (file.size === 0) {
    errors.push('Resume file must not be empty')
  }

  if (errors.length > 0) return { success: false, errors }

  return { success: true, data: file }
}
