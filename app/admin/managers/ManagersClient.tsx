'use client'

import { useCallback, useEffect, useState } from 'react'

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
        body: JSON.stringify({ username, password, upiId, name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not create the profile')

      setNotice(`Created ${data.username}. They sign in at /admin/login with this username and password.`)
      setUsername(''); setPassword(''); setUpiId(''); setName('')
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
    if (!confirm(`Delete the profile "${manager.username}"? They will no longer be able to sign in.`)) return
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

        <form onSubmit={handleCreate} style={{ display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', alignItems: 'end' }}>
          <div className="field">
            <label htmlFor="mgr-username" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>Username *</label>
            <input id="mgr-username" className="reg-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. arka" required
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)' }} />
          </div>

          <div className="field">
            <label htmlFor="mgr-password" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>Password *</label>
            <input id="mgr-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)' }} />
          </div>

          <div className="field">
            <label htmlFor="mgr-upi" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>UPI ID *</label>
            <input id="mgr-upi" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@bank" required
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)' }} />
          </div>

          <div className="field">
            <label htmlFor="mgr-name" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>Display name</label>
            <input id="mgr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)' }} />
          </div>

          <button className="btn btn-primary" type="submit" disabled={saving} style={{ height: '42px' }}>
            {saving ? 'Creating…' : 'Create profile'}
          </button>
        </form>

        {error && <div className="form-status form-status--error" style={{ marginTop: '14px', display: 'block' }}>{error}</div>}
        {notice && <div className="form-status" style={{ marginTop: '14px', display: 'block' }}>{notice}</div>}
      </section>

      <section className="admin-section-card" style={{ marginTop: 0 }}>
        <h3 style={{ marginTop: 0 }}>Manager profiles</h3>
        <div className="table-responsive">
          <table className="data-table">
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
                  <td><strong>{manager.username}</strong></td>
                  <td>{manager.name || '—'}</td>
                  <td><code>{manager.upiId}</code></td>
                  <td>
                    <span className={`badge ${manager.isActive ? '' : 'badge--error'}`}>
                      {manager.isActive ? 'ACTIVE' : 'DISABLED'}
                    </span>
                  </td>
                  <td>{manager.createdAt ? new Date(manager.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td>
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
