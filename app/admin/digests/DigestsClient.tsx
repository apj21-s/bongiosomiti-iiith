'use client'

import { useState } from 'react'
import { toast } from 'sonner'

export default function DigestsClient({ initialManagers }: { initialManagers: any[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handleSend(managerId?: string) {
    setLoadingId(managerId || 'ALL')
    try {
      const res = await fetch('/api/admin/digests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(managerId ? { managerId } : {})
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Success: ${data.sent} sent, ${data.skipped} skipped, ${data.failed} failed.`)
      } else {
        toast.error(data.error || 'Failed to send digests')
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="admin-section-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ margin: 0 }}>Manager List</h3>
        <button 
          className="btn btn-primary"
          onClick={() => handleSend()}
          disabled={loadingId !== null}
        >
          {loadingId === 'ALL' ? 'Sending to all...' : 'Send to All Active Managers'}
        </button>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>UPI ID</th>
              <th>Status</th>
              <th>Last Sent</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {initialManagers.map((m: any) => (
              <tr key={m.id}>
                <td>
                  <strong>{m.name || m.username}</strong>
                  <div style={{ fontSize: '0.8rem', color: '#718096' }}>{m.email || 'No email'}</div>
                </td>
                <td><code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{m.upi_id || 'N/A'}</code></td>
                <td>
                  {m.is_active 
                    ? <span style={{ color: '#38a169', fontWeight: 600, fontSize: '0.85rem' }}>Active</span>
                    : <span style={{ color: '#e53e3e', fontWeight: 600, fontSize: '0.85rem' }}>Inactive</span>}
                </td>
                <td style={{ color: '#718096', fontSize: '0.85rem' }}>
                  {m.digest_sent_at ? new Date(m.digest_sent_at).toLocaleString('en-IN') : 'Never'}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button 
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleSend(m.id)}
                    disabled={!m.is_active || !m.email || loadingId !== null}
                  >
                    {loadingId === m.id ? 'Sending...' : 'Send Digest'}
                  </button>
                </td>
              </tr>
            ))}
            {initialManagers.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#718096' }}>No managers found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
