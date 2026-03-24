import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { CandidateDetail } from '@/components/candidate-detail'
import { DeleteButton } from '@/components/delete-button'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageProps {
  params: { id: string }
}

// ---------------------------------------------------------------------------
// Dynamic metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const candidate = await prisma.candidate.findUnique({
      where: { id: params.id },
      select: { firstName: true, lastName: true },
    })

    if (!candidate) {
      return { title: 'Candidate Not Found | ATS - SIA' }
    }

    return {
      title: `${candidate.firstName} ${candidate.lastName} | ATS - SIA`,
      description: `View the profile and application history for ${candidate.firstName} ${candidate.lastName}.`,
    }
  } catch {
    return { title: 'Candidate | ATS - SIA' }
  }
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getCandidate(id: string) {
  try {
    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: {
        applications: {
          include: {
            role: true,
          },
          orderBy: { appliedAt: 'desc' },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { applications: true },
        },
      },
    })
    return candidate
  } catch (error) {
    console.error(`Failed to fetch candidate ${id}:`, error)
    return null
  }
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function CandidateDetailPage({ params }: PageProps) {
  const candidate = await getCandidate(params.id)

  if (!candidate) {
    notFound()
  }

  return (
    <main>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Breadcrumb ──────────────────────────────────────────────── */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500" aria-label="Breadcrumb">
          <Link
            href="/candidates"
            className="hover:text-primary-600 transition-colors"
          >
            Candidates
          </Link>
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-900 font-medium truncate">
            {candidate.firstName} {candidate.lastName}
          </span>
        </nav>

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {candidate.firstName} {candidate.lastName}
            </h1>
            <p className="text-gray-600 mt-1">Candidate profile</p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <Link
              href="/candidates"
              className="btn btn-secondary btn-md"
            >
              &larr; Back
            </Link>
            <Link
              href={`/candidates/${candidate.id}/edit`}
              className="btn btn-primary btn-md"
            >
              Edit Candidate
            </Link>
            <DeleteButton
              apiPath={`/api/candidates/${candidate.id}`}
              redirectPath="/candidates"
              label="Delete Candidate"
              confirmMessage={`Delete "${candidate.firstName} ${candidate.lastName}"? This will also delete all their applications.`}
            />
          </div>
        </div>

        {/* ── Detail content ──────────────────────────────────────────── */}
        <CandidateDetail candidate={candidate} />

      </div>
    </main>
  )
}
