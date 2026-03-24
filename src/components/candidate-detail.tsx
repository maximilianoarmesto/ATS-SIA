import Link from 'next/link'
import { type CandidateWithApplications, type CandidateNote } from '@/types'
import { formatDate } from '@/lib/utils'
import { CandidateNotes } from './candidate-notes'

// ---------------------------------------------------------------------------
// Status display helpers — candidate status
// ---------------------------------------------------------------------------

const CANDIDATE_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  HIRED: 'Hired',
  INACTIVE: 'Inactive',
  BLACKLISTED: 'Blacklisted',
}

const CANDIDATE_STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  HIRED: 'bg-blue-100 text-blue-800',
  INACTIVE: 'bg-gray-100 text-gray-600',
  BLACKLISTED: 'bg-red-100 text-red-800',
}

// ---------------------------------------------------------------------------
// Application status / stage display helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Renders a labelled field row; hides itself when value is absent. */
function InfoRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4 border-b border-gray-100 last:border-b-0">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
        {children}
      </dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface CandidateDetailProps {
  candidate: CandidateWithApplications & {
    _count: { applications: number }
    notes: CandidateNote[]
  }
}

export function CandidateDetail({ candidate }: CandidateDetailProps) {
  const initials =
    candidate.firstName.charAt(0).toUpperCase() +
    candidate.lastName.charAt(0).toUpperCase()

  return (
    <div className="space-y-8">

      {/* ── Profile header card ───────────────────────────────────────── */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">

          {/* Avatar + name */}
          <div className="flex items-center gap-5">
            <div className="h-20 w-20 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-primary-600 font-semibold text-2xl" aria-hidden="true">
                {initials}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {candidate.firstName} {candidate.lastName}
              </h2>
              {candidate.summary && (
                <p className="mt-1 text-sm text-gray-600 max-w-prose">
                  {candidate.summary}
                </p>
              )}
              <div className="mt-2">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${
                    CANDIDATE_STATUS_COLOR[candidate.status] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {CANDIDATE_STATUS_LABEL[candidate.status] ?? candidate.status}
                </span>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex gap-6 sm:flex-col sm:gap-3 sm:text-right">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {candidate._count.applications}
              </p>
              <p className="text-xs text-gray-500">
                {candidate._count.applications === 1 ? 'Application' : 'Applications'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {formatDate(candidate.createdAt)}
              </p>
              <p className="text-xs text-gray-500">Added</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Personal information + Resume ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Personal information */}
        <div className="lg:col-span-2 card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Personal Information
          </h3>
          <dl>
            <InfoRow label="Email">
              <a
                href={`mailto:${candidate.email}`}
                className="text-primary-600 hover:text-primary-800 transition-colors"
              >
                {candidate.email}
              </a>
            </InfoRow>

            {candidate.phone && (
              <InfoRow label="Phone">
                <a
                  href={`tel:${candidate.phone}`}
                  className="text-primary-600 hover:text-primary-800 transition-colors"
                >
                  {candidate.phone}
                </a>
              </InfoRow>
            )}

            {candidate.location && (
              <InfoRow label="Location">{candidate.location}</InfoRow>
            )}

            {candidate.linkedinUrl && (
              <InfoRow label="LinkedIn">
                <a
                  href={candidate.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-800 transition-colors break-all"
                >
                  {candidate.linkedinUrl}
                </a>
              </InfoRow>
            )}

            {candidate.portfolioUrl && (
              <InfoRow label="Portfolio">
                <a
                  href={candidate.portfolioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-800 transition-colors break-all"
                >
                  {candidate.portfolioUrl}
                </a>
              </InfoRow>
            )}

            <InfoRow label="Last updated">
              {formatDate(candidate.updatedAt)}
            </InfoRow>
          </dl>
        </div>

        {/* Resume card */}
        <div className="card flex flex-col">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Resume / CV
          </h3>

          {candidate.resumeUrl ? (
            <div className="flex flex-col items-center justify-center flex-1 py-6 gap-4">
              {/* File icon */}
              <div className="w-16 h-16 bg-red-50 rounded-xl flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>

              <div className="text-center">
                <p className="text-sm font-medium text-gray-900">
                  Resume on file
                </p>
                <p className="text-xs text-gray-500 mt-0.5 break-all px-2">
                  {candidate.resumeUrl.split('/').pop()}
                </p>
              </div>

              <a
                href={candidate.resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-md w-full"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                View Resume
              </a>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 py-6 gap-3 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center">
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
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  No resume uploaded
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Upload a CV when editing this candidate.
                </p>
              </div>
              <Link
                href={`/candidates/${candidate.id}/edit`}
                className="btn btn-secondary btn-md w-full mt-1"
              >
                Upload Resume
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Notes ────────────────────────────────────────────────────── */}
      <CandidateNotes candidateId={candidate.id} notes={candidate.notes} />

      {/* ── Applications ─────────────────────────────────────────────── */}
      <div className="card overflow-hidden p-0">
        {/* Card header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Applications
            {candidate._count.applications > 0 && (
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                {candidate._count.applications}
              </span>
            )}
          </h3>
        </div>

        {candidate.applications.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg
                className="w-7 h-7 text-gray-400"
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
            <h4 className="text-base font-medium text-gray-900 mb-1">
              No applications yet
            </h4>
            <p className="text-sm text-gray-500">
              This candidate has not applied to any roles.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
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
                    Source
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {candidate.applications.map((application) => (
                  <tr
                    key={application.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* Role title + optional department */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {application.role.title}
                      </div>
                      {application.role.department && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {application.role.department}
                        </div>
                      )}
                    </td>

                    {/* Company */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {application.role.company}
                    </td>

                    {/* Stage badge */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">
                        {application.stage.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Status badge */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${
                          APP_STATUS_COLOR[application.status] ??
                          'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {application.status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Applied date */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(application.appliedAt)}
                    </td>

                    {/* Source */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {application.source ?? (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
