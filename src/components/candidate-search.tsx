'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { type CandidateWithApplicationCount } from '@/types'
import { formatDate } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Milliseconds to wait after the user stops typing before firing the request. */
const DEBOUNCE_MS = 300

// ---------------------------------------------------------------------------
// Status display helpers (mirrors candidates-list.tsx)
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  HIRED: 'Hired',
  INACTIVE: 'Inactive',
  BLACKLISTED: 'Blacklisted',
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  HIRED: 'bg-blue-100 text-blue-800',
  INACTIVE: 'bg-gray-100 text-gray-600',
  BLACKLISTED: 'bg-red-100 text-red-800',
}

// ---------------------------------------------------------------------------
// API response shape
// ---------------------------------------------------------------------------

interface SearchResponse {
  data: CandidateWithApplicationCount[]
  pagination: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildSearchUrl(name: string, linkedin: string): string {
  const params = new URLSearchParams()
  if (name.trim()) params.set('name', name.trim())
  if (linkedin.trim()) params.set('linkedin', linkedin.trim())
  params.set('pageSize', '50')
  return `/api/candidates/search?${params.toString()}`
}

/** Returns true when at least one field has a non-empty trimmed value. */
function hasQuery(name: string, linkedin: string): boolean {
  return name.trim().length > 0 || linkedin.trim().length > 0
}

// ---------------------------------------------------------------------------
// Sub-component: search result row (keeps JSX DRY)
// ---------------------------------------------------------------------------

function SearchResultRow({
  candidate,
}: {
  candidate: CandidateWithApplicationCount
}) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {/* Candidate — avatar + name */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span
              className="text-primary-600 font-medium text-sm"
              aria-hidden="true"
            >
              {candidate.firstName.charAt(0).toUpperCase()}
              {candidate.lastName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="ml-4 min-w-0">
            <div className="text-sm font-semibold text-gray-900">
              {candidate.firstName} {candidate.lastName}
            </div>
            {candidate.summary && (
              <div
                className="text-xs text-gray-500 max-w-xs truncate"
                title={candidate.summary}
              >
                {candidate.summary}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Location */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">
          {candidate.location ?? <span className="text-gray-400">—</span>}
        </div>
      </td>

      {/* Status badge */}
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${
            STATUS_COLOR[candidate.status] ?? 'bg-gray-100 text-gray-600'
          }`}
        >
          {STATUS_LABEL[candidate.status] ?? candidate.status}
        </span>
      </td>

      {/* Applications */}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        <span className="font-medium">{candidate._count.applications}</span>
        <span className="text-gray-500 ml-1">
          {candidate._count.applications === 1 ? 'app' : 'apps'}
        </span>
      </td>

      {/* Added date */}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(candidate.createdAt)}
      </td>

      {/* Actions */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-3 text-sm">
          <Link
            href={`/candidates/${candidate.id}`}
            className="font-medium text-primary-600 hover:text-primary-800 transition-colors"
          >
            View
          </Link>
          <span className="text-gray-300" aria-hidden="true">
            |
          </span>
          <Link
            href={`/candidates/${candidate.id}/edit`}
            className="font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Edit
          </Link>
          {candidate.resumeUrl && (
            <>
              <span className="text-gray-300" aria-hidden="true">
                |
              </span>
              <a
                href={candidate.resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-gray-600 hover:text-gray-900 transition-colors"
                title="View résumé"
              >
                CV
              </a>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CandidateSearch() {
  const [nameQuery, setNameQuery] = useState('')
  const [linkedinQuery, setLinkedinQuery] = useState('')

  const [results, setResults] = useState<CandidateWithApplicationCount[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** True once the user has typed at least one character in any field. */
  const [hasSearched, setHasSearched] = useState(false)

  // Used to cancel stale in-flight requests when a newer one is issued.
  const abortControllerRef = useRef<AbortController | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---------------------------------------------------------------------------
  // Core search function — called after debounce delay
  // ---------------------------------------------------------------------------

  const executeSearch = useCallback(
    async (name: string, linkedin: string) => {
      // Cancel any in-flight request.
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      if (!hasQuery(name, linkedin)) {
        setResults([])
        setTotal(0)
        setError(null)
        setIsLoading(false)
        setHasSearched(false)
        return
      }

      const controller = new AbortController()
      abortControllerRef.current = controller

      setIsLoading(true)
      setError(null)
      setHasSearched(true)

      try {
        const url = buildSearchUrl(name, linkedin)
        const res = await fetch(url, { signal: controller.signal })

        if (!res.ok) {
          const body = (await res.json()) as { error?: string }
          throw new Error(body.error ?? 'Search failed')
        }

        const data = (await res.json()) as SearchResponse
        setResults(data.data)
        setTotal(data.pagination.total)
      } catch (err) {
        // Ignore aborted requests — they are superseded by a newer query.
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(
          err instanceof Error ? err.message : 'An unexpected error occurred'
        )
        setResults([])
        setTotal(0)
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  // ---------------------------------------------------------------------------
  // Debounced effect — re-fires whenever either query value changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      void executeSearch(nameQuery, linkedinQuery)
    }, DEBOUNCE_MS)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [nameQuery, linkedinQuery, executeSearch])

  // Abort any in-flight request when the component unmounts.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const isActive = hasQuery(nameQuery, linkedinQuery)
  const showResults = isActive && hasSearched && !isLoading

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mb-8">
      {/* ── Search panel ──────────────────────────────────────────────── */}
      <div className="card mb-4">
        <div className="flex items-center gap-3 mb-4">
          {/* Search icon */}
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg
              className="w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Search Candidates
            </h2>
            <p className="text-xs text-gray-500">
              Results update automatically as you type
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Name field */}
          <div>
            <label
              htmlFor="search-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Name
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg
                  className="h-4 w-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <input
                id="search-name"
                type="search"
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
                placeholder="e.g. Jane Doe"
                maxLength={200}
                autoComplete="off"
                className="input pl-9"
                aria-label="Search by candidate name"
              />
              {nameQuery && (
                <button
                  type="button"
                  onClick={() => setNameQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Clear name search"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* LinkedIn field */}
          <div>
            <label
              htmlFor="search-linkedin"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              LinkedIn Profile
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg
                  className="h-4 w-4 text-gray-400"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </div>
              <input
                id="search-linkedin"
                type="search"
                value={linkedinQuery}
                onChange={(e) => setLinkedinQuery(e.target.value)}
                placeholder="e.g. linkedin.com/in/janedoe"
                maxLength={500}
                autoComplete="off"
                className="input pl-9"
                aria-label="Search by LinkedIn profile URL"
              />
              {linkedinQuery && (
                <button
                  type="button"
                  onClick={() => setLinkedinQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Clear LinkedIn search"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Inline status row: loading spinner or result count */}
        <div className="mt-3 min-h-[1.25rem]" aria-live="polite" aria-atomic="true">
          {isLoading && isActive && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <svg
                className="animate-spin h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Searching…
            </div>
          )}
          {showResults && !error && (
            <p className="text-sm text-gray-500">
              Found{' '}
              <span className="font-semibold text-gray-900">{total}</span>{' '}
              candidate{total !== 1 ? 's' : ''}
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>

      {/* ── Search results table ──────────────────────────────────────── */}
      {showResults && !error && (
        results.length === 0 ? (
          <div className="card text-center py-12">
            <div className="w-14 h-14 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg
                className="w-7 h-7 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <h3 className="text-base font-medium text-gray-900 mb-1">
              No candidates found
            </h3>
            <p className="text-sm text-gray-500">
              Try adjusting your search terms or{' '}
              <Link
                href="/candidates/new"
                className="text-primary-600 hover:text-primary-800 font-medium"
              >
                add a new candidate
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table
                className="min-w-full divide-y divide-gray-200"
                aria-label="Candidate search results"
              >
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Candidate
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Location
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Applications
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Added
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.map((candidate) => (
                    <SearchResultRow key={candidate.id} candidate={candidate} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer: hint when results are capped */}
            {total > results.length && (
              <div className="px-6 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500 text-center">
                  Showing {results.length} of {total} matches — refine your
                  search to narrow results.
                </p>
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}
