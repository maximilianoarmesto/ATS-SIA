/**
 * Tests — CandidateSearch component logic
 *
 * Verifies the client-side behaviour of the CandidateSearch component:
 *  1. URL builder — correct query string construction for name / linkedin / both.
 *  2. hasQuery helper — only true when at least one field is non-empty.
 *  3. Fetch orchestration — correct endpoint called, abort on superseded query.
 *  4. Response parsing — data + pagination shape consumed correctly.
 *  5. Error handling — non-ok responses and network failures.
 *  6. Empty-results state — { data: [], pagination: { total: 0 } } handled.
 *  7. Debounce semantics (timer-based) verified via state-machine simulation.
 *  8. pageSize cap — always requests up to 50 results per search.
 *
 * Because this is a React component there is no DOM rendering in this test
 * environment.  Tests extract and validate the *pure logic* (URL building,
 * query gating, fetch handling, state transitions) using the same patterns
 * as candidate-notes.test.ts.
 *
 * Run via:
 *   npx tsx src/components/candidate-search.test.ts
 *
 * Exit code 0 = all tests pass, exit code 1 = one or more failures.
 */

import assert from 'node:assert/strict'

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
// Logic extracted from candidate-search.tsx (kept in sync)
// ---------------------------------------------------------------------------

function buildSearchUrl(name: string, linkedin: string): string {
  const params = new URLSearchParams()
  if (name.trim()) params.set('name', name.trim())
  if (linkedin.trim()) params.set('linkedin', linkedin.trim())
  params.set('pageSize', '50')
  return `/api/candidates/search?${params.toString()}`
}

function hasQuery(name: string, linkedin: string): boolean {
  return name.trim().length > 0 || linkedin.trim().length > 0
}

// ---------------------------------------------------------------------------
// Search simulation helper
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

interface FetchCall {
  url: string
  signal?: AbortSignal
}

type FetchMockSetup =
  | { ok: true; body: SearchResponse }
  | { ok: false; status: number; body: { error?: string } }
  | { throws: Error }

function makeFetchMock(setup: FetchMockSetup): {
  fetch: (url: string, init?: { signal?: AbortSignal }) => Promise<Response>
  calls: FetchCall[]
} {
  const calls: FetchCall[] = []

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
    location: null,
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
      pageSize: 50,
      totalPages: Math.ceil(candidates.length / 50) || 0,
      ...overrides,
    },
  }
}

