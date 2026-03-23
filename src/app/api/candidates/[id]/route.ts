import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  validateUpdateCandidate,
  validateResumeFile,
} from '@/lib/validations/candidate'

// ---------------------------------------------------------------------------
// GET /api/candidates/[id]
// Returns a single candidate with their application history.
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: {
        applications: {
          include: {
            role: true,
          },
          orderBy: { appliedAt: 'desc' },
        },
        _count: {
          select: { applications: true },
        },
      },
    })

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: candidate })
  } catch (error) {
    console.error('GET /api/candidates/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch candidate' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PUT /api/candidates/[id]
// Accepts multipart/form-data (with optional PDF resume) OR application/json.
// Only the fields present in the request body are updated (partial update).
//
// Multipart fields (all optional):
//   email?, firstName?, lastName?, phone?, linkedinUrl?, portfolioUrl?,
//   location?, summary?, status?
//   resume — optional new PDF file (≤ 5 MB); replaces the existing resumeUrl
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Confirm candidate exists before processing body
    const existing = await prisma.candidate.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      )
    }

    const contentType = request.headers.get('content-type') ?? ''

    let fields: Record<string, unknown> = {}
    let resumeFile: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()

      for (const [key, value] of formData.entries()) {
        if (typeof value === 'string') {
          // Allow callers to explicitly clear a nullable field by sending
          // the sentinel string "__null__" or an empty string for nullable
          // fields.  Empty strings for required fields are caught by the
          // validator.
          fields[key] = value === '__null__' ? null : value
        }
      }

      const maybeFile = formData.get('resume')
      if (maybeFile instanceof File && maybeFile.size > 0) {
        resumeFile = maybeFile
      }
    } else {
      fields = (await request.json()) as Record<string, unknown>
    }

    // Validate and upload new resume if provided
    if (resumeFile) {
      const fileResult = validateResumeFile(resumeFile)
      if (!fileResult.success) {
        return NextResponse.json(
          { error: 'Invalid resume file', details: fileResult.errors },
          { status: 422 }
        )
      }

      fields.resumeUrl = await uploadResume(resumeFile)
    }

    // Validate update fields
    const validation = validateUpdateCandidate(fields)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 422 }
      )
    }

    const updated = await prisma.candidate.update({
      where: { id },
      data: validation.data,
      include: {
        _count: {
          select: { applications: true },
        },
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    // Prisma unique constraint violation (duplicate email)
    if (isPrismaUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: 'A candidate with this email already exists' },
        { status: 409 }
      )
    }

    // Prisma record-not-found (race condition after the initial existence check)
    if (isPrismaNotFoundError(error)) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      )
    }

    console.error('PUT /api/candidates/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to update candidate' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Persist a resume PDF and return its accessible URL.
 * Swap this implementation for your real storage adapter (S3, GCS, R2 …).
 */
async function uploadResume(file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `/uploads/resumes/${Date.now()}-${safeName}`
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  )
}

function isPrismaNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2025'
  )
}
