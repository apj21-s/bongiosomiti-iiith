'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { confirmAction, notifyError, notifySuccess } from '@/components/site-notifications'

export type ChangeablePass = {
  id: string
  token: string
  participant_name: string
  email: string | null
  food_pref: string | null
  amount: number
}

type Change = {
  id: string
  ticket_id: string
  from_plate: string
  to_plate: string
  from_amount: number
  to_amount: number
  delta: number
  payer: 'PARTICIPANT' | 'COLLECTOR' | 'NOBODY'
  collector_name: string | null
  collector_upi: string | null
  status: 'AWAITING_TRANSFER' | 'APPROVED' | 'CANCELLED'
  reason: string | null
  settlement_note: string | null
  initiated_by: string | null
  initiated_at: string
  settled_by: string | null
  settled_at: string | null
  eventName: string | null
  ticket: { token: string; participant_name: string; email: string | null } | null
}

const rupees = (n: number) => `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`

/** Who sends what to whom, in one line, the same way the mails put it. */
function direction(c: Pick<Change, 'payer' | 'delta' | 'collector_name'>): string {
  if (c.payer === 'NOBODY') return 'Same price — nothing to send'
  const other = c.collector_name || 'the collector'
  return c.payer === 'PARTICIPANT'
    ? `${rupees(c.delta)} from the participant to ${other}`
    : `${rupees(c.delta)} back from ${other} to the participant`
}

