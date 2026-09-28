'use client'

import { useEffect, useState } from 'react'

type Manager = { id: string; username: string; upiId: string; name?: string | null }
type Payment = {
  id: string
  token: string
  utr?: string | null
  participant_name?: string | null
  email?: string | null
  amount?: number | null
  receiver_upi?: string | null
  allocation_flag_reason?: string | null
  allocation_flagged_at?: string | null
  payment_status?: string | null
  event?: { name?: string } | null
}

export default function AllocationsClient() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [note, setNote] = useState<{ type: 'ok' | 'bad'; text: string } | null>(null)

  async function load() {
    setState('loading')
    try {
      const res = await fetch('/api/admin/allocations')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load allocations.')
      setPayments(data.payments || [])
      setManagers(data.managers || [])
      setState('ready')
    } catch (e: any) {
      setNote({ type: 'bad', text: e.message })
      setState('failed')
    }
  }

  useEffect(() => { load() }, [])

  async function reassign(token: string) {
    const managerId = choice[token]
    if (!managerId) { setNote({ type: 'bad', text: 'Choose a manager first.' }); return }

    setBusy(token)
    setNote(null)
    try {
      const res = await fetch(`/api/admin/payments/${token}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not reassign.')
      setNote({
        type: 'ok',
        text: `Moved to ${data.assignedTo.username} (${data.assignedTo.upiId})${data.moved > 1 ? ` — ${data.moved} passes` : ''}.`,
      })
      await load()
    } catch (e: any) {
      setNote({ type: 'bad', text: e.message })
    } finally {
      setBusy(null)
    }
  }

  if (state === 'loading') return <p className="text-muted">Loading…</p>

  return (
    <div>
      {note && (
        <div
          className="admin-card"
          style={{
            marginBottom: '16px', padding: '12px 16px',
            borderLeft: `4px solid ${note.type === 'ok' ? '#2f7d4f' : '#8F321F'}`,
            color: note.type === 'ok' ? '#22543d' : '#8F321F', fontWeight: 600,
          }}
          role="status"
        >
          {note.text}
        </div>
      )}

      {managers.length === 0 && (
        <div className="admin-card" style={{ padding: '16px', marginBottom: '16px' }}>
          There are no active manager profiles to assign to. Add one under Manager Profiles first.
        </div>
      )}

      {payments.length === 0 ? (
        <div className="admin-card" style={{ padding: '24px', textAlign: 'center', color: '#718096' }}>
          Nothing here. No collector has reported a payment as wrongly allocated.
        </div>
      ) : (
        <div className="admin-table-wrap" style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Pass</th>
                <th>Participant</th>
                <th>Paid to (on receipt)</th>
                <th>Reported</th>
                <th>Assign to</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id || p.token}>
                  <td>
                    <code>{p.token?.includes('_') ? p.token.split('_')[0] : p.token}</code>
                    {p.utr && p.utr !== 'FREE-PASS' && (
                      <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: '4px' }}>
                        UTR {p.utr}
                      </div>
                    )}
                  </td>
                  <td>
                    <strong>{p.participant_name}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#718096' }}>{p.email}</div>
                    <div style={{ fontSize: '0.75rem', color: '#718096' }}>
                      {p.event?.name}{p.amount != null ? ` · ₹${p.amount}` : ''}
                    </div>
                  </td>
                  <td><code>{p.receiver_upi || '—'}</code></td>
                  <td style={{ maxWidth: '22ch' }}>
                    <div style={{ fontSize: '0.8rem' }}>{p.allocation_flag_reason || <span className="text-muted">no reason given</span>}</div>
                    {p.allocation_flagged_at && (
                      <div style={{ fontSize: '0.72rem', color: '#718096', marginTop: '4px' }}>
                        {new Date(p.allocation_flagged_at).toLocaleString()}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <select
                        value={choice[p.token] || ''}
                        onChange={(e) => setChoice((c) => ({ ...c, [p.token]: e.target.value }))}
                        style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e0', minWidth: '180px' }}
                      >
                        <option value="">Choose a manager…</option>
                        {managers.map((m) => (
                          <option key={m.id} value={m.id}>{m.username} — {m.upiId}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy === p.token || !choice[p.token]}
                        onClick={() => reassign(p.token)}
                      >
                        {busy === p.token ? 'Assigning…' : 'Assign'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
