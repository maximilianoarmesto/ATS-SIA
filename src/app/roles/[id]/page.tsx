import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { RoleDetail } from '@/components/role-detail'
import { DeleteButton } from '@/components/delete-button'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageProps {
  params: { id: string }
}

// ---------------------------------------------------------------------------
// Dynamic metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const role = await prisma.role.findUnique({
      where: { id: params.id },
      select: { title: true, company: true },
    })

    if (!role) {
      return { title: 'Role Not Found | ATS - SIA' }
    }

    return {
      title: `${role.title} | ATS - SIA`,
      description: `View details and applications for the ${role.title} role at ${role.company}.`,
    }
  } catch {
    return { title: 'Role | ATS - SIA' }
  }
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getRole(id: string) {
  try {
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        applications: {
          include: {
            candidate: true,
          },
          orderBy: { appliedAt: 'desc' },
        },
        _count: {
          select: { applications: true },
        },
      },
    })
    return role
  } catch (error) {
    console.error(`Failed to fetch role ${id}:`, error)
    return null
  }
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function RoleDetailPage({ params }: PageProps) {
  const role = await getRole(params.id)

  if (!role) {
    notFound()
  }

  return (
    <main>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Breadcrumb ──────────────────────────────────────────────── */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500" aria-label="Breadcrumb">
          <Link
            href="/roles"
            className="hover:text-primary-600 transition-colors"
          >
            Roles
          </Link>
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-900 font-medium truncate">
            {role.title}
          </span>
        </nav>

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{role.title}</h1>
            <p className="text-gray-600 mt-1">{role.company}</p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <Link
              href="/roles"
              className="btn btn-secondary btn-md"
            >
              &larr; Back
            </Link>
            <Link
              href={`/roles/${role.id}/edit`}
              className="btn btn-primary btn-md"
            >
              Edit Role
            </Link>
            <DeleteButton
              apiPath={`/api/roles/${role.id}`}
              redirectPath="/roles"
              label="Delete Role"
              confirmMessage={`Delete "${role.title}"? This will also delete all associated applications.`}
            />
          </div>
        </div>

        {/* ── Detail content ──────────────────────────────────────────── */}
        <RoleDetail role={role} />

      </div>
    </main>
  )
}
