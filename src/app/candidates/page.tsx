import Link from 'next/link'
import { Navbar } from '@/components/navbar'
import { CandidatesList } from '@/components/candidates-list'
import { prisma } from '@/lib/prisma'

async function getAllCandidates() {
  try {
    const candidates = await prisma.candidate.findMany({
      include: {
        _count: {
          select: {
            applications: true,
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })
    return candidates
  } catch (error) {
    console.error('Failed to fetch candidates:', error)
    return []
  }
}

export default async function CandidatesPage() {
  const candidates = await getAllCandidates()

  return (
    <main>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">
              Candidates
            </h1>
            <p className="text-lg text-gray-600">
              Manage and review all candidates in the pipeline
            </p>
          </div>
          <Link href="/candidates/new" className="btn btn-primary btn-md self-start sm:self-auto">
            + Add Candidate
          </Link>
        </div>

        {/* Summary bar */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm text-gray-600">
            Showing{' '}
            <span className="font-medium text-gray-900">{candidates.length}</span>{' '}
            candidate{candidates.length !== 1 ? 's' : ''}
          </p>

          {/* Status breakdown */}
          {candidates.length > 0 && (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              {(
                [
                  { status: 'ACTIVE', label: 'Active', color: 'bg-green-100 text-green-800' },
                  { status: 'HIRED', label: 'Hired', color: 'bg-blue-100 text-blue-800' },
                  { status: 'INACTIVE', label: 'Inactive', color: 'bg-gray-100 text-gray-600' },
                  { status: 'BLACKLISTED', label: 'Blacklisted', color: 'bg-red-100 text-red-800' },
                ] as const
              ).map(({ status, label, color }) => {
                const count = candidates.filter((c) => c.status === status).length
                if (count === 0) return null
                return (
                  <span key={status} className={`px-2 py-1 rounded-full font-medium ${color}`}>
                    {count} {label}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* Candidates table */}
        <CandidatesList candidates={candidates} />
      </div>
    </main>
  )
}
