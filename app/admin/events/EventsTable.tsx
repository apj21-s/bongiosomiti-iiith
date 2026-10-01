'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { confirmAction, notifyError } from '@/components/site-notifications'

import { useState } from 'react'

export default function EventsTable({ events }: { events: any[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete(slug: string) {
    if (!(await confirmAction({
      title: 'Delete this event?',
      message: `"${slug}" and its settings will be removed. This cannot be undone.`,
      confirmLabel: 'Delete event',
      tone: 'danger',
    }))) return
    setLoading(true)
    try {
      await fetch(`/api/admin/events/${slug}`, { method: 'DELETE' })
      window.location.reload()
    } catch (e: any) {
      setLoading(false)
      notifyError(e)
    }
  }

  async function handleToggleStatus(slug: string, status?: 'OPEN' | 'LOCKED' | 'CLOSED') {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/events/${slug}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // No status means "flip between open and locked", which is what the
        // Lock/Unlock button has always done.
        body: JSON.stringify(status ? { status } : {}),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to change status')
      window.location.reload()
    } catch (e: any) {
      setLoading(false)
      notifyError(e)
    }
  }

  if (loading) return <p className="text-muted">Loading...</p>

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Event Name &amp; Category</th>
          <th>Scheduled Date</th>
          <th>Venue</th>
          <th>Pass Price</th>
          <th>Registration Capacity</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {!events?.length && (
          <tr><td colSpan={7} className="text-muted">No events found in catalog.</td></tr>
        )}
        {events?.map((evt) => (
          <tr key={evt.id}>
            <td>
              <strong>{evt.name}</strong><br />
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>{evt.category}</span>
            </td>
            <td>{new Date(evt.event_date).toLocaleDateString()}</td>
            <td>{evt.venue}</td>
            <td>{evt.price === 0 ? 'Free' : `₹${evt.price}`}</td>
            <td>{evt.capacity}</td>
            <td><span className={`badge ${evt.status === 'OPEN' ? '' : 'badge--error'}`}>{evt.status}</span></td>
            <td>
              <div className="action-btn-group">
                <button type="button" className={`btn btn-sm ${evt.status === 'OPEN' ? 'btn-danger' : 'btn-secondary'}`} onClick={() => handleToggleStatus(evt.slug)}>
                  {evt.status === 'OPEN' ? 'Lock' : 'Unlock'}
                </button>
                {/* Closing is a separate decision from pausing, so it is a
                    separate button and it asks first - reopening a closed
                    event is easy, but telling people it has ended and then
                    taking that back is not. */}
                {evt.status !== 'CLOSED' ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    title="Registrations have ended for good"
                    onClick={async () => {
                      if (await confirmAction({
                        title: 'Close this event?',
                        message: `"${evt.name}" will stop taking registrations and show as finished. You can reopen it later.`,
                        confirmLabel: 'Close event',
                      })) {
                        handleToggleStatus(evt.slug, 'CLOSED')
                      }
                    }}
                  >Close</button>
                ) : (
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => handleToggleStatus(evt.slug, 'OPEN')}>
                    Reopen
                  </button>
                )}
                <Link href={`/admin/events/${evt.slug}/edit`} className="btn btn-sm btn-primary">Edit</Link>
                <Link href={`/events/${evt.slug}`} target="_blank" className="btn btn-sm btn-secondary">View Page</Link>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDelete(evt.slug)}>Delete</button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
