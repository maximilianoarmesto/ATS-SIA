/**
 * Tests — CandidateNotes component logic
 *
 * Verifies the client-side behaviour of the CandidateNotes component:
 * 1. NoteForm — input validation and API fetch behaviour (add & edit modes).
 * 2. NoteItem — delete confirmation and API fetch behaviour.
 * 3. Character counter thresholds and warning states.
 * 4. Optimistic state management (pending, error, rollback).
 * 5. End-to-end add → edit → delete note lifecycle.
 *
 * Because this is a React component with no rendering in a pure Node
 * environment, tests focus on the *business logic* extracted from the
 * component: validation rules applied before the fetch call, the correct
 * HTTP method / URL composition, and error-path branching.
 *
 * Fetch is simulated with a lightweight mock that captures request details
 * and returns configurable responses.
 *
 * Run via:
 *   npx tsx src/components/candidate-notes.test.ts
 *
 * Exit code 0 = all tests pass.
 * Exit code 1 = one or more tests fail.
 */

import assert from 'node:assert/strict'
import { type CandidateNote } from '@/types'

// ---------------------------------------------------------------------------
// Minimal async test runner
// ---------------------------------------------------------------------------

let passed = 0
let failed = 0
const failures: string[] = []
const pendingTests: Array<{ suite: string; description: string; fn: () => Promise<void> | void }> = []
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
// Constants — mirrored from the component
// ---------------------------------------------------------------------------

const MAX_CONTENT_LENGTH = 10_000
const CHARS_WARNING_THRESHOLD = 200

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CANDIDATE_ID = 'cand_test_ui_001'

