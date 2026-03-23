import { Navbar } from '@/components/navbar'
import { Hero } from '@/components/hero'
import { JobsList } from '@/components/jobs-list'
import { prisma } from '@/lib/prisma'

async function getJobs() {
  try {
    const jobs = await prisma.job.findMany({
      where: {
        status: 'ACTIVE'
      },
      include: {
        _count: {
          select: {
            applications: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 6
    })
    return jobs
  } catch (error) {
    console.error('Failed to fetch jobs:', error)
    return []
  }
}

export default async function Home() {
  const jobs = await getJobs()

  return (
    <main>
      <Navbar />
      <Hero />
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Featured Job Opportunities
            </h2>
            <p className="text-lg text-gray-600">
              Discover your next career opportunity
            </p>
          </div>
          <JobsList jobs={jobs} />
        </div>
      </section>
    </main>
  )
}