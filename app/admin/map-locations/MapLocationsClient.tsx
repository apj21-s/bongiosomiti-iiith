'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { parseCoordinatePair } from '@/utils/data/puja-locations'

type Location = {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  status: string
  sortOrder: number
  directions: string
}

type Draft = {
  name: string
  address: string
  lat: string
  lng: string
  status: string
  sortOrder: string
}

const EMPTY: Draft = { name: '', address: '', lat: '', lng: '', status: 'active', sortOrder: '0' }

function draftFrom(l: Location): Draft {
  return {
    name: l.name,
    address: l.address,
    lat: String(l.lat),
    lng: String(l.lng),
    status: l.status,
    sortOrder: String(l.sortOrder),
  }
}

export default function MapLocationsClient() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  /** null = the add form; an id = editing that row. */
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  /** Two-step delete, so a misplaced click does not remove a pin. */
  const [confirming, setConfirming] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/puja-locations')
      const data = await res.json()
      if (res.ok && Array.isArray(data)) setLocations(data)
      else setError(data?.error || 'Could not load the map locations')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the map locations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (cancelled) return
      await load()
    })()
    return () => { cancelled = true }
  }, [load])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return locations
    return locations.filter(
      (l) => l.name.toLowerCase().includes(q) || l.address.toLowerCase().includes(q)
    )
  }, [locations, search])

  /**
   * Accepts a whole coordinate pair pasted into the latitude box.
   *
   * Copying from Google Maps gives "17.385, 78.486" in one go, and splitting
   * that by hand into two boxes is where a digit goes missing.
   */
  function onLatChange(value: string) {
    const pair = parseCoordinatePair(value)
    if (pair && /[,\s]/.test(value.trim())) {
      setDraft((d) => ({ ...d, lat: String(pair.lat), lng: String(pair.lng) }))
      return
    }
    setDraft((d) => ({ ...d, lat: value }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setSaving(true)

    const body = {
      name: draft.name,
      address: draft.address,
      lat: draft.lat,
      lng: draft.lng,
      status: draft.status,
      sortOrder: Number(draft.sortOrder) || 0,
    }

    try {
      const res = await fetch(
        editing ? `/api/admin/puja-locations/${editing}` : '/api/admin/puja-locations',
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save the location')

      setNotice(editing ? `Updated ${data.name}.` : `Added ${data.name} to the map.`)
      setDraft(EMPTY)
      setEditing(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the location')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    setError(null)
    setNotice(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/puja-locations/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not delete the location')

      setNotice(`Removed ${data.deleted?.name || 'the location'} from the map.`)
      if (editing === id) { setEditing(null); setDraft(EMPTY) }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the location')
    } finally {
      setConfirming(null)
      setSaving(false)
    }
  }

  const label: React.CSSProperties = { display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#4a5568', marginBottom: '4px' }
  const input: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid #cbd5e0', borderRadius: '7px', fontSize: '0.9rem' }
  const cell: React.CSSProperties = { padding: '10px 12px', borderBottom: '1px solid #edf2f7', fontSize: '0.88rem', verticalAlign: 'top' }

  return (
    <div>
      {error && (
        <p role="alert" style={{ background: '#fff5f5', border: '1px solid #feb2b2', color: '#9b2c2c', padding: '11px 14px', borderRadius: '8px' }}>
          {error}
        </p>
      )}
      {notice && (
        <p role="status" style={{ background: '#f0fff4', border: '1px solid #9ae6b4', color: '#22543d', padding: '11px 14px', borderRadius: '8px' }}>
          {notice}
        </p>
      )}

      <form
        onSubmit={save}
        style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '28px' }}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#1a202c' }}>
          {editing ? 'Edit location' : 'Add a location'}
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label} htmlFor="loc-name">Name</label>
            <input id="loc-name" style={input} value={draft.name} required maxLength={160}
              placeholder="Enter Name"
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label} htmlFor="loc-address">One-line address</label>
            <input id="loc-address" style={input} value={draft.address} required maxLength={300}
              placeholder="Enter One-line Address"
              onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} />
          </div>

          <div>
            <label style={label} htmlFor="loc-lat">Latitude</label>
            <input id="loc-lat" style={input} value={draft.lat} required inputMode="decimal"
              placeholder="Enter Latitude"
              onChange={(e) => onLatChange(e.target.value)} />
            <small style={{ color: '#718096', fontSize: '0.74rem' }}>
              Paste &ldquo;lat, lng&rdquo; or a Maps link here and both boxes fill.
            </small>
          </div>

          <div>
            <label style={label} htmlFor="loc-lng">Longitude</label>
            <input id="loc-lng" style={input} value={draft.lng} required inputMode="decimal"
              placeholder="Enter Longitude"
              onChange={(e) => setDraft((d) => ({ ...d, lng: e.target.value }))} />
          </div>

          <div>
            <label style={label} htmlFor="loc-status">Status</label>
            <select id="loc-status" style={input} value={draft.status}
              onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
              <option value="active">Active &mdash; shown on the map</option>
              <option value="inactive">Inactive &mdash; kept, not shown</option>
              <option value="temporarily_closed">Temporarily closed &mdash; not this year</option>
              <option value="no_longer_exists">No longer exists</option>
            </select>
          </div>

          <div>
            <label style={label} htmlFor="loc-order">Sort order</label>
            <input id="loc-order" style={input} value={draft.sortOrder} inputMode="numeric"
              onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add to map'}
          </button>
          {editing && (
            <button type="button" className="btn btn-secondary" disabled={saving}
              onClick={() => { setEditing(null); setDraft(EMPTY); setError(null) }}>
              Cancel
            </button>
          )}
          {draft.lat && draft.lng && (
            <a className="btn btn-secondary" target="_blank" rel="noopener noreferrer"
              href={`https://www.google.com/maps/search/?api=1&query=${draft.lat},${draft.lng}`}>
              Check on Maps &rarr;
            </a>
          )}
        </div>
      </form>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#1a202c' }}>
          {loading ? 'Loading…' : `${locations.length} location${locations.length === 1 ? '' : 's'}`}
          {search && !loading && ` · ${shown.length} matching`}
        </h2>
        <input
          style={{ ...input, maxWidth: '280px' }}
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {!loading && locations.length === 0 && (
        <p style={{ color: '#718096' }}>
          No locations yet. Add one above, or run{' '}
          <code>node scripts/seed-puja-locations.js</code> to bring across the existing list.
        </p>
      )}

      {shown.length > 0 && (
        <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
            <thead>
              <tr style={{ background: '#f7fafc', textAlign: 'left' }}>
                <th style={{ ...cell, fontWeight: 600 }}>Name</th>
                <th style={{ ...cell, fontWeight: 600 }}>Address</th>
                <th style={{ ...cell, fontWeight: 600 }}>Coordinates</th>
                <th style={{ ...cell, fontWeight: 600 }}>Status</th>
                <th style={{ ...cell, fontWeight: 600 }}></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => (
                <tr key={l.id} style={editing === l.id ? { background: '#fffaf0' } : undefined}>
                  <td style={cell}>{l.name}</td>
                  <td style={{ ...cell, color: '#4a5568' }}>{l.address}</td>
                  <td style={{ ...cell, fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }}>
                    <a href={l.directions} target="_blank" rel="noopener noreferrer" style={{ color: '#2b6cb0' }}>
                      {l.lat.toFixed(6)}, {l.lng.toFixed(6)}
                    </a>
                  </td>
                  <td style={cell}>
                    <span style={{
                      fontSize: '0.75rem', padding: '3px 9px', borderRadius: '999px',
                      background: l.status === 'active' ? '#c6f6d5' : '#e2e8f0',
                      color: l.status === 'active' ? '#22543d' : '#4a5568',
                    }}>
                      {l.status}
                    </span>
                  </td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn btn-sm btn-secondary" disabled={saving}
                      onClick={() => {
                        setEditing(l.id)
                        setDraft(draftFrom(l))
                        setConfirming(null)
                        setError(null)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}>
                      Edit
                    </button>{' '}
                    {confirming === l.id ? (
                      <>
                        <button type="button" className="btn btn-sm btn-primary" disabled={saving}
                          onClick={() => remove(l.id)}>
                          Confirm
                        </button>{' '}
                        <button type="button" className="btn btn-sm btn-secondary" disabled={saving}
                          onClick={() => setConfirming(null)}>
                          No
                        </button>
                      </>
                    ) : (
                      <button type="button" className="btn btn-sm btn-secondary" disabled={saving}
                        onClick={() => setConfirming(l.id)}>
                        Delete
                      </button>
                    )}
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
