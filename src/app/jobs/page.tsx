import { Navbar } from '@/components/navbar'
import { JobsList } from '@/components/jobs-list'
import { prisma } from '@/lib/prisma'

async function getAllJobs() {
  try {
    const jobs = await prisma.job.findMany({
      include: {
        _count: {
          select: {
            applications: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    return jobs
  } catch (error) {
    console.error('Failed to fetch jobs:', error)
    return []
  }
}

export default async function JobsPage() {
  const jobs = await getAllJobs()

  return (
    <main>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Job Opportunities
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
                    Location
                  </label>
                  <select className="input">
                    <option value="">All Locations</option>
                    <option value="remote">Remote</option>
                    <option value="san-francisco">San Francisco, CA</option>
                    <option value="new-york">New York, NY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Job Type
                  </label>
                  <select className="input">
                    <option value="">All Types</option>
                    <option value="full-time">Full Time</option>
                    <option value="part-time">Part Time</option>
                    <option value="contract">Contract</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Salary Range
                  </label>
                  <select className="input">
                    <option value="">All Ranges</option>
                    <option value="0-50k">$0 - $50,000</option>
                    <option value="50k-100k">$50,000 - $100,000</option>
                    <option value="100k+">$100,000+</option>
                  </select>
                </div>
              </div>
            </div>
          </aside>

          {/* Jobs list */}
          <div className="flex-1">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-600 mb-4 sm:mb-0">
                Showing {jobs.length} job{jobs.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center space-x-2">
                <label htmlFor="sort" className="text-sm text-gray-700">
                  Sort by:
                </label>
                <select id="sort" className="input w-auto">
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="title">Job Title</option>
                  <option value="company">Company</option>
                </select>
              </div>
            </div>
            <JobsList jobs={jobs} />
          </div>
        </div>
      </div>
    </main>
  )
}