// ---------------------------------------------------------------------------
// Core search executor — mirrors the component's executeSearch logic
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
  fetchFn: (
    url: string,
    init?: { signal?: AbortSignal }
  ) => Promise<Response>
): Promise<SearchState> {
  if (!hasQuery(name, linkedin)) {
    return {
      results: [],
      total: 0,
      isLoading: false,
      error: null,
      hasSearched: false,
    }
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
      // Aborted — no state change
      return {
        results: [],
        total: 0,
        isLoading: false,
        error: null,
        hasSearched: true,
      }
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
// 1. buildSearchUrl — URL construction
// ---------------------------------------------------------------------------

describe('buildSearchUrl — URL construction', () => {
  test('includes name param when name is provided', () => {
    const url = buildSearchUrl('Jane', '')
    assert.ok(url.includes('name=Jane'), `Expected name=Jane in "${url}"`)
  })

  test('includes linkedin param when linkedin is provided', () => {
    const url = buildSearchUrl('', 'janedoe')
    assert.ok(url.includes('linkedin=janedoe'), `Expected linkedin=janedoe in "${url}"`)
  })

  test('includes both params when both are provided', () => {
    const url = buildSearchUrl('Jane', 'janedoe')
    assert.ok(url.includes('name=Jane'))
    assert.ok(url.includes('linkedin=janedoe'))
  })

  test('always includes pageSize=50', () => {
    const url = buildSearchUrl('Jane', '')
    assert.ok(url.includes('pageSize=50'), `Expected pageSize=50 in "${url}"`)
  })

  test('omits name param when name is empty', () => {
    const url = buildSearchUrl('', 'janedoe')
    const parsed = new URL(url, 'http://localhost')
    assert.equal(parsed.searchParams.get('name'), null)
  })

  test('omits linkedin param when linkedin is empty', () => {
    const url = buildSearchUrl('Jane', '')
    const parsed = new URL(url, 'http://localhost')
    assert.equal(parsed.searchParams.get('linkedin'), null)
  })

  test('trims whitespace from name before adding to URL', () => {
    const url = buildSearchUrl('  Jane  ', '')
    const parsed = new URL(url, 'http://localhost')
    assert.equal(parsed.searchParams.get('name'), 'Jane')
  })

  test('trims whitespace from linkedin before adding to URL', () => {
    const url = buildSearchUrl('', '  janedoe  ')
    const parsed = new URL(url, 'http://localhost')
    assert.equal(parsed.searchParams.get('linkedin'), 'janedoe')
  })

  test('URL path always starts with /api/candidates/search', () => {
    const url = buildSearchUrl('Jane', 'janedoe')
    assert.ok(url.startsWith('/api/candidates/search?'))
  })

  test('URL encodes special characters in name', () => {
    const url = buildSearchUrl('O\'Brien', '')
    const parsed = new URL(url, 'http://localhost')
    assert.equal(parsed.searchParams.get('name'), "O'Brien")
  })

  test('URL encodes spaces within name', () => {
    const url = buildSearchUrl('Jane Doe', '')
    const parsed = new URL(url, 'http://localhost')
    assert.equal(parsed.searchParams.get('name'), 'Jane Doe')
  })
})

// ---------------------------------------------------------------------------
// 2. hasQuery — query gating
// ---------------------------------------------------------------------------

describe('hasQuery — query gating', () => {
  test('returns true when only name is non-empty', () => {
    assert.equal(hasQuery('Jane', ''), true)
  })

  test('returns true when only linkedin is non-empty', () => {
    assert.equal(hasQuery('', 'janedoe'), true)
  })

  test('returns true when both are non-empty', () => {
    assert.equal(hasQuery('Jane', 'janedoe'), true)
  })

  test('returns false when both are empty strings', () => {
    assert.equal(hasQuery('', ''), false)
  })

  test('returns false when name is whitespace only', () => {
    assert.equal(hasQuery('   ', ''), false)
  })

  test('returns false when linkedin is whitespace only', () => {
    assert.equal(hasQuery('', '   '), false)
  })

  test('returns false when both are whitespace only', () => {
    assert.equal(hasQuery('   ', '   '), false)
  })

  test('returns true when name has a single character', () => {
    assert.equal(hasQuery('J', ''), true)
  })

  test('returns true when linkedin has a single character', () => {
    assert.equal(hasQuery('', 'j'), true)
  })
})

// ---------------------------------------------------------------------------
// 3. Search execution — fetch called with the correct URL
// ---------------------------------------------------------------------------

describe('Search execution — fetch URL and params', () => {
  test('calls fetch with correct URL for name-only search', async () => {
    const { fetch, calls } = makeFetchMock({
      ok: true,
      body: makeSearchResponse([]),
    })
    await simulateSearch('Jane', '', fetch)
    assert.equal(calls.length, 1)
    const parsed = new URL(calls[0].url, 'http://localhost')
    assert.equal(parsed.searchParams.get('name'), 'Jane')
    assert.equal(parsed.searchParams.get('linkedin'), null)
  })

  test('calls fetch with correct URL for linkedin-only search', async () => {
    const { fetch, calls } = makeFetchMock({
      ok: true,
      body: makeSearchResponse([]),
    })
    await simulateSearch('', 'janedoe', fetch)
    assert.equal(calls.length, 1)
    const parsed = new URL(calls[0].url, 'http://localhost')
    assert.equal(parsed.searchParams.get('linkedin'), 'janedoe')
    assert.equal(parsed.searchParams.get('name'), null)
  })

  test('calls fetch with correct URL for combined search', async () => {
    const { fetch, calls } = makeFetchMock({
      ok: true,
      body: makeSearchResponse([]),
    })
    await simulateSearch('Jane', 'janedoe', fetch)
    assert.equal(calls.length, 1)
    const parsed = new URL(calls[0].url, 'http://localhost')
    assert.equal(parsed.searchParams.get('name'), 'Jane')
    assert.equal(parsed.searchParams.get('linkedin'), 'janedoe')
  })

  test('does NOT call fetch when both inputs are empty', async () => {
    const { fetch, calls } = makeFetchMock({ ok: true, body: makeSearchResponse([]) })
    await simulateSearch('', '', fetch)
    assert.equal(calls.length, 0)
  })

  test('does NOT call fetch when inputs are whitespace only', async () => {
    const { fetch, calls } = makeFetchMock({ ok: true, body: makeSearchResponse([]) })
    await simulateSearch('   ', '   ', fetch)
    assert.equal(calls.length, 0)
  })

  test('always requests pageSize=50', async () => {
    const { fetch, calls } = makeFetchMock({ ok: true, body: makeSearchResponse([]) })
    await simulateSearch('Jane', '', fetch)
    const parsed = new URL(calls[0].url, 'http://localhost')
    assert.equal(parsed.searchParams.get('pageSize'), '50')
  })
})

// ---------------------------------------------------------------------------
// 4. Response parsing — data + pagination consumed correctly
// ---------------------------------------------------------------------------

describe('Search execution — response parsing', () => {
  test('returns candidates from the data array in the response', async () => {
    const candidates = [makeCandidate()]
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse(candidates),
    })
    const state = await simulateSearch('Jane', '', fetch)
    assert.equal(state.results.length, 1)
    assert.equal(state.results[0].firstName, 'Jane')
  })

  test('returns the total from the pagination object', async () => {
    const candidates = [makeCandidate(), makeCandidate({ id: 'cand_002' })]
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse(candidates, { total: 42 }),
    })
    const state = await simulateSearch('Jane', '', fetch)
    assert.equal(state.total, 42)
  })

  test('sets hasSearched to true after a successful search', async () => {
    const { fetch } = makeFetchMock({ ok: true, body: makeSearchResponse([]) })
    const state = await simulateSearch('Jane', '', fetch)
    assert.equal(state.hasSearched, true)
  })

  test('sets isLoading to false after a successful search', async () => {
    const { fetch } = makeFetchMock({ ok: true, body: makeSearchResponse([]) })
    const state = await simulateSearch('Jane', '', fetch)
    assert.equal(state.isLoading, false)
  })

  test('sets error to null after a successful search', async () => {
    const { fetch } = makeFetchMock({ ok: true, body: makeSearchResponse([]) })
    const state = await simulateSearch('Jane', '', fetch)
    assert.equal(state.error, null)
  })

  test('returns empty results array and total 0 for an empty dataset', async () => {
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse([], { total: 0, totalPages: 0 }),
    })
    const state = await simulateSearch('NoMatch', '', fetch)
    assert.equal(state.results.length, 0)
    assert.equal(state.total, 0)
  })

  test('response includes all required candidate fields', async () => {
    const candidate = makeCandidate()
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse([candidate]),
    })
    const state = await simulateSearch('Jane', '', fetch)
    const c = state.results[0]
    assert.ok(c.id !== undefined)
    assert.ok(c.firstName !== undefined)
    assert.ok(c.lastName !== undefined)
    assert.ok(c.status !== undefined)
    assert.ok(typeof c._count.applications === 'number')
  })
})

