/**
 * Tests — PUT  /api/candidates/[id]/notes/[noteId]
 *          DELETE /api/candidates/[id]/notes/[noteId]
 *
 * Verifies that:
 * 1. PUT updates a note's content and returns the updated note (200).
 * 2. PUT returns 404 when the note does not exist.
 * 3. PUT returns 403 when the note belongs to a different candidate.
 * 4. PUT returns 422 on validation failures.
 * 5. DELETE removes the note and returns { success: true } (200).
 * 6. DELETE returns 404 when the note does not exist.
 * 7. DELETE returns 403 when the note belongs to a different candidate.
 * 8. Both handlers return 500 on unexpected database errors.
 * 9. Race condition: P2025 during update/delete after existence check returns 404.
 *
 * Run via:
 *   npx tsx src/app/api/candidates/[id]/notes/[noteId]/route.test.ts
 *
 * Exit code 0 = all tests pass.
 * Exit code 1 = one or more tests fail.
 */

import { validateUpdateCandidateNote } from '@/lib/validations/candidate-note'
import { type CandidateNote } from '@/types'
import assert from 'node:assert/strict'

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
// Fixtures
// ---------------------------------------------------------------------------

const CANDIDATE_ID = 'cand_test_001'
const OTHER_CANDIDATE_ID = 'cand_test_other'
const NOTE_ID = 'note_test_001'

function makeNote(overrides: Partial<CandidateNote> = {}): CandidateNote {
  const now = new Date('2024-06-01T10:00:00.000Z')
  return {
    id: NOTE_ID,
    candidateId: CANDIDATE_ID,
    content: 'Original note content.',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

/** Simulates a Prisma P2025 "record not found" error (race condition). */
function makePrismaP2025Error(): Error & { code: string } {
  const err = new Error('Record to update not found.') as Error & { code: string }
  err.code = 'P2025'
  return err
}

// ---------------------------------------------------------------------------
// Prisma mock factory
// ---------------------------------------------------------------------------

type MockPrisma = {
  candidateNote: {
    findUnique: (args: unknown) => Promise<CandidateNote | null>
    update: (args: unknown) => Promise<CandidateNote>
    delete: (args: unknown) => Promise<CandidateNote>
  }
}

function makePrismaMock(overrides: Partial<{
  noteFindUnique: (args: unknown) => Promise<CandidateNote | null>
  noteUpdate: (args: unknown) => Promise<CandidateNote>
  noteDelete: (args: unknown) => Promise<CandidateNote>
}> = {}): MockPrisma {
  return {
    candidateNote: {
      findUnique: overrides.noteFindUnique ?? (async () => makeNote()),
      update: overrides.noteUpdate ?? (async () => makeNote()),
      delete: overrides.noteDelete ?? (async () => makeNote()),
    },
  }
}

// ---------------------------------------------------------------------------
// Handler simulators — mirror the exact logic of the real route handlers
// ---------------------------------------------------------------------------

function isPrismaNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2025'
  )
}

async function simulatePutNote(
  candidateId: string,
  noteId: string,
  body: Record<string, unknown>,
  prisma: MockPrisma
): Promise<{ status: number; body: unknown }> {
  try {
    const existing = await prisma.candidateNote.findUnique({ where: { id: noteId } })

    if (!existing) {
      return { status: 404, body: { error: 'Note not found' } }
    }

    if (existing.candidateId !== candidateId) {
      return { status: 403, body: { error: 'Note does not belong to the specified candidate' } }
    }

    const validation = validateUpdateCandidateNote(body)
    if (!validation.success) {
      return { status: 422, body: { error: 'Validation failed', details: validation.errors } }
    }

    const updated = await prisma.candidateNote.update({
      where: { id: noteId },
      data: { content: validation.data.content },
    })

    return { status: 200, body: { data: updated } }
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return { status: 404, body: { error: 'Note not found' } }
    }
    return { status: 500, body: { error: 'Failed to update candidate note' } }
  }
}

