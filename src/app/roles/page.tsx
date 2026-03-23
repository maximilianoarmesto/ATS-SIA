import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/navbar'
import { RolesList } from '@/components/roles-list'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Page metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Roles | ATS - SIA',
  description: 'View and manage all open roles and job postings.',
}

// ---------------------------------------------------------------------------
// Status display config for the summary badges
// ---------------------------------------------------------------------------

const STATUS_SUMMARY = [
  { status: 'PUBLISHED', label: 'Published', color: 'bg-green-100 text-green-800' },
  { status: 'DRAFT', label: 'Draft', color: 'bg-gray-100 text-gray-600' },
  { status: 'PAUSED', label: 'Paused', color: 'bg-yellow-100 text-yellow-800' },
  { status: 'CLOSED', label: 'Closed', color: 'bg-red-100 text-red-800' },
  { status: 'ARCHIVED', label: 'Archived', color: 'bg-gray-100 text-gray-400' },
] as const

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

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
      orderBy: [{ createdAt: 'desc' }],
    })
    return roles
  } catch (error) {
    console.error('Failed to fetch roles:', error)
    return []
  }
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function RolesPage() {
  const roles = await getAllRoles()
  const totalCount = roles.length

  return (
    <main>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Roles</h1>
            <p className="text-gray-600">
              Manage and review all open positions in the recruitment pipeline
            </p>
          </div>
          <Link
            href="/roles/new"
            className="btn btn-primary btn-md self-start sm:self-auto"
          >
            + Add Role
          </Link>
        </div>

        {/* ── Summary bar ─────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-gray-600">
            Showing{' '}
            <span className="font-semibold text-gray-900">{totalCount}</span>{' '}
            role{totalCount !== 1 ? 's' : ''}
          </p>

          {totalCount > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_SUMMARY.map(({ status, label, color }) => {
                const count = roles.filter((r) => r.status === status).length
                if (count === 0) return null
                return (
                  <span
                    key={status}
                    className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${color}`}
                  >
                    {count} {label}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Roles table ─────────────────────────────────────────────── */}
        <RolesList roles={roles} />

      </div>
    </main>
  )
}
