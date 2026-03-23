import Link from 'next/link'
import { type RoleWithApplications } from '@/types'
import { formatDate } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Role status display helpers
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  PAUSED: 'Paused',
  CLOSED: 'Closed',
  ARCHIVED: 'Archived',
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PUBLISHED: 'bg-green-100 text-green-800',
  PAUSED: 'bg-yellow-100 text-yellow-800',
  CLOSED: 'bg-red-100 text-red-800',
  ARCHIVED: 'bg-gray-100 text-gray-400',
}

// ---------------------------------------------------------------------------
// Application status display helpers
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
// Type display helpers
// ---------------------------------------------------------------------------

const LOCATION_TYPE_LABEL: Record<string, string> = {
  ON_SITE: 'On-Site',
  REMOTE: 'Remote',
  HYBRID: 'Hybrid',
}

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  FULL_TIME: 'Full Time',
  PART_TIME: 'Part Time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
  TEMPORARY: 'Temporary',
}

// ---------------------------------------------------------------------------
// Salary formatting helper
// ---------------------------------------------------------------------------

function formatSalary(
  min: number | null,
  max: number | null,
  currency: string | null
): string | null {
  if (min === null && max === null) return null
  const currencyCode = currency ?? 'USD'
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(n)

  if (min !== null && max !== null) return `${fmt(min)} – ${fmt(max)}`
  if (min !== null) return `From ${fmt(min)}`
  return `Up to ${fmt(max!)}`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Renders a labelled detail row inside a <dl>. */
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

interface RoleDetailProps {
  role: RoleWithApplications & { _count?: { applications: number } }
}

export function RoleDetail({ role }: RoleDetailProps) {
  const applicationCount = role._count?.applications ?? role.applications.length
  const salary = formatSalary(role.salaryMin, role.salaryMax, role.salaryCurrency)

  return (
    <div className="space-y-8">

      {/* ── Role header card ──────────────────────────────────────────── */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">

          {/* Icon + title */}
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg
                className="w-8 h-8 text-primary-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0H8m8 0a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{role.title}</h2>
              <p className="text-sm text-gray-600 mt-0.5">
                {role.company}
                {role.department && (
                  <span className="text-gray-400"> · {role.department}</span>
                )}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${
                    STATUS_COLOR[role.status] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {STATUS_LABEL[role.status] ?? role.status}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700">
                  {EMPLOYMENT_TYPE_LABEL[role.employmentType] ?? role.employmentType}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full bg-indigo-50 text-indigo-700">
                  {LOCATION_TYPE_LABEL[role.locationType] ?? role.locationType}
                </span>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex gap-6 sm:flex-col sm:gap-3 sm:text-right">
            <div>
              <p className="text-2xl font-bold text-gray-900">{applicationCount}</p>
              <p className="text-xs text-gray-500">
                {applicationCount === 1 ? 'Application' : 'Applications'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {formatDate(role.createdAt)}
              </p>
              <p className="text-xs text-gray-500">Posted</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Role information + meta ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Core details */}
        <div className="lg:col-span-2 space-y-6">

          {/* Description */}
          {role.description && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Description
              </h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {role.description}
              </p>
            </div>
          )}

          {/* Requirements */}
          {role.requirements && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Requirements
              </h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {role.requirements}
              </p>
            </div>
          )}

          {/* Benefits */}
          {role.benefits && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Benefits
              </h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {role.benefits}
              </p>
            </div>
          )}
        </div>

        {/* Side panel — role metadata */}
        <div className="card h-fit">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Role Details
          </h3>
          <dl>
            <InfoRow label="Company">{role.company}</InfoRow>

            {role.department && (
              <InfoRow label="Department">{role.department}</InfoRow>
            )}

            <InfoRow label="Employment">
              {EMPLOYMENT_TYPE_LABEL[role.employmentType] ?? role.employmentType}
            </InfoRow>

            <InfoRow label="Location type">
              {LOCATION_TYPE_LABEL[role.locationType] ?? role.locationType}
            </InfoRow>

            {role.location && (
              <InfoRow label="Location">{role.location}</InfoRow>
            )}

            {salary && (
              <InfoRow label="Salary">{salary}</InfoRow>
            )}

            {role.publishedAt && (
              <InfoRow label="Published">
                {formatDate(role.publishedAt)}
              </InfoRow>
            )}

            {role.closesAt && (
              <InfoRow label="Closes">
                {formatDate(role.closesAt)}
              </InfoRow>
            )}

            <InfoRow label="Last updated">
              {formatDate(role.updatedAt)}
            </InfoRow>
          </dl>
        </div>
      </div>

      {/* ── Applications ─────────────────────────────────────────────── */}
      <div className="card overflow-hidden p-0">

        {/* Card header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Applications
            {applicationCount > 0 && (
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                {applicationCount}
              </span>
            )}
          </h3>
        </div>

        {role.applications.length === 0 ? (
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
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h4 className="text-base font-medium text-gray-900 mb-1">
              No applications yet
            </h4>
            <p className="text-sm text-gray-500">
              No candidates have applied to this role yet.
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
                    Candidate
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
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Rating
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {role.applications.map((application) => {
                  const initials =
                    application.candidate.firstName.charAt(0).toUpperCase() +
                    application.candidate.lastName.charAt(0).toUpperCase()

                  return (
                    <tr
                      key={application.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      {/* Candidate avatar + name + email */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span
                              className="text-primary-600 font-medium text-xs"
                              aria-hidden="true"
                            >
                              {initials}
                            </span>
                          </div>
                          <div>
                            <Link
                              href={`/candidates/${application.candidateId}`}
                              className="text-sm font-medium text-gray-900 hover:text-primary-600 transition-colors"
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

                      {/* Rating */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {application.rating != null ? (
                          <span className="inline-flex items-center gap-0.5">
                            <svg
                              className="w-3.5 h-3.5 text-yellow-400"
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
