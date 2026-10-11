'use client'

import { useEffect, useId, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ALL_EVENTS, EVENT_SCOPE_COOKIE, todayInIndia, type ScopedEvent } from '@/utils/admin/event-scope-shared'

/**
 * Chooses which event the admin pages show.
 *
 * The choice is a cookie, so the server pages and the API routes behind every
 * table read it without being told. Changing it reloads the page, because the
 * tables fetch once on mount and would otherwise go on showing the old event.
 */
export default function AdminEventPicker() {
  const [events, setEvents] = useState<ScopedEvent[]>([])
  const [selected, setSelected] = useState<string>('')
  const pathname = usePathname()
  // Mounted twice, in the sidebar and the mobile menu, so the id is not fixed.
  const id = useId()

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/event-scope', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return
        setEvents(Array.isArray(d.events) ? d.events : [])
        setSelected(String(d.selected || ''))
      })
      .catch(() => {})
    return () => { cancelled = true }
    // Asked again on navigation, which is what picks the list up after sign-in.
  }, [pathname])

  if (events.length === 0) return null

  function choose(value: string) {
    setSelected(value)
    document.cookie = `${EVENT_SCOPE_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`
    window.location.reload()
  }

  const today = todayInIndia()
  const label = (e: ScopedEvent) => {
    const day = String(e.event_date || '').slice(0, 10)
    if (!day) return e.name
    return `${e.name} · ${day < today ? 'past' : day === today ? 'today' : 'upcoming'}`
  }

  return (
    <div style={{ padding: '4px 16px 12px' }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
        Event
      </label>
      <select
        id={id}
        value={selected}
        onChange={(e) => choose(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: '#2d3748', fontSize: '0.88rem', fontWeight: 600 }}
      >
        {events.map((e) => <option key={e.id} value={e.id}>{label(e)}</option>)}
        <option value={ALL_EVENTS}>All events</option>
      </select>
    </div>
  )
}
