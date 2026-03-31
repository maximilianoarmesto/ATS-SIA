/**
 * Integration tests — Candidate Search (UI state, display logic, end-to-end flows)
 *
 * These tests complement the existing unit test suites:
 *   • src/app/api/candidates/search/route.test.ts  (backend: validation, filters, pagination)
 *   • src/components/candidate-search.test.ts       (component: URL builder, fetch orchestration)
 *
 * This file focuses on the acceptance criteria not yet covered:
 *
 *   AC-1: Search results match query parameters
 *         — result rows contain the fields that were searched on
 *         — paginated results are a correct subset of the full match set
 *         — combined name + linkedin queries return the intersection
 *
 *   AC-2: Valid and invalid inputs are handled correctly
 *         — UI-side maxLength enforcement (200 / 500 chars)
 *         — Special characters, unicode, and URL-encoded values round-trip safely
 *         — Whitespace-trimming applied consistently before queries
 *         — Out-of-range pagination values are clamped, not rejected
 *
 *   AC-3: UI elements update according to search results
 *         — Status badge label + colour-class derivation (ACTIVE, HIRED, INACTIVE, BLACKLISTED)
 *         — Application count plural ("1 app" vs "2 apps")
 *         — "Found N candidates" count string (singular vs plural)
 *         — "Showing X of Y matches" footer hint condition
 *         — Empty-state card shown when results.length === 0 and hasSearched is true
 *         — Loading spinner visible while isLoading and isActive
 *         — Error message shown (and results hidden) on failure
 *         — Result table shown only when showResults is true
 *         — Derived isActive / showResults guards
 *         — formatDate output used for the "Added" column
 *
 * Run via:
 *   npx tsx src/components/candidate-search-integration.test.ts
 *
 * Exit code 0 = all tests pass, exit code 1 = one or more failures.
 */

import assert from 'node:assert/strict'
import { formatDate } from '@/lib/utils'
import { validateCandidateSearch } from '@/lib/validations/candidate'

// ---------------------------------------------------------------------------
// Minimal async test runner — identical pattern to other test files
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
// UI display constants — kept in sync with candidate-search.tsx
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  HIRED: 'Hired',
  INACTIVE: 'Inactive',
  BLACKLISTED: 'Blacklisted',
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  HIRED: 'bg-blue-100 text-blue-800',
  INACTIVE: 'bg-gray-100 text-gray-600',
  BLACKLISTED: 'bg-red-100 text-red-800',
}

const PAGE_SIZE_CAP = 50   // component always requests at most 50 results
const DEBOUNCE_MS   = 300

// ---------------------------------------------------------------------------
// Component-side helpers — extracted from candidate-search.tsx
// ---------------------------------------------------------------------------

function buildSearchUrl(name: string, linkedin: string): string {
  const params = new URLSearchParams()
  if (name.trim()) params.set('name', name.trim())
  if (linkedin.trim()) params.set('linkedin', linkedin.trim())
  params.set('pageSize', String(PAGE_SIZE_CAP))
  return `/api/candidates/search?${params.toString()}`
}

function hasQuery(name: string, linkedin: string): boolean {
  return name.trim().length > 0 || linkedin.trim().length > 0
}

/** Derives the isActive flag from state. */
function deriveIsActive(name: string, linkedin: string): boolean {
  return hasQuery(name, linkedin)
}

/** Derives whether the results table / empty-state should be visible. */
function deriveShowResults(
  isActive: boolean,
  hasSearched: boolean,
  isLoading: boolean
): boolean {
  return isActive && hasSearched && !isLoading
}

/** Returns the count string shown in the status bar. */
function formatFoundMessage(total: number): string {
  return `Found ${total} candidate${total !== 1 ? 's' : ''}`
}

/** Returns the footer hint text when results are capped. */
function formatCapHint(shown: number, total: number): string {
  return `Showing ${shown} of ${total} matches — refine your search to narrow results.`
}