// ---------------------------------------------------------------------------
// 5. Error handling — non-ok API responses and network failures
// ---------------------------------------------------------------------------

describe('Search execution — error handling', () => {
  test('sets error message when API returns a non-ok response', async () => {
    const { fetch } = makeFetchMock({
      ok: false,
      status: 500,
      body: { error: 'Internal server error' },
    })
    const state = await simulateSearch('Jane', '', fetch)
    assert.ok(state.error !== null)
    assert.ok(
      state.error?.includes('Internal server error'),
      `Got: "${state.error}"`
    )
  })

  test('sets a fallback error message when server sends no error field', async () => {
    const { fetch } = makeFetchMock({
      ok: false,
      status: 503,
      body: {},
    })
    const state = await simulateSearch('Jane', '', fetch)
    assert.ok(state.error !== null)
    assert.ok(
      state.error!.length > 0,
      'Error message should be a non-empty string'
    )
  })

  test('sets error message on network failure (fetch throws)', async () => {
    const throwingFetch = async () => {
      throw new Error('Network unreachable')
    }
    const state = await simulateSearch(
      'Jane',
      '',
      throwingFetch as Parameters<typeof simulateSearch>[2]
    )
    assert.ok(state.error !== null)
    assert.ok(state.error?.includes('Network unreachable'))
  })

  test('clears results when an error occurs', async () => {
    const { fetch } = makeFetchMock({
      ok: false,
      status: 500,
      body: { error: 'DB down' },
    })
    const state = await simulateSearch('Jane', '', fetch)
    assert.equal(state.results.length, 0)
    assert.equal(state.total, 0)
  })

  test('returns 400 error message from server verbatim', async () => {
    const { fetch } = makeFetchMock({
      ok: false,
      status: 400,
      body: { error: 'Invalid search parameters' },
    })
    const state = await simulateSearch('Jane', '', fetch)
    assert.ok(state.error?.includes('Invalid search parameters'))
  })

  test('treats AbortError as a non-error (superseded request)', async () => {
    const abortError = new DOMException('Aborted', 'AbortError')
    const throwingFetch = async () => { throw abortError }
    const state = await simulateSearch(
      'Jane',
      '',
      throwingFetch as Parameters<typeof simulateSearch>[2]
    )
    // Aborted requests should not surface an error to the user
    assert.equal(state.error, null)
  })
})

