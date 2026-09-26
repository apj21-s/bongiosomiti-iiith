'use client'

import { useCallback, useEffect, useState } from 'react'

type Setting = {
  youtubePlaylistId: string | null
  name: string
  isEnabled: boolean
  updatedAt?: string | null
  updatedBy?: string | null
}

export default function PlaylistClient() {
  const [link, setLink] = useState('')
  const [name, setName] = useState('Playlist')
  const [isEnabled, setIsEnabled] = useState(true)
  const [current, setCurrent] = useState<Setting | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/playlist')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load the playlist setting')

      setCurrent(data)
      setName(data.name || 'Playlist')
      setIsEnabled(data.isEnabled !== false)
      // Shown as the canonical playlist URL: only the id is stored.
      setLink(data.youtubePlaylistId ? `https://www.youtube.com/playlist?list=${data.youtubePlaylistId}` : '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the playlist setting')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => { if (!cancelled) await load() })()
    return () => { cancelled = true }
  }, [load])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setSaving(true)

    try {
      const res = await fetch('/api/admin/playlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link, name, isEnabled }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save')

      setCurrent(data)
      setNotice(data.youtubePlaylistId
        ? `Saved. The homepage will play playlist ${data.youtubePlaylistId}.`
        : 'Saved. No playlist is set, so the player is hidden.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const field = { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)' }

  return (
    <div className="grid" style={{ padding: 'clamp(12px, 3vw, 24px) 0', gap: '24px' }}>
      <section className="admin-section-card" style={{ marginTop: 0 }}>
        <h3 style={{ marginTop: 0 }}>Homepage music</h3>
        <p className="text-muted" style={{ marginTop: 0 }}>
          Paste a YouTube playlist link. It plays over the video in the middle of the home page.
          The playlist must be <strong>public or unlisted</strong> — YouTube will not embed a private one.
        </p>

        <form onSubmit={save} style={{ display: 'grid', gap: '16px', maxWidth: '640px' }}>
          <div className="field">
            <label htmlFor="pl-link" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              YouTube playlist link
            </label>
            <input
              id="pl-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://www.youtube.com/playlist?list=PL..."
              style={field}
            />
            <small className="text-muted">
              Leave blank to remove the playlist and hide the player.
            </small>
          </div>

          <div className="field">
            <label htmlFor="pl-name" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Display name
            </label>
            <input id="pl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Utsav" style={field} />
            <small className="text-muted">Shown until YouTube reports the first track title.</small>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
            <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} />
            Show the player on the home page
          </label>

          <div>
            <button className="btn btn-primary" type="submit" disabled={saving || loading}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>

        {error && <div className="form-status form-status--error" style={{ marginTop: '14px', display: 'block' }}>{error}</div>}
        {notice && <div className="form-status" style={{ marginTop: '14px', display: 'block' }}>{notice}</div>}
      </section>

      <section className="admin-section-card" style={{ marginTop: 0 }}>
        <h3 style={{ marginTop: 0 }}>Currently set</h3>
        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : (
          <table className="verification-meta-table" style={{ margin: 0 }}>
            <tbody>
              <tr>
                <td>Playlist ID</td>
                <td>{current?.youtubePlaylistId ? <code>{current.youtubePlaylistId}</code> : <span className="text-muted">none — player hidden</span>}</td>
              </tr>
              <tr><td>Display name</td><td>{current?.name || '—'}</td></tr>
              <tr><td>Player</td><td><span className={`badge ${current?.isEnabled ? '' : 'badge--error'}`}>{current?.isEnabled ? 'SHOWN' : 'HIDDEN'}</span></td></tr>
              <tr><td>Last changed</td><td>{current?.updatedAt ? new Date(current.updatedAt).toLocaleString('en-IN') : '—'}</td></tr>
              <tr><td>By</td><td>{current?.updatedBy || '—'}</td></tr>
            </tbody>
          </table>
        )}
        <p className="text-muted" style={{ marginBottom: 0, marginTop: '14px' }}>
          Only the playlist ID is stored, never the full link, and it is checked again every
          time the home page renders it.
        </p>
      </section>
    </div>
  )
}