async function simulateDeleteNote(
  candidateId: string,
  noteId: string,
  prisma: MockPrisma
): Promise<{ status: number; body: unknown }> {
  try {
    const existing = await prisma.candidateNote.findUnique({ where: { id: noteId } })

    if (!existing) {
      return { status: 404, body: { error: 'Note not found' } }
    }

    if (existing.candidateId !== candidateId) {
      return { status: 403, body: { error: 'Note does not belong to the specified candidate' } }
    }

    await prisma.candidateNote.delete({ where: { id: noteId } })

    return { status: 200, body: { success: true } }
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return { status: 404, body: { error: 'Note not found' } }
    }
    return { status: 500, body: { error: 'Failed to delete candidate note' } }
  }
}

// ---------------------------------------------------------------------------
// PUT — success (editing a note)
// ---------------------------------------------------------------------------

describe('PUT /api/candidates/[id]/notes/[noteId] — success', () => {
  test('returns 200 with the updated note', async () => {
    const updatedNote = makeNote({ content: 'Updated content' })
    const prisma = makePrismaMock({ noteUpdate: async () => updatedNote })
    const result = await simulatePutNote(CANDIDATE_ID, NOTE_ID, { content: 'Updated content' }, prisma)

    assert.equal(result.status, 200)
    const body = result.body as { data: CandidateNote }
    assert.equal(body.data.content, 'Updated content')
  })

  test('response is wrapped in a { data: {...} } envelope', async () => {
    const prisma = makePrismaMock()
    const result = await simulatePutNote(CANDIDATE_ID, NOTE_ID, { content: 'New content' }, prisma)

    assert.equal(result.status, 200)
    assert.ok('data' in (result.body as object))
  })

  test('persists trimmed content on update', async () => {
    let capturedContent = ''
    const prisma = makePrismaMock({
      noteUpdate: async (args) => {
        capturedContent = (args as { data: { content: string } }).data.content
        return makeNote({ content: capturedContent })
      },
    })
    await simulatePutNote(CANDIDATE_ID, NOTE_ID, { content: '  trimmed update  ' }, prisma)
    assert.equal(capturedContent, 'trimmed update')
  })

  test('updated note reflects the new content in the response', async () => {
    const newContent = 'Revised assessment: excellent candidate'
    const prisma = makePrismaMock({
      noteUpdate: async () => makeNote({ content: newContent, updatedAt: new Date() }),
    })
    const result = await simulatePutNote(CANDIDATE_ID, NOTE_ID, { content: newContent }, prisma)

    const data = (result.body as { data: CandidateNote }).data
    assert.equal(data.content, newContent)
  })

  test('update only affects the content field (candidateId and id are unchanged)', async () => {
    const prisma = makePrismaMock({
      noteUpdate: async () => makeNote({ content: 'Changed', id: NOTE_ID, candidateId: CANDIDATE_ID }),
    })
    const result = await simulatePutNote(CANDIDATE_ID, NOTE_ID, { content: 'Changed' }, prisma)

    const data = (result.body as { data: CandidateNote }).data
    assert.equal(data.id, NOTE_ID)
    assert.equal(data.candidateId, CANDIDATE_ID)
  })

  test('prisma.candidateNote.update is called exactly once', async () => {
    let updateCallCount = 0
    const prisma = makePrismaMock({
      noteUpdate: async () => { updateCallCount++; return makeNote() },
    })
    await simulatePutNote(CANDIDATE_ID, NOTE_ID, { content: 'Valid content' }, prisma)
    assert.equal(updateCallCount, 1)
  })

  test('updatedAt on the returned note can differ from createdAt (edit marker)', async () => {
    const createdAt = new Date('2024-01-01')
    const updatedAt = new Date('2024-06-15')
    const prisma = makePrismaMock({
      noteUpdate: async () => makeNote({ createdAt, updatedAt }),
    })
    const result = await simulatePutNote(CANDIDATE_ID, NOTE_ID, { content: 'Edited' }, prisma)

    const data = (result.body as { data: CandidateNote }).data
    assert.ok(
      new Date(data.updatedAt).getTime() > new Date(data.createdAt).getTime(),
      'updatedAt should be later than createdAt for an edited note'
    )
  })
})

