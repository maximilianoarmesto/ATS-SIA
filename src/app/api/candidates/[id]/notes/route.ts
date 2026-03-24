import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateCreateCandidateNote } from '@/lib/validations/candidate-note'

// ---------------------------------------------------------------------------
// GET /api/candidates/[id]/notes
// Returns all notes for the given candidate, newest first.
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Verify the candidate exists first so callers get a clear 404.
    const candidate = await prisma.candidate.findUnique({ where: { id } })
    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      )
    }

    const notes = await prisma.candidateNote.findMany({
      where: { candidateId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: notes })
  } catch (error) {
    console.error('GET /api/candidates/[id]/notes error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch candidate notes' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/candidates/[id]/notes
// Accepts application/json.
//
// Required fields:
//   content  — note body text (plain text / light markdown, max 10 000 chars)
//
// Response 201: { data: CandidateNote }
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Verify the candidate exists before creating the note.
    const candidate = await prisma.candidate.findUnique({ where: { id } })
    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      )
    }

    const fields = (await request.json()) as Record<string, unknown>

    const validation = validateCreateCandidateNote(fields)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 422 }
      )
    }

    const note = await prisma.candidateNote.create({
      data: {
        candidateId: id,
        content: validation.data.content,
      },
    })

    return NextResponse.json({ data: note }, { status: 201 })
  } catch (error) {
    console.error('POST /api/candidates/[id]/notes error:', error)
    return NextResponse.json(
      { error: 'Failed to create candidate note' },
      { status: 500 }
    )
  }
}
