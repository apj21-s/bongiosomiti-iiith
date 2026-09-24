'use client'

import { useState, useEffect } from 'react'

export default function PaymentsClient() {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('PENDING')
  const [reviewing, setReviewing] = useState<any | null>(null)

  async function fetchPayments() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/payments')
      const data = await res.json()
      if (res.ok) setPayments(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPayments()
  }, [])

  async function handleApprove(token: string) {
    if (!confirm(`Approve payment for pass ${token}?`)) return
    try {
      const res = await fetch(`/api/admin/payments/${token}/approve`, { method: 'POST' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to approve payment')
      }
      fetchPayments()
    } catch (e: any) {
      alert(e.message)
    }
  }

  async function handleReject(token: string) {
    if (!confirm(`Reject payment for pass ${token}?`)) return
    try {
      const res = await fetch(`/api/admin/payments/${token}/reject`, { method: 'POST' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to reject payment')
      }
      fetchPayments()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const filteredPayments = status ? payments.filter((p) => p.payment_status === status) : payments

  const groupedPayments = filteredPayments.reduce((acc: any[], pmt: any) => {
    const key = (pmt.utr && pmt.utr !== 'FREE-PASS') ? pmt.utr : pmt.token
    const existing = acc.find((p: any) => p._groupKey === key)
    if (existing) {
      existing.amount += pmt.amount
      existing.num_passes = (existing.num_passes || 1) + 1
      existing._tokens.push(pmt.token)
    } else {
      acc.push({ ...pmt, _groupKey: key, num_passes: 1, _tokens: [pmt.token] })
    }
    return acc
  }, [])

  function renderStatus(raw: string) {
    if (raw === 'APPROVED' || raw === 'VERIFIED') return 'VERIFIED'
    if (raw === 'REJECTED') return 'REJECTED'
    return 'VERIFICATION_PENDING'
  }

  return (
    <div className="grid" style={{ padding: 'clamp(12px, 3vw, 24px) clamp(12px, 3vw, 28px)' }}>
      <div className="filter-bar" style={{ display: 'flex', gap: '14px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', background: 'rgba(255,255,255,0.7)', padding: '14px 20px', borderRadius: '16px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label htmlFor="admin-payments-filter-status" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Filter by Verification Status:</label>
          <select id="admin-payments-filter-status" style={{ flex: '1 1 min(100%, 240px)', padding: '8px 14px', borderRadius: '12px', border: '1px solid var(--border)', background: '#fff', fontWeight: 600 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Transactions</option>
            <option value="PENDING">PENDING (Action Required)</option>
            <option value="APPROVED">VERIFIED (Active Passes)</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </div>
        <span style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'block', width: '100%' }}>Only authenticated organisers can verify payments &amp; issue passes.</span>
      </div>

      <div className="table-wrapper-outer" style={{ background: 'rgba(255,255,255,0.85)', borderRadius: '20px', border: '1px solid var(--border)', padding: 'clamp(12px, 2vw, 16px)', marginTop: '0.5rem', minWidth: 0, width: '100%' }}>
        <div className="table-responsive">
          <table className="data-table">
          <thead>
            <tr>
              <th>Registration ID</th>
              <th>Participant Name</th>
              <th>Registered Email</th>
              <th>UPI Transaction ID / UTR</th>
              <th>Expected Amount</th>
              <th>Submission Timestamp</th>
              <th>Payment Status</th>
              <th>Verification Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="text-muted">Loading payments...</td></tr>}
            {!loading && groupedPayments.length === 0 && <tr><td colSpan={8} className="text-muted">No payments found.</td></tr>}
            {!loading && groupedPayments.map((pmt: any) => {
              const displayStatus = renderStatus(pmt.payment_status)
              return (
                <tr key={pmt.id}>
                  <td><code>{pmt.token.includes('_') ? pmt.token.split('_')[0] : pmt.token}</code> {pmt.num_passes > 1 && <span style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block', marginTop: '4px' }}>+{pmt.num_passes - 1} more passes</span>}</td>
                  <td><strong>{pmt.participant_name}</strong><br /><span className="text-muted">{pmt.college_id}</span></td>
                  <td>{pmt.email}</td>
                  <td><strong style={{ fontFamily: 'monospace' }}>{pmt.utr || 'FREE-PASS'}</strong></td>
                  <td>₹{pmt.amount}</td>
                  <td>{new Date(pmt.created_at).toLocaleString()}</td>
                  <td><span className={`badge ${displayStatus === 'VERIFIED' ? '' : 'badge--error'}`}>{displayStatus}</span></td>
                  <td>
                    <div className="action-btn-group" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {pmt.payment_status !== 'APPROVED' && <button type="button" className="btn btn-sm btn-success" onClick={() => handleApprove(pmt.token)}>VERIFY</button>}
                      {pmt.payment_status !== 'REJECTED' && <button type="button" className="btn btn-sm btn-danger" onClick={() => handleReject(pmt.token)}>REJECT</button>}
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => setReviewing(pmt)}>REVIEW</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      {reviewing && (
        <div className="admin-modal-overlay is-active" role="dialog" aria-modal="true" aria-labelledby="modal-review-title">
          <div className="admin-modal-card">
            <div className="admin-modal-head">
              <h3 id="modal-review-title">Payment Verification Review</h3>
              <button type="button" className="admin-modal-close" onClick={() => setReviewing(null)} aria-label="Close modal">&times;</button>
            </div>
            <div className="admin-modal-body" style={{ overflowX: 'auto' }}>
              <table className="verification-meta-table" style={{ margin: 0, minWidth: 'max-content' }}>
                <tbody>
                  <tr><td>Registration ID</td><td><code>{reviewing.token.includes('_') ? reviewing.token.split('_')[0] : reviewing.token}</code></td></tr>
                  <tr><td>Participant Name</td><td><strong>{reviewing.participant_name}</strong></td></tr>
                  <tr><td>College ID / Org</td><td>{reviewing.college_id || 'N/A'}</td></tr>
                  <tr><td>Registered Email</td><td>{reviewing.email}</td></tr>
                  <tr><td>Phone Number</td><td>{reviewing.phone || 'N/A'}</td></tr>
                  <tr><td>Event</td><td>{reviewing.event?.name}</td></tr>
                  <tr><td>UPI Transaction UTR</td><td><strong style={{ letterSpacing: '0.05em' }}>{reviewing.utr || 'N/A'}</strong></td></tr>
                  <tr><td>Expected Amount</td><td>₹{reviewing.amount}</td></tr>
                  <tr><td>Submitted At</td><td>{new Date(reviewing.created_at).toLocaleString()}</td></tr>
                  <tr><td>Payment Status</td><td><span className="badge">{renderStatus(reviewing.payment_status)}</span></td></tr>
                </tbody>
              </table>
            </div>
            <div className="admin-modal-footer" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-danger" style={{ flex: '1 1 auto', minWidth: 'min(100%, 140px)', justifyContent: 'center' }} onClick={() => { setReviewing(null); handleReject(reviewing.token) }}>✕ Reject</button>
              <button type="button" className="btn btn-success" style={{ flex: '1 1 auto', minWidth: 'min(100%, 140px)', justifyContent: 'center' }} onClick={() => { setReviewing(null); handleApprove(reviewing.token) }}>✓ Verify Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
