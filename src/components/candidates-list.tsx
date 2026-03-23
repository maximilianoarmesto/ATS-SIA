import Link from 'next/link'
import { type CandidateWithApplicationCount } from '@/types'
import { formatDate } from '@/lib/utils'

interface CandidatesListProps {
  candidates: CandidateWithApplicationCount[]
}

export function CandidatesList({ candidates }: CandidatesListProps) {
  if (candidates.length === 0) {
    return (
      <div className="card text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No candidates yet
        </h3>
        <p className="text-gray-500 mb-6">
          Add your first candidate to get started.
        </p>
        <Link href="/candidates/new" className="btn btn-primary btn-md">
          Add Candidate
        </Link>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Candidate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Applications
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Added
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {candidates.map((candidate) => (
              <tr key={candidate.id} className="hover:bg-gray-50">
                {/* Name + avatar */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-600 font-medium text-sm">
                        {candidate.firstName.charAt(0)}
                        {candidate.lastName.charAt(0)}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {candidate.firstName} {candidate.lastName}
                      </div>
                      {candidate.summary && (
                        <div className="text-xs text-gray-500 max-w-xs truncate">
                          {candidate.summary}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Email + phone */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{candidate.email}</div>
                  {candidate.phone && (
                    <div className="text-xs text-gray-500">{candidate.phone}</div>
                  )}
                </td>

                {/* Location */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {candidate.location ?? (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>
                </td>

                {/* Status badge */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      candidate.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : candidate.status === 'HIRED'
                        ? 'bg-blue-100 text-blue-800'
                        : candidate.status === 'INACTIVE'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-red-100 text-red-800' // BLACKLISTED
                    }`}
                  >
                    {candidate.status.charAt(0) +
                      candidate.status.slice(1).toLowerCase()}
                  </span>
                </td>

                {/* Application count */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {candidate._count.applications}{' '}
                  <span className="text-gray-500">
                    {candidate._count.applications === 1 ? 'app' : 'apps'}
                  </span>
                </td>

                {/* Created date */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(candidate.createdAt)}
                </td>

                {/* Actions */}
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center space-x-3">
                    <Link
                      href={`/candidates/${candidate.id}`}
                      className="text-primary-600 hover:text-primary-800 font-medium"
                    >
                      View
                    </Link>
                    <Link
                      href={`/candidates/${candidate.id}/edit`}
                      className="text-gray-600 hover:text-gray-800 font-medium"
                    >
                      Edit
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