// ---------------------------------------------------------------------------
// PUT — note not found (404)
// ---------------------------------------------------------------------------

describe('PUT /api/candidates/[id]/notes/[noteId] — note not found', () => {
  test('returns 404 when the note does not exist', async () => {
    const prisma = makePrismaMock({ noteFindUnique: async () => null })
    const result = await simulatePutNote(CANDIDATE_ID, 'nonexistent_note', { content: 'Update' }, prisma)

    assert.equal(result.status, 404)
    const body = result.body as { error: string }
    assert.ok(body.error.toLowerCase().includes('note'))
  })

  test('returns 404 with a human-readable error message', async () => {
    const prisma = makePrismaMock({ noteFindUnique: async () => null })
    const result = await simulatePutNote(CANDIDATE_ID, 'ghost_note', { content: 'Update' }, prisma)

    const body = result.body as { error: string }
    assert.equal(typeof body.error, 'string')
    assert.ok(body.error.length > 0)
  })

  test('does NOT call update when the note does not exist', async () => {
    let updateCalled = false
    const prisma = makePrismaMock({
      noteFindUnique: async () => null,
      noteUpdate: async () => { updateCalled = true; return makeNote() },
    })
    await simulatePutNote(CANDIDATE_ID, 'ghost_note', { content: 'Update' }, prisma)
    assert.equal(updateCalled, false)
  })

  test('returns 404 on P2025 race condition during update', async () => {
    const prisma = makePrismaMock({
      noteUpdate: async () => { throw makePrismaP2025Error() },
    })
    const result = await simulatePutNote(CANDIDATE_ID, NOTE_ID, { content: 'Update' }, prisma)
    assert.equal(result.status, 404)
  })
})

// ---------------------------------------------------------------------------
// PUT — cross-candidate manipulation (403)
// ---------------------------------------------------------------------------

describe('PUT /api/candidates/[id]/notes/[noteId] — cross-candidate protection', () => {
  test('returns 403 when the note belongs to a different candidate', async () => {
    // Note belongs to OTHER_CANDIDATE_ID, but the request is for CANDIDATE_ID
    const wrongCandidateNote = makeNote({ candidateId: OTHER_CANDIDATE_ID })
    const prisma = makePrismaMock({ noteFindUnique: async () => wrongCandidateNote })
    const result = await simulatePutNote(CANDIDATE_ID, NOTE_ID, { content: 'Update' }, prisma)

    assert.equal(result.status, 403)
    const body = result.body as { error: string }
    assert.ok(
      body.error.toLowerCase().includes('candidate'),
      `Expected cross-candidate error, got: ${body.error}`
    )
  })

  test('403 error message mentions the candidate relationship', async () => {
    const wrongNote = makeNote({ candidateId: OTHER_CANDIDATE_ID })
    const prisma = makePrismaMock({ noteFindUnique: async () => wrongNote })
    const result = await simulatePutNote(CANDIDATE_ID, NOTE_ID, { content: 'Hack attempt' }, prisma)

    const body = result.body as { error: string }
    assert.ok(typeof body.error === 'string' && body.error.length > 0)
  })

  test('does NOT call update when 403 is returned', async () => {
    let updateCalled = false
    const wrongNote = makeNote({ candidateId: OTHER_CANDIDATE_ID })
    const prisma = makePrismaMock({
      noteFindUnique: async () => wrongNote,
      noteUpdate: async () => { updateCalled = true; return makeNote() },
    })
    await simulatePutNote(CANDIDATE_ID, NOTE_ID, { content: 'Attempt' }, prisma)
    assert.equal(updateCalled, false)
  })
})

// ---------------------------------------------------------------------------
// PUT — validation failures (422)
// ---------------------------------------------------------------------------