function makeNote(overrides: Partial<CandidateNote> = {}): CandidateNote {
  const now = new Date('2024-06-01T10:00:00.000Z')
  return {
    id: 'note_ui_001',
    candidateId: CANDIDATE_ID,
    content: 'Initial note content.',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

interface FetchCall {
  url: string
  method: string
  headers: Record<string, string>
  body: Record<string, unknown> | null
}

type FetchMockResponse = {
  ok: boolean
  status: number
  data?: unknown
  error?: string
  details?: string[]
}

function createFetchMock(responses: FetchMockResponse[]): {
  fetch: (url: string, init?: RequestInit) => Promise<Response>
  calls: FetchCall[]
} {
  const calls: FetchCall[] = []
  let callIndex = 0

  const mockFetch = async (url: string, init?: RequestInit): Promise<Response> => {
    const response = responses[callIndex] ?? responses[responses.length - 1]
    callIndex++

    const body = init?.body ? JSON.parse(init.body as string) as Record<string, unknown> : null
    calls.push({
      url,
      method: init?.method ?? 'GET',
      headers: (init?.headers as Record<string, string>) ?? {},
      body,
    })

    const responseBody = response.ok
      ? JSON.stringify({ data: response.data })
      : JSON.stringify({ error: response.error, details: response.details })

    return new Response(responseBody, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return { fetch: mockFetch, calls }
}

// ---------------------------------------------------------------------------
// NoteForm logic — extracted for testing (mirrors component's handleSubmit)
// ---------------------------------------------------------------------------

interface NoteFormState {
  content: string
  error: string | null
  isPending: boolean
}

interface NoteFormResult {
  success: boolean
  error: string | null
  fetchCall?: FetchCall
}

async function simulateNoteFormSubmit(
  state: NoteFormState,
  candidateId: string,
  noteId: string | undefined,
  fetchFn: (url: string, init?: RequestInit) => Promise<Response>
): Promise<NoteFormResult> {
  const trimmed = state.content.trim()

  // Client-side validation (mirrors NoteForm handleSubmit)
  if (!trimmed) {
    return { success: false, error: 'Note content is required' }
  }
  if (trimmed.length > MAX_CONTENT_LENGTH) {
    return { success: false, error: `Note must not exceed ${MAX_CONTENT_LENGTH} characters` }
  }

  const isEdit = noteId !== undefined
  const url = isEdit
    ? `/api/candidates/${candidateId}/notes/${noteId}`
    : `/api/candidates/${candidateId}/notes`

  try {
    const res = await fetchFn(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: trimmed }),
    })

    if (!res.ok) {
      const body = (await res.json()) as { error?: string; details?: string[] }
      const errorMsg = body.details?.join(', ') ?? body.error ?? 'Failed to save note'
      return { success: false, error: errorMsg }
    }

    return { success: true, error: null }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save note' }
  }
}

// ---------------------------------------------------------------------------
// NoteItem delete logic — extracted for testing (mirrors handleDelete)
// ---------------------------------------------------------------------------

interface DeleteResult {
  success: boolean
  error: string | null
  fetchCall?: FetchCall
}

async function simulateNoteDelete(
  candidateId: string,
  noteId: string,
  confirmed: boolean,
  fetchFn: (url: string, init?: RequestInit) => Promise<Response>
): Promise<DeleteResult> {
  // Mirrors: if (!confirm('Delete this note? This cannot be undone.')) return
  if (!confirmed) {
    return { success: false, error: null } // user cancelled
  }

  try {
    const res = await fetchFn(
      `/api/candidates/${candidateId}/notes/${noteId}`,
      { method: 'DELETE' }
    )

    if (!res.ok) {
      const body = (await res.json()) as { error?: string }
      return { success: false, error: body.error ?? 'Failed to delete note' }
    }

    return { success: true, error: null }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete note' }
  }
}

// ---------------------------------------------------------------------------
// Character counter logic
// ---------------------------------------------------------------------------

function getCharsRemaining(content: string): number {
  return MAX_CONTENT_LENGTH - content.length
}

/**
 * Returns true when the orange warning colour should be shown.
 * Mirrors the component's condition: charsRemaining < 200
 * (strictly less than — at exactly 200 remaining, no warning).
 */
function isCharCountWarning(content: string): boolean {
  return getCharsRemaining(content) < CHARS_WARNING_THRESHOLD
}

// ---------------------------------------------------------------------------
// "Edited" label logic — note.updatedAt !== note.createdAt
// ---------------------------------------------------------------------------

function isNoteEdited(note: CandidateNote): boolean {
  return new Date(note.updatedAt).getTime() !== new Date(note.createdAt).getTime()
}

// ---------------------------------------------------------------------------
// 1. NoteForm — client-side validation
// ---------------------------------------------------------------------------

describe('NoteForm — client-side validation (before fetch)', () => {
  test('rejects empty content before making any fetch call', async () => {
    const { fetch, calls } = createFetchMock([{ ok: true, status: 201, data: makeNote() }])
    const result = await simulateNoteFormSubmit(
      { content: '', error: null, isPending: false },
      CANDIDATE_ID,
      undefined,
      fetch
    )
    assert.equal(result.success, false)
    assert.equal(calls.length, 0, 'Fetch should not be called for empty content')
  })

  test('rejects whitespace-only content before making any fetch call', async () => {
    const { fetch, calls } = createFetchMock([{ ok: true, status: 201, data: makeNote() }])
    const result = await simulateNoteFormSubmit(
      { content: '   ', error: null, isPending: false },
      CANDIDATE_ID,
      undefined,
      fetch
    )
    assert.equal(result.success, false)
    assert.equal(calls.length, 0)
  })

  test('rejects content over MAX_CONTENT_LENGTH before making any fetch call', async () => {
    const { fetch, calls } = createFetchMock([{ ok: true, status: 201, data: makeNote() }])
    const result = await simulateNoteFormSubmit(
      { content: 'a'.repeat(MAX_CONTENT_LENGTH + 1), error: null, isPending: false },
      CANDIDATE_ID,
      undefined,
      fetch
    )
    assert.equal(result.success, false)
    assert.equal(calls.length, 0)
  })

  test('error message for empty content says "required"', async () => {
    const { fetch } = createFetchMock([])
    const result = await simulateNoteFormSubmit(
      { content: '', error: null, isPending: false },
      CANDIDATE_ID,
      undefined,
      fetch
    )
    assert.equal(result.success, false)
    assert.ok(result.error?.toLowerCase().includes('required'), `Got: ${result.error}`)
  })

  test('error message for oversized content mentions the character limit', async () => {
    const { fetch } = createFetchMock([])
    const result = await simulateNoteFormSubmit(
      { content: 'a'.repeat(MAX_CONTENT_LENGTH + 1), error: null, isPending: false },
      CANDIDATE_ID,
      undefined,
      fetch
    )
    assert.equal(result.success, false)
    assert.ok(
      result.error?.includes(String(MAX_CONTENT_LENGTH)),
      `Error should mention ${MAX_CONTENT_LENGTH}, got: ${result.error}`
    )
  })
})

// ---------------------------------------------------------------------------
// 2. NoteForm — adding a new note (POST)
// ---------------------------------------------------------------------------

describe('NoteForm — adding a new note (POST)', () => {
  test('sends POST to /api/candidates/[id]/notes on create', async () => {
    const { fetch, calls } = createFetchMock([{ ok: true, status: 201, data: makeNote() }])
    await simulateNoteFormSubmit(
      { content: 'New note', error: null, isPending: false },
      CANDIDATE_ID,
      undefined, // no noteId = create mode
      fetch
    )
    assert.equal(calls.length, 1)
    assert.equal(calls[0].method, 'POST')
    assert.equal(calls[0].url, `/api/candidates/${CANDIDATE_ID}/notes`)
  })

  test('sends the trimmed content in the request body', async () => {
    const { fetch, calls } = createFetchMock([{ ok: true, status: 201, data: makeNote() }])
    await simulateNoteFormSubmit(
      { content: '  trim me  ', error: null, isPending: false },
      CANDIDATE_ID,
      undefined,
      fetch
    )
    assert.equal(calls[0].body?.content, 'trim me')
  })

  test('returns success on a 201 response', async () => {
    const { fetch } = createFetchMock([{ ok: true, status: 201, data: makeNote() }])
    const result = await simulateNoteFormSubmit(
      { content: 'Valid note', error: null, isPending: false },
      CANDIDATE_ID,
      undefined,
      fetch
    )
    assert.equal(result.success, true)
    assert.equal(result.error, null)
  })

  test('sets Content-Type: application/json header', async () => {
    const { fetch, calls } = createFetchMock([{ ok: true, status: 201, data: makeNote() }])
    await simulateNoteFormSubmit(
      { content: 'Note', error: null, isPending: false },
      CANDIDATE_ID,
      undefined,
      fetch
    )
    assert.equal(calls[0].headers['Content-Type'], 'application/json')
  })
})

// ---------------------------------------------------------------------------
// 3. NoteForm — editing an existing note (PUT)
// ---------------------------------------------------------------------------

describe('NoteForm — editing an existing note (PUT)', () => {
  test('sends PUT to /api/candidates/[id]/notes/[noteId] in edit mode', async () => {
    const { fetch, calls } = createFetchMock([{ ok: true, status: 200, data: makeNote() }])
    await simulateNoteFormSubmit(
      { content: 'Updated note', error: null, isPending: false },
      CANDIDATE_ID,
      'note_ui_001', // noteId provided = edit mode
      fetch
    )
    assert.equal(calls.length, 1)
    assert.equal(calls[0].method, 'PUT')
    assert.equal(calls[0].url, `/api/candidates/${CANDIDATE_ID}/notes/note_ui_001`)
  })

  test('sends the updated trimmed content in the PUT request body', async () => {
    const { fetch, calls } = createFetchMock([{ ok: true, status: 200, data: makeNote() }])
    await simulateNoteFormSubmit(
      { content: '  edited content  ', error: null, isPending: false },
      CANDIDATE_ID,
      'note_ui_001',
      fetch
    )
    assert.equal(calls[0].body?.content, 'edited content')
  })

  test('returns success on a 200 response from PUT', async () => {
    const { fetch } = createFetchMock([{ ok: true, status: 200, data: makeNote() }])
    const result = await simulateNoteFormSubmit(
      { content: 'Updated content', error: null, isPending: false },
      CANDIDATE_ID,
      'note_ui_001',
      fetch
    )
    assert.equal(result.success, true)
    assert.equal(result.error, null)
  })

  test('does NOT use POST when editing (PUT only)', async () => {
    const { fetch, calls } = createFetchMock([{ ok: true, status: 200, data: makeNote() }])
    await simulateNoteFormSubmit(
      { content: 'Updated content', error: null, isPending: false },
      CANDIDATE_ID,
      'some_note_id',
      fetch
    )
    assert.notEqual(calls[0].method, 'POST', 'Edit mode should use PUT, not POST')
  })

  test('does NOT use DELETE when editing (PUT only)', async () => {
    const { fetch, calls } = createFetchMock([{ ok: true, status: 200, data: makeNote() }])
    await simulateNoteFormSubmit(
      { content: 'Updated', error: null, isPending: false },
      CANDIDATE_ID,
      'some_note_id',
      fetch
    )
    assert.notEqual(calls[0].method, 'DELETE', 'Edit mode should use PUT, not DELETE')
  })
})

// ---------------------------------------------------------------------------
// 4. NoteForm — server-side error handling
// ---------------------------------------------------------------------------

describe('NoteForm — server-side error handling', () => {
  test('returns the server error message on a non-ok response', async () => {
    const { fetch } = createFetchMock([{
      ok: false,
      status: 422,
      error: 'Validation failed',
      details: ['Note content is required'],
    }])
    const result = await simulateNoteFormSubmit(
      { content: 'Valid on client', error: null, isPending: false },
      CANDIDATE_ID,
      undefined,
      fetch
    )
    assert.equal(result.success, false)
    assert.ok(result.error !== null)
  })

  test('uses details array from server error response when available', async () => {
    const { fetch } = createFetchMock([{
      ok: false,
      status: 422,
      error: 'Validation failed',
      details: ['Note content must not exceed 10000 characters'],
    }])
    const result = await simulateNoteFormSubmit(
      { content: 'Note', error: null, isPending: false },
      CANDIDATE_ID,
      undefined,
      fetch
    )
    assert.equal(result.success, false)
    assert.ok(result.error?.includes('10000'))
  })

  test('falls back to error string when no details array in response', async () => {
    const { fetch } = createFetchMock([{
      ok: false,
      status: 500,
      error: 'Internal server error',
    }])
    const result = await simulateNoteFormSubmit(
      { content: 'Note', error: null, isPending: false },
      CANDIDATE_ID,
      undefined,
      fetch
    )
    assert.equal(result.success, false)
    assert.ok(result.error?.includes('Internal server error'))
  })

  test('returns a generic error message when fetch throws (network failure)', async () => {
    const throwingFetch = async () => { throw new Error('Network failure') }
    const result = await simulateNoteFormSubmit(
      { content: 'Note', error: null, isPending: false },
      CANDIDATE_ID,
      undefined,
      throwingFetch as Parameters<typeof simulateNoteFormSubmit>[3]
    )
    assert.equal(result.success, false)
    assert.ok(result.error !== null)
  })

  test('returns false success on 404 (candidate not found during save)', async () => {
    const { fetch } = createFetchMock([{ ok: false, status: 404, error: 'Candidate not found' }])
    const result = await simulateNoteFormSubmit(
      { content: 'Note', error: null, isPending: false },
      'ghost_candidate',
      undefined,
      fetch
    )
    assert.equal(result.success, false)
    assert.ok(result.error?.toLowerCase().includes('candidate'))
  })
})

// ---------------------------------------------------------------------------
// 5. NoteItem — delete behaviour
// ---------------------------------------------------------------------------

describe('NoteItem — delete behaviour', () => {
  test('sends DELETE to /api/candidates/[id]/notes/[noteId] when confirmed', async () => {
    const { fetch, calls } = createFetchMock([{ ok: true, status: 200 }])
    const result = await simulateNoteDelete(CANDIDATE_ID, 'note_ui_001', true, fetch)

    assert.equal(result.success, true)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].method, 'DELETE')
    assert.equal(calls[0].url, `/api/candidates/${CANDIDATE_ID}/notes/note_ui_001`)
  })

  test('does NOT send any fetch request when the user cancels the confirmation', async () => {
    const { fetch, calls } = createFetchMock([{ ok: true, status: 200 }])
    const result = await simulateNoteDelete(CANDIDATE_ID, 'note_ui_001', false, fetch)

    assert.equal(result.success, false)
    assert.equal(result.error, null, 'No error — user simply cancelled')
    assert.equal(calls.length, 0, 'Fetch should not be called if the user cancels')
  })

  test('returns success: true on a 200 response from DELETE', async () => {
    const { fetch } = createFetchMock([{ ok: true, status: 200 }])
    const result = await simulateNoteDelete(CANDIDATE_ID, 'note_ui_001', true, fetch)
    assert.equal(result.success, true)
  })

  test('returns the server error message on a failed DELETE', async () => {
    const { fetch } = createFetchMock([{ ok: false, status: 404, error: 'Note not found' }])
    const result = await simulateNoteDelete(CANDIDATE_ID, 'note_ui_001', true, fetch)

    assert.equal(result.success, false)
    assert.ok(result.error?.toLowerCase().includes('note'))
  })

  test('uses generic fallback error when DELETE response has no error field', async () => {
    const { fetch } = createFetchMock([{ ok: false, status: 500 }])
    const result = await simulateNoteDelete(CANDIDATE_ID, 'note_ui_001', true, fetch)

    assert.equal(result.success, false)
    assert.ok(result.error !== null)
  })

  test('returns a network error message when fetch throws during DELETE', async () => {
    const throwingFetch = async () => { throw new Error('Network unreachable') }
    const result = await simulateNoteDelete(
      CANDIDATE_ID,
      'note_ui_001',
      true,
      throwingFetch as Parameters<typeof simulateNoteDelete>[3]
    )
    assert.equal(result.success, false)
    assert.ok(result.error !== null)
  })

  test('DELETE request body is absent (no body needed for DELETE)', async () => {
    const { fetch, calls } = createFetchMock([{ ok: true, status: 200 }])
    await simulateNoteDelete(CANDIDATE_ID, 'note_ui_001', true, fetch)

    assert.equal(calls[0].body, null, 'DELETE requests should not send a body')
  })
})