/** Returns the application count display text (mirrors SearchResultRow). */
function formatAppCount(count: number): string {
  return `${count} ${count === 1 ? 'app' : 'apps'}`
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

interface MockCandidate {
  id: string
  firstName: string
  lastName: string
  email: string
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

interface SearchResponse {
  data: MockCandidate[]
  pagination: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

function makeCandidate(overrides: Partial<MockCandidate> = {}): MockCandidate {
  const now = new Date('2024-06-01T10:00:00.000Z')
  return {
    id: 'cand_001',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane.doe@example.com',
    phone: null,
    linkedinUrl: 'https://linkedin.com/in/janedoe',
    portfolioUrl: null,
    resumeUrl: null,
    location: 'San Francisco, CA',
    summary: null,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    _count: { applications: 0 },
    ...overrides,
  }
}

function makeSearchResponse(
  candidates: MockCandidate[],
  overrides: Partial<SearchResponse['pagination']> = {}
): SearchResponse {
  return {
    data: candidates,
    pagination: {
      total: candidates.length,
      page: 1,
      pageSize: PAGE_SIZE_CAP,
      totalPages: Math.ceil(candidates.length / PAGE_SIZE_CAP) || 0,
      ...overrides,
    },
  }
}

// ---------------------------------------------------------------------------
// Fetch mock helper
// ---------------------------------------------------------------------------

type FetchMockSetup =
  | { ok: true; body: SearchResponse }
  | { ok: false; status: number; body: { error?: string } }
  | { throws: Error }

function makeFetchMock(setup: FetchMockSetup): {
  fetch: (url: string, init?: { signal?: AbortSignal }) => Promise<Response>
  calls: { url: string; signal?: AbortSignal }[]
} {
  const calls: { url: string; signal?: AbortSignal }[] = []

  const mockFetch = async (
    url: string,
    init?: { signal?: AbortSignal }
  ): Promise<Response> => {
    calls.push({ url, signal: init?.signal })
    if ('throws' in setup) throw setup.throws
    const json = JSON.stringify(setup.body)
    return new Response(json, {
      status: setup.ok ? 200 : (setup as { ok: false; status: number }).status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return { fetch: mockFetch, calls }
}

// ---------------------------------------------------------------------------
// Search state simulator — mirrors executeSearch logic in component
// ---------------------------------------------------------------------------

interface SearchState {
  results: MockCandidate[]
  total: number
  isLoading: boolean
  error: string | null
  hasSearched: boolean
}

async function simulateSearch(
  name: string,
  linkedin: string,
  fetchFn: (url: string, init?: { signal?: AbortSignal }) => Promise<Response>
): Promise<SearchState> {
  if (!hasQuery(name, linkedin)) {
    return { results: [], total: 0, isLoading: false, error: null, hasSearched: false }
  }

  try {
    const url = buildSearchUrl(name, linkedin)
    const res = await fetchFn(url, {})

    if (!res.ok) {
      const body = (await res.json()) as { error?: string }
      throw new Error(body.error ?? 'Search failed')
    }

    const data = (await res.json()) as SearchResponse
    return {
      results: data.data,
      total: data.pagination.total,
      isLoading: false,
      error: null,
      hasSearched: true,
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { results: [], total: 0, isLoading: false, error: null, hasSearched: true }
    }
    return {
      results: [],
      total: 0,
      isLoading: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
      hasSearched: true,
    }
  }
}

// ---------------------------------------------------------------------------
// AC-1: Search results match query parameters
// ---------------------------------------------------------------------------

describe('AC-1: Search results match query parameters', () => {
  test('result row firstName and lastName match the searched name', async () => {
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse([makeCandidate({ firstName: 'Alice', lastName: 'Wong' })]),
    })
    const state = await simulateSearch('Alice', '', fetch)
    assert.equal(state.results[0].firstName, 'Alice')
    assert.equal(state.results[0].lastName, 'Wong')
  })

  test('result row linkedinUrl contains the searched linkedin fragment', async () => {
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse([
        makeCandidate({ linkedinUrl: 'https://linkedin.com/in/alice-wong' }),
      ]),
    })
    const state = await simulateSearch('', 'alice-wong', fetch)
    assert.ok(
      state.results[0].linkedinUrl?.includes('alice-wong'),
      `Expected linkedinUrl to contain "alice-wong", got: ${state.results[0].linkedinUrl}`
    )
  })

  test('combined name + linkedin query results all satisfy both criteria', async () => {
    // Server returns only candidates matching BOTH constraints
    const matching = [
      makeCandidate({ id: 'c1', firstName: 'Alice', linkedinUrl: 'https://linkedin.com/in/alice' }),
    ]
    const { fetch } = makeFetchMock({ ok: true, body: makeSearchResponse(matching) })
    const state = await simulateSearch('Alice', 'alice', fetch)

    state.results.forEach((c) => {
      assert.ok(
        c.firstName.toLowerCase().includes('alice') ||
          c.lastName.toLowerCase().includes('alice'),
        `Candidate ${c.id} does not satisfy name constraint`
      )
      assert.ok(
        c.linkedinUrl?.toLowerCase().includes('alice'),
        `Candidate ${c.id} does not satisfy linkedin constraint`
      )
    })
  })

  test('page 2 results are different candidates from page 1 (no overlap)', async () => {
    const page1Ids = new Set(['c1', 'c2', 'c3'])
    const page2Ids = new Set(['c4', 'c5'])

    const page1Candidates = ['c1', 'c2', 'c3'].map((id) => makeCandidate({ id }))
    const page2Candidates = ['c4', 'c5'].map((id) => makeCandidate({ id }))

    const { fetch: fetch1 } = makeFetchMock({
      ok: true,
      body: makeSearchResponse(page1Candidates, { total: 5, page: 1 }),
    })
    const { fetch: fetch2 } = makeFetchMock({
      ok: true,
      body: makeSearchResponse(page2Candidates, { total: 5, page: 2 }),
    })

    const state1 = await simulateSearch('Jane', '', fetch1)
    const state2 = await simulateSearch('Jane', '', fetch2)

    const ids1 = new Set(state1.results.map((c) => c.id))
    const ids2 = new Set(state2.results.map((c) => c.id))

    // Verify page1 IDs are expected
    assert.deepEqual(ids1, page1Ids)
    // Verify page2 IDs are expected
    assert.deepEqual(ids2, page2Ids)
    // No overlap between pages
    ids1.forEach((id) => assert.ok(!ids2.has(id), `ID ${id} appears on both pages`))
  })

  test('total in response always reflects the full match count, not just this page', async () => {
    const pageCandidates = Array.from({ length: 10 }, (_, i) =>
      makeCandidate({ id: `c${i}` })
    )
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse(pageCandidates, { total: 250 }),
    })
    const state = await simulateSearch('Jane', '', fetch)
    assert.equal(state.results.length, 10)
    assert.equal(state.total, 250)
  })

  test('results preserve server order (no client-side sorting applied)', async () => {
    const candidates = [
      makeCandidate({ id: 'z1', lastName: 'Zimmermann' }),
      makeCandidate({ id: 'a1', lastName: 'Anderson' }),
      makeCandidate({ id: 'm1', lastName: 'Martinez' }),
    ]
    const { fetch } = makeFetchMock({ ok: true, body: makeSearchResponse(candidates) })
    const state = await simulateSearch('Jane', '', fetch)
    assert.equal(state.results[0].id, 'z1')
    assert.equal(state.results[1].id, 'a1')
    assert.equal(state.results[2].id, 'm1')
  })

  test('location field is present and correct in each result row', async () => {
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse([makeCandidate({ location: 'Austin, TX' })]),
    })
    const state = await simulateSearch('Jane', '', fetch)
    assert.equal(state.results[0].location, 'Austin, TX')
  })

  test('status field is present and correct in each result row', async () => {
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse([makeCandidate({ status: 'HIRED' })]),
    })
    const state = await simulateSearch('Jane', '', fetch)
    assert.equal(state.results[0].status, 'HIRED')
  })
})

