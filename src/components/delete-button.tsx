'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface DeleteButtonProps {
  apiPath: string
  redirectPath: string
  label?: string
  confirmMessage?: string
}

export function DeleteButton({
  apiPath,
  redirectPath,
  label = 'Delete',
  confirmMessage = 'Are you sure? This action cannot be undone.',
}: DeleteButtonProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(confirmMessage)) return

    setDeleting(true)
    try {
      const res = await fetch(apiPath, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Failed to delete')
        setDeleting(false)
        return
      }
      router.push(redirectPath)
      router.refresh()
    } catch {
      alert('Network error. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="btn btn-md bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
    >
      {deleting ? 'Deleting...' : label}
    </button>
  )
}
