'use client'

import { Navbar } from '@/components/navbar'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface RoleData {
  id: string
  title: string
  company: string
  description: string | null
  department: string | null
  location: string | null
  locationType: string
  employmentType: string
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  requirements: string | null
  benefits: string | null
  status: string
}

export default function EditRolePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [role, setRole] = useState<RoleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/roles/${params.id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found')
        return res.json()
      })
      .then(({ data }) => setRole(data))
      .catch(() => setErrors(['Role not found']))
      .finally(() => setLoading(false))
  }, [params.id])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors([])
    setSubmitting(true)

    const form = e.currentTarget
    const formData = new FormData(form)

    const body: Record<string, unknown> = {
      title: formData.get('title'),
      company: formData.get('company'),
      status: formData.get('status'),
      locationType: formData.get('locationType'),
      employmentType: formData.get('employmentType'),
    }

    // String fields — send value or null to clear
    const stringFields = [
      'description', 'department', 'location', 'salaryCurrency', 'requirements', 'benefits',
    ]
    for (const key of stringFields) {
      const val = formData.get(key)
      body[key] = val && typeof val === 'string' && val.trim() ? val.trim() : null
    }

    // Number fields — send value or null to clear
    const salaryMin = formData.get('salaryMin')
    body.salaryMin = salaryMin && String(salaryMin).trim() ? Number(salaryMin) : null
    const salaryMax = formData.get('salaryMax')
    body.salaryMax = salaryMax && String(salaryMax).trim() ? Number(salaryMax) : null

    try {
      const res = await fetch(`/api/roles/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        setErrors(data.details ?? [data.error ?? 'Failed to update role'])
        setSubmitting(false)
        return
      }

      router.push(`/roles/${params.id}`)
    } catch {
      setErrors(['Network error. Please try again.'])
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main>
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-500">
          Loading...
        </div>
      </main>
    )
  }

  if (!role) {
    return (
      <main>
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Role not found</h1>
          <Link href="/roles" className="text-primary-600 hover:text-primary-700">
            Back to Roles
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main>
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href={`/roles/${role.id}`}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            &larr; Back to Role
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Edit Role</h1>
          <p className="mt-2 text-gray-600">
            Update the details for {role.title} at {role.company}.
          </p>
        </div>

        {errors.length > 0 && (
          <div className="mb-6 rounded-md bg-red-50 border border-red-200 p-4">
            <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-600">*</span>
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  maxLength={200}
                  defaultValue={role.title}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                  Company <span className="text-red-600">*</span>
                </label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  required
                  maxLength={200}
                  defaultValue={role.company}
                  className="input"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <input
                  id="department"
                  name="department"
                  type="text"
                  maxLength={200}
                  defaultValue={role.department ?? ''}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select id="status" name="status" defaultValue={role.status} className="input">
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="PAUSED">Paused</option>
                  <option value="CLOSED">Closed</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
            </div>
          </div>

          {/* Location & Employment */}
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Location & Employment</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  maxLength={300}
                  defaultValue={role.location ?? ''}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="locationType" className="block text-sm font-medium text-gray-700 mb-1">
                  Location Type
                </label>
                <select id="locationType" name="locationType" defaultValue={role.locationType} className="input">
                  <option value="ON_SITE">On-Site</option>
                  <option value="REMOTE">Remote</option>
                  <option value="HYBRID">Hybrid</option>
                </select>
              </div>
              <div>
                <label htmlFor="employmentType" className="block text-sm font-medium text-gray-700 mb-1">
                  Employment Type
                </label>
                <select id="employmentType" name="employmentType" defaultValue={role.employmentType} className="input">
                  <option value="FULL_TIME">Full-Time</option>
                  <option value="PART_TIME">Part-Time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERNSHIP">Internship</option>
                  <option value="TEMPORARY">Temporary</option>
                </select>
              </div>
            </div>
          </div>

          {/* Compensation */}
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Compensation</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="salaryMin" className="block text-sm font-medium text-gray-700 mb-1">
                  Salary Min
                </label>
                <input
                  id="salaryMin"
                  name="salaryMin"
                  type="number"
                  min={0}
                  defaultValue={role.salaryMin ?? ''}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="salaryMax" className="block text-sm font-medium text-gray-700 mb-1">
                  Salary Max
                </label>
                <input
                  id="salaryMax"
                  name="salaryMax"
                  type="number"
                  min={0}
                  defaultValue={role.salaryMax ?? ''}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="salaryCurrency" className="block text-sm font-medium text-gray-700 mb-1">
                  Currency
                </label>
                <input
                  id="salaryCurrency"
                  name="salaryCurrency"
                  type="text"
                  maxLength={10}
                  defaultValue={role.salaryCurrency ?? 'USD'}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Details</h2>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                maxLength={10000}
                defaultValue={role.description ?? ''}
                className="input min-h-[100px]"
              />
            </div>
            <div>
              <label htmlFor="requirements" className="block text-sm font-medium text-gray-700 mb-1">
                Requirements
              </label>
              <textarea
                id="requirements"
                name="requirements"
                rows={3}
                maxLength={10000}
                defaultValue={role.requirements ?? ''}
                className="input min-h-[80px]"
              />
            </div>
            <div>
              <label htmlFor="benefits" className="block text-sm font-medium text-gray-700 mb-1">
                Benefits
              </label>
              <textarea
                id="benefits"
                name="benefits"
                rows={3}
                maxLength={10000}
                defaultValue={role.benefits ?? ''}
                className="input min-h-[80px]"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Link href={`/roles/${role.id}`} className="btn btn-secondary btn-md">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-md"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
