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
}

export default function ManagersClient() {
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [upiId, setUpiId] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/managers')
      const data = await res.json()
      if (res.ok && Array.isArray(data)) setManagers(data)
      else setError(data?.error || 'Could not load manager profiles')
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
        body: JSON.stringify({ username, password, upiId, email, name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not create the profile')

      setNotice(`Created ${data.username}. They sign in at /admin/login with this username and password.`)
      setUsername(''); setPassword(''); setUpiId(''); setEmail(''); setName('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the profile')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(manager: Manager) {
    await fetch(`/api/admin/managers/${manager.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !manager.isActive }),
    })
    load()
  }

  async function remove(manager: Manager) {
    if (!(await confirmAction({
      title: 'Delete this manager profile?',
      message: `"${manager.username}" will no longer be able to sign in.`,
      confirmLabel: 'Delete profile',
      tone: 'danger',
    }))) return
    await fetch(`/api/admin/managers/${manager.id}`, { method: 'DELETE' })
    load()
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
        <div className="table-responsive">
          <table className="data-table admin-stack-table">
            <thead>
              <tr>
                <th>Username</th><th>Name</th><th>UPI ID</th><th>Status</th><th>Created</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="text-muted">Loading…</td></tr>}
              {!loading && managers.length === 0 && (
                <tr><td colSpan={6} className="text-muted">No manager profiles yet.</td></tr>
              )}
              {!loading && managers.map((manager) => (
                <tr key={manager.id}>
                  <td data-label="Username"><strong>{manager.username}</strong></td>
                  <td data-label="Name">{manager.name || '—'}</td>
                  <td data-label="UPI ID"><code>{manager.upiId}</code></td>
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