export default function PlateChangesClient({
  eventName,
  plates,
  passes,
}: {
  eventName: string
  plates: string[]
  passes: ChangeablePass[]
}) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [toPlate, setToPlate] = useState('')
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const [changes, setChanges] = useState<Change[]>([])
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/plate-changes', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Could not load the changes')
      setChanges(Array.isArray(data) ? data : [])
    } catch (e) {
      notifyError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const selected = useMemo(() => passes.find((p) => p.id === selectedId) || null, [passes, selectedId])

  // A pass already in the queue cannot be put in it twice; the server refuses
  // it too, but saying so here saves a round trip and explains why.
  const openTicketIds = useMemo(
    () => new Set(changes.filter((c) => c.status === 'AWAITING_TRANSFER').map((c) => c.ticket_id)),
    [changes],
  )

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    const pool = q
      ? passes.filter((p) =>
          [p.participant_name, p.email || '', p.token, p.food_pref || ''].some((f) => f.toLowerCase().includes(q)))
      : passes
    return pool.slice(0, 40)
  }, [passes, search])

  const otherPlates = plates.filter((p) => p !== selected?.food_pref)

  async function raise(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/plate-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: selected.id, toPlate: toPlate.trim(), delta, reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'The change could not be raised')
      notifySuccess(`${selected.participant_name} and ${data.collector_name || 'the collector'} have been emailed.`)
      setSelectedId(''); setToPlate(''); setDelta(''); setReason(''); setSearch('')
      void load()
    } catch (err) {
      notifyError(err)
    } finally {
      setSaving(false)
    }
  }

  async function settle(change: Change, action: 'approve' | 'cancel') {
    const who = change.ticket?.participant_name || 'this participant'
    const ok = await confirmAction({
      title: action === 'approve' ? 'Confirm the money moved?' : 'Call this change off?',
      message: action === 'approve'
        ? `${direction(change)}. Approving rewrites ${who}'s pass to ${change.to_plate} and emails them a fresh copy. Only do this once you have seen the receipt.`
        : `${who}'s pass stays as ${change.from_plate}. Nobody is emailed.`,
      confirmLabel: action === 'approve' ? 'Yes, it moved' : 'Call it off',
      tone: action === 'approve' ? 'normal' : 'danger',
    })
    if (!ok) return

    try {
      const res = await fetch(`/api/admin/plate-changes/${change.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: notes[change.id] || '' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'That did not go through')
      notifySuccess(action === 'approve' ? `${who} is now on ${change.to_plate}.` : 'The change was called off.')
      void load()
    } catch (err) {
      notifyError(err)
    }
  }

  const waiting = changes.filter((c) => c.status === 'AWAITING_TRANSFER')
  const done = changes.filter((c) => c.status !== 'AWAITING_TRANSFER')

  return (
    <div className="grid" style={{ padding: 'clamp(12px, 3vw, 24px) 0', gap: '24px', gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <section className="admin-section-card" style={{ marginTop: 0 }}>
        <h3 style={{ marginTop: 0 }}>Raise a change</h3>
        <p className="text-muted" style={{ marginTop: 0 }}>
          Find the pass, choose what it should become. The participant is emailed with the
          collector copied in, and the collector again on their own. Whoever receives the
          money is the one asked to reply with the receipt.
        </p>

        <form onSubmit={raise} className="admin-form-grid">
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="pc-search">Find a pass</label>
            <input id="pc-search" className="form-control" value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Enter Name, Email, Pass Code or Plate" />
            <p className="admin-form-note" style={{ gridColumn: 'auto' }}>
              {passes.length} approved pass{passes.length === 1 ? '' : 'es'} for {eventName}.
            </p>
          </div>

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="pc-pass">Pass</label>
            <select id="pc-pass" className="form-control" value={selectedId}
              onChange={(e) => { setSelectedId(e.target.value); setToPlate(''); setDelta('') }} required>
              <option value="">Select a pass</option>
              {matches.map((p) => (
                <option key={p.id} value={p.id} disabled={openTicketIds.has(p.id)}>
                  {p.participant_name} — {p.food_pref || 'no plate'} — {rupees(p.amount)} — {p.token.split('_')[1] || p.token}
                  {openTicketIds.has(p.id) ? ' (already waiting)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="pc-to">Change to</label>
            {otherPlates.length > 0 ? (
              <select id="pc-to" className="form-control" value={toPlate}
                onChange={(e) => setToPlate(e.target.value)} required>
                <option value="">Select a plate</option>
                {otherPlates.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            ) : (
              <input id="pc-to" className="form-control" value={toPlate}
                onChange={(e) => setToPlate(e.target.value)} placeholder="Enter Plate" required />
            )}
          </div>

          <div className="field">
            <label htmlFor="pc-delta">Difference (optional)</label>
            <input id="pc-delta" className="form-control" type="number" step="1" value={delta}
              onChange={(e) => setDelta(e.target.value)} placeholder="Enter Amount" />
          </div>

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="pc-reason">Reason (optional)</label>
            <input id="pc-reason" className="form-control" value={reason}
              onChange={(e) => setReason(e.target.value)} placeholder="Enter Reason" />
          </div>

          <p className="admin-form-note">
            Leave the difference blank and it is worked out from the price table at the rate
            this participant was charged at &mdash; a positive figure means they owe it, a
            negative one means it comes back to them. Any discount they already have is kept.
          </p>

          {selected && (
            <div className="pc-selected">
              <strong>{selected.participant_name}</strong> &middot; {selected.email || 'no email'}<br />
              Currently <strong>{selected.food_pref || 'no plate'}</strong> at {rupees(selected.amount)}
            </div>
          )}

          <div className="admin-form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving || !selected || !toPlate.trim()}>
              {saving ? 'Raising…' : 'Raise the change and email them'}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-section-card" style={{ marginTop: 0 }}>
        <h3 style={{ marginTop: 0 }}>Waiting on a transfer</h3>
        {loading && <p className="text-muted" style={{ margin: 0 }}>Loading…</p>}
        {!loading && waiting.length === 0 && (
          <p className="text-muted" style={{ margin: 0 }}>Nothing is waiting.</p>
        )}

        {waiting.map((c) => (
          <div key={c.id} className="pc-card">
            <div className="pc-card__head">
              <div>
                <strong>{c.ticket?.participant_name || 'Unknown'}</strong>
                <span className="pc-card__sub">{c.ticket?.email || ''}</span>
              </div>
              <span className="badge badge--pending">Awaiting transfer</span>
            </div>

            <p className="pc-card__move">
              {c.from_plate} <span aria-hidden="true">&rarr;</span> {c.to_plate}
              <span className="pc-card__sub">
                {rupees(c.from_amount)} becomes {rupees(c.to_amount)}
              </span>
            </p>
            <p className="pc-card__money">{direction(c)}</p>
            {c.reason && <p className="pc-card__sub">Reason: {c.reason}</p>}
            <p className="pc-card__sub">
              Raised {new Date(c.initiated_at).toLocaleString('en-IN')} by {c.initiated_by || 'an organiser'}
              {c.collector_upi ? ` · collected at ${c.collector_upi}` : ''}
            </p>

            <div className="pc-card__actions">
              <input className="form-control" placeholder="Enter Note (what the receipt showed)"
                value={notes[c.id] || ''}
                onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))} />
              <button type="button" className="btn btn-sm btn-primary" onClick={() => settle(c, 'approve')}>
                Approve
              </button>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => settle(c, 'cancel')}>
                Cancel
              </button>
            </div>
          </div>
        ))}
      </section>

      {done.length > 0 && (
        <section className="admin-section-card" style={{ marginTop: 0 }}>
          <h3 style={{ marginTop: 0 }}>Settled</h3>
          <div className="table-responsive">
            <table className="data-table admin-stack-table">
              <thead>
                <tr>
                  <th>Participant</th><th>Change</th><th>Money</th><th>Outcome</th><th>When</th>
                </tr>
              </thead>
              <tbody>
                {done.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Participant">
                      <strong>{c.ticket?.participant_name || 'Unknown'}</strong>
                    </td>
                    <td data-label="Change">{c.from_plate} &rarr; {c.to_plate}</td>
                    <td data-label="Money">{direction(c)}</td>
                    <td data-label="Outcome">
                      <span className={`badge ${c.status === 'APPROVED' ? '' : 'badge--error'}`}>
                        {c.status === 'APPROVED' ? 'APPROVED' : 'CANCELLED'}
                      </span>
                      {c.settlement_note ? <span className="pc-card__sub">{c.settlement_note}</span> : null}
                    </td>
                    <td data-label="When">
                      {c.settled_at ? new Date(c.settled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                      <span className="pc-card__sub">{c.settled_by || ''}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
