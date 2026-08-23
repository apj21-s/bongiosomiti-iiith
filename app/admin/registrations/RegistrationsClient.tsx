'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function RegistrationsClient({ initialEvents }: { initialEvents: any[] }) {
  const [registrations, setRegistrations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [eventSlug, setEventSlug] = useState('all')
  const [status, setStatus] = useState('all')

  async function fetchRegs() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (eventSlug !== 'all') params.set('event', eventSlug)
      if (status !== 'all') params.set('status', status)
      const res = await fetch(`/api/admin/registrations?${params.toString()}`)
      const data = await res.json()
      if (res.ok) setRegistrations(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => fetchRegs(), 300)
    return () => clearTimeout(timeout)
  }, [query, eventSlug, status])

  async function handleDelete(token: string) {
    if (!confirm(`Are you sure you want to delete registration ${token}?`)) return
    try {
      await fetch(`/api/admin/registrations/${token}`, { method: 'DELETE' })
      fetchRegs()
    } catch (e: any) {
      alert(e.message)
    }
  }

  function handleExportCSV() {
    if (registrations.length === 0) {
      alert('No registrations to export.')
      return
    }
    const headers = ['Token', 'Name', 'College ID', 'Email', 'Phone', 'Event', 'Amount', 'Status', 'Payment Status', 'Date']
    const rows = registrations.map((reg) => [
      reg.token,
      `"${reg.participant_name || ''}"`,
      `"${reg.college_id || ''}"`,
      `"${reg.email || ''}"`,
      `"${reg.phone || ''}"`,
      `"${reg.event?.name || ''}"`,
      reg.amount,
      reg.status,
      reg.payment_status,
      new Date(reg.created_at).toLocaleString(),
    ])
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `registrations_export_${new Date().getTime()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="grid" style={{ padding: '24px 28px' }}>
      <div className="filter-bar" style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(255,255,255,0.6)', padding: '14px 18px', borderRadius: '16px', border: '1px solid var(--border)' }}>
        <div style={{ flex: 2, minWidth: '240px' }}>
          <input placeholder="🔍 Search by name, College ID, phone, email, or token..." style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border)', background: '#fff' }} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <select style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border)', background: '#fff' }} value={eventSlug} onChange={(e) => setEventSlug(e.target.value)}>
            <option value="all">All Events</option>
            {initialEvents.map((evt) => <option key={evt.slug} value={evt.slug}>{evt.name}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '140px' }}>
          <select style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border)', background: '#fff' }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="UNUSED">UNUSED</option>
            <option value="USED">USED (Checked In)</option>
            <option value="PENDING_PAYMENT">PENDING_PAYMENT</option>
            <option value="PAYMENT_REJECTED">PAYMENT_REJECTED</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '140px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" type="button" onClick={handleExportCSV}>📥 Export CSV</button>
        </div>
      </div>

      <div className="table-responsive" style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.7)', borderRadius: '20px', border: '1px solid var(--border)', padding: '14px', marginTop: '0.5rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Attendee &amp; College ID</th>
              <th>Contact Info</th>
              <th>Event</th>
              <th>Pass Token</th>
              <th>Amount &amp; UTR</th>
              <th>Status</th>
              <th>Registration Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="text-muted">Loading registrations...</td></tr>}
            {!loading && registrations.length === 0 && <tr><td colSpan={8} className="text-muted">No registrations found.</td></tr>}
            {!loading && registrations.map((reg) => (
              <tr key={reg.id}>
                <td>
                  <strong>{reg.participant_name}</strong><br />
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>{reg.college_id}</span>
                </td>
                <td>
                  <span style={{ fontSize: '0.85rem' }}>{reg.email || 'No email'}</span><br />
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>{reg.phone || 'No phone'}</span>
                </td>
                <td>{reg.event?.name}</td>
                <td><Link href={`/pass/${reg.token}`} target="_blank"><code>{reg.token}</code></Link></td>
                <td>₹{reg.amount}<br /><span className="text-muted" style={{ fontSize: '0.85rem' }}>{reg.utr || 'Free'}</span></td>
                <td>
                  <span className={`badge ${reg.status === 'UNUSED' ? '' : 'badge--error'}`}>{reg.status}</span>
                  {reg.payment_status && <span className="text-muted" style={{ fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>Pmt: {reg.payment_status}</span>}
                </td>
                <td>{new Date(reg.created_at).toLocaleDateString()}</td>
                <td><button type="button" className="btn btn-sm btn-danger" onClick={() => handleDelete(reg.token)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
