import {
  RoleStatus,
  LocationType,
  EmploymentType,
} from '@prisma/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_ROLE_STATUSES: RoleStatus[] = [
  'DRAFT',
  'PUBLISHED',
  'PAUSED',
  'CLOSED',
  'ARCHIVED',
]

const VALID_LOCATION_TYPES: LocationType[] = ['ON_SITE', 'REMOTE', 'HYBRID']

const VALID_EMPLOYMENT_TYPES: EmploymentType[] = [
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'INTERNSHIP',
  'TEMPORARY',
]

// ---------------------------------------------------------------------------
// Input shape types
// ---------------------------------------------------------------------------

export interface CreateRoleInput {
  title: string
  company: string
  description?: string
  department?: string
  location?: string
  locationType?: LocationType
  employmentType?: EmploymentType
  salaryMin?: number
  salaryMax?: number
  salaryCurrency?: string
  requirements?: string
  benefits?: string
  status?: RoleStatus
  postedById?: string
  publishedAt?: Date
  closesAt?: Date
}

export interface UpdateRoleInput {
  title?: string
  company?: string
  description?: string | null
  department?: string | null
  location?: string | null
  locationType?: LocationType
  employmentType?: EmploymentType
  salaryMin?: number | null
  salaryMax?: number | null
  salaryCurrency?: string | null
  requirements?: string | null
  benefits?: string | null
  status?: RoleStatus
  postedById?: string | null
  publishedAt?: Date | null
  closesAt?: Date | null
}

// ---------------------------------------------------------------------------
// Validation result — shared discriminated-union type
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

function collectOptionalPositiveInt(
  field: string,
  value: unknown,
  errors: string[]
): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) {
    errors.push(`${field} must be a non-negative integer`)
    return undefined
  }
  return n
}

function collectOptionalDate(
  field: string,
  value: unknown,
  errors: string[]
): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const d = new Date(value as string)
  if (isNaN(d.getTime())) {
    errors.push(`${field} must be a valid ISO 8601 date string`)
    return undefined
  }
  return d
}

// ---------------------------------------------------------------------------
// validateCreateRole
// ---------------------------------------------------------------------------

export function validateCreateRole(
  raw: Record<string, unknown>
): ValidationResult<CreateRoleInput> {
  const errors: string[] = []

  // title — required, max 200
  if (!raw.title || typeof raw.title !== 'string' || !raw.title.trim()) {
    errors.push('Title is required')
  } else if (raw.title.trim().length > 200) {
    errors.push('Title must not exceed 200 characters')
  }

  // company — required, max 200
  if (!raw.company || typeof raw.company !== 'string' || !raw.company.trim()) {
    errors.push('Company is required')
  } else if (raw.company.trim().length > 200) {
    errors.push('Company must not exceed 200 characters')
  }

  // description — optional, max 10000
  collectOptionalString('Description', raw.description, 10000, errors)

  // department — optional, max 200
  collectOptionalString('Department', raw.department, 200, errors)

  // location — optional, max 300
  collectOptionalString('Location', raw.location, 300, errors)

  // locationType — optional enum
  if (
    raw.locationType !== undefined &&
    raw.locationType !== null &&
    raw.locationType !== ''
  ) {
    if (!VALID_LOCATION_TYPES.includes(raw.locationType as LocationType)) {
      errors.push(
        `Location type must be one of: ${VALID_LOCATION_TYPES.join(', ')}`
      )
    }
  }

  // employmentType — optional enum
  if (
    raw.employmentType !== undefined &&
    raw.employmentType !== null &&
    raw.employmentType !== ''
  ) {
    if (!VALID_EMPLOYMENT_TYPES.includes(raw.employmentType as EmploymentType)) {
      errors.push(
        `Employment type must be one of: ${VALID_EMPLOYMENT_TYPES.join(', ')}`
      )
    }
  }

  // salaryMin — optional non-negative integer
  const salaryMin = collectOptionalPositiveInt(
    'Salary min',
    raw.salaryMin,
    errors
  )

  // salaryMax — optional non-negative integer
  const salaryMax = collectOptionalPositiveInt(
    'Salary max',
    raw.salaryMax,
    errors
  )

  // salaryMin must be <= salaryMax when both are provided
  if (
    salaryMin !== undefined &&
    salaryMax !== undefined &&
    salaryMin > salaryMax
  ) {
    errors.push('Salary min must not exceed salary max')
  }

  // salaryCurrency — optional, max 10
  collectOptionalString('Salary currency', raw.salaryCurrency, 10, errors)

  // requirements — optional, max 10000
  collectOptionalString('Requirements', raw.requirements, 10000, errors)

  // benefits — optional, max 10000
  collectOptionalString('Benefits', raw.benefits, 10000, errors)

  // status — optional enum
  if (
    raw.status !== undefined &&
    raw.status !== null &&
    raw.status !== ''
  ) {
    if (!VALID_ROLE_STATUSES.includes(raw.status as RoleStatus)) {
      errors.push(
        `Status must be one of: ${VALID_ROLE_STATUSES.join(', ')}`
      )
    }
  }

  // postedById — optional string (cuid)
  if (
    raw.postedById !== undefined &&
    raw.postedById !== null &&
    raw.postedById !== ''
  ) {
    if (typeof raw.postedById !== 'string') {
      errors.push('Posted by ID must be a string')
    }
  }

  // publishedAt — optional ISO date
  collectOptionalDate('Published at', raw.publishedAt, errors)

  // closesAt — optional ISO date
  collectOptionalDate('Closes at', raw.closesAt, errors)

  if (errors.length > 0) return { success: false, errors }

  const data: CreateRoleInput = {
    title: (raw.title as string).trim(),
    company: (raw.company as string).trim(),
  }

  const description = collectOptionalString(
    'Description',
    raw.description,
    10000,
    []
  )
  if (description !== undefined) data.description = description

  const department = collectOptionalString(
    'Department',
    raw.department,
    200,
    []
  )
  if (department !== undefined) data.department = department

  const location = collectOptionalString('Location', raw.location, 300, [])
  if (location !== undefined) data.location = location

  if (raw.locationType && typeof raw.locationType === 'string')
    data.locationType = raw.locationType as LocationType

  if (raw.employmentType && typeof raw.employmentType === 'string')
    data.employmentType = raw.employmentType as EmploymentType

  if (salaryMin !== undefined) data.salaryMin = salaryMin
  if (salaryMax !== undefined) data.salaryMax = salaryMax

  const salaryCurrency = collectOptionalString(
    'Salary currency',
    raw.salaryCurrency,
    10,
    []
  )
  if (salaryCurrency !== undefined) data.salaryCurrency = salaryCurrency

  const requirements = collectOptionalString(
    'Requirements',
    raw.requirements,
    10000,
    []
  )
  if (requirements !== undefined) data.requirements = requirements

  const benefits = collectOptionalString('Benefits', raw.benefits, 10000, [])
  if (benefits !== undefined) data.benefits = benefits

  if (raw.status) data.status = raw.status as RoleStatus

  if (raw.postedById && typeof raw.postedById === 'string')
    data.postedById = raw.postedById.trim()

  const publishedAt = collectOptionalDate('Published at', raw.publishedAt, [])
  if (publishedAt !== undefined) data.publishedAt = publishedAt

  const closesAt = collectOptionalDate('Closes at', raw.closesAt, [])
  if (closesAt !== undefined) data.closesAt = closesAt

  return { success: true, data }
}

