'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type ApplicationWithDetails } from '@/types'
import { formatDate } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Application status display helpers
// ---------------------------------------------------------------------------

const APP_STATUS_LABEL: Record<string, string> = {
  APPLIED: 'Applied',
  UNDER_REVIEW: 'Under Review',
  SHORTLISTED: 'Shortlisted',
  INTERVIEWING: 'Interviewing',
  OFFER_SENT: 'Offer Sent',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
}

const APP_STATUS_COLOR: Record<string, string> = {
  APPLIED: 'bg-yellow-100 text-yellow-800',
  UNDER_REVIEW: 'bg-blue-100 text-blue-800',
  SHORTLISTED: 'bg-cyan-100 text-cyan-800',
  INTERVIEWING: 'bg-purple-100 text-purple-800',
  OFFER_SENT: 'bg-orange-100 text-orange-800',
  HIRED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  WITHDRAWN: 'bg-gray-100 text-gray-600',
}

const ALL_STATUSES = Object.keys(APP_STATUS_LABEL)

// ---------------------------------------------------------------------------
// Application stage display helpers
// ---------------------------------------------------------------------------

const APP_STAGE_LABEL: Record<string, string> = {
  APPLICATION: 'Application',
  SCREENING: 'Screening',
  ASSESSMENT: 'Assessment',
  INTERVIEW_1: 'Interview 1',
  INTERVIEW_2: 'Interview 2',
  FINAL_ROUND: 'Final Round',
  OFFER: 'Offer',
  CLOSED: 'Closed',
}

// ---------------------------------------------------------------------------
// Status-update row cell
// ---------------------------------------------------------------------------

interface StatusCellProps {
  applicationId: string
  currentStatus: string
}

function StatusCell({ applicationId, currentStatus }: StatusCellProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState(currentStatus)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(newStatus: string) {
    if (newStatus === status) return
    setError(null)

    const previous = status
    // Optimistic update
    setStatus(newStatus)

    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? 'Update failed')
      }

      // Revalidate server-rendered page data
      startTransition(() => {
        router.refresh()
      })
    } catch (err) {
      // Roll back on error
      setStatus(previous)
      setError(err instanceof Error ? err.message : 'Update failed')
    }
  }

  return (
    <td className="px-6 py-4 whitespace-nowrap">
      <div className="flex flex-col gap-1">
        <select
          value={status}
          onChange={(e) => handleChange(e.target.value)}
          disabled={isPending}
          aria-label="Update application status"
          className={`text-xs font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed ${
            APP_STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600'
          }`}
        >
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s} className="bg-white text-gray-900 font-normal">
              {APP_STATUS_LABEL[s] ?? s}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </td>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ApplicationsListProps {
  applications: ApplicationWithDetails[]
}

export function ApplicationsList({ applications }: ApplicationsListProps) {
  if (applications.length === 0) {
    return (
      <div className="card text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No applications yet
        </h3>
        <p className="text-gray-500">
          Applications will appear here once candidates start applying to roles.
        </p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Candidate
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Role
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Company
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Stage
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Applied
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Rating
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {applications.map((application) => (
              <tr
                key={application.id}
                className="hover:bg-gray-50 transition-colors"
              >
                {/* Candidate — avatar + name + email */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span
                        className="text-primary-600 font-medium text-sm"
                        aria-hidden="true"
                      >
                        {application.candidate.firstName
                          .charAt(0)
                          .toUpperCase()}
                        {application.candidate.lastName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="ml-4 min-w-0">
                      <Link
                        href={`/candidates/${application.candidate.id}`}
                        className="text-sm font-semibold text-gray-900 hover:text-primary-600 transition-colors"
                      >
                        {application.candidate.firstName}{' '}
                        {application.candidate.lastName}
                      </Link>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {application.candidate.email}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Role — title + department */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link
                    href={`/roles/${application.role.id}`}
                    className="text-sm font-semibold text-gray-900 hover:text-primary-600 transition-colors"
                  >
                    {application.role.title}
                  </Link>
                  {application.role.department && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {application.role.department}
                    </div>
                  )}
                </td>

                {/* Company */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {application.role.company}
                  </div>
                </td>

                {/* Stage — static badge */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">
                    {APP_STAGE_LABEL[application.stage] ??
                      application.stage.replace(/_/g, ' ')}
                  </span>
                </td>

                {/* Status — interactive dropdown */}
                <StatusCell
                  applicationId={application.id}
                  currentStatus={application.status}
                />

                {/* Applied date */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(application.appliedAt)}
                </td>

                {/* Rating */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {application.rating !== null ? (
                    <span className="flex items-center gap-1">
                      <svg
                        className="w-4 h-4 text-yellow-400 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span>{application.rating}/5</span>
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>

                {/* Actions — View candidate / View role */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3 text-sm">
                    <Link
                      href={`/candidates/${application.candidate.id}`}
                      className="font-medium text-primary-600 hover:text-primary-800 transition-colors"
                    >
                      Candidate
                    </Link>
                    <span className="text-gray-300" aria-hidden="true">
                      |
                    </span>
                    <Link
                      href={`/roles/${application.role.id}`}
                      className="font-medium text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      Role
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