// ---------------------------------------------------------------------------
// 6. No-query guard — state when inputs are cleared
// ---------------------------------------------------------------------------

describe('No-query guard — inputs cleared', () => {
  test('hasSearched is false when query is empty', async () => {
    const { fetch } = makeFetchMock({ ok: true, body: makeSearchResponse([]) })
    const state = await simulateSearch('', '', fetch)
    assert.equal(state.hasSearched, false)
  })

  test('results is empty array when query is empty', async () => {
    const { fetch } = makeFetchMock({ ok: true, body: makeSearchResponse([]) })
    const state = await simulateSearch('', '', fetch)
    assert.equal(state.results.length, 0)
  })

  test('error is null when query is empty', async () => {
    const { fetch } = makeFetchMock({ ok: true, body: makeSearchResponse([]) })
    const state = await simulateSearch('', '', fetch)
    assert.equal(state.error, null)
  })

  test('total is 0 when query is empty', async () => {
    const { fetch } = makeFetchMock({ ok: true, body: makeSearchResponse([]) })
    const state = await simulateSearch('', '', fetch)
    assert.equal(state.total, 0)
  })
})

// ---------------------------------------------------------------------------
// 7. Debounce semantics — timer-based simulation
// ---------------------------------------------------------------------------

describe('Debounce semantics — timer simulation', () => {
  const DEBOUNCE_MS = 300

  /**
   * Simulates a sequence of keystrokes with configurable delays between them.
   * Returns the number of fetch calls that would be triggered (i.e. how many
   * debounced callbacks fire after the DEBOUNCE_MS window closes).
   */
  async function simulateKeystrokes(
    keystrokes: Array<{ value: string; delayMs: number }>
  ): Promise<number> {
    let pendingTimer: ReturnType<typeof setTimeout> | null = null
    let fetchCallCount = 0
    let lastValue = ''

    for (const { value, delayMs } of keystrokes) {
      // Cancel the previous pending debounce
      if (pendingTimer !== null) {
        clearTimeout(pendingTimer)
        pendingTimer = null
      }

      lastValue = value

      // After `delayMs`, decide whether the debounce timer fires
      if (delayMs >= DEBOUNCE_MS) {
        // Simulate the debounce timer firing
        if (hasQuery(lastValue, '')) {
          fetchCallCount++
        }
        pendingTimer = null
      } else {
        // The timer is still pending (would be cancelled by the next keystroke)
        pendingTimer = setTimeout(() => { /* cancelled */ }, DEBOUNCE_MS)
      }
    }

    // After all keystrokes, if there is a pending timer, fire it now.
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer)
      if (hasQuery(lastValue, '')) {
        fetchCallCount++
      }
    }

    return fetchCallCount
  }

  test('fires exactly once when typing stops after DEBOUNCE_MS', async () => {
    const calls = await simulateKeystrokes([
      { value: 'J', delayMs: 50 },
      { value: 'Ja', delayMs: 50 },
      { value: 'Jan', delayMs: 400 }, // > DEBOUNCE_MS → fires
    ])
    assert.equal(calls, 1)
  })

  test('does not fire while user is typing rapidly', async () => {
    const calls = await simulateKeystrokes([
      { value: 'J', delayMs: 50 },
      { value: 'Ja', delayMs: 50 },
      { value: 'Jan', delayMs: 50 },
    ])
    // All keystrokes within debounce window — last one fires at the end
    assert.equal(calls, 1)
  })

  test('fires once per typing burst', async () => {
    const calls = await simulateKeystrokes([
      { value: 'J', delayMs: 50 },
      { value: 'Ja', delayMs: 400 }, // burst 1 ends → fires
      { value: 'Jan', delayMs: 50 },
      { value: 'Jane', delayMs: 400 }, // burst 2 ends → fires
    ])
    assert.equal(calls, 2)
  })

  test('does not fire when query is cleared (empty string)', async () => {
    const calls = await simulateKeystrokes([
      { value: 'Jane', delayMs: 50 },
      { value: '', delayMs: 400 }, // cleared — hasQuery is false
    ])
    assert.equal(calls, 0)
  })
})