// ---------------------------------------------------------------------------
// validateUpdateRole
// ---------------------------------------------------------------------------

export function validateUpdateRole(
  raw: Record<string, unknown>
): ValidationResult<UpdateRoleInput> {
  const errors: string[] = []

  const knownFields: (keyof UpdateRoleInput)[] = [
    'title',
    'company',
    'description',
    'department',
    'location',
    'locationType',
    'employmentType',
    'salaryMin',
    'salaryMax',
    'salaryCurrency',
    'requirements',
    'benefits',
    'status',
    'postedById',
    'publishedAt',
    'closesAt',
  ]
  const providedFields = knownFields.filter((f) => f in raw)
  if (providedFields.length === 0) {
    errors.push('At least one field must be provided for update')
    return { success: false, errors }
  }

  // title — optional, must be non-empty if provided
  if ('title' in raw) {
    if (!raw.title || typeof raw.title !== 'string' || !raw.title.trim()) {
      errors.push('Title must not be empty')
    } else if ((raw.title as string).trim().length > 200) {
      errors.push('Title must not exceed 200 characters')
    }
  }

  // company — optional, must be non-empty if provided
  if ('company' in raw) {
    if (!raw.company || typeof raw.company !== 'string' || !raw.company.trim()) {
      errors.push('Company must not be empty')
    } else if ((raw.company as string).trim().length > 200) {
      errors.push('Company must not exceed 200 characters')
    }
  }

  // description — nullable, max 10000
  if ('description' in raw && raw.description !== null) {
    collectOptionalString('Description', raw.description, 10000, errors)
  }

  // department — nullable, max 200
  if ('department' in raw && raw.department !== null) {
    collectOptionalString('Department', raw.department, 200, errors)
  }

  // location — nullable, max 300
  if ('location' in raw && raw.location !== null) {
    collectOptionalString('Location', raw.location, 300, errors)
  }

  // locationType — optional enum
  if (
    'locationType' in raw &&
    raw.locationType !== null &&
    raw.locationType !== ''
  ) {
    if (!VALID_LOCATION_TYPES.includes(raw.locationType as LocationType)) {
      errors.push(
        `Location type must be one of: ${VALID_LOCATION_TYPES.join(', ')}`
      )
    }
  }

  // employmentType — optional enum
  if (
    'employmentType' in raw &&
    raw.employmentType !== null &&
    raw.employmentType !== ''
  ) {
    if (!VALID_EMPLOYMENT_TYPES.includes(raw.employmentType as EmploymentType)) {
      errors.push(
        `Employment type must be one of: ${VALID_EMPLOYMENT_TYPES.join(', ')}`
      )
    }
  }

  // salaryMin — nullable non-negative integer
  let salaryMin: number | undefined
  if ('salaryMin' in raw && raw.salaryMin !== null && raw.salaryMin !== '') {
    salaryMin = collectOptionalPositiveInt('Salary min', raw.salaryMin, errors)
  }

  // salaryMax — nullable non-negative integer
  let salaryMax: number | undefined
  if ('salaryMax' in raw && raw.salaryMax !== null && raw.salaryMax !== '') {
    salaryMax = collectOptionalPositiveInt('Salary max', raw.salaryMax, errors)
  }

  // Cross-field: min must not exceed max
  if (
    salaryMin !== undefined &&
    salaryMax !== undefined &&
    salaryMin > salaryMax
  ) {
    errors.push('Salary min must not exceed salary max')
  }

  // salaryCurrency — nullable, max 10
  if (
    'salaryCurrency' in raw &&
    raw.salaryCurrency !== null &&
    raw.salaryCurrency !== ''
  ) {
    collectOptionalString('Salary currency', raw.salaryCurrency, 10, errors)
  }

  // requirements — nullable, max 10000
  if ('requirements' in raw && raw.requirements !== null) {
    collectOptionalString('Requirements', raw.requirements, 10000, errors)
  }

  // benefits — nullable, max 10000
  if ('benefits' in raw && raw.benefits !== null) {
    collectOptionalString('Benefits', raw.benefits, 10000, errors)
  }

  // status — optional enum
  if ('status' in raw && raw.status !== null && raw.status !== '') {
    if (!VALID_ROLE_STATUSES.includes(raw.status as RoleStatus)) {
      errors.push(
        `Status must be one of: ${VALID_ROLE_STATUSES.join(', ')}`
      )
    }
  }

  // postedById — nullable string
  if ('postedById' in raw && raw.postedById !== null && raw.postedById !== '') {
    if (typeof raw.postedById !== 'string') {
      errors.push('Posted by ID must be a string')
    }
  }

  // publishedAt — nullable ISO date
  if (
    'publishedAt' in raw &&
    raw.publishedAt !== null &&
    raw.publishedAt !== ''
  ) {
    collectOptionalDate('Published at', raw.publishedAt, errors)
  }

  // closesAt — nullable ISO date
  if (
    'closesAt' in raw &&
    raw.closesAt !== null &&
    raw.closesAt !== ''
  ) {
    collectOptionalDate('Closes at', raw.closesAt, errors)
  }

  if (errors.length > 0) return { success: false, errors }

  const data: UpdateRoleInput = {}

  if ('title' in raw && raw.title && typeof raw.title === 'string')
    data.title = (raw.title as string).trim()

  if ('company' in raw && raw.company && typeof raw.company === 'string')
    data.company = (raw.company as string).trim()

  if ('description' in raw)
    data.description =
      raw.description && typeof raw.description === 'string'
        ? (raw.description as string).trim()
        : null

  if ('department' in raw)
    data.department =
      raw.department && typeof raw.department === 'string'
        ? (raw.department as string).trim()
        : null

  if ('location' in raw)
    data.location =
      raw.location && typeof raw.location === 'string'
        ? (raw.location as string).trim()
        : null

  if ('locationType' in raw && raw.locationType)
    data.locationType = raw.locationType as LocationType

  if ('employmentType' in raw && raw.employmentType)
    data.employmentType = raw.employmentType as EmploymentType

  if ('salaryMin' in raw)
    data.salaryMin =
      raw.salaryMin !== null && raw.salaryMin !== '' ? salaryMin ?? null : null

  if ('salaryMax' in raw)
    data.salaryMax =
      raw.salaryMax !== null && raw.salaryMax !== '' ? salaryMax ?? null : null

  if ('salaryCurrency' in raw)
    data.salaryCurrency =
      raw.salaryCurrency && typeof raw.salaryCurrency === 'string'
        ? (raw.salaryCurrency as string).trim()
        : null

  if ('requirements' in raw)
    data.requirements =
      raw.requirements && typeof raw.requirements === 'string'
        ? (raw.requirements as string).trim()
        : null

  if ('benefits' in raw)
    data.benefits =
      raw.benefits && typeof raw.benefits === 'string'
        ? (raw.benefits as string).trim()
        : null

  if ('status' in raw && raw.status) data.status = raw.status as RoleStatus

  if ('postedById' in raw)
    data.postedById =
      raw.postedById && typeof raw.postedById === 'string'
        ? (raw.postedById as string).trim()
        : null

  if ('publishedAt' in raw)
    data.publishedAt =
      raw.publishedAt !== null && raw.publishedAt !== ''
        ? collectOptionalDate('Published at', raw.publishedAt, []) ?? null
        : null

  if ('closesAt' in raw)
    data.closesAt =
      raw.closesAt !== null && raw.closesAt !== ''
        ? collectOptionalDate('Closes at', raw.closesAt, []) ?? null
        : null

  return { success: true, data }
}
