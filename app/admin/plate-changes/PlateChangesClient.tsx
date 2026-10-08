'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { confirmAction, notifyError, notifySuccess } from '@/components/site-notifications'

type FoundPass = { id: string; token: string; plate: string; amount: number; paymentStatus: string }

type Found = {
  id: string
  eventId: string | null
  eventName: string | null
  participantName: string
  participantEmail: string
  collector: { upi: string | null; email: string | null; name: string }
  total: number
  passes: FoundPass[]
}

type PassChange = {
  ticketId: string
  token: string
  fromPlate: string
  toPlate: string
  fromAmount: number
  toAmount: number
}

type Change = {
  id: string
  registration_id: string
  participant_name: string | null
  participant_email: string | null
  collector_name: string | null
  collector_upi: string | null
  passes: PassChange[]
  delta: number
  payer: 'PARTICIPANT' | 'COLLECTOR' | 'NOBODY'
  status: 'AWAITING_TRANSFER' | 'APPROVED' | 'CANCELLED'
  reason: string | null
  settlement_note: string | null
  initiated_by: string | null
  initiated_at: string
  settled_by: string | null
  settled_at: string | null
  eventName?: string | null
}

const rupees = (n: number) => `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`

/** Who sends what to whom, in one line, the same way the mails put it. */
function direction(c: Pick<Change, 'payer' | 'delta' | 'collector_name'>): string {
  if (c.payer === 'NOBODY' || c.delta === 0) return 'Nothing to send'
  const other = c.collector_name || 'the collector'
  return c.payer === 'PARTICIPANT'
    ? `${rupees(c.delta)} from the participant to ${other}`
    : `${rupees(c.delta)} back from ${other} to the participant`
}

/** The editable copy of one pass. */
type Draft = { toPlate: string; toAmount: string }

