/**
 * Tests — GET /api/candidates/search
 *
 * Verifies that:
 *  1. At least one search param (name or linkedin) is required → 400 otherwise.
 *  2. name search: matches firstName, lastName, or combined full-name tokens.
 *  3. linkedin search: partial, case-insensitive match on linkedinUrl.
 *  4. Combined name + linkedin search uses AND semantics (intersection).
 *  5. Pagination (page / pageSize) is applied and returned correctly.
 *  6. pageSize is clamped to [1, 100].
 *  7. Empty result sets return { data: [], pagination: { total: 0, … } }.
 *  8. Returns 500 on unexpected database errors.
 *  9. Validation: invalid page / pageSize produce 400 with descriptive errors.
 * 10. Query builder correctly constructs single- and multi-token name filters.
 *
 * Run via:
 *   npx tsx src/app/api/candidates/search/route.test.ts
 *
 * Exit code 0 = all tests pass.
 * Exit code 1 = one or more tests fail.
 *
 * Strategy: handler logic is extracted into injectable simulation functions
 * that accept a mock Prisma client — identical to the approach used by the
 * existing notes route tests.  No DB connection required.
 */

import assert from 'node:assert/strict'
import { validateCandidateSearch } from '@/lib/validations/candidate'

// ---------------------------------------------------------------------------
// Local mock type — avoids a dependency on @prisma/client (not installed in
// the test environment) while remaining structurally compatible with the real
// CandidateWithApplicationCount type used by the route handler.
// ---------------------------------------------------------------------------
interface MockCandidate {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  linkedinUrl: string | null
  portfolioUrl: string | null
  resumeUrl: string | null
  location: string | null
  summary: string | null
  status: string
  createdAt: Date
  updatedAt: Date
  _count: { applications: number }
}

// ---------------------------------------------------------------------------
// Minimal async test runner (matches project convention)
// ---------------------------------------------------------------------------

let passed = 0
let failed = 0
const failures: string[] = []
const pendingTests: Array<{
  suite: string
  description: string
  fn: () => Promise<void> | void
}> = []
let currentSuite = ''

function test(description: string, fn: () => Promise<void> | void): void {
  pendingTests.push({ suite: currentSuite, description, fn })
}

function describe(suite: string, fn: () => void): void {
  currentSuite = suite
  fn()
  currentSuite = ''
}

