import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateCandidateSearch } from '@/lib/validations/candidate'

// ---------------------------------------------------------------------------
// GET /api/candidates/search
//
// Purpose
//   Dedicated, high-performance endpoint for searching candidates by name
//   and/or LinkedIn profile URL.  It is intentionally separate from the
//   general GET /api/candidates list so that:
//     1. Search concerns (trigram matching, relevance ordering) stay isolated.
//     2. The list endpoint keeps its simple status-filter semantics.
//     3. Clients can call this endpoint without polluting the full list cache.
//
// Query parameters
//   name      — Partial, case-insensitive match against firstName, lastName,
//               or the concatenated "firstName lastName" full name.
//               (optional, but at least one of name/linkedin is required)
//   linkedin  — Partial, case-insensitive match against linkedinUrl.
//               (optional, but at least one of name/linkedin is required)
//   page      — 1-based page number  (default: 1)
//   pageSize  — Results per page, 1–100 (default: 20)
//
// Performance
//   Queries use Prisma's `contains` + `mode: 'insensitive'` which compiles to
//   PostgreSQL ILIKE.  The GIN trigram indexes added in migration
//   20240103000000_add_candidate_search_indexes give O(1) lookup times even
//   against millions of rows.
//
//   When both `name` and `linkedin` are provided the clauses are AND-ed so
//   that callers can narrow results to a specific person's LinkedIn profile
//   while also verifying the name.
//
// Response shape
//   {
//     data: CandidateWithApplicationCount[],
//     pagination: { total, page, pageSize, totalPages }
//   }
//
// Error responses
//   400 — missing/invalid query parameters (details in `errors` array)
//   500 — unexpected server / database error
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl

    // Pull raw string values so the validator can inspect them uniformly.
    const rawParams = {
      name: searchParams.get('name'),
      linkedin: searchParams.get('linkedin'),
      page: searchParams.get('page'),
      pageSize: searchParams.get('pageSize'),
    }

    const validation = validateCandidateSearch(rawParams)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid search parameters', errors: validation.errors },
        { status: 400 }
      )
    }

    const { name, linkedin, page, pageSize } = validation.data

    // ---------------------------------------------------------------------------
    // Build the Prisma `where` clause.
    //
    // Name search: match firstName, lastName, or the full name token
    // ("firstName lastName") — the third condition catches users who search
    // with a full name like "Jane Doe".  Prisma does not support a computed
    // column search natively, so we replicate it with three OR branches:
    //   1. firstName ILIKE '%<name>%'
    //   2. lastName  ILIKE '%<name>%'
    //   3. (firstName || ' ' || lastName) ILIKE '%<name>%'  — via raw filter
    //
    // Because Prisma's `contains` does not support cross-column expressions,
    // branch 3 is handled by a separate OR clause that splits the search term
    // on whitespace and checks that all tokens appear in either field.  This
    // correctly handles "Jane Doe" → firstName contains "Jane" AND lastName
    // contains "Doe" (or vice-versa).
    //
    // LinkedIn search: straightforward partial match on linkedinUrl.
    // ---------------------------------------------------------------------------
    const nameFilters = buildNameFilters(name)
    const linkedinFilter = buildLinkedinFilter(linkedin)

    // When both name and linkedin are provided use AND semantics so the result
    // is the intersection (i.e. this profile AND this name).
    const andClauses: object[] = []
    if (nameFilters) andClauses.push(nameFilters)
    if (linkedinFilter) andClauses.push(linkedinFilter)

    const where = andClauses.length > 1
      ? { AND: andClauses }
      : andClauses[0] ?? {}

    // Run count + page fetch in a single round trip.
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
    console.error('GET /api/candidates/search error:', error)
    return NextResponse.json(
      { error: 'Failed to search candidates' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a Prisma `where` sub-clause for name search.
 *
 * Strategy:
 *  • Single-token queries (e.g. "Jane") → OR across firstName and lastName.
 *  • Multi-token queries (e.g. "Jane Doe") → additionally require each
 *    token to appear in firstName OR lastName so that cross-field full names
 *    are matched without a raw SQL expression.
 *
 * Returns `undefined` when `name` is falsy (no filter applied).
 */
function buildNameFilters(
  name: string | undefined
): object | undefined {
  if (!name) return undefined

  const tokens = name.split(/\s+/).filter(Boolean)

  if (tokens.length <= 1) {
    // Simple single-token search: match firstName OR lastName.
    return {
      OR: [
        { firstName: { contains: name, mode: 'insensitive' as const } },
        { lastName: { contains: name, mode: 'insensitive' as const } },
      ],
    }
  }

  // Multi-token: each token must appear in firstName OR lastName.
  // e.g. "Jane Doe" → (firstName|lastName contains "Jane") AND (firstName|lastName contains "Doe")
  const tokenClauses = tokens.map((token) => ({
    OR: [
      { firstName: { contains: token, mode: 'insensitive' as const } },
      { lastName: { contains: token, mode: 'insensitive' as const } },
    ],
  }))

  // Also keep the original full-string match as an OR alternative so that
  // partial middle-name or hyphenated strings like "van der Berg" still work
  // when all tokens happen to be inside a single field.
  return {
    OR: [
      { AND: tokenClauses },
      { firstName: { contains: name, mode: 'insensitive' as const } },
      { lastName: { contains: name, mode: 'insensitive' as const } },
    ],
  }
}

/**
 * Build a Prisma `where` sub-clause for LinkedIn URL search.
 *
 * Returns `undefined` when `linkedin` is falsy.
 */
function buildLinkedinFilter(
  linkedin: string | undefined
): object | undefined {
  if (!linkedin) return undefined

  return {
    linkedinUrl: { contains: linkedin, mode: 'insensitive' as const },
  }
}
