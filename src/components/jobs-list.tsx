import { type RoleWithApplicationCount } from '@/types'
import { formatDate } from '@/lib/utils'

interface JobsListProps {
  roles: RoleWithApplicationCount[]
}

export function JobsList({ roles }: JobsListProps) {
  if (roles.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m-8 0V6a2 2 0 00-2 2v6" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No roles available</h3>
        <p className="text-gray-500">Check back later for new opportunities.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {roles.map((role) => (
        <div key={role.id} className="card hover:shadow-lg transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-semibold text-lg text-gray-900 mb-1">
                {role.title}
              </h3>
              <p className="text-primary-600 font-medium">{role.company}</p>
            </div>
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                role.status === 'PUBLISHED'
                  ? 'bg-green-100 text-green-800'
                  : role.status === 'CLOSED'
                  ? 'bg-red-100 text-red-800'
                  : role.status === 'PAUSED'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {role.status}
            </span>
          </div>

          {role.description && (
            <p className="text-gray-600 text-sm mb-4 line-clamp-3">
              {role.description}
            </p>
          )}

          <div className="space-y-2 mb-4">
            {role.location && (
              <div className="flex items-center text-sm text-gray-500">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {role.location}
              </div>
            )}
            <div className="flex items-center text-sm text-gray-500">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m-8 0V6a2 2 0 00-2 2v6" />
              </svg>
              {role.employmentType.replace('_', ' ')}
            </div>
            <div className="flex items-center text-sm text-gray-500">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              {role.locationType.replace('_', ' ')}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <span className="text-xs text-gray-500">
              Posted {formatDate(role.createdAt)}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                {role._count.applications} applicant{role._count.applications !== 1 ? 's' : ''}
              </span>
              <button className="btn btn-primary btn-sm">
                Apply Now
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
