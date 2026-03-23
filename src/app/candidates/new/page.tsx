'use client'

import { Navbar } from '@/components/navbar'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

export default function NewCandidatePage() {
  const router = useRouter()
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type !== 'application/pdf') {
        setErrors(['Resume must be a PDF file'])
        e.target.value = ''
        setFileName(null)
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrors(['Resume file size must not exceed 5 MB'])
        e.target.value = ''
        setFileName(null)
        return
      }
      setErrors([])
      setFileName(file.name)
    } else {
      setFileName(null)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors([])
    setSubmitting(true)

    const form = e.currentTarget
    const formData = new FormData(form)

    // Check if there's a resume file — if so, send as multipart/form-data
    const resumeFile = formData.get('resume')
    const hasResume = resumeFile instanceof File && resumeFile.size > 0

    try {
      let res: Response

      if (hasResume) {
        // Send as multipart/form-data (browser sets Content-Type with boundary)
        // Remove empty string fields to avoid validation issues
        const cleanedFormData = new FormData()
        for (const [key, value] of formData.entries()) {
          if (key === 'resume') {
            if (value instanceof File && value.size > 0) {
              cleanedFormData.append(key, value)
            }
          } else if (typeof value === 'string' && value.trim()) {
            cleanedFormData.append(key, value.trim())
          }
        }
        res = await fetch('/api/candidates', {
          method: 'POST',
          body: cleanedFormData,
        })
      } else {
        // Send as JSON (no file)
        const body: Record<string, string> = {}
        const fields = [
          'email', 'firstName', 'lastName', 'phone',
          'linkedinUrl', 'portfolioUrl', 'location', 'summary',
        ]
        for (const key of fields) {
          const val = formData.get(key)
          if (val && typeof val === 'string' && val.trim()) {
            body[key] = val.trim()
          }
        }
        res = await fetch('/api/candidates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      if (!res.ok) {
        const data = await res.json()
        setErrors(data.details ?? [data.error ?? 'Failed to create candidate'])
        setSubmitting(false)
        return
      }

      const { data: candidate } = await res.json()
      router.push(`/candidates/${candidate.id}`)
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
            href="/candidates"
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            &larr; Back to Candidates
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Add New Candidate</h1>
          <p className="mt-2 text-gray-600">
            Enter the candidate&apos;s information below.
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
          {/* Name & Email */}
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  maxLength={100}
                  className="input"
                  placeholder="e.g. Alice"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  maxLength={100}
                  className="input"
                  placeholder="e.g. Johnson"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="input"
                  placeholder="e.g. alice@example.com"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  className="input"
                  placeholder="e.g. +1-555-0101"
                />
              </div>
            </div>
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                id="location"
                name="location"
                type="text"
                maxLength={200}
                className="input"
                placeholder="e.g. San Francisco, CA"
              />
            </div>
          </div>

          {/* Resume Upload */}
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Resume / CV</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload PDF (max 5 MB)
              </label>
              <div
                className="flex items-center justify-center w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg
                      className="w-8 h-8 mb-2 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    {fileName ? (
                      <p className="text-sm text-primary-600 font-medium">{fileName}</p>
                    ) : (
                      <>
                        <p className="mb-1 text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span> a PDF file
                        </p>
                        <p className="text-xs text-gray-400">PDF only, up to 5 MB</p>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    id="resume"
                    name="resume"
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Online Profiles</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="linkedinUrl" className="block text-sm font-medium text-gray-700 mb-1">
                  LinkedIn URL
                </label>
                <input
                  id="linkedinUrl"
                  name="linkedinUrl"
                  type="url"
                  className="input"
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
              <div>
                <label htmlFor="portfolioUrl" className="block text-sm font-medium text-gray-700 mb-1">
                  Portfolio URL
                </label>
                <input
                  id="portfolioUrl"
                  name="portfolioUrl"
                  type="url"
                  className="input"
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Professional Summary</h2>
            <div>
              <label htmlFor="summary" className="block text-sm font-medium text-gray-700 mb-1">
                Summary
              </label>
              <textarea
                id="summary"
                name="summary"
                rows={4}
                maxLength={2000}
                className="input min-h-[100px]"
                placeholder="Brief professional summary..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Link href="/candidates" className="btn btn-secondary btn-md">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-md"
            >
              {submitting ? 'Creating...' : 'Add Candidate'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
