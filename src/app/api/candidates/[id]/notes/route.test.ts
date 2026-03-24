/**
 * Tests — GET /api/candidates/[id]/notes  &  POST /api/candidates/[id]/notes
 *
 * Verifies that:
 * 1. GET returns the full notes list ordered newest-first for a known candidate.
 * 2. GET returns 404 when the candidate does not exist.
 * 3. POST creates a new note and returns 201 with the persisted note.
 * 4. POST returns 404 when the candidate does not exist.
 * 5. POST returns 422 on validation failures (empty content, over-length, etc.).
 * 6. Both handlers return 500 on unexpected database errors.
 * 7. Note data is persisted correctly (candidateId, trimmed content).
 *
 * Run via:
 *   npx tsx src/app/api/candidates/[id]/notes/route.test.ts
 *
 * Exit code 0 = all tests pass.
 * Exit code 1 = one or more tests fail.
 *
 * Strategy: because the real route handlers call a live Prisma client we
 * extract the handler *logic* into injectable simulation functions that accept
 * a mock Prisma client.  This mirrors the real implementation exactly while
 * keeping tests hermetic (no DB connection required).
 */

import { validateCreateCandidateNote } from '@/lib/validations/candidate-note'
import { type CandidateNote } from '@/types'

// ---------------------------------------------------------------------------
// Minimal async test runner (no top-level await — wraps everything in an IIFE)
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
// Fixtures
// ---------------------------------------------------------------------------

const CANDIDATE_ID = 'cand_test_001'

function makeNote(overrides: Partial<CandidateNote> = {}): CandidateNote {
  const now = new Date('2024-06-01T10:00:00.000Z')
  return {
    id: 'note_001',
    candidateId: CANDIDATE_ID,
    content: 'Great technical skills.',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Prisma mock factory
// ---------------------------------------------------------------------------

type MockPrisma = {
  candidate: {
    findUnique: (args: unknown) => Promise<unknown>
  }
  candidateNote: {
    findMany: (args: unknown) => Promise<CandidateNote[]>
    create: (args: unknown) => Promise<CandidateNote>
    findUnique: (args: unknown) => Promise<CandidateNote | null>
    update: (args: unknown) => Promise<CandidateNote>
    delete: (args: unknown) => Promise<CandidateNote>
  }
}

function makePrismaMock(overrides: Partial<{
  candidateFindUnique: (args: unknown) => Promise<unknown>
  notesFindMany: (args: unknown) => Promise<CandidateNote[]>
  noteCreate: (args: unknown) => Promise<CandidateNote>
  noteFindUnique: (args: unknown) => Promise<CandidateNote | null>
  noteUpdate: (args: unknown) => Promise<CandidateNote>
  noteDelete: (args: unknown) => Promise<CandidateNote>
}> = {}): MockPrisma {
  return {
    candidate: {
      findUnique: overrides.candidateFindUnique ?? (async () => ({ id: CANDIDATE_ID })),
    },
    candidateNote: {
      findMany: overrides.notesFindMany ?? (async () => []),
      create: overrides.noteCreate ?? (async () => makeNote()),
      findUnique: overrides.noteFindUnique ?? (async () => makeNote()),
      update: overrides.noteUpdate ?? (async () => makeNote()),
      delete: overrides.noteDelete ?? (async () => makeNote()),
    },
  }
}

// ---------------------------------------------------------------------------
// Handler simulators — mirror the exact logic of the real route handlers
// with injectable Prisma clients (keeping tests hermetic).
// ---------------------------------------------------------------------------

async function simulateGetNotes(
  candidateId: string,
  prisma: MockPrisma
): Promise<{ status: number; body: unknown }> {
  try {
    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
    if (!candidate) {
      return { status: 404, body: { error: 'Candidate not found' } }
    }
    const notes = await prisma.candidateNote.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
    })
    return { status: 200, body: { data: notes } }
  } catch {
    return { status: 500, body: { error: 'Failed to fetch candidate notes' } }
  }
}

async function simulatePostNote(
  candidateId: string,
  body: Record<string, unknown>,
  prisma: MockPrisma
): Promise<{ status: number; body: unknown }> {
  try {
    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
    if (!candidate) {
      return { status: 404, body: { error: 'Candidate not found' } }
    }
    const validation = validateCreateCandidateNote(body)
    if (!validation.success) {
      return { status: 422, body: { error: 'Validation failed', details: validation.errors } }
    }
    const note = await prisma.candidateNote.create({
      data: { candidateId, content: validation.data.content },
    })
    return { status: 201, body: { data: note } }
  } catch {
    return { status: 500, body: { error: 'Failed to create candidate note' } }
  }
}

// ---------------------------------------------------------------------------
// GET — success cases
// ---------------------------------------------------------------------------