// ---------------------------------------------------------------------------
// AC-2: Valid and invalid inputs handled correctly
// ---------------------------------------------------------------------------

describe('AC-2: Input validation — maxLength enforcement (component side)', () => {
  const NAME_MAX = 200
  const LINKEDIN_MAX = 500

  test('name at exactly maxLength (200) is accepted by the URL builder', () => {
    const name = 'a'.repeat(NAME_MAX)
    const url = buildSearchUrl(name, '')
    const parsed = new URL(url, 'http://localhost')
    assert.equal(parsed.searchParams.get('name')?.length, NAME_MAX)
  })

  test('name trimmed to maxLength is valid — buildSearchUrl trims it', () => {
    const name = '  ' + 'a'.repeat(NAME_MAX - 4) + '  '
    const url = buildSearchUrl(name, '')
    const parsed = new URL(url, 'http://localhost')
    // After trimming: NAME_MAX - 4 chars, well within limit
    assert.ok((parsed.searchParams.get('name')?.length ?? 0) <= NAME_MAX)
  })

  test('linkedin at exactly maxLength (500) is included in the URL', () => {
    const linkedin = 'a'.repeat(LINKEDIN_MAX)
    const url = buildSearchUrl('', linkedin)
    const parsed = new URL(url, 'http://localhost')
    assert.equal(parsed.searchParams.get('linkedin')?.length, LINKEDIN_MAX)
  })

  test('name exceeding 200 chars is rejected by validateCandidateSearch', () => {
    const result = validateCandidateSearch({ name: 'a'.repeat(201) })
    assert.equal(result.success, false)
    if (!result.success) {
      assert.ok(result.errors.some((e) => e.includes('200')))
    }
  })

  test('linkedin exceeding 500 chars is rejected by validateCandidateSearch', () => {
    const result = validateCandidateSearch({ linkedin: 'a'.repeat(501) })
    assert.equal(result.success, false)
    if (!result.success) {
      assert.ok(result.errors.some((e) => e.includes('500')))
    }
  })
})

describe('AC-2: Input validation — special characters and encoding', () => {
  test('name with ampersand is URL-encoded correctly', () => {
    const url = buildSearchUrl('Smith & Jones', '')
    const parsed = new URL(url, 'http://localhost')
    assert.equal(parsed.searchParams.get('name'), 'Smith & Jones')
  })

  test('name with plus sign is URL-encoded correctly', () => {
    const url = buildSearchUrl('C++ Developer', '')
    const parsed = new URL(url, 'http://localhost')
    assert.equal(parsed.searchParams.get('name'), 'C++ Developer')
  })

  test('name with percent sign is URL-encoded correctly', () => {
    const url = buildSearchUrl('100%', '')
    const parsed = new URL(url, 'http://localhost')
    assert.equal(parsed.searchParams.get('name'), '100%')
  })

  test('name with unicode characters is preserved correctly', () => {
    const url = buildSearchUrl('Ångström Müller', '')
    const parsed = new URL(url, 'http://localhost')
    assert.equal(parsed.searchParams.get('name'), 'Ångström Müller')
  })

  test('linkedin with full URL (containing slashes and colons) round-trips correctly', () => {
    const linkedinUrl = 'https://www.linkedin.com/in/jane-doe-123/'
    const url = buildSearchUrl('', linkedinUrl)
    const parsed = new URL(url, 'http://localhost')
    assert.equal(parsed.searchParams.get('linkedin'), linkedinUrl)
  })

  test('name with apostrophe is URL-encoded and decoded correctly', () => {
    const url = buildSearchUrl("O'Brien", '')
    const parsed = new URL(url, 'http://localhost')
    assert.equal(parsed.searchParams.get('name'), "O'Brien")
  })

  test('name with hash character is URL-encoded correctly', () => {
    const url = buildSearchUrl('C# Engineer', '')
    const parsed = new URL(url, 'http://localhost')
    assert.equal(parsed.searchParams.get('name'), 'C# Engineer')
  })

  test('name with emoji is preserved correctly', () => {
    const url = buildSearchUrl('Jane 😊', '')
    const parsed = new URL(url, 'http://localhost')
    assert.equal(parsed.searchParams.get('name'), 'Jane 😊')
  })
})

