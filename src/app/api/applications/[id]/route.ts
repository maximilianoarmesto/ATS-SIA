import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateUpdateApplication } from '@/lib/validations/application'

// ---------------------------------------------------------------------------
// GET /api/applications/[id]
// Returns a single application with its candidate and role details.
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        candidate: true,
        role: true,
      },
    })

    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: application })
  } catch (error) {
    console.error('GET /api/applications/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch application' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PUT /api/applications/[id]
// Accepts application/json.
// Only the fields present in the request body are updated (partial update).
//
// Updatable fields: status, stage, resumeUrl, coverLetter, notes, rating,
//   source
//
// Send null for a nullable field to explicitly clear it.
// Note: candidateId and roleId are immutable once the application is created.
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Confirm application exists before processing body
    const existing = await prisma.application.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    const fields = (await request.json()) as Record<string, unknown>

    const validation = validateUpdateApplication(fields)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 422 }
      )
    }

    const updated = await prisma.application.update({
      where: { id },
      data: validation.data,
      include: {
        candidate: true,
        role: true,
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    // Prisma record-not-found (race condition after the initial existence check)
    if (isPrismaNotFoundError(error)) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    console.error('PUT /api/applications/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to update application' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isPrismaNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2025'
  )
}
