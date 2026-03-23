export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/navbar'
import { ApplicationsList } from '@/components/applications-list'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Page metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Applications | ATS - SIA',
  description: 'View and manage all job applications in the recruitment pipeline.',
}

// ---------------------------------------------------------------------------
// Status display config for the summary badges
// ---------------------------------------------------------------------------

const STATUS_SUMMARY = [
  { status: 'APPLIED',      label: 'Applied',      color: 'bg-yellow-100 text-yellow-800' },
  { status: 'UNDER_REVIEW', label: 'Under Review',  color: 'bg-blue-100 text-blue-800'   },
  { status: 'SHORTLISTED',  label: 'Shortlisted',   color: 'bg-cyan-100 text-cyan-800'   },
  { status: 'INTERVIEWING', label: 'Interviewing',  color: 'bg-purple-100 text-purple-800'},
  { status: 'OFFER_SENT',   label: 'Offer Sent',    color: 'bg-orange-100 text-orange-800'},
  { status: 'HIRED',        label: 'Hired',         color: 'bg-green-100 text-green-800' },
  { status: 'REJECTED',     label: 'Rejected',      color: 'bg-red-100 text-red-800'     },
  { status: 'WITHDRAWN',    label: 'Withdrawn',     color: 'bg-gray-100 text-gray-600'   },
] as const

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getAllApplications() {
  try {
    const applications = await prisma.application.findMany({
      include: {
        candidate: true,
        role: true,
      },
      orderBy: [{ appliedAt: 'desc' }],
    })
    return applications
  } catch (error) {
    console.error('Failed to fetch applications:', error)
    return []
  }
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function ApplicationsPage() {
  const applications = await getAllApplications()
  const totalCount = applications.length

  return (
    <main>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">
              Applications
            </h1>
            <p className="text-gray-600">
              Manage and review all job applications in the recruitment pipeline
            </p>
          </div>
          <Link
            href="/applications/new"
            className="btn btn-primary btn-md self-start sm:self-auto"
          >
            + Add Application
          </Link>
        </div>

        {/* ── Summary bar ─────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-gray-600">
            Showing{' '}
            <span className="font-semibold text-gray-900">{totalCount}</span>{' '}
            application{totalCount !== 1 ? 's' : ''}
          </p>

          {totalCount > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_SUMMARY.map(({ status, label, color }) => {
                const count = applications.filter(
                  (a) => a.status === status
                ).length
                if (count === 0) return null
                return (
                  <span
                    key={status}
                    className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${color}`}
                  >
                    {count} {label}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Applications table ──────────────────────────────────────── */}
        <ApplicationsList applications={applications} />

      </div>
    </main>
  )
}
