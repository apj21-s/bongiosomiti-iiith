import { requireAdmin } from '@/utils/auth/require-admin'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { getEvents } from '@/utils/data/events'

/**
 * Opens or locks registration for an event.
 *
 * Writes both places the event is kept, for the same reason the editor beside
 * it does: the site reads public/data/events.json, while tickets.event_id
 * points at the events row and the admin counts come off it. This route used to
 * write only the file, which is how the status came to say OPEN in one and
 * LOCKED in the other - caught by scripts/sync-events.js, which is what that
 * tool is for.
 *
 * The file write fails on Vercel's read-only filesystem; when it does, the row
 * still has the change and the response says the file did not take it.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const guard = await requireAdmin(3)
  if (!guard.ok) return guard.response

  let status: string
  const written = { file: false, database: false }
  const warnings: string[] = []

  /**
   * Three states, not two.
   *
   *   OPEN    taking registrations
   *   LOCKED  paused, and expected to reopen
   *   CLOSED  finished - the event has happened, or is not going to
   *
   * Everything downstream already reads "not OPEN" as "no registrations", so
   * CLOSED needs no new checks; the distinction is for the people running it,
   * who need to tell a pause from an ending.
   *
   * A request may name the state it wants. With no body the old behaviour
   * stands and the button flips between OPEN and LOCKED.
   */
  const ALLOWED = ['OPEN', 'LOCKED', 'CLOSED']
  let wanted: string | null = null
  try {
    const body = (await request.json()) as Record<string, unknown>
    if (typeof body.status === 'string') {
      const asked = body.status.trim().toUpperCase()
      if (!ALLOWED.includes(asked)) {
        return NextResponse.json(
          { error: `Status must be one of ${ALLOWED.join(', ')}.` },
          { status: 400 }
        )
      }
      wanted = asked
    }
  } catch {
    // No body: fall through to the toggle.
  }

  try {
    const events = (await getEvents()) as Record<string, unknown>[]

    const eventIndex = events.findIndex((e) => e.slug === slug)
    if (eventIndex === -1) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    status = wanted ?? (events[eventIndex].status === 'OPEN' ? 'LOCKED' : 'OPEN')
    events[eventIndex].status = status

    // Best-effort write to local file (succeeds in dev, silently fails on Vercel)
    try {
      const filePath = path.join(process.cwd(), 'public', 'data', 'events.json')
      fs.writeFileSync(filePath, JSON.stringify(events, null, 2) + '\n', 'utf8')
      written.file = true
    } catch (e) {
      warnings.push(
        `The events file could not be written (${e instanceof Error ? e.message : 'unknown'}). ` +
        'On a read-only deployment this is expected: the change is in the database.'
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not fetch events' },
      { status: 500 }
    )
  }

  // Always write to DB — this is the production source of truth.
  try {
    const supabase = await createServiceRoleClient()
    const { error } = await supabase.from('events').update({ status }).eq('slug', slug)

    if (error) warnings.push(`The events row was not updated: ${error.message}`)
    else written.database = true
  } catch (e) {
    warnings.push(`The events row was not updated: ${e instanceof Error ? e.message : 'unknown'}`)
  }

  if (!written.file && !written.database) {
    return NextResponse.json({ error: warnings.join(' ') || 'Nothing was saved' }, { status: 500 })
  }

  return NextResponse.json({ success: true, status, written, warnings })
}