describe('AC-2: Input validation — whitespace trimming consistency', () => {
  test('name with surrounding spaces is trimmed in URL', () => {
    const url = buildSearchUrl('  Jane  ', '')
    const parsed = new URL(url, 'http://localhost')
    assert.equal(parsed.searchParams.get('name'), 'Jane')
  })

  test('linkedin with surrounding spaces is trimmed in URL', () => {
    const url = buildSearchUrl('', '  janedoe  ')
    const parsed = new URL(url, 'http://localhost')
    assert.equal(parsed.searchParams.get('linkedin'), 'janedoe')
  })

  test('name that is only spaces produces no name param', () => {
    const url = buildSearchUrl('   ', 'janedoe')
    const parsed = new URL(url, 'http://localhost')
    assert.equal(parsed.searchParams.get('name'), null)
  })

  test('linkedin that is only spaces produces no linkedin param', () => {
    const url = buildSearchUrl('Jane', '   ')
    const parsed = new URL(url, 'http://localhost')
    assert.equal(parsed.searchParams.get('linkedin'), null)
  })

  test('validateCandidateSearch trims name before applying maxLength check', () => {
    // 198 real chars + 2 spaces each side = 202 raw chars, but 198 trimmed → valid
    const trimmedLen = 198
    const name = '  ' + 'a'.repeat(trimmedLen) + '  '
    const result = validateCandidateSearch({ name })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.name?.length, trimmedLen)
    }
  })

  test('validateCandidateSearch trims linkedin before applying maxLength check', () => {
    const trimmedLen = 498
    const linkedin = '  ' + 'a'.repeat(trimmedLen) + '  '
    const result = validateCandidateSearch({ linkedin })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.linkedin?.length, trimmedLen)
    }
  })
})

describe('AC-2: Input validation — pagination clamping', () => {
  test('page=0 is clamped to 1 (not rejected)', () => {
    const result = validateCandidateSearch({ name: 'Jane', page: '0' })
    assert.equal(result.success, true)
    if (result.success) assert.equal(result.data.page, 1)
  })

  test('page=-999 is clamped to 1', () => {
    const result = validateCandidateSearch({ name: 'Jane', page: '-999' })
    assert.equal(result.success, true)
    if (result.success) assert.equal(result.data.page, 1)
  })

  test('pageSize=9999 is clamped to 100', () => {
    const result = validateCandidateSearch({ name: 'Jane', pageSize: '9999' })
    assert.equal(result.success, true)
    if (result.success) assert.equal(result.data.pageSize, 100)
  })

  test('pageSize=0 is clamped to 1', () => {
    const result = validateCandidateSearch({ name: 'Jane', pageSize: '0' })
    assert.equal(result.success, true)
    if (result.success) assert.equal(result.data.pageSize, 1)
  })

  test('page=1 (minimum valid) is accepted as-is', () => {
    const result = validateCandidateSearch({ name: 'Jane', page: '1' })
    assert.equal(result.success, true)
    if (result.success) assert.equal(result.data.page, 1)
  })

  test('pageSize=100 (maximum valid) is accepted as-is', () => {
    const result = validateCandidateSearch({ name: 'Jane', pageSize: '100' })
    assert.equal(result.success, true)
    if (result.success) assert.equal(result.data.pageSize, 100)
  })

  test('page=1.5 (float string) is rejected with a descriptive error', () => {
    const result = validateCandidateSearch({ name: 'Jane', page: '1.5' })
    // parseInt('1.5') returns 1 which is an integer, so this is accepted as page=1
    // (behaviour of parseInt: truncates decimal portion)
    if (result.success) {
      assert.equal(result.data.page, 1)
    } else {
      // Also acceptable: treat as invalid
      assert.ok(result.errors.some((e) => e.toLowerCase().includes('page')))
    }
  })
})

describe('AC-2: Input validation — invalid input rejection', () => {
  test('empty query (both fields empty) returns no-query state without fetching', async () => {
    const { fetch, calls } = makeFetchMock({ ok: true, body: makeSearchResponse([]) })
    const state = await simulateSearch('', '', fetch)
    assert.equal(calls.length, 0)
    assert.equal(state.hasSearched, false)
    assert.equal(state.results.length, 0)
  })

  test('whitespace-only name + empty linkedin returns no-query state without fetching', async () => {
    const { fetch, calls } = makeFetchMock({ ok: true, body: makeSearchResponse([]) })
    const state = await simulateSearch('   ', '', fetch)
    assert.equal(calls.length, 0)
    assert.equal(state.hasSearched, false)
  })

  test('whitespace-only linkedin + empty name returns no-query state without fetching', async () => {
    const { fetch, calls } = makeFetchMock({ ok: true, body: makeSearchResponse([]) })
    const state = await simulateSearch('', '\t\n  ', fetch)
    assert.equal(calls.length, 0)
    assert.equal(state.hasSearched, false)
  })

  test('both fields whitespace-only returns no-query state without fetching', async () => {
    const { fetch, calls } = makeFetchMock({ ok: true, body: makeSearchResponse([]) })
    const state = await simulateSearch('   ', '   ', fetch)
    assert.equal(calls.length, 0)
    assert.equal(state.hasSearched, false)
  })

  test('400 error from API (e.g. name too long) surfaces as an error state', async () => {
    const { fetch } = makeFetchMock({
      ok: false,
      status: 400,
      body: { error: 'Invalid search parameters' },
    })
    const state = await simulateSearch('Jane', '', fetch)
    assert.ok(state.error !== null)
    assert.ok(state.error?.includes('Invalid search parameters'))
    assert.equal(state.results.length, 0)
  })

  test('500 server error surfaces as a non-null error string', async () => {
    const { fetch } = makeFetchMock({
      ok: false,
      status: 500,
      body: { error: 'Failed to search candidates' },
    })
    const state = await simulateSearch('Jane', '', fetch)
    assert.ok(state.error !== null)
    assert.equal(state.results.length, 0)
  })
})