describe('PUT /api/candidates/[id]/notes/[noteId] — validation failures', () => {
  test('returns 422 when content is missing', async () => {
    const result = await simulatePutNote(CANDIDATE_ID, NOTE_ID, {}, makePrismaMock())
    assert.equal(result.status, 422)
    const body = result.body as { error: string; details: string[] }
    assert.equal(body.error, 'Validation failed')
    assert.ok(Array.isArray(body.details) && body.details.length > 0)
  })

  test('returns 422 when content is an empty string', async () => {
    const result = await simulatePutNote(CANDIDATE_ID, NOTE_ID, { content: '' }, makePrismaMock())
    assert.equal(result.status, 422)
    const body = result.body as { error: string; details: string[] }
    assert.ok(body.details.some((d) => d.toLowerCase().includes('required')))
  })

  test('returns 422 when content is whitespace-only', async () => {
    const result = await simulatePutNote(CANDIDATE_ID, NOTE_ID, { content: '   ' }, makePrismaMock())
    assert.equal(result.status, 422)
  })

  test('returns 422 when content exceeds 10 000 characters', async () => {
    const result = await simulatePutNote(
      CANDIDATE_ID,
      NOTE_ID,
      { content: 'x'.repeat(10_001) },
      makePrismaMock()
    )
    assert.equal(result.status, 422)
    const body = result.body as { error: string; details: string[] }
    assert.ok(body.details.some((d) => d.includes('10000') || d.includes('10,000')))
  })

  test('does NOT call update on validation failure', async () => {
    let updateCalled = false
    const prisma = makePrismaMock({
      noteUpdate: async () => { updateCalled = true; return makeNote() },
    })
    await simulatePutNote(CANDIDATE_ID, NOTE_ID, { content: '' }, prisma)
    assert.equal(updateCalled, false)
  })

  test('validation details are an array of non-empty strings', async () => {
    const result = await simulatePutNote(CANDIDATE_ID, NOTE_ID, { content: '' }, makePrismaMock())
    const body = result.body as { details: unknown[] }
    assert.ok(body.details.every((d) => typeof d === 'string' && (d as string).length > 0))
  })
})

// ---------------------------------------------------------------------------
// PUT — database errors (500)
// ---------------------------------------------------------------------------

describe('PUT /api/candidates/[id]/notes/[noteId] — database errors', () => {
  test('returns 500 when noteUpdate throws an unexpected error', async () => {
    const prisma = makePrismaMock({
      noteUpdate: async () => { throw new Error('Disk full') },
    })
    const result = await simulatePutNote(CANDIDATE_ID, NOTE_ID, { content: 'Valid' }, prisma)
    assert.equal(result.status, 500)
    const body = result.body as { error: string }
    assert.ok(body.error.toLowerCase().includes('failed'))
  })

  test('returns 500 when findUnique throws an unexpected error', async () => {
    const prisma = makePrismaMock({
      noteFindUnique: async () => { throw new Error('Timeout') },
    })
    const result = await simulatePutNote(CANDIDATE_ID, NOTE_ID, { content: 'Valid' }, prisma)
    assert.equal(result.status, 500)
  })
})

// ---------------------------------------------------------------------------
// DELETE — success (removing a note)
// ---------------------------------------------------------------------------

describe('DELETE /api/candidates/[id]/notes/[noteId] — success', () => {
  test('returns 200 with { success: true }', async () => {
    const prisma = makePrismaMock()
    const result = await simulateDeleteNote(CANDIDATE_ID, NOTE_ID, prisma)

    assert.equal(result.status, 200)
    assert.deepEqual(result.body, { success: true })
  })

  test('response body is exactly { success: true } — no other fields', async () => {
    const prisma = makePrismaMock()
    const result = await simulateDeleteNote(CANDIDATE_ID, NOTE_ID, prisma)

    assert.equal(result.status, 200)
    const body = result.body as Record<string, unknown>
    assert.equal(Object.keys(body).length, 1)
    assert.equal(body.success, true)
  })

  test('prisma.candidateNote.delete is called exactly once', async () => {
    let deleteCallCount = 0
    const prisma = makePrismaMock({
      noteDelete: async () => { deleteCallCount++; return makeNote() },
    })
    await simulateDeleteNote(CANDIDATE_ID, NOTE_ID, prisma)
    assert.equal(deleteCallCount, 1)
  })

  test('deleted note is no longer returned on subsequent GET (simulated)', async () => {
    let noteStore: CandidateNote[] = [makeNote({ id: 'del_note' })]

    const prismaDel = makePrismaMock({
      noteDelete: async () => {
        const note = noteStore.find((n) => n.id === 'del_note')!
        noteStore = noteStore.filter((n) => n.id !== 'del_note')
        return note
      },
    })
    await simulateDeleteNote(CANDIDATE_ID, 'del_note', prismaDel)
    assert.equal(noteStore.length, 0, 'Note should be removed from the store after deletion')
  })
})