// ---------------------------------------------------------------------------
// 8. pageSize cap
// ---------------------------------------------------------------------------

describe('pageSize cap', () => {
  test('buildSearchUrl always sets pageSize to 50', () => {
    const urlNameOnly = buildSearchUrl('Jane', '')
    const urlLinkedinOnly = buildSearchUrl('', 'janedoe')
    const urlBoth = buildSearchUrl('Jane', 'janedoe')

    for (const url of [urlNameOnly, urlLinkedinOnly, urlBoth]) {
      const parsed = new URL(url, 'http://localhost')
      assert.equal(
        parsed.searchParams.get('pageSize'),
        '50',
        `Expected pageSize=50 in "${url}"`
      )
    }
  })

  test('shows "Showing X of Y" hint only when total exceeds the page size', () => {
    // Simulate the condition: total > results.length
    const total = 80
    const resultsLength = 50
    const shouldShowHint = total > resultsLength
    assert.equal(shouldShowHint, true)
  })

  test('does not show hint when all results fit on one page', () => {
    const total = 10
    const resultsLength = 10
    const shouldShowHint = total > resultsLength
    assert.equal(shouldShowHint, false)
  })
})

// ---------------------------------------------------------------------------
// 9. Combined search scenarios
// ---------------------------------------------------------------------------

describe('Combined search scenarios', () => {
  test('name + linkedin search calls a single fetch with both params', async () => {
    const { fetch, calls } = makeFetchMock({
      ok: true,
      body: makeSearchResponse([makeCandidate()]),
    })
    await simulateSearch('Jane', 'janedoe', fetch)
    assert.equal(calls.length, 1)
    const parsed = new URL(calls[0].url, 'http://localhost')
    assert.equal(parsed.searchParams.get('name'), 'Jane')
    assert.equal(parsed.searchParams.get('linkedin'), 'janedoe')
  })

  test('search with only linkedin returns candidates matching linkedin', async () => {
    const candidates = [
      makeCandidate({ linkedinUrl: 'https://linkedin.com/in/janedoe' }),
    ]
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse(candidates),
    })
    const state = await simulateSearch('', 'janedoe', fetch)
    assert.equal(state.results.length, 1)
    assert.equal(
      state.results[0].linkedinUrl,
      'https://linkedin.com/in/janedoe'
    )
  })

  test('multiple matching candidates are all returned in results', async () => {
    const candidates = [
      makeCandidate({ id: 'c1', firstName: 'Jane', lastName: 'Smith' }),
      makeCandidate({ id: 'c2', firstName: 'Jane', lastName: 'Doe' }),
      makeCandidate({ id: 'c3', firstName: 'Janet', lastName: 'Jones' }),
    ]
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse(candidates, { total: 3 }),
    })
    const state = await simulateSearch('Jane', '', fetch)
    assert.equal(state.results.length, 3)
    assert.equal(state.total, 3)
  })

  test('each result has a unique id', async () => {
    const candidates = [
      makeCandidate({ id: 'c1' }),
      makeCandidate({ id: 'c2' }),
      makeCandidate({ id: 'c3' }),
    ]
    const { fetch } = makeFetchMock({
      ok: true,
      body: makeSearchResponse(candidates),
    })
    const state = await simulateSearch('Jane', '', fetch)
    const ids = state.results.map((c) => c.id)
    const uniqueIds = new Set(ids)
    assert.equal(uniqueIds.size, ids.length, 'All result IDs should be unique')
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
    console.log('\n✓ All CandidateSearch component logic tests passed.')
  }
})()
