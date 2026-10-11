import { cookies } from 'next/headers'
import { getEvents } from '@/utils/data/events'
import { ALL_EVENTS, EVENT_SCOPE_COOKIE, defaultEvent, type ScopedEvent } from './event-scope-shared'

export type EventScope = {
  events: ScopedEvent[]
  /** The event being looked at, or null for every event at once. */
  event: ScopedEvent | null
}

/**
 * Which event the admin pages and their API routes are showing.
 *
 * Chosen in the sidebar and carried in a cookie, so the browser sends it with
 * every admin fetch and no page has to thread it through by hand. A cookie
 * naming an event that no longer exists is ignored rather than trusted, and
 * with no cookie at all the pages open on the default event.
 */
export async function getEventScope(): Promise<EventScope> {
  const events = ((await getEvents()) || []).map((e: Record<string, unknown>) => ({
    id: String(e.id),
    slug: String(e.slug),
    name: String(e.name ?? e.slug),
    event_date: (e.event_date as string | null) ?? null,
    status: (e.status as string | null) ?? null,
  })) as ScopedEvent[]

  const chosen = (await cookies()).get(EVENT_SCOPE_COOKIE)?.value
  if (chosen === ALL_EVENTS) return { events, event: null }

  const event = events.find((e) => e.id === chosen) || defaultEvent(events)
  return { events, event }
}