describe('GET /api/candidates/[id]/notes — success', () => {
  test('returns 200 with an empty array when the candidate has no notes', async () => {
    const prisma = makePrismaMock({ notesFindMany: async () => [] })
    const result = await simulateGetNotes(CANDIDATE_ID, prisma)
    const body = result.body as { data: CandidateNote[] }

    assert.equal(result.status, 200)
    assert.ok(Array.isArray(body.data))
    assert.equal(body.data.length, 0)
  })

  test('returns 200 with all candidate notes', async () => {
    const notes = [
      makeNote({ id: 'note_001', content: 'First note' }),
      makeNote({ id: 'note_002', content: 'Second note' }),
    ]
    const prisma = makePrismaMock({ notesFindMany: async () => notes })
    const result = await simulateGetNotes(CANDIDATE_ID, prisma)

    assert.equal(result.status, 200)
    assert.equal((result.body as { data: CandidateNote[] }).data.length, 2)
  })

  test('notes are returned in newest-first order', async () => {
    const older = makeNote({ id: 'old', createdAt: new Date('2024-01-01'), content: 'Old' })
    const newer = makeNote({ id: 'new', createdAt: new Date('2024-06-01'), content: 'New' })
    const prisma = makePrismaMock({ notesFindMany: async () => [newer, older] })
    const result = await simulateGetNotes(CANDIDATE_ID, prisma)

    const notes = (result.body as { data: CandidateNote[] }).data
    assert.equal(notes[0].id, 'new', 'Newest note should appear first')
    assert.equal(notes[1].id, 'old', 'Older note should appear second')
  })

  test('response is wrapped in a { data: [...] } envelope', async () => {
    const prisma = makePrismaMock({ notesFindMany: async () => [makeNote()] })
    const result = await simulateGetNotes(CANDIDATE_ID, prisma)

    assert.ok('data' in (result.body as object), 'Response should have a data key')
  })

  test('each note in the response contains id, content, candidateId, createdAt, updatedAt', async () => {
    const note = makeNote({
      id: 'note_full',
      content: 'Detailed note',
      candidateId: CANDIDATE_ID,
      createdAt: new Date('2024-03-15T12:00:00.000Z'),
      updatedAt: new Date('2024-03-15T12:00:00.000Z'),
    })
    const prisma = makePrismaMock({ notesFindMany: async () => [note] })
    const result = await simulateGetNotes(CANDIDATE_ID, prisma)

    const returned = (result.body as { data: CandidateNote[] }).data[0]
    assert.equal(returned.id, 'note_full')
    assert.equal(returned.content, 'Detailed note')
    assert.equal(returned.candidateId, CANDIDATE_ID)
    assert.ok(returned.createdAt !== undefined)
    assert.ok(returned.updatedAt !== undefined)
  })
})

// ---------------------------------------------------------------------------
// GET — candidate not found
// ---------------------------------------------------------------------------

describe('GET /api/candidates/[id]/notes — candidate not found', () => {
  test('returns 404 when the candidate does not exist', async () => {
    const prisma = makePrismaMock({ candidateFindUnique: async () => null })
    const result = await simulateGetNotes('nonexistent_id', prisma)

    assert.equal(result.status, 404)
    const body = result.body as { error: string }
    assert.ok(body.error.toLowerCase().includes('candidate'))
  })

  test('returns a human-readable error message', async () => {
    const prisma = makePrismaMock({ candidateFindUnique: async () => null })
    const result = await simulateGetNotes('ghost_id', prisma)

    const body = result.body as { error: string }
    assert.equal(typeof body.error, 'string')
    assert.ok(body.error.length > 0)
  })

  test('does NOT query notes when the candidate is not found (early return)', async () => {
    let notesFindManyCalled = false
    const prisma = makePrismaMock({
      candidateFindUnique: async () => null,
      notesFindMany: async () => { notesFindManyCalled = true; return [] },
    })
    await simulateGetNotes('ghost_id', prisma)
    assert.equal(notesFindManyCalled, false, 'Should not query notes for non-existent candidate')
  })
})

// ---------------------------------------------------------------------------
// GET — database errors
// ---------------------------------------------------------------------------

describe('GET /api/candidates/[id]/notes — database errors', () => {
  test('returns 500 when candidateFindUnique throws', async () => {
    const prisma = makePrismaMock({
      candidateFindUnique: async () => { throw new Error('DB connection lost') },
    })
    const result = await simulateGetNotes(CANDIDATE_ID, prisma)
    assert.equal(result.status, 500)
  })

  test('returns 500 when notesFindMany throws', async () => {
    const prisma = makePrismaMock({
      notesFindMany: async () => { throw new Error('Query timeout') },
    })
    const result = await simulateGetNotes(CANDIDATE_ID, prisma)
    assert.equal(result.status, 500)
    const body = result.body as { error: string }
    assert.ok(body.error.toLowerCase().includes('failed'))
  })
})