async function runAll(): Promise<void> {
  let lastSuite = ''
  for (const { suite, description, fn } of pendingTests) {
    if (suite !== lastSuite) {
      console.log(`\n${suite}`)
      lastSuite = suite
    }
    try {
      await fn()
      passed++
      console.log(`  ✓ ${description}`)
    } catch (err) {
      failed++
      const message = err instanceof Error ? err.message : String(err)
      failures.push(`  ✗ ${description}\n      ${message}`)
      console.error(`  ✗ ${description}`)
      console.error(`      ${message}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCandidate(overrides: Partial<MockCandidate> = {}): MockCandidate {
  const now = new Date('2024-06-01T10:00:00.000Z')
  return {
    id: 'cand_001',
    email: 'jane.doe@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    phone: null,
    linkedinUrl: 'https://linkedin.com/in/janedoe',
    portfolioUrl: null,
    resumeUrl: null,
    location: null,
    summary: null,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    _count: { applications: 0 },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Mock Prisma factory
// ---------------------------------------------------------------------------

type MockPrisma = {
  candidate: {
    findMany: (args: unknown) => Promise<MockCandidate[]>
    count: (args: unknown) => Promise<number>
  }
}

function makePrismaMock(overrides: Partial<{
  findMany: (args: unknown) => Promise<MockCandidate[]>
  count: (args: unknown) => Promise<number>
}> = {}): MockPrisma {
  return {
    candidate: {
      findMany: overrides.findMany ?? (async () => []),
      count: overrides.count ?? (async () => 0),
    },
  }
}

// ---------------------------------------------------------------------------
// Handler simulator — mirrors the real route handler logic exactly, with an
// injectable Prisma client so tests are fully hermetic.
// ---------------------------------------------------------------------------

/** Re-implementation of the internal name-filter builder (kept in sync). */
function buildNameFilters(name: string | undefined): object | undefined {
  if (!name) return undefined
  const tokens = name.split(/\s+/).filter(Boolean)
  if (tokens.length <= 1) {
    return {
      OR: [
        { firstName: { contains: name, mode: 'insensitive' } },
        { lastName: { contains: name, mode: 'insensitive' } },
      ],
    }
  }
  const tokenClauses = tokens.map((token) => ({
    OR: [
      { firstName: { contains: token, mode: 'insensitive' } },
      { lastName: { contains: token, mode: 'insensitive' } },
    ],
  }))
  return {
    OR: [
      { AND: tokenClauses },
      { firstName: { contains: name, mode: 'insensitive' } },
      { lastName: { contains: name, mode: 'insensitive' } },
    ],
  }
}

function buildLinkedinFilter(linkedin: string | undefined): object | undefined {
  if (!linkedin) return undefined
  return { linkedinUrl: { contains: linkedin, mode: 'insensitive' } }
}

async function simulateSearchCandidates(
  rawParams: Record<string, string | null | undefined>,
  prisma: MockPrisma
): Promise<{ status: number; body: unknown }> {
  try {
    const validation = validateCandidateSearch(rawParams)
    if (!validation.success) {
      return {
        status: 400,
        body: { error: 'Invalid search parameters', errors: validation.errors },
      }
    }

    const { name, linkedin, page, pageSize } = validation.data

    const nameFilters = buildNameFilters(name)
    const linkedinFilter = buildLinkedinFilter(linkedin)

    const andClauses: object[] = []
    if (nameFilters) andClauses.push(nameFilters)
    if (linkedinFilter) andClauses.push(linkedinFilter)

    const where =
      andClauses.length > 1
        ? { AND: andClauses }
        : andClauses[0] ?? {}

    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { applications: true } } },
      }),
      prisma.candidate.count({ where }),
    ])

    return {
      status: 200,
      body: {
        data: candidates,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    }
  } catch {
    return { status: 500, body: { error: 'Failed to search candidates' } }
  }
}

// ---------------------------------------------------------------------------
// 1. Validation — missing search parameters
// ---------------------------------------------------------------------------

describe('GET /api/candidates/search — validation: missing params', () => {
  test('returns 400 when no search params are provided', async () => {
    const result = await simulateSearchCandidates({}, makePrismaMock())
    assert.equal(result.status, 400)
  })

  test('returns descriptive errors array when no params are provided', async () => {
    const result = await simulateSearchCandidates({}, makePrismaMock())
    const body = result.body as { error: string; errors: string[] }
    assert.equal(body.error, 'Invalid search parameters')
    assert.ok(Array.isArray(body.errors) && body.errors.length > 0)
    assert.ok(body.errors.some((e) => e.toLowerCase().includes('"name"') || e.toLowerCase().includes('name')))
  })

  test('returns 400 when name is empty string', async () => {
    const result = await simulateSearchCandidates({ name: '' }, makePrismaMock())
    assert.equal(result.status, 400)
  })

  test('returns 400 when linkedin is empty string', async () => {
    const result = await simulateSearchCandidates({ linkedin: '' }, makePrismaMock())
    assert.equal(result.status, 400)
  })

  test('returns 400 when both name and linkedin are empty strings', async () => {
    const result = await simulateSearchCandidates({ name: '', linkedin: '' }, makePrismaMock())
    assert.equal(result.status, 400)
  })

  test('returns 400 when name is whitespace-only', async () => {
    const result = await simulateSearchCandidates({ name: '   ' }, makePrismaMock())
    assert.equal(result.status, 400)
  })

  test('does NOT call prisma when validation fails', async () => {
    let findManyCalled = false
    const prisma = makePrismaMock({
      findMany: async () => { findManyCalled = true; return [] },
    })
    await simulateSearchCandidates({}, prisma)
    assert.equal(findManyCalled, false)
  })
})

// ---------------------------------------------------------------------------
// 2. Validation — name parameter boundary checks
// ---------------------------------------------------------------------------

describe('GET /api/candidates/search — validation: name param', () => {
  test('accepts name with 1 character', async () => {
    const result = await simulateSearchCandidates({ name: 'J' }, makePrismaMock())
    assert.equal(result.status, 200)
  })

  test('accepts name at exactly 200 characters', async () => {
    const result = await simulateSearchCandidates({ name: 'a'.repeat(200) }, makePrismaMock())
    assert.equal(result.status, 200)
  })

  test('returns 400 when name exceeds 200 characters', async () => {
    const result = await simulateSearchCandidates({ name: 'a'.repeat(201) }, makePrismaMock())
    assert.equal(result.status, 400)
    const body = result.body as { errors: string[] }
    assert.ok(body.errors.some((e) => e.includes('200')))
  })
})

// ---------------------------------------------------------------------------
// 3. Validation — linkedin parameter boundary checks
// ---------------------------------------------------------------------------

describe('GET /api/candidates/search — validation: linkedin param', () => {
  test('accepts linkedin with a short value', async () => {
    const result = await simulateSearchCandidates({ linkedin: 'janedoe' }, makePrismaMock())
    assert.equal(result.status, 200)
  })

  test('accepts linkedin at exactly 500 characters', async () => {
    const result = await simulateSearchCandidates({ linkedin: 'a'.repeat(500) }, makePrismaMock())
    assert.equal(result.status, 200)
  })

  test('returns 400 when linkedin exceeds 500 characters', async () => {
    const result = await simulateSearchCandidates({ linkedin: 'a'.repeat(501) }, makePrismaMock())
    assert.equal(result.status, 400)
    const body = result.body as { errors: string[] }
    assert.ok(body.errors.some((e) => e.includes('500')))
  })
})

// ---------------------------------------------------------------------------
// 4. Validation — page and pageSize params
// ---------------------------------------------------------------------------

describe('GET /api/candidates/search — validation: pagination params', () => {
  test('defaults page to 1 when not provided', async () => {
    const result = await simulateSearchCandidates({ name: 'Jane' }, makePrismaMock())
    assert.equal(result.status, 200)
    const body = result.body as { pagination: { page: number } }
    assert.equal(body.pagination.page, 1)
  })

  test('defaults pageSize to 20 when not provided', async () => {
    const result = await simulateSearchCandidates({ name: 'Jane' }, makePrismaMock())
    const body = result.body as { pagination: { pageSize: number } }
    assert.equal(body.pagination.pageSize, 20)
  })

  test('respects a valid page value', async () => {
    const result = await simulateSearchCandidates({ name: 'Jane', page: '3' }, makePrismaMock())
    const body = result.body as { pagination: { page: number } }
    assert.equal(body.pagination.page, 3)
  })

  test('respects a valid pageSize value', async () => {
    const result = await simulateSearchCandidates({ name: 'Jane', pageSize: '50' }, makePrismaMock())
    const body = result.body as { pagination: { pageSize: number } }
    assert.equal(body.pagination.pageSize, 50)
  })

  test('clamps pageSize to 100 when provided value exceeds 100', async () => {
    const result = await simulateSearchCandidates({ name: 'Jane', pageSize: '9999' }, makePrismaMock())
    const body = result.body as { pagination: { pageSize: number } }
    assert.equal(body.pagination.pageSize, 100)
  })

  test('clamps pageSize to 1 when provided value is 0', async () => {
    const result = await simulateSearchCandidates({ name: 'Jane', pageSize: '0' }, makePrismaMock())
    const body = result.body as { pagination: { pageSize: number } }
    assert.equal(body.pagination.pageSize, 1)
  })

  test('clamps page to 1 when provided value is negative', async () => {
    const result = await simulateSearchCandidates({ name: 'Jane', page: '-5' }, makePrismaMock())
    const body = result.body as { pagination: { page: number } }
    assert.equal(body.pagination.page, 1)
  })

  test('returns 400 when page is not a number', async () => {
    const result = await simulateSearchCandidates({ name: 'Jane', page: 'abc' }, makePrismaMock())
    assert.equal(result.status, 400)
    const body = result.body as { errors: string[] }
    assert.ok(body.errors.some((e) => e.toLowerCase().includes('page')))
  })

  test('returns 400 when pageSize is not a number', async () => {
    const result = await simulateSearchCandidates({ name: 'Jane', pageSize: 'big' }, makePrismaMock())
    assert.equal(result.status, 400)
    const body = result.body as { errors: string[] }
    assert.ok(body.errors.some((e) => e.toLowerCase().includes('pagesize')))
  })
})

// ---------------------------------------------------------------------------
// 5. Name search — filter construction and result shape
// ---------------------------------------------------------------------------

describe('GET /api/candidates/search — name search', () => {
  test('returns 200 with matching candidates', async () => {
    const candidates = [makeCandidate({ firstName: 'Jane', lastName: 'Doe' })]
    const prisma = makePrismaMock({ findMany: async () => candidates, count: async () => 1 })
    const result = await simulateSearchCandidates({ name: 'Jane' }, prisma)

    assert.equal(result.status, 200)
    const body = result.body as { data: MockCandidate[] }
    assert.equal(body.data.length, 1)
    assert.equal(body.data[0].firstName, 'Jane')
  })

  test('returns empty data array when no candidates match', async () => {
    const prisma = makePrismaMock({ findMany: async () => [], count: async () => 0 })
    const result = await simulateSearchCandidates({ name: 'NoMatch' }, prisma)

    assert.equal(result.status, 200)
    const body = result.body as { data: MockCandidate[]; pagination: { total: number } }
    assert.equal(body.data.length, 0)
    assert.equal(body.pagination.total, 0)
  })

  test('response is wrapped in { data, pagination } envelope', async () => {
    const result = await simulateSearchCandidates({ name: 'Jane' }, makePrismaMock())
    const body = result.body as Record<string, unknown>
    assert.ok('data' in body, 'Response should have a data key')
    assert.ok('pagination' in body, 'Response should have a pagination key')
  })

  test('pagination includes total, page, pageSize, totalPages', async () => {
    const prisma = makePrismaMock({ findMany: async () => [], count: async () => 42 })
    const result = await simulateSearchCandidates({ name: 'Jane', pageSize: '10' }, prisma)
    const body = result.body as { pagination: { total: number; page: number; pageSize: number; totalPages: number } }
    assert.equal(body.pagination.total, 42)
    assert.equal(body.pagination.page, 1)
    assert.equal(body.pagination.pageSize, 10)
    assert.equal(body.pagination.totalPages, 5)
  })

  test('single-token name filter passes the token to findMany (single OR clause)', async () => {
    let capturedWhere: unknown
    const prisma = makePrismaMock({
      findMany: async (args) => { capturedWhere = (args as { where: unknown }).where; return [] },
      count: async () => 0,
    })
    await simulateSearchCandidates({ name: 'Jane' }, prisma)

    const where = capturedWhere as { OR: Array<{ firstName?: unknown; lastName?: unknown }> }
    assert.ok(Array.isArray(where.OR))
    assert.ok(where.OR.some((c) => c.firstName !== undefined))
    assert.ok(where.OR.some((c) => c.lastName !== undefined))
  })

  test('multi-token name filter builds AND-of-OR token clauses', async () => {
    let capturedWhere: unknown
    const prisma = makePrismaMock({
      findMany: async (args) => { capturedWhere = (args as { where: unknown }).where; return [] },
      count: async () => 0,
    })
    await simulateSearchCandidates({ name: 'Jane Doe' }, prisma)

    // The top-level should be an OR that includes an AND clause
    const where = capturedWhere as { OR: Array<{ AND?: unknown[] }> }
    assert.ok(Array.isArray(where.OR))
    const andClause = where.OR.find((c) => 'AND' in c)
    assert.ok(andClause, 'Multi-token search must include an AND clause for token matching')
    assert.ok(
      Array.isArray((andClause as { AND: unknown[] }).AND) &&
        (andClause as { AND: unknown[] }).AND.length === 2,
      'AND clause should have one sub-clause per token'
    )
  })

  test('findMany receives correct skip for page 2', async () => {
    let capturedSkip = -1
    const prisma = makePrismaMock({
      findMany: async (args) => {
        capturedSkip = (args as { skip: number }).skip
        return []
      },
      count: async () => 0,
    })
    await simulateSearchCandidates({ name: 'Jane', page: '2', pageSize: '10' }, prisma)
    assert.equal(capturedSkip, 10, 'skip should equal (page - 1) * pageSize')
  })

  test('findMany receives correct take value', async () => {
    let capturedTake = -1
    const prisma = makePrismaMock({
      findMany: async (args) => {
        capturedTake = (args as { take: number }).take
        return []
      },
      count: async () => 0,
    })
    await simulateSearchCandidates({ name: 'Jane', pageSize: '15' }, prisma)
    assert.equal(capturedTake, 15)
  })

  test('each returned candidate has id, firstName, lastName, email, status, _count', async () => {
    const candidate = makeCandidate()
    const prisma = makePrismaMock({ findMany: async () => [candidate], count: async () => 1 })
    const result = await simulateSearchCandidates({ name: 'Jane' }, prisma)
    const data = (result.body as { data: MockCandidate[] }).data[0]

    assert.ok(data.id !== undefined)
    assert.ok(data.firstName !== undefined)
    assert.ok(data.lastName !== undefined)
    assert.ok(data.email !== undefined)
    assert.ok(data.status !== undefined)
    assert.ok(data._count !== undefined && typeof data._count.applications === 'number')
  })
})

// ---------------------------------------------------------------------------
// 6. LinkedIn search
// ---------------------------------------------------------------------------

describe('GET /api/candidates/search — linkedin search', () => {
  test('returns 200 with matching candidates by linkedinUrl', async () => {
    const candidate = makeCandidate({ linkedinUrl: 'https://linkedin.com/in/janedoe' })
    const prisma = makePrismaMock({ findMany: async () => [candidate], count: async () => 1 })
    const result = await simulateSearchCandidates({ linkedin: 'janedoe' }, prisma)

    assert.equal(result.status, 200)
    const body = result.body as { data: MockCandidate[] }
    assert.equal(body.data.length, 1)
    assert.equal(body.data[0].linkedinUrl, 'https://linkedin.com/in/janedoe')
  })

  test('linkedin filter targets the linkedinUrl field (not firstName/lastName)', async () => {
    let capturedWhere: unknown
    const prisma = makePrismaMock({
      findMany: async (args) => { capturedWhere = (args as { where: unknown }).where; return [] },
      count: async () => 0,
    })
    await simulateSearchCandidates({ linkedin: 'janedoe' }, prisma)

    const where = capturedWhere as { linkedinUrl: { contains: string; mode: string } }
    assert.ok(where.linkedinUrl !== undefined, 'where should have a linkedinUrl clause')
    assert.equal(where.linkedinUrl.contains, 'janedoe')
    assert.equal(where.linkedinUrl.mode, 'insensitive')
  })

  test('returns empty results when no linkedin URL matches', async () => {
    const prisma = makePrismaMock({ findMany: async () => [], count: async () => 0 })
    const result = await simulateSearchCandidates({ linkedin: 'noprofile' }, prisma)

    assert.equal(result.status, 200)
    const body = result.body as { data: MockCandidate[] }
    assert.equal(body.data.length, 0)
  })

  test('search is case-insensitive for linkedin', async () => {
    let capturedWhere: unknown
    const prisma = makePrismaMock({
      findMany: async (args) => { capturedWhere = (args as { where: unknown }).where; return [] },
      count: async () => 0,
    })
    await simulateSearchCandidates({ linkedin: 'JaneDoe' }, prisma)

    const where = capturedWhere as { linkedinUrl: { mode: string } }
    assert.equal(where.linkedinUrl.mode, 'insensitive')
  })
})

// ---------------------------------------------------------------------------
// 7. Combined name + linkedin search (AND semantics)
// ---------------------------------------------------------------------------

describe('GET /api/candidates/search — combined name + linkedin search', () => {
  test('returns 200 when both params match a candidate', async () => {
    const candidate = makeCandidate()
    const prisma = makePrismaMock({ findMany: async () => [candidate], count: async () => 1 })
    const result = await simulateSearchCandidates({ name: 'Jane', linkedin: 'janedoe' }, prisma)

    assert.equal(result.status, 200)
    assert.equal((result.body as { data: MockCandidate[] }).data.length, 1)
  })

  test('combined filter uses AND to intersect name and linkedin results', async () => {
    let capturedWhere: unknown
    const prisma = makePrismaMock({
      findMany: async (args) => { capturedWhere = (args as { where: unknown }).where; return [] },
      count: async () => 0,
    })
    await simulateSearchCandidates({ name: 'Jane', linkedin: 'janedoe' }, prisma)

    const where = capturedWhere as { AND?: unknown[] }
    assert.ok(where.AND !== undefined, 'Combined search must use AND at the top level')
    assert.equal((where.AND as unknown[]).length, 2, 'AND should have exactly 2 clauses')
  })

  test('returns empty results when name matches but linkedin does not', async () => {
    // Combined AND → an empty result set because linkedin filter narrows to nothing
    const prisma = makePrismaMock({ findMany: async () => [], count: async () => 0 })
    const result = await simulateSearchCandidates({ name: 'Jane', linkedin: 'noprofile' }, prisma)

    assert.equal(result.status, 200)
    assert.equal((result.body as { data: MockCandidate[] }).data.length, 0)
  })
})

// ---------------------------------------------------------------------------
// 8. Pagination — correctness and edge cases
// ---------------------------------------------------------------------------

describe('GET /api/candidates/search — pagination', () => {
  test('totalPages is ceil(total / pageSize)', async () => {
    const prisma = makePrismaMock({ count: async () => 25 })
    const result = await simulateSearchCandidates({ name: 'Jane', pageSize: '10' }, prisma)
    const body = result.body as { pagination: { totalPages: number } }
    assert.equal(body.pagination.totalPages, 3)
  })

  test('totalPages is 0 when total is 0', async () => {
    const prisma = makePrismaMock({ count: async () => 0 })
    const result = await simulateSearchCandidates({ name: 'Jane', pageSize: '10' }, prisma)
    const body = result.body as { pagination: { totalPages: number } }
    assert.equal(body.pagination.totalPages, 0)
  })

  test('totalPages is 1 when total equals pageSize', async () => {
    const prisma = makePrismaMock({ count: async () => 20 })
    const result = await simulateSearchCandidates({ name: 'Jane', pageSize: '20' }, prisma)
    const body = result.body as { pagination: { totalPages: number } }
    assert.equal(body.pagination.totalPages, 1)
  })

  test('findMany and count are called with the same where clause', async () => {
    const seenWheres: unknown[] = []
    const prisma = makePrismaMock({
      findMany: async (args) => { seenWheres.push((args as { where: unknown }).where); return [] },
      count: async (args) => { seenWheres.push((args as { where: unknown }).where); return 0 },
    })
    await simulateSearchCandidates({ name: 'Jane' }, prisma)

    assert.equal(seenWheres.length, 2, 'Both findMany and count should be called')
    assert.deepEqual(seenWheres[0], seenWheres[1], 'Both calls should use identical where clauses')
  })

  test('multiple pages return different slices (simulated store)', async () => {
    const allCandidates = Array.from({ length: 5 }, (_, i) =>
      makeCandidate({ id: `c${i}`, firstName: 'Jane', lastName: `Doe${i}`, email: `jane${i}@e.com` })
    )
    const prisma = makePrismaMock({
      findMany: async (args) => {
        const { skip, take } = args as { skip: number; take: number }
        return allCandidates.slice(skip, skip + take)
      },
      count: async () => allCandidates.length,
    })

    const page1 = await simulateSearchCandidates({ name: 'Jane', pageSize: '3', page: '1' }, prisma)
    const page2 = await simulateSearchCandidates({ name: 'Jane', pageSize: '3', page: '2' }, prisma)

    assert.equal((page1.body as { data: MockCandidate[] }).data.length, 3)
    assert.equal((page2.body as { data: MockCandidate[] }).data.length, 2)
  })
})

// ---------------------------------------------------------------------------
// 9. Database error handling
// ---------------------------------------------------------------------------

describe('GET /api/candidates/search — database errors', () => {
  test('returns 500 when findMany throws', async () => {
    const prisma = makePrismaMock({
      findMany: async () => { throw new Error('DB connection lost') },
      count: async () => 0,
    })
    const result = await simulateSearchCandidates({ name: 'Jane' }, prisma)
    assert.equal(result.status, 500)
    const body = result.body as { error: string }
    assert.ok(body.error.toLowerCase().includes('failed'))
  })

  test('returns 500 when count throws', async () => {
    const prisma = makePrismaMock({
      findMany: async () => [],
      count: async () => { throw new Error('Timeout') },
    })
    const result = await simulateSearchCandidates({ name: 'Jane' }, prisma)
    assert.equal(result.status, 500)
  })

  test('error response has a human-readable error string', async () => {
    const prisma = makePrismaMock({
      findMany: async () => { throw new Error('Query failed') },
    })
    const result = await simulateSearchCandidates({ name: 'Jane' }, prisma)
    const body = result.body as { error: string }
    assert.equal(typeof body.error, 'string')
    assert.ok(body.error.length > 0)
  })
})

// ---------------------------------------------------------------------------
// 10. Filter builder unit tests — buildNameFilters
// ---------------------------------------------------------------------------

describe('buildNameFilters — unit tests', () => {
  test('returns undefined for falsy input', () => {
    assert.equal(buildNameFilters(undefined), undefined)
    assert.equal(buildNameFilters(''), undefined)
  })

  test('single token: returns OR with firstName and lastName contains clauses', () => {
    const filter = buildNameFilters('Jane') as { OR: Array<{ firstName?: unknown; lastName?: unknown }> }
    assert.ok(filter !== undefined)
    assert.ok(Array.isArray(filter.OR))
    assert.ok(filter.OR.some((c) => c.firstName !== undefined))
    assert.ok(filter.OR.some((c) => c.lastName !== undefined))
  })

  test('single token: contains value matches the input', () => {
    const filter = buildNameFilters('Jane') as {
      OR: Array<{ firstName?: { contains: string }; lastName?: { contains: string } }>
    }
    const fnClause = filter.OR.find((c) => c.firstName !== undefined)
    assert.equal(fnClause?.firstName?.contains, 'Jane')
  })

  test('single token: mode is insensitive', () => {
    const filter = buildNameFilters('Jane') as {
      OR: Array<{ firstName?: { mode: string } }>
    }
    const fnClause = filter.OR.find((c) => c.firstName !== undefined)
    assert.equal(fnClause?.firstName?.mode, 'insensitive')
  })

  test('multi-token: returns OR that includes an AND of per-token clauses', () => {
    const filter = buildNameFilters('Jane Doe') as {
      OR: Array<{ AND?: unknown[]; firstName?: unknown; lastName?: unknown }>
    }
    assert.ok(Array.isArray(filter.OR))
    const andClause = filter.OR.find((c) => 'AND' in c)
    assert.ok(andClause !== undefined)
  })

  test('multi-token: AND clause has one entry per token', () => {
    const filter = buildNameFilters('Jane Doe') as {
      OR: Array<{ AND?: unknown[] }>
    }
    const andClause = filter.OR.find((c) => 'AND' in c)
    assert.equal((andClause as { AND: unknown[] }).AND.length, 2)
  })

  test('multi-token: also includes full-string fallback OR clauses', () => {
    const filter = buildNameFilters('Jane Doe') as {
      OR: Array<{ AND?: unknown[]; firstName?: unknown; lastName?: unknown }>
    }
    assert.ok(filter.OR.some((c) => c.firstName !== undefined))
    assert.ok(filter.OR.some((c) => c.lastName !== undefined))
  })

  test('three-token search: AND clause has three entries', () => {
    const filter = buildNameFilters('van der Berg') as {
      OR: Array<{ AND?: unknown[] }>
    }
    const andClause = filter.OR.find((c) => 'AND' in c)
    assert.equal((andClause as { AND: unknown[] }).AND.length, 3)
  })
})

// ---------------------------------------------------------------------------
// 11. Filter builder unit tests — buildLinkedinFilter
// ---------------------------------------------------------------------------

describe('buildLinkedinFilter — unit tests', () => {
  test('returns undefined for falsy input', () => {
    assert.equal(buildLinkedinFilter(undefined), undefined)
    assert.equal(buildLinkedinFilter(''), undefined)
  })

  test('returns contains clause on linkedinUrl', () => {
    const filter = buildLinkedinFilter('janedoe') as {
      linkedinUrl: { contains: string; mode: string }
    }
    assert.equal(filter.linkedinUrl.contains, 'janedoe')
    assert.equal(filter.linkedinUrl.mode, 'insensitive')
  })

  test('passes through full URL fragment correctly', () => {
    const filter = buildLinkedinFilter('linkedin.com/in/jane') as {
      linkedinUrl: { contains: string }
    }
    assert.equal(filter.linkedinUrl.contains, 'linkedin.com/in/jane')
  })
})

// ---------------------------------------------------------------------------
// 12. validateCandidateSearch — unit tests (validation module)
// ---------------------------------------------------------------------------

describe('validateCandidateSearch — unit tests', () => {
  test('fails when no params provided', () => {
    const result = validateCandidateSearch({})
    assert.equal(result.success, false)
    if (!result.success) {
      assert.ok(result.errors.length > 0)
    }
  })

  test('succeeds with only name', () => {
    const result = validateCandidateSearch({ name: 'Jane' })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.name, 'Jane')
      assert.equal(result.data.linkedin, undefined)
    }
  })

  test('succeeds with only linkedin', () => {
    const result = validateCandidateSearch({ linkedin: 'janedoe' })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.linkedin, 'janedoe')
      assert.equal(result.data.name, undefined)
    }
  })

  test('succeeds with both name and linkedin', () => {
    const result = validateCandidateSearch({ name: 'Jane', linkedin: 'janedoe' })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.name, 'Jane')
      assert.equal(result.data.linkedin, 'janedoe')
    }
  })

  test('trims name before use', () => {
    const result = validateCandidateSearch({ name: '  Jane  ' })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.name, 'Jane')
    }
  })

  test('trims linkedin before use', () => {
    const result = validateCandidateSearch({ linkedin: '  janedoe  ' })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.linkedin, 'janedoe')
    }
  })

  test('defaults page to 1', () => {
    const result = validateCandidateSearch({ name: 'Jane' })
    assert.equal(result.success, true)
    if (result.success) assert.equal(result.data.page, 1)
  })

  test('defaults pageSize to 20', () => {
    const result = validateCandidateSearch({ name: 'Jane' })
    assert.equal(result.success, true)
    if (result.success) assert.equal(result.data.pageSize, 20)
  })

  test('parses page from string', () => {
    const result = validateCandidateSearch({ name: 'Jane', page: '5' })
    assert.equal(result.success, true)
    if (result.success) assert.equal(result.data.page, 5)
  })

  test('clamps negative page to 1', () => {
    const result = validateCandidateSearch({ name: 'Jane', page: '-10' })
    assert.equal(result.success, true)
    if (result.success) assert.equal(result.data.page, 1)
  })

  test('clamps pageSize > 100 to 100', () => {
    const result = validateCandidateSearch({ name: 'Jane', pageSize: '500' })
    assert.equal(result.success, true)
    if (result.success) assert.equal(result.data.pageSize, 100)
  })

  test('clamps pageSize < 1 to 1', () => {
    const result = validateCandidateSearch({ name: 'Jane', pageSize: '0' })
    assert.equal(result.success, true)
    if (result.success) assert.equal(result.data.pageSize, 1)
  })

  test('rejects non-numeric page with an error', () => {
    const result = validateCandidateSearch({ name: 'Jane', page: 'nope' })
    assert.equal(result.success, false)
    if (!result.success) assert.ok(result.errors.some((e) => e.toLowerCase().includes('page')))
  })

  test('rejects non-numeric pageSize with an error', () => {
    const result = validateCandidateSearch({ name: 'Jane', pageSize: 'many' })
    assert.equal(result.success, false)
    if (!result.success) assert.ok(result.errors.some((e) => e.toLowerCase().includes('pagesize')))
  })

  test('data has page and pageSize always set on success', () => {
    const result = validateCandidateSearch({ name: 'X' })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(typeof result.data.page, 'number')
      assert.equal(typeof result.data.pageSize, 'number')
    }
  })
})

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

void (async function main() {
  await runAll()

  const total = passed + failed
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Test results: ${passed} passed, ${failed} failed, ${total} total`)

  if (failures.length > 0) {
    console.log('\nFailures:')
    failures.forEach((f) => console.log(f))
  }

  if (failed > 0) {
    process.exit(1)
  } else {
    console.log('\n✓ All candidate search route tests passed.')
  }
})()
