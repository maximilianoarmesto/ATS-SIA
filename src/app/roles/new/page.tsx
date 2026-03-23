'use client'

import { Navbar } from '@/components/navbar'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function NewRolePage() {
  const router = useRouter()
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors([])
    setSubmitting(true)

    const form = e.currentTarget
    const formData = new FormData(form)

    const body: Record<string, unknown> = {
      title: formData.get('title'),
      company: formData.get('company'),
    }

    const optional = [
      'description', 'department', 'location', 'locationType',
      'employmentType', 'salaryCurrency', 'requirements', 'benefits', 'status',
    ]
    for (const key of optional) {
      const val = formData.get(key)
      if (val && typeof val === 'string' && val.trim()) {
        body[key] = val.trim()
      }
    }

    const salaryMin = formData.get('salaryMin')
    if (salaryMin && String(salaryMin).trim()) {
      body.salaryMin = Number(salaryMin)
    }
    const salaryMax = formData.get('salaryMax')
    if (salaryMax && String(salaryMax).trim()) {
      body.salaryMax = Number(salaryMax)
    }

    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        setErrors(data.details ?? [data.error ?? 'Failed to create role'])
        setSubmitting(false)
        return
      }

      const { data: role } = await res.json()
      router.push(`/roles/${role.id}`)
    } catch {
      setErrors(['Network error. Please try again.'])
      setSubmitting(false)
    }
  }

  return (
    <main>
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/roles"
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            &larr; Back to Roles
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create New Role</h1>
          <p className="mt-2 text-gray-600">
            Fill in the details below to post a new role.
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
          {/* Title & Company */}
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  maxLength={200}
                  className="input"
                  placeholder="e.g. Senior Software Engineer"
                />
              </div>
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                  Company <span className="text-red-500">*</span>
                </label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  required
                  maxLength={200}
                  className="input"
                  placeholder="e.g. Tech Corp"
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
                  className="input"
                  placeholder="e.g. Engineering"
                />
              </div>
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select id="status" name="status" className="input">
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="PAUSED">Paused</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Location */}
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
                  className="input"
                  placeholder="e.g. San Francisco, CA"
                />
              </div>
              <div>
                <label htmlFor="locationType" className="block text-sm font-medium text-gray-700 mb-1">
                  Location Type
                </label>
                <select id="locationType" name="locationType" className="input">
                  <option value="ON_SITE">On-Site</option>
                  <option value="REMOTE">Remote</option>
                  <option value="HYBRID">Hybrid</option>
                </select>
              </div>
              <div>
                <label htmlFor="employmentType" className="block text-sm font-medium text-gray-700 mb-1">
                  Employment Type
                </label>
                <select id="employmentType" name="employmentType" className="input">
                  <option value="FULL_TIME">Full-Time</option>
                  <option value="PART_TIME">Part-Time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERNSHIP">Internship</option>
                  <option value="TEMPORARY">Temporary</option>
                </select>
              </div>
            </div>
          </div>

          {/* Salary */}
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
                  className="input"
                  placeholder="e.g. 80000"
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
                  className="input"
                  placeholder="e.g. 120000"
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
                  defaultValue="USD"
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Description */}
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
                className="input min-h-[100px]"
                placeholder="Describe the role..."
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
                className="input min-h-[80px]"
                placeholder="List the requirements..."
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
                className="input min-h-[80px]"
                placeholder="List the benefits..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Link href="/roles" className="btn btn-secondary btn-md">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-md"
            >
              {submitting ? 'Creating...' : 'Create Role'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
