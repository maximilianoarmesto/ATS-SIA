import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateCreateApplication } from '@/lib/validations/application'
import { ApplicationStatus, ApplicationStage } from '@prisma/client'

// ---------------------------------------------------------------------------
// GET /api/applications
// Query params:
//   candidateId    — filter by candidate (optional)
//   roleId         — filter by role (optional)
//   status         — filter by ApplicationStatus (optional)
//   stage          — filter by ApplicationStage (optional)
//   page           — 1-based page number (default: 1)
//   pageSize       — number of results per page (default: 20, max: 100)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl

    const candidateId = searchParams.get('candidateId')?.trim() ?? ''
    const roleId = searchParams.get('roleId')?.trim() ?? ''
    const statusParam = searchParams.get('status')
    const stageParam = searchParams.get('stage')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10))
    )

    // Validate status filter
    const validStatuses: ApplicationStatus[] = [
      'APPLIED',
      'UNDER_REVIEW',
      'SHORTLISTED',
      'INTERVIEWING',
      'OFFER_SENT',
      'HIRED',
      'REJECTED',
      'WITHDRAWN',
    ]
    if (statusParam && !validStatuses.includes(statusParam as ApplicationStatus)) {
      return NextResponse.json(
        { error: 'Invalid status filter', validValues: validStatuses },
        { status: 400 }
      )
    }

    // Validate stage filter
    const validStages: ApplicationStage[] = [
      'APPLICATION',
      'SCREENING',
      'ASSESSMENT',
      'INTERVIEW_1',
      'INTERVIEW_2',
      'FINAL_ROUND',
      'OFFER',
      'CLOSED',
    ]
    if (stageParam && !validStages.includes(stageParam as ApplicationStage)) {
      return NextResponse.json(
        { error: 'Invalid stage filter', validValues: validStages },
        { status: 400 }
      )
    }

    const where = {
      ...(candidateId ? { candidateId } : {}),
      ...(roleId ? { roleId } : {}),
      ...(statusParam ? { status: statusParam as ApplicationStatus } : {}),
      ...(stageParam ? { stage: stageParam as ApplicationStage } : {}),
    }

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        orderBy: [{ appliedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          candidate: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          role: {
            select: {
              id: true,
              title: true,
              company: true,
              department: true,
            },
          },
        },
      }),
      prisma.application.count({ where }),
    ])

    return NextResponse.json({
      data: applications,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('GET /api/applications error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch applications' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/applications
// Accepts application/json.
//
// Required fields: candidateId, roleId
// Optional fields: status, stage, resumeUrl, coverLetter, notes, rating, source
//
// The combination of candidateId + roleId must be unique — a candidate can
// only hold one active application per role at a time.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const fields = (await request.json()) as Record<string, unknown>

    const validation = validateCreateApplication(fields)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 422 }
      )
    }

    // Verify the referenced candidate exists
    const candidate = await prisma.candidate.findUnique({
      where: { id: validation.data.candidateId },
    })
    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      )
    }

    // Verify the referenced role exists
    const role = await prisma.role.findUnique({
      where: { id: validation.data.roleId },
    })
    if (!role) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      )
    }

    const application = await prisma.application.create({
      data: validation.data,
      include: {
        candidate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        role: {
          select: {
            id: true,
            title: true,
            company: true,
            department: true,
          },
        },
      },
    })

    return NextResponse.json({ data: application }, { status: 201 })
  } catch (error) {
    // Prisma unique constraint violation (duplicate candidateId + roleId)
    if (isPrismaUniqueConstraintError(error)) {
      return NextResponse.json(
        {
          error:
            'An application for this candidate and role already exists',
        },
        { status: 409 }
      )
    }

    // Prisma foreign key violation (candidateId or roleId does not exist)
    if (isPrismaForeignKeyError(error)) {
      return NextResponse.json(
        { error: 'Referenced candidate or role does not exist' },
        { status: 422 }
      )
    }

    console.error('POST /api/applications error:', error)
    return NextResponse.json(
      { error: 'Failed to create application' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  )
}

function isPrismaForeignKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2003'
  )
}
