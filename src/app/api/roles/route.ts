import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateCreateRole } from '@/lib/validations/role'
import { RoleStatus, LocationType, EmploymentType } from '@prisma/client'

// ---------------------------------------------------------------------------
// GET /api/roles
// Query params:
//   status         — filter by RoleStatus (optional)
//   locationType   — filter by LocationType (optional)
//   employmentType — filter by EmploymentType (optional)
//   department     — partial match on department (optional)
//   search         — partial match on title, company, or department (optional)
//   page           — 1-based page number (default: 1)
//   pageSize       — number of results per page (default: 20, max: 100)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl

    const statusParam = searchParams.get('status')
    const locationTypeParam = searchParams.get('locationType')
    const employmentTypeParam = searchParams.get('employmentType')
    const department = searchParams.get('department')?.trim() ?? ''
    const search = searchParams.get('search')?.trim() ?? ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10))
    )

    // Validate status filter
    const validStatuses: RoleStatus[] = [
      'DRAFT',
      'PUBLISHED',
      'PAUSED',
      'CLOSED',
      'ARCHIVED',
    ]
    if (statusParam && !validStatuses.includes(statusParam as RoleStatus)) {
      return NextResponse.json(
        { error: 'Invalid status filter', validValues: validStatuses },
        { status: 400 }
      )
    }

    // Validate locationType filter
    const validLocationTypes: LocationType[] = ['ON_SITE', 'REMOTE', 'HYBRID']
    if (
      locationTypeParam &&
      !validLocationTypes.includes(locationTypeParam as LocationType)
    ) {
      return NextResponse.json(
        {
          error: 'Invalid locationType filter',
          validValues: validLocationTypes,
        },
        { status: 400 }
      )
    }

    // Validate employmentType filter
    const validEmploymentTypes: EmploymentType[] = [
      'FULL_TIME',
      'PART_TIME',
      'CONTRACT',
      'INTERNSHIP',
      'TEMPORARY',
    ]
    if (
      employmentTypeParam &&
      !validEmploymentTypes.includes(employmentTypeParam as EmploymentType)
    ) {
      return NextResponse.json(
        {
          error: 'Invalid employmentType filter',
          validValues: validEmploymentTypes,
        },
        { status: 400 }
      )
    }

    const where = {
      ...(statusParam ? { status: statusParam as RoleStatus } : {}),
      ...(locationTypeParam
        ? { locationType: locationTypeParam as LocationType }
        : {}),
      ...(employmentTypeParam
        ? { employmentType: employmentTypeParam as EmploymentType }
        : {}),
      ...(department
        ? { department: { contains: department, mode: 'insensitive' as const } }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { company: { contains: search, mode: 'insensitive' as const } },
              {
                department: { contains: search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    }

    const [roles, total] = await Promise.all([
      prisma.role.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: { applications: true },
          },
        },
      }),
      prisma.role.count({ where }),
    ])

    return NextResponse.json({
      data: roles,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('GET /api/roles error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch roles' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/roles
// Accepts application/json.
//
// Required fields: title, company
// Optional fields: description, department, location, locationType,
//   employmentType, salaryMin, salaryMax, salaryCurrency, requirements,
//   benefits, status, postedById, publishedAt, closesAt
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const fields = (await request.json()) as Record<string, unknown>

    const validation = validateCreateRole(fields)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 422 }
      )
    }

    const role = await prisma.role.create({
      data: validation.data,
      include: {
        _count: {
          select: { applications: true },
        },
      },
    })

    return NextResponse.json({ data: role }, { status: 201 })
  } catch (error) {
    // Prisma foreign key violation (e.g. unknown postedById)
    if (isPrismaForeignKeyError(error)) {
      return NextResponse.json(
        { error: 'Referenced user (postedById) does not exist' },
        { status: 422 }
      )
    }

    console.error('POST /api/roles error:', error)
    return NextResponse.json(
      { error: 'Failed to create role' },
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