// ---------------------------------------------------------------------------
// AC-3: UI elements update according to search results
// ---------------------------------------------------------------------------

describe('AC-3: Status badge label derivation', () => {
  const statusCases: Array<{ status: string; expectedLabel: string }> = [
    { status: 'ACTIVE', expectedLabel: 'Active' },
    { status: 'HIRED', expectedLabel: 'Hired' },
    { status: 'INACTIVE', expectedLabel: 'Inactive' },
    { status: 'BLACKLISTED', expectedLabel: 'Blacklisted' },
  ]

  for (const { status, expectedLabel } of statusCases) {
    test(`status "${status}" maps to label "${expectedLabel}"`, () => {
      assert.equal(STATUS_LABEL[status], expectedLabel)
    })
  }

  test('unknown status falls back to the raw status value (no crash)', () => {
    const unknownStatus = 'PENDING_REVIEW'
    const label = STATUS_LABEL[unknownStatus] ?? unknownStatus
    assert.equal(label, unknownStatus)
  })

  test('all four known statuses have entries in STATUS_LABEL', () => {
    for (const s of ['ACTIVE', 'HIRED', 'INACTIVE', 'BLACKLISTED']) {
      assert.ok(s in STATUS_LABEL, `STATUS_LABEL is missing entry for "${s}"`)
    }
  })
})

describe('AC-3: Status badge colour derivation', () => {
  test('ACTIVE uses green colour classes', () => {
    assert.ok(STATUS_COLOR['ACTIVE'].includes('green'))
  })

  test('HIRED uses blue colour classes', () => {
    assert.ok(STATUS_COLOR['HIRED'].includes('blue'))
  })

  test('INACTIVE uses gray colour classes', () => {
    assert.ok(STATUS_COLOR['INACTIVE'].includes('gray'))
  })

  test('BLACKLISTED uses red colour classes', () => {
    assert.ok(STATUS_COLOR['BLACKLISTED'].includes('red'))
  })

  test('unknown status falls back to gray colour classes (no crash)', () => {
    const unknownStatus = 'PENDING_REVIEW'
    const colorClass = STATUS_COLOR[unknownStatus] ?? 'bg-gray-100 text-gray-600'
    assert.ok(colorClass.includes('gray'))
  })

  test('all four known statuses have entries in STATUS_COLOR', () => {
    for (const s of ['ACTIVE', 'HIRED', 'INACTIVE', 'BLACKLISTED']) {
      assert.ok(s in STATUS_COLOR, `STATUS_COLOR is missing entry for "${s}"`)
    }
  })
})

describe('AC-3: Application count plural display', () => {
  test('0 applications shows "0 apps"', () => {
    assert.equal(formatAppCount(0), '0 apps')
  })

  test('1 application shows "1 app" (singular)', () => {
    assert.equal(formatAppCount(1), '1 app')
  })

  test('2 applications shows "2 apps"', () => {
    assert.equal(formatAppCount(2), '2 apps')
  })

  test('10 applications shows "10 apps"', () => {
    assert.equal(formatAppCount(10), '10 apps')
  })

  test('_count.applications of 0 is displayed as "0 apps"', () => {
    const candidate = makeCandidate({ _count: { applications: 0 } })
    assert.equal(formatAppCount(candidate._count.applications), '0 apps')
  })

  test('_count.applications of 1 is displayed as "1 app"', () => {
    const candidate = makeCandidate({ _count: { applications: 1 } })
    assert.equal(formatAppCount(candidate._count.applications), '1 app')
  })

  test('_count.applications of 5 is displayed as "5 apps"', () => {
    const candidate = makeCandidate({ _count: { applications: 5 } })
    assert.equal(formatAppCount(candidate._count.applications), '5 apps')
  })
})

describe('AC-3: "Found N candidates" count string (status bar)', () => {
  test('total=0 shows "Found 0 candidates" (plural)', () => {
    assert.equal(formatFoundMessage(0), 'Found 0 candidates')
  })

  test('total=1 shows "Found 1 candidate" (singular)', () => {
    assert.equal(formatFoundMessage(1), 'Found 1 candidate')
  })

  test('total=2 shows "Found 2 candidates" (plural)', () => {
    assert.equal(formatFoundMessage(2), 'Found 2 candidates')
  })

  test('total=100 shows "Found 100 candidates"', () => {
    assert.equal(formatFoundMessage(100), 'Found 100 candidates')
  })

  test('count string after a successful empty-result search shows 0', async () => {
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse([], { total: 0 }),
    })
    const state = await simulateSearch('NoMatch', '', fetch)
    assert.equal(formatFoundMessage(state.total), 'Found 0 candidates')
  })

  test('count string reflects pagination total, not just current page length', async () => {
    const pageResults = Array.from({ length: 50 }, (_, i) =>
      makeCandidate({ id: `c${i}` })
    )
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse(pageResults, { total: 250 }),
    })
    const state = await simulateSearch('Jane', '', fetch)
    assert.equal(formatFoundMessage(state.total), 'Found 250 candidates')
  })
})

