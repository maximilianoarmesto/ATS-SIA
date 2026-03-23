import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { prisma } from '@/lib/prisma'
import {
  validateCreateCandidate,
  validateResumeFile,
} from '@/lib/validations/candidate'
import { CandidateStatus } from '@prisma/client'

// ---------------------------------------------------------------------------
// GET /api/candidates
// Query params:
//   status   — filter by CandidateStatus (optional)
//   search   — partial match on firstName, lastName, or email (optional)
//   page     — 1-based page number (default: 1)
//   pageSize — number of results per page (default: 20, max: 100)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl

    const statusParam = searchParams.get('status')
    const search = searchParams.get('search')?.trim() ?? ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10))
    )

    // Validate status filter
    const validStatuses: CandidateStatus[] = [
      'ACTIVE',
      'HIRED',
      'INACTIVE',
      'BLACKLISTED',
    ]
    if (statusParam && !validStatuses.includes(statusParam as CandidateStatus)) {
      return NextResponse.json(
        {
          error: 'Invalid status filter',
          validValues: validStatuses,
        },
        { status: 400 }
      )
    }

    const where = {
      ...(statusParam ? { status: statusParam as CandidateStatus } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: { applications: true },
          },
        },
      }),
      prisma.candidate.count({ where }),
    ])

    return NextResponse.json({
      data: candidates,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('GET /api/candidates error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch candidates' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/candidates
// Accepts multipart/form-data (with optional PDF resume) OR application/json.
//
// Multipart fields:
//   email*, firstName*, lastName*, phone?, linkedinUrl?, portfolioUrl?,
//   location?, summary?, status?
//   resume  — optional PDF file (≤ 5 MB)
//
// When a resume file is provided it is validated (PDF, ≤5 MB) and its
// metadata stored.  Actual file persistence (S3, GCS, local disk …) is
// handled by the uploadResume helper — swap in your storage adapter there.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? ''

    let fields: Record<string, unknown> = {}
    let resumeFile: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()

      // Extract text fields
      for (const [key, value] of formData.entries()) {
        if (typeof value === 'string') {
          fields[key] = value
        }
      }

      // Extract resume file
      const maybeFile = formData.get('resume')
      if (maybeFile instanceof File && maybeFile.size > 0) {
        resumeFile = maybeFile
      }
    } else {
      // Fall back to JSON body
      fields = (await request.json()) as Record<string, unknown>
    }

    // Validate resume file before candidate fields so the caller gets all
    // errors in one shot when both are invalid.
    let resolvedResumeUrl: string | undefined

    if (resumeFile) {
      const fileResult = validateResumeFile(resumeFile)
      if (!fileResult.success) {
        return NextResponse.json(
          { error: 'Invalid resume file', details: fileResult.errors },
          { status: 422 }
        )
      }

      // Persist the file and obtain its public/storage URL.
      resolvedResumeUrl = await uploadResume(resumeFile)
    }

    // Validate candidate fields (without resumeUrl — that's set by the server)
    const validation = validateCreateCandidate(fields)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 422 }
      )
    }

    const createData = { ...validation.data }
    if (resolvedResumeUrl) {
      createData.resumeUrl = resolvedResumeUrl
    }

    const candidate = await prisma.candidate.create({
      data: createData,
      include: {
        _count: {
          select: { applications: true },
        },
      },
    })

    return NextResponse.json({ data: candidate }, { status: 201 })
  } catch (error) {
    // Prisma unique constraint violation (duplicate email)
    if (isPrismaUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: 'A candidate with this email already exists' },
        { status: 409 }
      )
    }

    console.error('POST /api/candidates error:', error)
    return NextResponse.json(
      { error: 'Failed to create candidate' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Persist a resume PDF to the local filesystem and return its public URL path.
 */
async function uploadResume(file: File): Promise<string> {
  const uploadsDir = join(process.cwd(), 'public', 'uploads', 'resumes')
  await mkdir(uploadsDir, { recursive: true })

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const fileName = `${Date.now()}-${safeName}`
  const filePath = join(uploadsDir, fileName)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  return `/api/uploads/resumes/${fileName}`
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  )
}
