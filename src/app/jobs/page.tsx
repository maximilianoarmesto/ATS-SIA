export const dynamic = 'force-dynamic'

import { Navbar } from '@/components/navbar'
import { JobsList } from '@/components/jobs-list'
import { prisma } from '@/lib/prisma'

async function getAllRoles() {
  try {
    const roles = await prisma.role.findMany({
      include: {
        _count: {
          select: {
            applications: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
    return roles
  } catch (error) {
    console.error('Failed to fetch roles:', error)
    return []
  }
}

export default async function JobsPage() {
  const roles = await getAllRoles()

  return (
    <main>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Role Opportunities
          </h1>
          <p className="text-lg text-gray-600">
            Browse all available positions and find your perfect match
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters sidebar */}
          <aside className="lg:w-64 flex-shrink-0">
            <div className="card">
              <h3 className="font-semibold text-lg mb-4">Filters</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location Type
                  </label>
                  <select className="input">
                    <option value="">All Types</option>
                    <option value="REMOTE">Remote</option>
                    <option value="ON_SITE">On-Site</option>
                    <option value="HYBRID">Hybrid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employment Type
                  </label>
                  <select className="input">
                    <option value="">All Types</option>
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="INTERNSHIP">Internship</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department
                  </label>
                  <select className="input">
                    <option value="">All Departments</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Design">Design</option>
                    <option value="Product">Product</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>
              </div>
            </div>
          </aside>

          {/* Roles list */}
          <div className="flex-1">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-600 mb-4 sm:mb-0">
                Showing {roles.length} role{roles.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center space-x-2">
                <label htmlFor="sort" className="text-sm text-gray-700">
                  Sort by:
                </label>
                <select id="sort" className="input w-auto">
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="title">Role Title</option>
                  <option value="company">Company</option>
                </select>
              </div>
            </div>
            <JobsList roles={roles} />
          </div>
        </div>
      </div>
    </main>
  )
}
