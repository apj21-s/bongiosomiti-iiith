'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LookupForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleLookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const query = formData.get('query') as string
    
    fetch('/api/pass/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    }).then(res => res.json()).then(data => {
      if (data.token) {
        router.push(`/pass/${data.token}`)
      } else {
        setError(data.error || 'Pass not found')
      }
    }).catch(err => {
      setError(err.message)
    }).finally(() => {
      setLoading(false)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      <form className="pass-lookup-form" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }} onSubmit={handleLookup}>
        <label htmlFor="pass-lookup-input" style={{ fontWeight: 600, fontSize: '0.9rem' }}>Lookup Another Pass:</label>
        <input id="pass-lookup-input" name="query" placeholder="Enter Token ID or College ID..." style={{ flex: 1, minWidth: '220px', padding: '8px 14px', borderRadius: '12px', border: '1px solid var(--border)', background: '#fff' }} required />
        <button className="btn btn-secondary" type="submit" disabled={loading}>{loading ? 'Searching...' : 'Find Pass'}</button>
      </form>
      {error && (
        <div className="form-status form-status--error" aria-live="polite" style={{ fontSize: '0.85rem', padding: '8px 12px' }}>
          <span className="utsav-toast__icon">✕</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