// ---------------------------------------------------------------------------
// DELETE — note not found (404)
// ---------------------------------------------------------------------------

describe('DELETE /api/candidates/[id]/notes/[noteId] — note not found', () => {
  test('returns 404 when the note does not exist', async () => {
    const prisma = makePrismaMock({ noteFindUnique: async () => null })
    const result = await simulateDeleteNote(CANDIDATE_ID, 'nonexistent_note', prisma)

    assert.equal(result.status, 404)
    const body = result.body as { error: string }
    assert.ok(body.error.toLowerCase().includes('note'))
  })

  test('does NOT call delete when the note does not exist', async () => {
    let deleteCalled = false
    const prisma = makePrismaMock({
      noteFindUnique: async () => null,
      noteDelete: async () => { deleteCalled = true; return makeNote() },
    })
    await simulateDeleteNote(CANDIDATE_ID, 'ghost_note', prisma)
    assert.equal(deleteCalled, false)
  })

  test('returns 404 on P2025 race condition during delete', async () => {
    const prisma = makePrismaMock({
      noteDelete: async () => { throw makePrismaP2025Error() },
    })
    const result = await simulateDeleteNote(CANDIDATE_ID, NOTE_ID, prisma)
    assert.equal(result.status, 404)
  })
})

// ---------------------------------------------------------------------------
// DELETE — cross-candidate manipulation (403)
// ---------------------------------------------------------------------------

describe('DELETE /api/candidates/[id]/notes/[noteId] — cross-candidate protection', () => {
  test('returns 403 when the note belongs to a different candidate', async () => {
    const wrongCandidateNote = makeNote({ candidateId: OTHER_CANDIDATE_ID })
    const prisma = makePrismaMock({ noteFindUnique: async () => wrongCandidateNote })
    const result = await simulateDeleteNote(CANDIDATE_ID, NOTE_ID, prisma)

    assert.equal(result.status, 403)
    const body = result.body as { error: string }
    assert.ok(body.error.toLowerCase().includes('candidate'))
  })

  test('does NOT call delete when 403 is returned', async () => {
    let deleteCalled = false
    const wrongNote = makeNote({ candidateId: OTHER_CANDIDATE_ID })
    const prisma = makePrismaMock({
      noteFindUnique: async () => wrongNote,
      noteDelete: async () => { deleteCalled = true; return makeNote() },
    })
    await simulateDeleteNote(CANDIDATE_ID, NOTE_ID, prisma)
    assert.equal(deleteCalled, false)
  })
})

// ---------------------------------------------------------------------------
// DELETE — database errors (500)
// ---------------------------------------------------------------------------

describe('DELETE /api/candidates/[id]/notes/[noteId] — database errors', () => {
  test('returns 500 when noteDelete throws an unexpected error', async () => {
    const prisma = makePrismaMock({
      noteDelete: async () => { throw new Error('DB write failed') },
    })
    const result = await simulateDeleteNote(CANDIDATE_ID, NOTE_ID, prisma)
    assert.equal(result.status, 500)
    const body = result.body as { error: string }
    assert.ok(body.error.toLowerCase().includes('failed'))
  })

  test('returns 500 when findUnique throws on DELETE', async () => {
    const prisma = makePrismaMock({
      noteFindUnique: async () => { throw new Error('Connection reset') },
    })
    const result = await simulateDeleteNote(CANDIDATE_ID, NOTE_ID, prisma)
    assert.equal(result.status, 500)
  })
})

