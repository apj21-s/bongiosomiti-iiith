'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function EventsTable({ events }: { events: any[] }) {
  const router = useRouter()

  async function handleDelete(slug: string) {
    if (!confirm(`Are you sure you want to delete ${slug}?`)) return
    try {
      await fetch(`/api/admin/events/${slug}`, { method: 'DELETE' })
      router.refresh()
    } catch (e: any) {
      alert(e.message)
    }
  }

  async function handleToggleStatus(slug: string) {
    try {
      const res = await fetch(`/api/admin/events/${slug}/toggle`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to toggle status')
      router.refresh()
    } catch (e: any) {
      alert(e.message)
    }
  }

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