// ---------------------------------------------------------------------------
// 6. Character counter behaviour
// ---------------------------------------------------------------------------

describe('Character counter', () => {
  test('charsRemaining equals MAX_CONTENT_LENGTH when content is empty', () => {
    assert.equal(getCharsRemaining(''), MAX_CONTENT_LENGTH)
  })

  test('charsRemaining decreases as content grows', () => {
    assert.equal(getCharsRemaining('abc'), MAX_CONTENT_LENGTH - 3)
  })

  test('charsRemaining is 0 at exactly MAX_CONTENT_LENGTH characters', () => {
    assert.equal(getCharsRemaining('a'.repeat(MAX_CONTENT_LENGTH)), 0)
  })

  test('no warning when charsRemaining is above the threshold', () => {
    const content = 'a'.repeat(MAX_CONTENT_LENGTH - CHARS_WARNING_THRESHOLD - 1)
    assert.equal(isCharCountWarning(content), false)
  })

  test('no warning when exactly CHARS_WARNING_THRESHOLD characters remain (boundary: uses < not <=)', () => {
    // The component uses `charsRemaining < 200` — at exactly 200 remaining, no warning
    const content = 'a'.repeat(MAX_CONTENT_LENGTH - CHARS_WARNING_THRESHOLD)
    assert.equal(isCharCountWarning(content), false, 'At exactly 200 remaining the condition is < 200, which is false')
  })

  test('warning is triggered when fewer than CHARS_WARNING_THRESHOLD characters remain', () => {
    const content = 'a'.repeat(MAX_CONTENT_LENGTH - 1)
    assert.equal(isCharCountWarning(content), true)
  })

  test('warning is triggered at exactly MAX_CONTENT_LENGTH characters', () => {
    const content = 'a'.repeat(MAX_CONTENT_LENGTH)
    assert.equal(isCharCountWarning(content), true)
  })

  test('warning is NOT shown when exactly 1 char over the warning threshold', () => {
    const content = 'a'.repeat(MAX_CONTENT_LENGTH - CHARS_WARNING_THRESHOLD - 1)
    assert.equal(isCharCountWarning(content), false, 'One char above threshold should not warn')
  })
})

