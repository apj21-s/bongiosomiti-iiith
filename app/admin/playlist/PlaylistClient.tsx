'use client'

import { useCallback, useEffect, useState } from 'react'

type Entry = {
  id: string
  name: string
  url: string | null
  isDefault: boolean
}

type Payload = {
  entries: Entry[]
  /** True while the list is still the shipped set, untouched by anybody. */
  seeded: boolean
  warnings?: string[]
}

/**
 * The playlists the homepage offers, and which one it starts on.
 *
 * Adding one puts it in the visitor's picker on the home page; removing it
 * takes it out. The first in the list is what plays before anybody chooses.
 */
export default function PlaylistClient() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [seeded, setSeeded] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])

  const [link, setLink] = useState('')
  const [name, setName] = useState('')

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const absorb = useCallback((data: Payload) => {
    setEntries(data.entries || [])
    setSeeded(Boolean(data.seeded))
    setWarnings(data.warnings || [])
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/playlist')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load the playlists')
      absorb(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the playlists')
    } finally {
      setLoading(false)
    }
  }, [absorb])

  useEffect(() => {
    let cancelled = false
    void (async () => { if (!cancelled) await load() })()
    return () => { cancelled = true }
  }, [load])

  async function send(method: string, body: Record<string, unknown>, working: string, done: string) {
    setError(null)
    setNotice(null)
    setBusy(working)

    try {
      const res = await fetch('/api/admin/playlist', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'That did not work')
      absorb(data)
      setNotice(done)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work')
      return false
    } finally {
      setBusy(null)
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const ok = await send('POST', { link, name }, 'add', 'Added to the homepage.')
    if (ok) {
      setLink('')
      setName('')
    }
  }

  if (loading) return <p style={{ color: '#718096' }}>Loading the playlists…</p>

  return (
    <div style={{ display: 'grid', gap: '24px', maxWidth: '760px' }}>
      {seeded && (
        <p className="admin-note" style={{ margin: 0, padding: '12px 14px', borderRadius: '8px', background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e' }}>
          These are the playlists the site ships with. Add or remove one and the list becomes yours.
        </p>
      )}

      <section>
        <h2 style={{ fontSize: '1.1rem', margin: '0 0 4px' }}>On the homepage</h2>
        <p style={{ margin: '0 0 14px', color: '#718096', fontSize: '0.9rem' }}>
          Visitors choose between these in the player. The first one is what plays before they do.
        </p>

        {entries.length === 0 ? (
          <p style={{ color: '#718096' }}>No playlists. The homepage will fall back to the shipped set.</p>
        ) : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '10px' }}>
            {entries.map((entry) => (
              <li
                key={entry.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                  padding: '12px 14px', borderRadius: '10px', background: '#fff',
                  border: entry.isDefault ? '2px solid var(--brand, #b65a3c)' : '1px solid #e2e8f0',
                }}
              >
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ color: '#1a202c' }}>{entry.name}</strong>
                    {entry.isDefault && (
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--brand-2, #8e3f2d)' }}>
                        plays first
                      </span>
                    )}
                  </div>
                  {entry.url && (
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.78rem', color: '#718096', wordBreak: 'break-all' }}
                    >
                      {entry.id}
                    </a>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {!entry.isDefault && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy !== null}
                      onClick={() => send('PATCH', { action: 'makeDefault', id: entry.id }, entry.id, `"${entry.name}" now plays first.`)}
                    >
                      Play first
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy !== null}
                    onClick={() => send('DELETE', { id: entry.id }, entry.id, `"${entry.name}" removed.`)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: '1.1rem', margin: '0 0 4px' }}>Add a playlist</h2>
        <p style={{ margin: '0 0 12px', color: '#718096', fontSize: '0.9rem' }}>
          It has to be public or unlisted, or visitors will see an empty player.
        </p>

        <form onSubmit={add} style={{ display: 'grid', gap: '10px' }}>
          <input
            className="input"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Enter Playlist URL"
            autoComplete="off"
            spellCheck={false}
          />
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter Name"
            maxLength={48}
          />
          <button type="submit" className="btn btn-primary" disabled={busy !== null || link.trim() === ''}>
            {busy === 'add' ? 'Adding…' : 'Add to the homepage'}
          </button>
        </form>
      </section>

      {error && <p style={{ margin: 0, color: '#c53030' }}>{error}</p>}
      {notice && <p style={{ margin: 0, color: '#2f855a' }}>{notice}</p>}

      {warnings.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: '18px', color: '#92400e', fontSize: '0.86rem' }}>
          {warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
    </div>
  )
}
