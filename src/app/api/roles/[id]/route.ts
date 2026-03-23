import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateUpdateRole } from '@/lib/validations/role'

// ---------------------------------------------------------------------------
// GET /api/roles/[id]
// Returns a single role with its application count and optional relations.
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        postedBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { applications: true },
        },
      },
    })

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    return NextResponse.json({ data: role })
  } catch (error) {
    console.error('GET /api/roles/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch role' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PUT /api/roles/[id]
// Accepts application/json.
// Only the fields present in the request body are updated (partial update).
//
// Optional fields: title, company, description, department, location,
//   locationType, employmentType, salaryMin, salaryMax, salaryCurrency,
//   requirements, benefits, status, postedById, publishedAt, closesAt
//
// Send null for a nullable field to explicitly clear it.
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Confirm role exists before processing body
    const existing = await prisma.role.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    const fields = (await request.json()) as Record<string, unknown>

    const validation = validateUpdateRole(fields)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 422 }
      )
    }

    const updated = await prisma.role.update({
      where: { id },
      data: validation.data,
      include: {
        postedBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { applications: true },
        },
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    // Prisma foreign key violation (e.g. unknown postedById)
    if (isPrismaForeignKeyError(error)) {
      return NextResponse.json(
        { error: 'Referenced user (postedById) does not exist' },
        { status: 422 }
      )
    }

    // Prisma record-not-found (race condition after the initial existence check)
    if (isPrismaNotFoundError(error)) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    console.error('PUT /api/roles/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to update role' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isPrismaForeignKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2003'
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
