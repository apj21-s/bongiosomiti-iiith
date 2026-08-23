'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewEventPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)

    let slug = String(formData.get('slug') || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
    if (!slug) slug = String(formData.get('name') || '').toLowerCase().replace(/[^a-z0-9-]/g, '-')

    const data = {
      slug,
      name: String(formData.get('name') || '').trim(),
      description: String(formData.get('description') || '').trim(),
      event_date: formData.get('event_date'),
      venue: String(formData.get('venue') || '').trim(),
      capacity: parseInt(String(formData.get('capacity') || '100')),
      price: parseInt(String(formData.get('price') || '0')),
      category: String(formData.get('category') || 'Cultural'),
      image_url: 'assets/community-puja.svg',
      status: 'OPEN',
    }

    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to create event')
      }
      router.push('/admin/events')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <main className="panel container" style={{ maxWidth: '860px', margin: '2rem auto', padding: '0' }}>
      <div className="panel-head" style={{ padding: '24px 28px' }}>
        <div>
          <p className="section-label">Organiser Event Creator</p>
          <h1 style={{ fontSize: '2rem', margin: '4px 0 6px' }}>Create New Cultural Event</h1>
          <p>Publish a new event to the BONGIO.SOMITI public catalog with custom pricing, venue, and pass capacity.</p>
        </div>
        <Link className="btn btn-secondary" href="/admin/events">&larr; Back to Events</Link>
      </div>

      <div className="grid" style={{ padding: '24px 28px' }}>
        <form className="section" style={{ padding: 0 }} onSubmit={handleSubmit}>
          <div className="field-grid">
            <div className="field"><label htmlFor="event_name">Event Name *</label><input id="event_name" name="name" placeholder="e.g. Bijoya Sammelani 2026" required /></div>
            <div className="field"><label htmlFor="event_slug">URL Slug *</label><input id="event_slug" name="slug" placeholder="e.g. bijoya-sammelani" required /></div>
            <div className="field"><label htmlFor="event_category">Category / Tag</label><input id="event_category" name="category" placeholder="e.g. Autumn Gathering / Music Evening" /></div>
            <div className="field"><label htmlFor="event_date">Event Date *</label><input id="event_date" name="event_date" type="date" required /></div>
            <div className="field"><label htmlFor="event_venue">Venue *</label><input id="event_venue" name="venue" placeholder="e.g. Main Auditorium / Courtyard" required /></div>
            <div className="field"><label htmlFor="event_capacity">Max Ticket Capacity *</label><input id="event_capacity" name="capacity" type="number" min="1" max="5000" placeholder="150" required defaultValue="100" /></div>
            <div className="field"><label htmlFor="event_price">Pass Price (INR) *</label><input id="event_price" name="price" type="number" min="0" placeholder="0 for free, or enter amount in ₹" required defaultValue="0" /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="event_description">Description / Narrative</label>
              <textarea id="event_description" name="description" rows={3} placeholder="Describe the cultural event, food, traditions, and schedule..." style={{ width: '100%', padding: '12px', borderRadius: '14px', border: '1px solid var(--border)' }}></textarea>
            </div>
          </div>
          <div className="row-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '12px' }}>
            <button className="btn btn-primary" type="submit" style={{ flex: 1 }} disabled={loading}>{loading ? 'Publishing...' : 'Publish Event to Catalog'}</button>
            <Link className="btn btn-secondary" href="/admin/events">Cancel</Link>
          </div>
          {error && (
            <div className="form-status form-status--error" aria-live="polite" style={{ marginTop: '1rem', display: 'block' }}>
              <span className="utsav-toast__icon">✕</span>
              <span>{error}</span>
            </div>
          )}
        </form>
      </div>
    </main>
  )
}
