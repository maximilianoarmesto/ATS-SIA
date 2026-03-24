import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateUpdateCandidateNote } from '@/lib/validations/candidate-note'

// ---------------------------------------------------------------------------
// PUT /api/candidates/[id]/notes/[noteId]
// Accepts application/json.
//
// Replaces the full note content (full-replace semantics).
//
// Required fields:
//   content  — note body text (plain text / light markdown, max 10 000 chars)
//
// Response 200: { data: CandidateNote }
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; noteId: string } }
) {
  try {
    const { id, noteId } = params

    // Confirm the note exists and belongs to the specified candidate.
    const existing = await prisma.candidateNote.findUnique({
      where: { id: noteId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      )
    }

    // Ensure the note actually belongs to the candidate in the URL — prevents
    // cross-candidate note manipulation.
    if (existing.candidateId !== id) {
      return NextResponse.json(
        { error: 'Note does not belong to the specified candidate' },
        { status: 403 }
      )
    }

    const fields = (await request.json()) as Record<string, unknown>

    const validation = validateUpdateCandidateNote(fields)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 422 }
      )
    }

    const updated = await prisma.candidateNote.update({
      where: { id: noteId },
      data: { content: validation.data.content },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    // Prisma record-not-found (race condition after the existence check)
    if (isPrismaNotFoundError(error)) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      )
    }

    console.error('PUT /api/candidates/[id]/notes/[noteId] error:', error)
    return NextResponse.json(
      { error: 'Failed to update candidate note' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/candidates/[id]/notes/[noteId]
//
// Response 200: { success: true }
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; noteId: string } }
) {
  try {
    const { id, noteId } = params

    // Confirm the note exists and belongs to the specified candidate.
    const existing = await prisma.candidateNote.findUnique({
      where: { id: noteId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      )
    }

    // Ensure the note actually belongs to the candidate in the URL.
    if (existing.candidateId !== id) {
      return NextResponse.json(
        { error: 'Note does not belong to the specified candidate' },
        { status: 403 }
      )
    }

    await prisma.candidateNote.delete({ where: { id: noteId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    // Prisma record-not-found (race condition after the existence check)
    if (isPrismaNotFoundError(error)) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      )
    }

    console.error('DELETE /api/candidates/[id]/notes/[noteId] error:', error)
    return NextResponse.json(
      { error: 'Failed to delete candidate note' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isPrismaNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2025'
  )
}
