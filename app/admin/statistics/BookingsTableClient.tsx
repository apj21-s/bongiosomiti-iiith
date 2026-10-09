'use client'

import { useState } from 'react'
import { AUDIENCE_LABEL, describePlates, type RegistrationRow } from '@/utils/data/statistics'

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

export default function BookingsTableClient({ bookings }: { bookings: RegistrationRow[] }) {
  const [query, setQuery] = useState('')

  const filtered = query.trim() === '' 
    ? bookings 
    : bookings.filter(b => {
        const q = query.toLowerCase()
        return (
          b.participantName.toLowerCase().includes(q) ||
          (b.email && b.email.toLowerCase().includes(q)) ||
          describePlates(b).toLowerCase().includes(q)
        )
      })

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <input 
          type="text" 
          placeholder="Search bookings by name, email, or plate..." 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: '100%', maxWidth: '400px', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border)', background: '#fff' }}
        />
      </div>
      
      {filtered.length === 0 ? (
        <p className="text-muted" style={{ margin: 0 }}>No bookings match your search.</p>
      ) : (
        <div className="table-responsive">
          <table className="data-table admin-stack-table">
            <thead>
              <tr>
                <th>Participant</th><th>Rate</th><th>Plates</th><th>Passes</th><th>Paid</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((booking) => (
                <tr key={booking.id}>
                  <td data-label="Participant">
                    <strong>{booking.participantName}</strong>
                    {booking.email ? <span className="stats-booking__sub" style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted)' }}>{booking.email}</span> : null}
                  </td>
                  <td data-label="Rate">{AUDIENCE_LABEL[booking.audience]}</td>
                  <td data-label="Plates">{describePlates(booking)}</td>
                  <td data-label="Passes">{booking.passes}</td>
                  <td data-label="Paid">{rupees(booking.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