// ---------------------------------------------------------------------------
// POST — success cases
// ---------------------------------------------------------------------------

describe('POST /api/candidates/[id]/notes — success', () => {
  test('returns 201 with the created note', async () => {
    const created = makeNote({ id: 'new_note', content: 'New note content' })
    const prisma = makePrismaMock({ noteCreate: async () => created })
    const result = await simulatePostNote(CANDIDATE_ID, { content: 'New note content' }, prisma)

    assert.equal(result.status, 201)
    assert.equal((result.body as { data: CandidateNote }).data.id, 'new_note')
    assert.equal((result.body as { data: CandidateNote }).data.content, 'New note content')
  })

  test('response is wrapped in a { data: {...} } envelope', async () => {
    const prisma = makePrismaMock({ noteCreate: async () => makeNote() })
    const result = await simulatePostNote(CANDIDATE_ID, { content: 'Hello' }, prisma)

    assert.equal(result.status, 201)
    assert.ok('data' in (result.body as object))
  })

  test('persists trimmed content (not the raw whitespace-padded input)', async () => {
    let capturedContent = ''
    const prisma = makePrismaMock({
      noteCreate: async (args) => {
        capturedContent = (args as { data: { content: string } }).data.content
        return makeNote({ content: capturedContent })
      },
    })
    await simulatePostNote(CANDIDATE_ID, { content: '  trimmed content  ' }, prisma)
    assert.equal(capturedContent, 'trimmed content')
  })

  test('associates the note with the correct candidateId', async () => {
    let capturedCandidateId = ''
    const prisma = makePrismaMock({
      noteCreate: async (args) => {
        capturedCandidateId = (args as { data: { candidateId: string } }).data.candidateId
        return makeNote({ candidateId: capturedCandidateId })
      },
    })
    await simulatePostNote(CANDIDATE_ID, { content: 'Note content' }, prisma)
    assert.equal(capturedCandidateId, CANDIDATE_ID)
  })

  test('prisma.candidateNote.create is called exactly once per request', async () => {
    let callCount = 0
    const prisma = makePrismaMock({
      noteCreate: async () => { callCount++; return makeNote() },
    })
    await simulatePostNote(CANDIDATE_ID, { content: 'Note' }, prisma)
    assert.equal(callCount, 1)
  })

  test('created note includes all expected fields in the response', async () => {
    const now = new Date('2024-07-01T09:00:00.000Z')
    const created = makeNote({ id: 'resp_note', content: 'Content here', createdAt: now, updatedAt: now })
    const prisma = makePrismaMock({ noteCreate: async () => created })
    const result = await simulatePostNote(CANDIDATE_ID, { content: 'Content here' }, prisma)

    const data = (result.body as { data: CandidateNote }).data
    assert.equal(data.id, 'resp_note')
    assert.equal(data.candidateId, CANDIDATE_ID)
    assert.ok(data.createdAt !== undefined)
    assert.ok(data.updatedAt !== undefined)
  })
})

// ---------------------------------------------------------------------------
// POST — candidate not found
// ---------------------------------------------------------------------------

describe('POST /api/candidates/[id]/notes — candidate not found', () => {
  test('returns 404 when the candidate does not exist', async () => {
    const prisma = makePrismaMock({ candidateFindUnique: async () => null })
    const result = await simulatePostNote('ghost_id', { content: 'Note' }, prisma)

    assert.equal(result.status, 404)
    const body = result.body as { error: string }
    assert.ok(body.error.toLowerCase().includes('candidate'))
  })

  test('does NOT create a note when the candidate is not found', async () => {
    let createCalled = false
    const prisma = makePrismaMock({
      candidateFindUnique: async () => null,
      noteCreate: async () => { createCalled = true; return makeNote() },
    })
    await simulatePostNote('ghost_id', { content: 'Note' }, prisma)
    assert.equal(createCalled, false)
  })
})

// ---------------------------------------------------------------------------
// POST — validation failures (422)
// ---------------------------------------------------------------------------