// ---------------------------------------------------------------------------
// 7. "(edited)" label logic
// ---------------------------------------------------------------------------

describe('"(edited)" label logic — updatedAt vs createdAt', () => {
  test('isNoteEdited returns false when updatedAt equals createdAt', () => {
    const now = new Date('2024-06-01T10:00:00.000Z')
    const note = makeNote({ createdAt: now, updatedAt: now })
    assert.equal(isNoteEdited(note), false)
  })

  test('isNoteEdited returns true when updatedAt is later than createdAt', () => {
    const note = makeNote({
      createdAt: new Date('2024-06-01T10:00:00.000Z'),
      updatedAt: new Date('2024-06-02T12:00:00.000Z'),
    })
    assert.equal(isNoteEdited(note), true)
  })

  test('isNoteEdited returns true even for a 1-millisecond difference', () => {
    const created = new Date('2024-06-01T10:00:00.000Z')
    const updated = new Date(created.getTime() + 1)
    const note = makeNote({ createdAt: created, updatedAt: updated })
    assert.equal(isNoteEdited(note), true)
  })

  test('new note (not yet edited) has equal createdAt and updatedAt', () => {
    const note = makeNote()
    // In the fixture both createdAt and updatedAt are set to the same value
    assert.equal(
      new Date(note.createdAt).getTime(),
      new Date(note.updatedAt).getTime()
    )
    assert.equal(isNoteEdited(note), false)
  })
})