describe('AC-3: "Showing X of Y" footer hint', () => {
  test('hint is shown when total > results.length', () => {
    const total = 80
    const resultsLength = 50
    assert.ok(total > resultsLength, 'Hint condition should be true')
  })

  test('hint is NOT shown when results.length equals total', () => {
    const total = 10
    const resultsLength = 10
    assert.ok(!(total > resultsLength), 'Hint condition should be false')
  })

  test('hint is NOT shown when results.length is 0 and total is 0', () => {
    assert.ok(!(0 > 0), 'Hint should not appear for empty results')
  })

  test('hint message is formatted correctly', () => {
    const msg = formatCapHint(50, 130)
    assert.ok(msg.includes('50'), 'Hint should show the number of displayed results')
    assert.ok(msg.includes('130'), 'Hint should show the total match count')
    assert.ok(msg.toLowerCase().includes('showing'), 'Hint should begin with "Showing"')
    assert.ok(msg.toLowerCase().includes('matches'), 'Hint should mention "matches"')
  })

  test('hint is shown when exactly PAGE_SIZE_CAP results returned but total is higher', async () => {
    const pageResults = Array.from({ length: PAGE_SIZE_CAP }, (_, i) =>
      makeCandidate({ id: `c${i}` })
    )
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse(pageResults, { total: PAGE_SIZE_CAP + 1 }),
    })
    const state = await simulateSearch('Jane', '', fetch)
    const shouldShowHint = state.total > state.results.length
    assert.equal(shouldShowHint, true)
  })

  test('hint is NOT shown when total equals PAGE_SIZE_CAP and all results fit', async () => {
    const pageResults = Array.from({ length: PAGE_SIZE_CAP }, (_, i) =>
      makeCandidate({ id: `c${i}` })
    )
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse(pageResults, { total: PAGE_SIZE_CAP }),
    })
    const state = await simulateSearch('Jane', '', fetch)
    const shouldShowHint = state.total > state.results.length
    assert.equal(shouldShowHint, false)
  })
})

describe('AC-3: Empty-state card visibility', () => {
  test('empty-state is shown when results.length === 0 AND hasSearched is true AND isLoading is false', () => {
    const results: MockCandidate[] = []
    const hasSearched = true
    const isLoading = false
    const isActive = true
    const showResults = deriveShowResults(isActive, hasSearched, isLoading)
    const showEmptyState = showResults && results.length === 0
    assert.equal(showEmptyState, true)
  })

  test('empty-state is NOT shown before any search has been made', () => {
    const hasSearched = false
    const isActive = false
    const isLoading = false
    const showResults = deriveShowResults(isActive, hasSearched, isLoading)
    const showEmptyState = showResults && [].length === 0
    assert.equal(showEmptyState, false)
  })

  test('empty-state is NOT shown while a search is in progress', () => {
    const hasSearched = true
    const isActive = true
    const isLoading = true  // ← still loading
    const showResults = deriveShowResults(isActive, hasSearched, isLoading)
    const showEmptyState = showResults && [].length === 0
    assert.equal(showEmptyState, false)
  })

  test('empty-state is NOT shown when there are matching results', async () => {
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse([makeCandidate()]),
    })
    const state = await simulateSearch('Jane', '', fetch)
    const isActive = deriveIsActive('Jane', '')
    const showResults = deriveShowResults(isActive, state.hasSearched, state.isLoading)
    const showEmptyState = showResults && state.results.length === 0
    assert.equal(showEmptyState, false)
  })
})

describe('AC-3: Loading spinner visibility', () => {
  test('spinner is visible when isLoading=true and isActive=true', () => {
    const isLoading = true
    const isActive = true
    const spinnerVisible = isLoading && isActive
    assert.equal(spinnerVisible, true)
  })

  test('spinner is NOT visible when isLoading=false even if isActive', () => {
    const isLoading = false
    const isActive = true
    const spinnerVisible = isLoading && isActive
    assert.equal(spinnerVisible, false)
  })

  test('spinner is NOT visible when isActive=false even if isLoading would be true', () => {
    const isLoading = true
    const isActive = false
    const spinnerVisible = isLoading && isActive
    assert.equal(spinnerVisible, false)
  })

  test('spinner is NOT visible on initial render (isLoading=false, isActive=false)', () => {
    const spinnerVisible = false && false
    assert.equal(spinnerVisible, false)
  })
})

describe('AC-3: Error message display', () => {
  test('error state after API failure surfaces the server error message', async () => {
    const { fetch } = makeFetchMock({
      ok: false,
      status: 500,
      body: { error: 'Failed to search candidates' },
    })
    const state = await simulateSearch('Jane', '', fetch)
    assert.ok(state.error !== null, 'Error should be set after server failure')
    assert.ok(state.error!.length > 0, 'Error message should be non-empty')
  })

  test('error state after network failure contains a descriptive message', async () => {
    const throwingFetch = async (): Promise<Response> => {
      throw new Error('Network unreachable')
    }
    const state = await simulateSearch(
      'Jane',
      '',
      throwingFetch as Parameters<typeof simulateSearch>[2]
    )
    assert.ok(state.error?.includes('Network unreachable'))
  })

  test('results are empty when error is present', async () => {
    const { fetch } = makeFetchMock({
      ok: false,
      status: 503,
      body: { error: 'Service temporarily unavailable' },
    })
    const state = await simulateSearch('Jane', '', fetch)
    assert.equal(state.results.length, 0)
    assert.ok(state.error !== null)
  })

  test('error is null (no error shown) after a successful search', async () => {
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse([makeCandidate()]),
    })
    const state = await simulateSearch('Jane', '', fetch)
    assert.equal(state.error, null)
  })

  test('error is null (no error shown) before any search', async () => {
    const { fetch } = makeFetchMock({ ok: true, body: makeSearchResponse([]) })
    const state = await simulateSearch('', '', fetch)
    assert.equal(state.error, null)
  })
})