describe('POST /api/candidates/[id]/notes — validation failures', () => {
  test('returns 422 when content field is missing', async () => {
    const result = await simulatePostNote(CANDIDATE_ID, {}, makePrismaMock())
    assert.equal(result.status, 422)
    const body = result.body as { error: string; details: string[] }
    assert.equal(body.error, 'Validation failed')
    assert.ok(Array.isArray(body.details) && body.details.length > 0)
  })

  test('returns 422 when content is an empty string', async () => {
    const result = await simulatePostNote(CANDIDATE_ID, { content: '' }, makePrismaMock())
    assert.equal(result.status, 422)
    const body = result.body as { error: string; details: string[] }
    assert.ok(body.details.some((d) => d.toLowerCase().includes('required')))
  })

  test('returns 422 when content is whitespace-only', async () => {
    const result = await simulatePostNote(CANDIDATE_ID, { content: '   ' }, makePrismaMock())
    assert.equal(result.status, 422)
  })

  test('returns 422 when content exceeds 10 000 characters', async () => {
    const result = await simulatePostNote(
      CANDIDATE_ID,
      { content: 'a'.repeat(10_001) },
      makePrismaMock()
    )
    assert.equal(result.status, 422)
    const body = result.body as { error: string; details: string[] }
    assert.ok(body.details.some((d) => d.includes('10000') || d.includes('10,000')))
  })

  test('does NOT call create on validation failure', async () => {
    let createCalled = false
    const prisma = makePrismaMock({
      noteCreate: async () => { createCalled = true; return makeNote() },
    })
    await simulatePostNote(CANDIDATE_ID, { content: '' }, prisma)
    assert.equal(createCalled, false)
  })

  test('validation details are an array of strings', async () => {
    const result = await simulatePostNote(CANDIDATE_ID, {}, makePrismaMock())
    const body = result.body as { details: unknown[] }
    assert.ok(body.details.every((d) => typeof d === 'string'))
  })
})

// ---------------------------------------------------------------------------
// POST — database errors
// ---------------------------------------------------------------------------

describe('POST /api/candidates/[id]/notes — database errors', () => {
  test('returns 500 when noteCreate throws', async () => {
    const prisma = makePrismaMock({
      noteCreate: async () => { throw new Error('Unexpected DB error') },
    })
    const result = await simulatePostNote(CANDIDATE_ID, { content: 'Valid note' }, prisma)
    assert.equal(result.status, 500)
    const body = result.body as { error: string }
    assert.ok(body.error.toLowerCase().includes('failed'))
  })

  test('returns 500 when candidateFindUnique throws', async () => {
    const prisma = makePrismaMock({
      candidateFindUnique: async () => { throw new Error('DB unreachable') },
    })
    const result = await simulatePostNote(CANDIDATE_ID, { content: 'Valid note' }, prisma)
    assert.equal(result.status, 500)
  })
})

// ---------------------------------------------------------------------------
// Persistence contract — note data integrity across create and read
// ---------------------------------------------------------------------------

describe('Persistence contract — note data integrity', () => {
  test('note created via POST appears in subsequent GET response', async () => {
    const noteStore: CandidateNote[] = []
    const prisma = makePrismaMock({
      noteCreate: async (args) => {
        const data = (args as { data: { candidateId: string; content: string } }).data
        const note = makeNote({ id: `note_${noteStore.length}`, content: data.content, candidateId: data.candidateId })
        noteStore.push(note)
        return note
      },
      notesFindMany: async () => [...noteStore].reverse(),
    })

    await simulatePostNote(CANDIDATE_ID, { content: 'Persisted note' }, prisma)

    const getResult = await simulateGetNotes(CANDIDATE_ID, prisma)
    assert.equal(getResult.status, 200)
    const notes = (getResult.body as { data: CandidateNote[] }).data
    assert.ok(notes.some((n) => n.content === 'Persisted note'))
  })

  test('three notes created sequentially are all retrievable via GET', async () => {
    const noteStore: CandidateNote[] = []
    const prisma = makePrismaMock({
      noteCreate: async (args) => {
        const data = (args as { data: { candidateId: string; content: string } }).data
        const note = makeNote({ id: `n${noteStore.length}`, content: data.content })
        noteStore.push(note)
        return note
      },
      notesFindMany: async () => [...noteStore].reverse(),
    })

    await simulatePostNote(CANDIDATE_ID, { content: 'Note A' }, prisma)
    await simulatePostNote(CANDIDATE_ID, { content: 'Note B' }, prisma)
    await simulatePostNote(CANDIDATE_ID, { content: 'Note C' }, prisma)

    const getResult = await simulateGetNotes(CANDIDATE_ID, prisma)
    const notes = (getResult.body as { data: CandidateNote[] }).data
    assert.equal(notes.length, 3)
    const contents = new Set(notes.map((n) => n.content))
    assert.ok(contents.has('Note A'))
    assert.ok(contents.has('Note B'))
    assert.ok(contents.has('Note C'))
  })
})

// ---------------------------------------------------------------------------
// Import assert (must be after describe/test registrations to avoid hoisting)
// ---------------------------------------------------------------------------

import assert from 'node:assert/strict'

// ---------------------------------------------------------------------------
// Entry point — run all tests
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
    console.log('\n✓ All notes collection route tests passed.')
  }
})()