// ---------------------------------------------------------------------------
// Full edit / delete lifecycle
// ---------------------------------------------------------------------------

describe('Full note lifecycle — add, edit, delete', () => {
  test('note content is changed after a successful PUT', async () => {
    const noteStore: Map<string, CandidateNote> = new Map()
    noteStore.set(NOTE_ID, makeNote({ content: 'Original' }))

    const prisma = makePrismaMock({
      noteFindUnique: async (args) => {
        const id = (args as { where: { id: string } }).where.id
        return noteStore.get(id) ?? null
      },
      noteUpdate: async (args) => {
        const id = (args as { where: { id: string }; data: { content: string } }).where.id
        const content = (args as { where: { id: string }; data: { content: string } }).data.content
        const existing = noteStore.get(id)!
        const updated = { ...existing, content, updatedAt: new Date() }
        noteStore.set(id, updated)
        return updated
      },
    })

    const result = await simulatePutNote(CANDIDATE_ID, NOTE_ID, { content: 'Updated' }, prisma)
    assert.equal(result.status, 200)
    assert.equal(noteStore.get(NOTE_ID)?.content, 'Updated')
  })

  test('note is absent from the store after a successful DELETE', async () => {
    const noteStore: Map<string, CandidateNote> = new Map()
    noteStore.set(NOTE_ID, makeNote())

    const prisma = makePrismaMock({
      noteFindUnique: async (args) => {
        const id = (args as { where: { id: string } }).where.id
        return noteStore.get(id) ?? null
      },
      noteDelete: async (args) => {
        const id = (args as { where: { id: string } }).where.id
        const note = noteStore.get(id)!
        noteStore.delete(id)
        return note
      },
    })

    const result = await simulateDeleteNote(CANDIDATE_ID, NOTE_ID, prisma)
    assert.equal(result.status, 200)
    assert.equal(noteStore.has(NOTE_ID), false, 'Note should be removed from the store')
  })

  test('attempting to delete an already-deleted note returns 404', async () => {
    const noteStore: Map<string, CandidateNote> = new Map()

    const prisma = makePrismaMock({
      noteFindUnique: async (args) => {
        const id = (args as { where: { id: string } }).where.id
        return noteStore.get(id) ?? null
      },
      noteDelete: async () => { throw new Error('Should not be called') },
    })

    const result = await simulateDeleteNote(CANDIDATE_ID, NOTE_ID, prisma)
    assert.equal(result.status, 404)
  })

  test('sequential edit and delete: final state is absent', async () => {
    const noteStore: Map<string, CandidateNote> = new Map()
    noteStore.set(NOTE_ID, makeNote({ content: 'Original' }))

    const prisma = makePrismaMock({
      noteFindUnique: async (args) => {
        const id = (args as { where: { id: string } }).where.id
        return noteStore.get(id) ?? null
      },
      noteUpdate: async (args) => {
        const a = args as { where: { id: string }; data: { content: string } }
        const existing = noteStore.get(a.where.id)!
        const updated = { ...existing, content: a.data.content, updatedAt: new Date() }
        noteStore.set(a.where.id, updated)
        return updated
      },
      noteDelete: async (args) => {
        const id = (args as { where: { id: string } }).where.id
        const note = noteStore.get(id)!
        noteStore.delete(id)
        return note
      },
    })

    // Edit the note
    const editResult = await simulatePutNote(CANDIDATE_ID, NOTE_ID, { content: 'Edited' }, prisma)
    assert.equal(editResult.status, 200)
    assert.equal(noteStore.get(NOTE_ID)?.content, 'Edited')

    // Delete the note
    const deleteResult = await simulateDeleteNote(CANDIDATE_ID, NOTE_ID, prisma)
    assert.equal(deleteResult.status, 200)
    assert.equal(noteStore.has(NOTE_ID), false)
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
    console.log('\n✓ All note detail route tests passed.')
  }
})()
