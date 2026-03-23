export const dynamic = 'force-dynamic'

import { Navbar } from '@/components/navbar'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

async function getDashboardData() {
  try {
    const [totalRoles, totalApplications, publishedRoles, recentApplications] =
      await Promise.all([
        prisma.role.count(),
        prisma.application.count(),
        prisma.role.count({
          where: { status: 'PUBLISHED' },
        }),
        prisma.application.findMany({
          take: 5,
          orderBy: { appliedAt: 'desc' },
          include: {
            role: true,
            candidate: true,
          },
        }),
      ])

    return {
      totalRoles,
      totalApplications,
      publishedRoles,
      recentApplications,
    }
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error)
    return {
      totalRoles: 0,
      totalApplications: 0,
      publishedRoles: 0,
      recentApplications: [],
    }
  }
}

export default async function DashboardPage() {
  const { totalRoles, totalApplications, publishedRoles, recentApplications } =
    await getDashboardData()

  return (
    <main>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Dashboard</h1>
          <p className="text-lg text-gray-600">
            Overview of your recruitment activities
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m-8 0V6a2 2 0 00-2 2v6"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-2xl font-bold text-gray-900">{totalRoles}</h3>
                <p className="text-gray-600">Total Roles</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-2xl font-bold text-gray-900">
                  {totalApplications}
                </h3>
                <p className="text-gray-600">Total Applications</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-2xl font-bold text-gray-900">
                  {publishedRoles}
                </h3>
                <p className="text-gray-600">Published Roles</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Applications */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Recent Applications
            </h3>
            {recentApplications.length > 0 ? (
              <div className="space-y-4">
                {recentApplications.map((application) => (
                  <div
                    key={application.id}
                    className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {application.role.title}
                      </p>
                      <p className="text-sm text-gray-600">
                        {application.candidate.firstName}{' '}
                        {application.candidate.lastName} •{' '}
                        {application.role.company}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          application.status === 'APPLIED'
                            ? 'bg-yellow-100 text-yellow-800'
                            : application.status === 'UNDER_REVIEW'
                            ? 'bg-blue-100 text-blue-800'
                            : application.status === 'HIRED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {application.status.replace(/_/g, ' ')}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(application.appliedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No recent applications
              </p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <Link href="/roles/new" className="btn btn-primary btn-md w-full">
                Post New Role
              </Link>
              <Link href="/applications" className="btn btn-secondary btn-md w-full">
                Review Applications
              </Link>
              <Link href="/candidates" className="btn btn-secondary btn-md w-full">
                Manage Candidates
              </Link>
              <Link href="/roles" className="btn btn-secondary btn-md w-full">
                View All Roles
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
