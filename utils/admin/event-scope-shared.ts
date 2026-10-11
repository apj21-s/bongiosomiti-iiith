/**
 * The parts of the admin event scope the browser needs as well as the server.
 *
 * Kept apart from event-scope.ts because that one reads cookies through
 * next/headers, which a client component cannot import.
 */

/** Which event the admin pages are looking at: an event id, or ALL_EVENTS. */
export const EVENT_SCOPE_COOKIE = 'admin_event'
export const ALL_EVENTS = 'all'

export type ScopedEvent = {
  id: string
  slug: string
  name: string
  event_date?: string | null
  status?: string | null
}

/**
 * Today as YYYY-MM-DD in India time.
 *
 * The events are in Hyderabad, and taking the day there on both server and
 * client means the two agree on which side of midnight it is.
 */
export function todayInIndia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

function dayOf(event: ScopedEvent): string {
  return String(event.event_date || '').slice(0, 10)
}

/**
 * The event the admin pages open on when nobody has picked one.
 *
 * The nearest event still to come, since that is the one being run. With none
 * ahead, the most recent one behind, since that is the one still being
 * settled.
 */
export function defaultEvent(events: ScopedEvent[]): ScopedEvent | null {
  const today = todayInIndia()
  const dated = events.filter((e) => dayOf(e))
  const upcoming = dated.filter((e) => dayOf(e) >= today).sort((a, b) => dayOf(a).localeCompare(dayOf(b)))
  if (upcoming[0]) return upcoming[0]
  const past = dated.sort((a, b) => dayOf(b).localeCompare(dayOf(a)))
  return past[0] || events[0] || null
}

/** Latest first, the order the picker lists them in. */
export function byDateDescending(events: ScopedEvent[]): ScopedEvent[] {
  return [...events].sort((a, b) => dayOf(b).localeCompare(dayOf(a)))
}
