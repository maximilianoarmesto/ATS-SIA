'use client'

import { Navbar } from '@/components/navbar'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface SelectOption {
  id: string
  label: string
}

export default function NewApplicationPage() {
  const router = useRouter()
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [candidates, setCandidates] = useState<SelectOption[]>([])
  const [roles, setRoles] = useState<SelectOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/candidates?pageSize=100').then((r) => r.json()),
      fetch('/api/roles?pageSize=100').then((r) => r.json()),
    ])
      .then(([candRes, roleRes]) => {
        setCandidates(
          (candRes.data ?? []).map((c: { id: string; firstName: string; lastName: string; email: string }) => ({
            id: c.id,
            label: `${c.firstName} ${c.lastName} (${c.email})`,
          }))
        )
        setRoles(
          (roleRes.data ?? []).map((r: { id: string; title: string; company: string }) => ({
            id: r.id,
            label: `${r.title} — ${r.company}`,
          }))
        )
      })
      .catch(() => setErrors(['Failed to load candidates and roles']))
      .finally(() => setLoading(false))
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors([])
    setSubmitting(true)

    const form = e.currentTarget
    const formData = new FormData(form)

    const body: Record<string, unknown> = {
      candidateId: formData.get('candidateId'),
      roleId: formData.get('roleId'),
    }

    const optional = ['status', 'source', 'coverLetter', 'notes']
    for (const key of optional) {
      const val = formData.get(key)
      if (val && typeof val === 'string' && val.trim()) {
        body[key] = val.trim()
      }
    }

    const rating = formData.get('rating')
    if (rating && String(rating).trim()) {
      body.rating = Number(rating)
    }

    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        setErrors(data.details ?? [data.error ?? 'Failed to create application'])
        setSubmitting(false)
        return
      }

      router.push('/applications')
    } catch {
      setErrors(['Network error. Please try again.'])
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main>
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-500">Loading...</div>
      </main>
    )
  }

  return (
    <main>
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/applications" className="text-sm text-primary-600 hover:text-primary-700">
            &larr; Back to Applications
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create New Application</h1>
          <p className="mt-2 text-gray-600">Link a candidate to a role.</p>
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
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Candidate & Role</h2>
            <div>
              <label htmlFor="candidateId" className="block text-sm font-medium text-gray-700 mb-1">
                Candidate <span className="text-red-600">*</span>
              </label>
              <select id="candidateId" name="candidateId" required className="input">
                <option value="">Select a candidate...</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="roleId" className="block text-sm font-medium text-gray-700 mb-1">
                Role <span className="text-red-600">*</span>
              </label>
              <select id="roleId" name="roleId" required className="input">
                <option value="">Select a role...</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Application Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select id="status" name="status" className="input">
                  <option value="APPLIED">Applied</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="SHORTLISTED">Shortlisted</option>
                  <option value="INTERVIEWING">Interviewing</option>
                  <option value="OFFER_SENT">Offer Sent</option>
                  <option value="HIRED">Hired</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="WITHDRAWN">Withdrawn</option>
                </select>
              </div>
              <div>
                <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                <input id="source" name="source" type="text" className="input" placeholder="e.g. LinkedIn" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="rating" className="block text-sm font-medium text-gray-700 mb-1">Rating (1-5)</label>
                <input id="rating" name="rating" type="number" min={1} max={5} className="input" />
              </div>
            </div>
            <div>
              <label htmlFor="coverLetter" className="block text-sm font-medium text-gray-700 mb-1">Cover Letter</label>
              <textarea id="coverLetter" name="coverLetter" rows={3} maxLength={10000} className="input min-h-[80px]" placeholder="Optional cover letter..." />
            </div>
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
              <textarea id="notes" name="notes" rows={2} maxLength={10000} className="input min-h-[60px]" placeholder="Internal recruiter notes..." />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Link href="/applications" className="btn btn-secondary btn-md">Cancel</Link>
            <button type="submit" disabled={submitting} className="btn btn-primary btn-md">
              {submitting ? 'Creating...' : 'Create Application'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