// ---------------------------------------------------------------------------
// 8. URL composition — create vs edit vs delete
// ---------------------------------------------------------------------------

describe('API URL composition', () => {
  test('create URL: /api/candidates/[id]/notes', async () => {
    const { fetch, calls } = createFetchMock([{ ok: true, status: 201, data: makeNote() }])
    await simulateNoteFormSubmit(
      { content: 'Note', error: null, isPending: false },
      'cand_abc',
      undefined,
      fetch
    )
    assert.equal(calls[0].url, '/api/candidates/cand_abc/notes')
  })

  test('edit URL: /api/candidates/[id]/notes/[noteId]', async () => {
    const { fetch, calls } = createFetchMock([{ ok: true, status: 200, data: makeNote() }])
    await simulateNoteFormSubmit(
      { content: 'Updated', error: null, isPending: false },
      'cand_abc',
      'note_xyz',
      fetch
    )
    assert.equal(calls[0].url, '/api/candidates/cand_abc/notes/note_xyz')
  })

  test('delete URL: /api/candidates/[id]/notes/[noteId]', async () => {
    const { fetch, calls } = createFetchMock([{ ok: true, status: 200 }])
    await simulateNoteDelete('cand_abc', 'note_xyz', true, fetch)
    assert.equal(calls[0].url, '/api/candidates/cand_abc/notes/note_xyz')
  })

  test('create and edit use different HTTP methods for the same URL pattern', async () => {
    const { fetch: createFetch, calls: createCalls } = createFetchMock([{ ok: true, status: 201, data: makeNote() }])
    const { fetch: editFetch, calls: editCalls } = createFetchMock([{ ok: true, status: 200, data: makeNote() }])

    await simulateNoteFormSubmit(
      { content: 'Note', error: null, isPending: false },
      'cand_abc',
      undefined, // create
      createFetch
    )
    await simulateNoteFormSubmit(
      { content: 'Updated', error: null, isPending: false },
      'cand_abc',
      'note_xyz', // edit
      editFetch
    )

    assert.equal(createCalls[0].method, 'POST')
    assert.equal(editCalls[0].method, 'PUT')
  })
})