export default function PlateChangesClient({
  platesByEvent,
}: {
  platesByEvent: Record<string, string[]>
}) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<Found[] | null>(null)

  const [chosen, setChosen] = useState<Found | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [delta, setDelta] = useState('0')
  const [payer, setPayer] = useState<'PARTICIPANT' | 'COLLECTOR' | 'NOBODY'>('NOBODY')
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

  async function search(e: React.FormEvent) {
    e.preventDefault()
    setSearching(true)
    setResults(null)
    try {
      const res = await fetch(`/api/admin/plate-changes/lookup?q=${encodeURIComponent(query.trim())}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'That search did not work')
      setResults(Array.isArray(data) ? data : [])
      if (Array.isArray(data) && data.length === 1) choose(data[0])
    } catch (err) {
      notifyError(err)
    } finally {
      setSearching(false)
    }
  }

  function choose(reg: Found) {
    setChosen(reg)
    setDrafts(Object.fromEntries(reg.passes.map((p) => [p.id, { toPlate: p.plate, toAmount: String(p.amount) }])))
    setDelta('0')
    setPayer('NOBODY')
    setReason('')
  }

  const suggestions = chosen?.eventId ? platesByEvent[chosen.eventId] || [] : []

  /** What the edits add up to, which is only a suggestion for the transfer. */
  const edited = useMemo(() => {
    if (!chosen) return { moved: [] as FoundPass[], difference: 0 }
    const moved: FoundPass[] = []
    let difference = 0
    for (const pass of chosen.passes) {
      const draft = drafts[pass.id]
      if (!draft) continue
      const amount = Number(draft.toAmount)
      const changedPlate = draft.toPlate.trim() !== pass.plate
      const changedAmount = Number.isFinite(amount) && Math.round(amount) !== pass.amount
      if (changedPlate || changedAmount) {
        moved.push(pass)
        difference += (Number.isFinite(amount) ? Math.round(amount) : pass.amount) - pass.amount
      }
    }
    return { moved, difference }
  }, [chosen, drafts])

  function applySuggestion() {
    const d = edited.difference
    setDelta(String(Math.abs(d)))
    setPayer(d === 0 ? 'NOBODY' : d > 0 ? 'PARTICIPANT' : 'COLLECTOR')
  }

  async function raise(e: React.FormEvent) {
    e.preventDefault()
    if (!chosen) return
    setSaving(true)
    try {
      const passes = chosen.passes
        .filter((p) => edited.moved.some((m) => m.id === p.id))
        .map((p) => ({ ticketId: p.id, toPlate: drafts[p.id].toPlate.trim(), toAmount: Number(drafts[p.id].toAmount) }))

      const res = await fetch('/api/admin/plate-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: chosen.id, passes, delta: Number(delta) || 0, payer, reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'The change could not be raised')
      notifySuccess(`${chosen.participantName} and ${data.collector_name || 'the collector'} have been emailed.`)
      setChosen(null); setResults(null); setQuery(''); setDrafts({})
      void load()
    } catch (err) {
      notifyError(err)
    } finally {
      setSaving(false)
    }
  }

  async function settle(change: Change, action: 'approve' | 'cancel') {
    const who = change.participant_name || 'this participant'
    const ok = await confirmAction({
      title: action === 'approve' ? 'Confirm the money moved?' : 'Call this change off?',
      message: action === 'approve'
        ? `${direction(change)}. Approving rewrites ${who}'s booking and emails them a fresh set of passes. Only do this once you have seen the receipt.`
        : `${who}'s booking stays as it is. Nobody is emailed.`,
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
      notifySuccess(action === 'approve' ? `${who}'s booking has been updated.` : 'The change was called off.')
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
        <h3 style={{ marginTop: 0 }}>Find the booking</h3>
        <form onSubmit={search} className="pc-search">
          <input className="form-control" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter Participant Email, Collector Email, Registration Number or Pass Code" />
          <button className="btn btn-primary" type="submit" disabled={searching || query.trim().length < 2}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {results && results.length === 0 && (
          <p className="text-muted" style={{ marginBottom: 0 }}>Nothing matched that.</p>
        )}

        {results && results.length > 1 && (
          <div className="pc-results">
            {results.map((r) => (
              <button key={r.id} type="button"
                className={`pc-result ${chosen?.id === r.id ? 'is-chosen' : ''}`}
                onClick={() => choose(r)}>
                <strong>{r.participantName}</strong>
                <span className="pc-card__sub">{r.participantEmail}</span>
                <span className="pc-card__sub">
                  {r.eventName || 'Unknown event'} · {r.passes.length} pass{r.passes.length === 1 ? '' : 'es'} · {rupees(r.total)} · {r.id}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {chosen && (
        <section className="admin-section-card" style={{ marginTop: 0 }}>
          <h3 style={{ marginTop: 0 }}>{chosen.participantName}</h3>
          <p className="text-muted" style={{ marginTop: 0 }}>
            {chosen.participantEmail} · {chosen.eventName || 'Unknown event'} · registration{' '}
            <code>{chosen.id}</code> · collected by {chosen.collector.name}
            {chosen.collector.email ? ` (${chosen.collector.email})` : ''}
            {chosen.collector.upi ? ` at ${chosen.collector.upi}` : ''}
          </p>

          <form onSubmit={raise}>
            <div className="table-responsive">
              <table className="data-table admin-stack-table">
                <thead>
                  <tr><th>Pass</th><th>Plate</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  {chosen.passes.map((pass) => (
                    <tr key={pass.id}>
                      <td data-label="Pass">
                        <code>{pass.token.split('_')[1] || pass.token}</code>
                        <span className="pc-card__sub">
                          was {pass.plate || 'no plate'} at {rupees(pass.amount)}
                          {pass.paymentStatus !== 'APPROVED' ? ` · ${pass.paymentStatus}` : ''}
                        </span>
                      </td>
                      <td data-label="Plate">
                        <input className="form-control" list="pc-plates"
                          value={drafts[pass.id]?.toPlate ?? ''}
                          onChange={(e) => setDrafts((d) => ({ ...d, [pass.id]: { ...d[pass.id], toPlate: e.target.value } }))}
                          placeholder="Enter Plate" />
                      </td>
                      <td data-label="Amount">
                        <input className="form-control" type="number" step="1" min="0"
                          value={drafts[pass.id]?.toAmount ?? ''}
                          onChange={(e) => setDrafts((d) => ({ ...d, [pass.id]: { ...d[pass.id], toAmount: e.target.value } }))}
                          placeholder="Enter Amount" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <datalist id="pc-plates">
              {suggestions.map((p) => <option key={p} value={p} />)}
            </datalist>

            <div className="pc-transfer">
              <div className="field">
                <label htmlFor="pc-delta">Amount to transfer</label>
                <input id="pc-delta" className="form-control" type="number" step="1" min="0"
                  value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="Enter Amount" />
              </div>

              <div className="field">
                <label htmlFor="pc-payer">Direction</label>
                <select id="pc-payer" className="form-control" value={payer}
                  onChange={(e) => setPayer(e.target.value as typeof payer)}>
                  <option value="NOBODY">Nothing to send</option>
                  <option value="PARTICIPANT">Participant pays the collector</option>
                  <option value="COLLECTOR">Collector refunds the participant</option>
                </select>
              </div>

              <div className="field">
                <label>&nbsp;</label>
                <button type="button" className="btn btn-secondary" onClick={applySuggestion}>
                  Use the edits ({edited.difference === 0 ? 'nothing' : rupees(edited.difference)}
                  {edited.difference > 0 ? ' in' : edited.difference < 0 ? ' out' : ''})
                </button>
              </div>
            </div>

            <p className="admin-form-note" style={{ gridColumn: 'auto' }}>
              The amount and the direction are yours to set. What the edits add up to is only
              offered as a starting point &mdash; a plate swapped as a goodwill fix can move no
              money at all, and a figure settled over the phone wins over the price table.
            </p>

            <div className="field" style={{ marginTop: '12px' }}>
              <label htmlFor="pc-reason">Reason (optional, included in the email)</label>
              <input id="pc-reason" className="form-control" value={reason}
                onChange={(e) => setReason(e.target.value)} placeholder="Enter Reason" />
            </div>

            <div className="pc-raise">
              <span className="text-muted">
                {edited.moved.length === 0
                  ? 'Nothing has been changed yet.'
                  : `${edited.moved.length} pass${edited.moved.length === 1 ? '' : 'es'} will change.`}
              </span>
              <button className="btn btn-primary" type="submit" disabled={saving || edited.moved.length === 0}>
                {saving ? 'Raising…' : 'Raise the change and email them'}
              </button>
            </div>
          </form>
        </section>
      )}

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
                <strong>{c.participant_name || 'Unknown'}</strong>
                <span className="pc-card__sub">{c.participant_email || ''} · {c.registration_id}</span>
              </div>
              <span className="badge badge--pending">Awaiting transfer</span>
            </div>

            {c.passes.map((p) => (
              <p key={p.ticketId} className="pc-card__move">
                {p.fromPlate || 'no plate'} <span aria-hidden="true">&rarr;</span> {p.toPlate}
                <span className="pc-card__sub">{rupees(p.fromAmount)} becomes {rupees(p.toAmount)}</span>
              </p>
            ))}

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
                <tr><th>Participant</th><th>Change</th><th>Money</th><th>Outcome</th><th>When</th></tr>
              </thead>
              <tbody>
                {done.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Participant">
                      <strong>{c.participant_name || 'Unknown'}</strong>
                      <span className="pc-card__sub">{c.registration_id}</span>
                    </td>
                    <td data-label="Change">
                      {c.passes.map((p) => (
                        <span key={p.ticketId} style={{ display: 'block' }}>
                          {p.fromPlate || 'no plate'} &rarr; {p.toPlate}
                        </span>
                      ))}
                    </td>
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