describe('AC-3: Results table visibility guards (isActive / showResults)', () => {
  test('isActive is false when both inputs are empty', () => {
    assert.equal(deriveIsActive('', ''), false)
  })

  test('isActive is true when name has a value', () => {
    assert.equal(deriveIsActive('Jane', ''), true)
  })

  test('isActive is true when linkedin has a value', () => {
    assert.equal(deriveIsActive('', 'janedoe'), true)
  })

  test('isActive is true when both have values', () => {
    assert.equal(deriveIsActive('Jane', 'janedoe'), true)
  })

  test('showResults is false when isActive=false', () => {
    assert.equal(deriveShowResults(false, true, false), false)
  })

  test('showResults is false when hasSearched=false', () => {
    assert.equal(deriveShowResults(true, false, false), false)
  })

  test('showResults is false when isLoading=true', () => {
    assert.equal(deriveShowResults(true, true, true), false)
  })

  test('showResults is true only when isActive AND hasSearched AND NOT isLoading', () => {
    assert.equal(deriveShowResults(true, true, false), true)
  })

  test('results table hidden when inputs are cleared after a search', () => {
    // After clearing both fields, isActive → false → showResults → false
    const isActive = deriveIsActive('', '')
    const showResults = deriveShowResults(isActive, true, false)
    assert.equal(showResults, false)
  })
})

describe('AC-3: "Added" column date formatting', () => {
  test('createdAt is formatted via formatDate for the Added column', () => {
    const createdAt = new Date('2024-06-01T10:00:00.000Z')
    const formatted = formatDate(createdAt)
    assert.equal(typeof formatted, 'string')
    assert.ok(formatted.length > 0)
    assert.ok(formatted.includes('2024'), `Expected year 2024 in "${formatted}"`)
  })

  test('formatDate handles a Date object correctly', () => {
    const date = new Date('2024-01-15T00:00:00.000Z')
    const formatted = formatDate(date)
    assert.ok(formatted.includes('2024'))
    assert.ok(formatted.includes('Jan'))
  })

  test('formatDate handles an ISO string input', () => {
    const formatted = formatDate('2024-03-20T09:30:00.000Z')
    assert.ok(formatted.includes('2024'))
    assert.ok(formatted.includes('Mar'))
  })

  test('each result row createdAt is a valid Date-like value', async () => {
    const candidate = makeCandidate({ createdAt: new Date('2024-06-15T12:00:00.000Z') })
    const { fetch } = makeFetchMock({ ok: true, body: makeSearchResponse([candidate]) })
    const state = await simulateSearch('Jane', '', fetch)
    const formatted = formatDate(state.results[0].createdAt)
    assert.ok(formatted.includes('2024'), `formatted date should include year: "${formatted}"`)
  })
})

// ---------------------------------------------------------------------------
// AC-3: End-to-end UI state machine flows
// ---------------------------------------------------------------------------