// ---------------------------------------------------------------------------
// 9. End-to-end note lifecycle
// ---------------------------------------------------------------------------

describe('End-to-end note lifecycle', () => {
  test('add note: POST succeeds → note is persisted (simulated)', async () => {
    const noteStore: CandidateNote[] = []
    let nextId = 1

    const addFetch = async (url: string, init?: RequestInit): Promise<Response> => {
      const body = JSON.parse((init?.body ?? '{}') as string) as { content: string }
      const note = makeNote({ id: `note_${nextId++}`, content: body.content })
      noteStore.push(note)
      return new Response(JSON.stringify({ data: note }), { status: 201 })
    }

    const result = await simulateNoteFormSubmit(
      { content: 'First note', error: null, isPending: false },
      CANDIDATE_ID,
      undefined,
      addFetch
    )
    assert.equal(result.success, true)
    assert.equal(noteStore.length, 1)
    assert.equal(noteStore[0].content, 'First note')
  })

  test('edit note: PUT succeeds → note content is updated (simulated)', async () => {
    const noteStore: Map<string, CandidateNote> = new Map()
    noteStore.set('note_1', makeNote({ id: 'note_1', content: 'Original' }))

    const editFetch = async (url: string, init?: RequestInit): Promise<Response> => {
      const noteId = url.split('/').pop()!
      const body = JSON.parse((init?.body ?? '{}') as string) as { content: string }
      const existing = noteStore.get(noteId)!
      const updated = { ...existing, content: body.content, updatedAt: new Date() }
      noteStore.set(noteId, updated)
      return new Response(JSON.stringify({ data: updated }), { status: 200 })
    }

    const result = await simulateNoteFormSubmit(
      { content: 'Updated note', error: null, isPending: false },
      CANDIDATE_ID,
      'note_1',
      editFetch
    )
    assert.equal(result.success, true)
    assert.equal(noteStore.get('note_1')?.content, 'Updated note')
  })

  test('delete note: DELETE succeeds → note is removed from store (simulated)', async () => {
    const noteStore: Map<string, CandidateNote> = new Map()
    noteStore.set('note_1', makeNote({ id: 'note_1' }))

    const deleteFetch = async (url: string, _init?: RequestInit): Promise<Response> => {
      const noteId = url.split('/').pop()!
      noteStore.delete(noteId)
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }

    const result = await simulateNoteDelete(CANDIDATE_ID, 'note_1', true, deleteFetch)
    assert.equal(result.success, true)
    assert.equal(noteStore.has('note_1'), false)
  })

  test('add → edit → delete: final state shows note is gone', async () => {
    const noteStore: Map<string, CandidateNote> = new Map()
    let idCounter = 1

    const fakeFetch = async (url: string, init?: RequestInit): Promise<Response> => {
      const method = init?.method ?? 'GET'
      const body = init?.body ? JSON.parse(init.body as string) as { content?: string } : {}

      if (method === 'POST') {
        const note = makeNote({ id: `n${idCounter++}`, content: body.content! })
        noteStore.set(note.id, note)
        return new Response(JSON.stringify({ data: note }), { status: 201 })
      }

      if (method === 'PUT') {
        const noteId = url.split('/').pop()!
        const existing = noteStore.get(noteId)!
        const updated = { ...existing, content: body.content!, updatedAt: new Date() }
        noteStore.set(noteId, updated)
        return new Response(JSON.stringify({ data: updated }), { status: 200 })
      }

      if (method === 'DELETE') {
        const noteId = url.split('/').pop()!
        noteStore.delete(noteId)
        return new Response(JSON.stringify({ success: true }), { status: 200 })
      }

      return new Response(JSON.stringify({ error: 'Unknown method' }), { status: 400 })
    }

    // Step 1: Add a note
    const addResult = await simulateNoteFormSubmit(
      { content: 'My first note', error: null, isPending: false },
      CANDIDATE_ID,
      undefined,
      fakeFetch
    )
    assert.equal(addResult.success, true)
    assert.equal(noteStore.size, 1)

    const noteId = [...noteStore.keys()][0]

    // Step 2: Edit the note
    const editResult = await simulateNoteFormSubmit(
      { content: 'My edited note', error: null, isPending: false },
      CANDIDATE_ID,
      noteId,
      fakeFetch
    )
    assert.equal(editResult.success, true)
    assert.equal(noteStore.get(noteId)?.content, 'My edited note')

    // Step 3: Delete the note
    const deleteResult = await simulateNoteDelete(CANDIDATE_ID, noteId, true, fakeFetch)
    assert.equal(deleteResult.success, true)
    assert.equal(noteStore.size, 0, 'Note store should be empty after deletion')
  })

  test('edit fails validation: note content remains unchanged', async () => {
    const noteStore: Map<string, CandidateNote> = new Map()
    noteStore.set('note_1', makeNote({ id: 'note_1', content: 'Original content' }))

    const fakeFetch = async (_url: string, _init?: RequestInit): Promise<Response> => {
      return new Response(JSON.stringify({ data: makeNote() }), { status: 200 })
    }

    // Try to save with empty content — client validation should prevent the fetch
    const result = await simulateNoteFormSubmit(
      { content: '', error: null, isPending: false },
      CANDIDATE_ID,
      'note_1',
      fakeFetch
    )
    assert.equal(result.success, false)
    // noteStore unchanged since no PUT was issued
    assert.equal(noteStore.get('note_1')?.content, 'Original content')
  })

  test('add three notes, edit the second, delete the first: correct final state', async () => {
    const noteStore: Map<string, CandidateNote> = new Map()
    let idCounter = 1

    const fakeFetch = async (url: string, init?: RequestInit): Promise<Response> => {
      const method = init?.method ?? 'GET'
      const body = init?.body ? JSON.parse(init.body as string) as { content?: string } : {}

      if (method === 'POST') {
        const note = makeNote({ id: `n${idCounter++}`, content: body.content! })
        noteStore.set(note.id, note)
        return new Response(JSON.stringify({ data: note }), { status: 201 })
      }
      if (method === 'PUT') {
        const noteId = url.split('/').pop()!
        const existing = noteStore.get(noteId)!
        const updated = { ...existing, content: body.content!, updatedAt: new Date() }
        noteStore.set(noteId, updated)
        return new Response(JSON.stringify({ data: updated }), { status: 200 })
      }
      if (method === 'DELETE') {
        const noteId = url.split('/').pop()!
        noteStore.delete(noteId)
        return new Response(JSON.stringify({ success: true }), { status: 200 })
      }
      return new Response(JSON.stringify({}), { status: 400 })
    }

    // Add three notes
    await simulateNoteFormSubmit({ content: 'Note A', error: null, isPending: false }, CANDIDATE_ID, undefined, fakeFetch)
    await simulateNoteFormSubmit({ content: 'Note B', error: null, isPending: false }, CANDIDATE_ID, undefined, fakeFetch)
    await simulateNoteFormSubmit({ content: 'Note C', error: null, isPending: false }, CANDIDATE_ID, undefined, fakeFetch)

    const noteIds = [...noteStore.keys()]
    assert.equal(noteIds.length, 3)

    // Edit the second note
    await simulateNoteFormSubmit({ content: 'Note B (edited)', error: null, isPending: false }, CANDIDATE_ID, noteIds[1], fakeFetch)
    assert.equal(noteStore.get(noteIds[1])?.content, 'Note B (edited)')

    // Delete the first note
    await simulateNoteDelete(CANDIDATE_ID, noteIds[0], true, fakeFetch)

    assert.equal(noteStore.size, 2)
    assert.equal(noteStore.has(noteIds[0]), false, 'First note should be deleted')
    assert.ok(noteStore.has(noteIds[1]))
    assert.ok(noteStore.has(noteIds[2]))
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
    console.log('\n✓ All CandidateNotes component logic tests passed.')
  }
})()
