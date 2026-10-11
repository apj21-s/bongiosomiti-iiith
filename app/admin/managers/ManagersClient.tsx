'use client'

import { useCallback, useEffect, useState } from 'react'
import { confirmAction } from '@/components/site-notifications'

type Manager = {
  id: string
  username: string
  upiId: string
  name?: string | null
  isActive: boolean
  createdAt?: string | null
  createdBy?: string | null
  totalVerifiedAmount?: number
  eventIds?: string[]
}

type EventOption = { id: string; name: string }

export default function ManagersClient() {
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // The event picked in the admin sidebar, which the amounts are for (null
  // for all events), and the events a manager can be set up to collect for.
  const [scopeEvent, setScopeEvent] = useState<EventOption | null>(null)
  const [events, setEvents] = useState<EventOption[]>([])
  const [assignmentsAvailable, setAssignmentsAvailable] = useState(false)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [upiId, setUpiId] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [newEventIds, setNewEventIds] = useState<string[]>([])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/managers')
      const data = await res.json()
      if (res.ok && Array.isArray(data?.managers)) {
        setManagers(data.managers)
        setScopeEvent(data.event)
        setEvents(data.events || [])
        setAssignmentsAvailable(Boolean(data.assignmentsAvailable))
        // A new profile is offered the event being looked at by default.
        setNewEventIds(data.event ? [data.event.id] : [])
      } else setError(data?.error || 'Could not load manager profiles')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load manager profiles')
    } finally {
      setLoading(false)
    }
  }, [])

  // The fetch is kicked off without touching state synchronously, so the
  // initial render is the loading state rather than an effect that sets it.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (cancelled) return
      await load()
    })()
    return () => { cancelled = true }
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setSaving(true)

    try {
      const res = await fetch('/api/admin/managers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, upiId, email, name, eventIds: newEventIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not create the profile')

      setNotice(
        `Created ${data.username}. They sign in at /admin/login with this username and password.` +
        (data.warning ? ` Their events could not be saved (${data.warning}) - set them in the table below.` : '')
      )
      setUsername(''); setPassword(''); setUpiId(''); setEmail(''); setName('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the profile')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(manager: Manager) {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/managers/${manager.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !manager.isActive }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to update manager')
      }
      window.location.reload()
    } catch (e: any) {
      setLoading(false)
      setError(e.message)
    }
  }

  async function toggleEvent(manager: Manager, eventId: string) {
    const current = manager.eventIds || []
    const eventIds = current.includes(eventId)
      ? current.filter((id) => id !== eventId)
      : [...current, eventId]
    setError(null)
    try {
      const res = await fetch(`/api/admin/managers/${manager.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventIds }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Could not update the events')
      setManagers((all) => all.map((m) => (m.id === manager.id ? { ...m, eventIds } : m)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the events')
    }
  }

  async function remove(manager: Manager) {
    if (!(await confirmAction({
      title: 'Delete this manager profile?',
      message: `"${manager.username}" will no longer be able to sign in.`,
      confirmLabel: 'Delete profile',
      tone: 'danger',
    }))) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/managers/${manager.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to delete manager. They may have tickets assigned to them.')
      }
      window.location.reload()
    } catch (e: any) {
      setLoading(false)
      setError(e.message)
    }
  }

  return (
    <div className="grid" style={{ padding: 'clamp(12px, 3vw, 24px) 0', gap: '24px' }}>
      <section className="admin-section-card" style={{ marginTop: 0 }}>
        <h3 style={{ marginTop: 0 }}>New manager profile</h3>
        <p className="text-muted" style={{ marginTop: 0 }}>
          A manager signs in with these details and sees only the payments made to their UPI ID.
        </p>

        <form onSubmit={handleCreate} className="admin-form-grid">
          <div className="field">
            <label htmlFor="mgr-username">Username *</label>
            <input id="mgr-username" className="form-control" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter Username" required />
          </div>

          <div className="field">
            <label htmlFor="mgr-password">Password *</label>
            <input id="mgr-password" type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter Password" required minLength={8} />
          </div>

          <div className="field">
            <label htmlFor="mgr-upi">UPI ID *</label>
            <input id="mgr-upi" className="form-control" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="Enter UPI ID" required />
          </div>

          <div className="field">
            <label htmlFor="mgr-email">Email *</label>
            <input id="mgr-email" type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter Email" required />
          </div>

          <p className="admin-form-note">
            The email is where their digest goes: how many payments came to them, how many
            are verified, how many are waiting, and anything reassigned to them. Sent only
            when there is something to report.
          </p>
          
          <div className="field">
            <label htmlFor="mgr-name">Display name</label>
            <input id="mgr-name" className="form-control" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter Name" />
          </div>

          {assignmentsAvailable && events.length > 0 && (
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Collects for</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {events.map((ev) => {
                  const on = newEventIds.includes(ev.id)
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      className={`btn btn-sm ${on ? 'btn-primary' : 'btn-secondary'}`}
                      aria-pressed={on}
                      onClick={() => setNewEventIds((ids) => (on ? ids.filter((id) => id !== ev.id) : [...ids, ev.id]))}
                    >
                      {on ? '✓ ' : ''}{ev.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="admin-form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Creating…' : 'Create profile'}
            </button>
          </div>
        </form>

        {error && <div className="form-status form-status--error" style={{ marginTop: '14px', display: 'block' }}>{error}</div>}
        {notice && <div className="form-status" style={{ marginTop: '14px', display: 'block' }}>{notice}</div>}
      </section>

      <section className="admin-section-card" style={{ marginTop: 0 }}>
        <h3 style={{ marginTop: 0 }}>Manager profiles</h3>
        <p className="text-muted" style={{ marginTop: 0 }}>
          Verified amount is the money each manager holds {scopeEvent ? <>for <strong>{scopeEvent.name}</strong></> : 'across all events'}:
          approved payments they are answerable for (after any reassignment from Wrong Allocations), plus or minus
          what settled plate changes actually moved. Switch event in the sidebar.
        </p>
        {!assignmentsAvailable && !loading && (
          <p className="admin-form-note">Run <code>supabase/manager-events.sql</code> to set which managers collect for which event.</p>
        )}
        {assignmentsAvailable && scopeEvent && !loading && managers.length > 0 &&
          !managers.some((m) => (m.eventIds || []).includes(scopeEvent.id)) && (
          <p className="admin-form-note">
            Nobody is set up for {scopeEvent.name} yet, so its registration form offers every active manager&apos;s UPI ID.
            Tick managers under Events to give it its own collectors.
          </p>
        )}
        <div className="table-responsive">
          <table className="data-table admin-stack-table">
            <thead>
              <tr>
                <th>Username</th><th>Name</th><th>UPI ID</th><th>Verified Amount</th>{assignmentsAvailable && <th>Events</th>}<th>Status</th><th>Created</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={assignmentsAvailable ? 8 : 7} className="text-muted">Loading…</td></tr>}
              {!loading && managers.length === 0 && (
                <tr><td colSpan={assignmentsAvailable ? 8 : 7} className="text-muted">No manager profiles yet.</td></tr>
              )}
              {!loading && managers.map((manager) => (
                <tr key={manager.id}>
                  <td data-label="Username"><strong>{manager.username}</strong></td>
                  <td data-label="Name">{manager.name || '—'}</td>
                  <td data-label="UPI ID"><code>{manager.upiId}</code></td>
                  <td data-label="Verified Amount">₹{(manager.totalVerifiedAmount || 0).toLocaleString('en-IN')}</td>
                  {assignmentsAvailable && (
                    <td data-label="Events">
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {events.map((ev) => {
                          const on = (manager.eventIds || []).includes(ev.id)
                          return (
                            <button
                              key={ev.id}
                              type="button"
                              className={`btn btn-sm ${on ? 'btn-primary' : 'btn-secondary'}`}
                              aria-pressed={on}
                              title={on ? `Collects for ${ev.name} - click to remove` : `Click to collect for ${ev.name}`}
                              onClick={() => toggleEvent(manager, ev.id)}
                            >
                              {on ? '✓ ' : ''}{ev.name}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                  )}
                  <td data-label="Status">
                    <span className={`badge ${manager.isActive ? '' : 'badge--error'}`}>
                      {manager.isActive ? 'ACTIVE' : 'DISABLED'}
                    </span>
                  </td>
                  <td data-label="Created">{manager.createdAt ? new Date(manager.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td data-label="Actions">
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => toggleActive(manager)}>
                        {manager.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(manager)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
