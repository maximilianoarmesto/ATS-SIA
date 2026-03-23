import Link from 'next/link'
import { type RoleWithApplicationCount } from '@/types'
import { formatDate } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Status display helpers
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
// Component
// ---------------------------------------------------------------------------

interface RolesListProps {
  roles: RoleWithApplicationCount[]
}

export function RolesList({ roles }: RolesListProps) {
  if (roles.length === 0) {
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
              d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m-8 0V6a2 2 0 00-2 2v6"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No roles yet</h3>
        <p className="text-gray-500 mb-6">
          Create your first role to start building your talent pipeline.
        </p>
        <Link href="/roles/new" className="btn btn-primary btn-md">
          + Add Role
        </Link>
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
                Type
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Location
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Salary
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
                Applications
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Posted
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
            {roles.map((role) => {
              const salary = formatSalary(
                role.salaryMin,
                role.salaryMax,
                role.salaryCurrency
              )

              return (
                <tr
                  key={role.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {/* Role — title + department */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {role.title}
                    </div>
                    {role.department && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {role.department}
                      </div>
                    )}
                  </td>

                  {/* Company */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{role.company}</div>
                  </td>

                  {/* Employment type + location type */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {EMPLOYMENT_TYPE_LABEL[role.employmentType] ??
                        role.employmentType}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {LOCATION_TYPE_LABEL[role.locationType] ??
                        role.locationType}
                    </div>
                  </td>

                  {/* Location */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {role.location ?? (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                  </td>

                  {/* Salary */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {salary ?? <span className="text-gray-400">—</span>}
                    </div>
                  </td>

                  {/* Status badge */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${
                        STATUS_COLOR[role.status] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {STATUS_LABEL[role.status] ?? role.status}
                    </span>
                  </td>

                  {/* Application count */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="font-medium">
                      {role._count.applications}
                    </span>
                    <span className="text-gray-500 ml-1">
                      {role._count.applications === 1 ? 'app' : 'apps'}
                    </span>
                  </td>

                  {/* Posted date */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(role.createdAt)}
                  </td>

                  {/* Actions — Edit */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3 text-sm">
                      <Link
                        href={`/roles/${role.id}/edit`}
                        className="font-medium text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
