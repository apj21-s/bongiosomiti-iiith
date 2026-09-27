import { requireAdmin } from '@/utils/auth/require-admin'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { createServiceRoleClient } from '@/utils/supabase/server'

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

  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'events.json')
    const events = JSON.parse(fs.readFileSync(filePath, 'utf8'))

    const eventIndex = events.findIndex((e: { slug?: string }) => e.slug === slug)
    if (eventIndex === -1) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    status = events[eventIndex].status === 'OPEN' ? 'LOCKED' : 'OPEN'
    events[eventIndex].status = status

    try {
      fs.writeFileSync(filePath, JSON.stringify(events, null, 2) + '\n', 'utf8')
      written.file = true
    } catch (e) {
      warnings.push(
        `The events file could not be written (${e instanceof Error ? e.message : 'unknown'}). ` +
        'On a read-only deployment this is expected: the change is in the database, ' +
        'and events.json has to be edited in the repository to match.'
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not read the events file' },
      { status: 500 }
    )
  }

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