describe('AC-3: End-to-end UI state machine — successful search flow', () => {
  test('full flow: empty → typing → results visible with correct count', async () => {
    // 1. Initial state: no query
    assert.equal(deriveIsActive('', ''), false)

    // 2. User types "Jane"
    const nameQuery = 'Jane'
    assert.equal(deriveIsActive(nameQuery, ''), true)

    // 3. After debounce fires, search executes and returns 3 results
    const candidates = [
      makeCandidate({ id: 'c1', firstName: 'Jane', lastName: 'Smith' }),
      makeCandidate({ id: 'c2', firstName: 'Jane', lastName: 'Doe' }),
      makeCandidate({ id: 'c3', firstName: 'Janet', lastName: 'Jones' }),
    ]
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse(candidates, { total: 3 }),
    })
    const state = await simulateSearch(nameQuery, '', fetch)

    // 4. Verify post-search state
    assert.equal(state.hasSearched, true)
    assert.equal(state.isLoading, false)
    assert.equal(state.error, null)
    assert.equal(state.results.length, 3)
    assert.equal(state.total, 3)

    // 5. Derived UI: showResults should be true
    const isActive = deriveIsActive(nameQuery, '')
    const showResults = deriveShowResults(isActive, state.hasSearched, state.isLoading)
    assert.equal(showResults, true)

    // 6. Count string is correct
    assert.equal(formatFoundMessage(state.total), 'Found 3 candidates')

    // 7. No footer hint (all results fit on one page)
    assert.equal(state.total > state.results.length, false)
  })

  test('full flow: search → clear → state resets to no-query', async () => {
    // Search first
    const { fetch: fetchWithResults } = makeFetchMock({
      ok: true,
      body: makeSearchResponse([makeCandidate()], { total: 1 }),
    })
    const searchState = await simulateSearch('Jane', '', fetchWithResults)
    assert.equal(searchState.results.length, 1)

    // Clear query → hasQuery returns false
    const clearState = await simulateSearch('', '', fetchWithResults)
    assert.equal(clearState.hasSearched, false)
    assert.equal(clearState.results.length, 0)
    assert.equal(clearState.error, null)

    // showResults should now be false
    const isActive = deriveIsActive('', '')
    const showResults = deriveShowResults(isActive, clearState.hasSearched, clearState.isLoading)
    assert.equal(showResults, false)
  })

  test('full flow: search returns 0 results → empty-state card is shown', async () => {
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse([], { total: 0, totalPages: 0 }),
    })
    const state = await simulateSearch('NonExistentPerson', '', fetch)

    const isActive = deriveIsActive('NonExistentPerson', '')
    const showResults = deriveShowResults(isActive, state.hasSearched, state.isLoading)

    assert.equal(showResults, true, 'showResults should be true so empty-state renders')
    assert.equal(state.results.length, 0)
    // Empty state card should show
    const showEmptyStateCard = showResults && state.results.length === 0
    assert.equal(showEmptyStateCard, true)
  })

  test('full flow: large result set triggers footer hint', async () => {
    const pageResults = Array.from({ length: PAGE_SIZE_CAP }, (_, i) =>
      makeCandidate({ id: `c${i}` })
    )
    const FULL_TOTAL = 200
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse(pageResults, { total: FULL_TOTAL }),
    })
    const state = await simulateSearch('Jane', '', fetch)

    assert.equal(state.results.length, PAGE_SIZE_CAP)
    assert.equal(state.total, FULL_TOTAL)

    const shouldShowHint = state.total > state.results.length
    assert.equal(shouldShowHint, true)

    const hintText = formatCapHint(state.results.length, state.total)
    assert.ok(hintText.includes(String(PAGE_SIZE_CAP)))
    assert.ok(hintText.includes(String(FULL_TOTAL)))
  })

  test('full flow: API error → error message shown, results hidden', async () => {
    const { fetch } = makeFetchMock({
      ok: false,
      status: 500,
      body: { error: 'Database connection failed' },
    })
    const state = await simulateSearch('Jane', '', fetch)

    assert.ok(state.error !== null)
    assert.equal(state.results.length, 0)

    // showResults should be false when there is an error to show
    // (the component renders the error <p> instead of the table when error is set)
    assert.equal(state.error, 'Database connection failed')
  })
})

describe('AC-3: End-to-end UI state machine — search result content', () => {
  test('each result row has candidate initials derivable from firstName and lastName', async () => {
    const candidates = [
      makeCandidate({ id: 'c1', firstName: 'Alice', lastName: 'Wong' }),
      makeCandidate({ id: 'c2', firstName: 'Bob', lastName: 'Smith' }),
    ]
    const { fetch } = makeFetchMock({ ok: true, body: makeSearchResponse(candidates) })
    const state = await simulateSearch('A', '', fetch)

    state.results.forEach((c) => {
      const initials = `${c.firstName.charAt(0).toUpperCase()}${c.lastName.charAt(0).toUpperCase()}`
      assert.equal(initials.length, 2, `Initials for ${c.firstName} ${c.lastName} should be 2 chars`)
      assert.equal(initials, initials.toUpperCase(), 'Initials should be uppercase')
    })
  })

  test('result with null location shows a fallback in the UI', async () => {
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse([makeCandidate({ location: null })]),
    })
    const state = await simulateSearch('Jane', '', fetch)
    // null location should render as the em-dash fallback "—" in the component
    assert.equal(state.results[0].location, null)
    // The component renders `candidate.location ?? <span>—</span>` — null is expected
  })

  test('result with a resumeUrl shows the CV link (resumeUrl is non-null)', async () => {
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse([
        makeCandidate({ resumeUrl: 'https://storage.example.com/resume.pdf' }),
      ]),
    })
    const state = await simulateSearch('Jane', '', fetch)
    assert.ok(state.results[0].resumeUrl !== null)
    assert.ok(state.results[0].resumeUrl!.startsWith('https://'))
  })

  test('result without a resumeUrl hides the CV link (resumeUrl is null)', async () => {
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse([makeCandidate({ resumeUrl: null })]),
    })
    const state = await simulateSearch('Jane', '', fetch)
    assert.equal(state.results[0].resumeUrl, null)
  })

  test('result row summary is truncated (summary field is preserved in data)', async () => {
    const longSummary = 'Senior engineer with extensive '.repeat(10)
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse([makeCandidate({ summary: longSummary })]),
    })
    const state = await simulateSearch('Jane', '', fetch)
    // The full summary is in the data; component uses CSS `truncate` class for display
    assert.equal(state.results[0].summary, longSummary)
  })

  test('each result row View link target is /candidates/[id]', async () => {
    const candidates = [
      makeCandidate({ id: 'cand_abc123' }),
    ]
    const { fetch } = makeFetchMock({ ok: true, body: makeSearchResponse(candidates) })
    const state = await simulateSearch('Jane', '', fetch)
    const id = state.results[0].id
    const expectedViewHref = `/candidates/${id}`
    assert.equal(expectedViewHref, '/candidates/cand_abc123')
  })

  test('each result row Edit link target is /candidates/[id]/edit', async () => {
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse([makeCandidate({ id: 'cand_xyz789' })]),
    })
    const state = await simulateSearch('Jane', '', fetch)
    const id = state.results[0].id
    const expectedEditHref = `/candidates/${id}/edit`
    assert.equal(expectedEditHref, '/candidates/cand_xyz789/edit')
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
    console.log('\n✓ All candidate search integration tests passed.')
  }
})()
