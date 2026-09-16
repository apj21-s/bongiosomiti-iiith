'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function CheckinsClient() {
  const [checkins, setCheckins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchCheckins() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/checkins')
      const data = await res.json()
      if (res.ok) setCheckins(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCheckins()
  }, [])

  async function handleUndo(id: string) {
    if (!confirm('Undo this checkin? The pass will become valid for entry again.')) return
    try {
      await fetch(`/api/admin/checkins/${id}/undo`, { method: 'POST' })
      fetchCheckins()
    } catch (e: any) {
      alert(e.message)
    }
  }

  return (
    <div className="grid" style={{ padding: 'clamp(16px, 4vw, 24px) 0' }}>
      <div className="table-wrapper-outer" style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '20px', border: '1px solid var(--border)', padding: 'clamp(12px, 2vw, 16px)', minWidth: 0, width: '100%' }}>
        <div className="table-responsive">
          <table className="data-table">
          <thead>
            <tr>
              <th>Check-in Timestamp</th>
              <th>Attendee Name</th>
              <th>Event</th>
              <th>Pass Token</th>
              <th>Entry Gate</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="text-muted">Loading check-ins...</td></tr>}
            {!loading && checkins.length === 0 && <tr><td colSpan={6} className="text-muted">No check-in history found.</td></tr>}
            {!loading && checkins.map((c) => (
              <tr key={c.id}>
                <td>{new Date(c.timestamp).toLocaleString()}</td>
                <td><strong>{c.participantName}</strong></td>
                <td>{c.eventName}</td>
                <td><Link href={`/pass/${c.token}`} target="_blank"><code>{c.token}</code></Link></td>
                <td><span className="pill">{c.gate || 'Gate 1'}</span></td>
                <td><button type="button" className="btn btn-sm btn-secondary" onClick={() => handleUndo(c.id)}>Undo Entry</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
