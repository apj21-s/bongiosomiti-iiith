import { requireAdmin } from '@/utils/auth/require-admin'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { ownsEventRows, toDatabaseRow } from '@/utils/data/event-sync'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  await params
  const guard = await requireAdmin(3)
  if (!guard.ok) return guard.response

  return NextResponse.json({ error: 'Deleting events is disabled' }, { status: 403 })
}

/**
 * Edits an event in both places it is kept.
 *
 * public/data/events.json is what every page reads; the events row is what
 * tickets point at and what the admin counts are drawn from. Writing one and
 * not the other is how they came to disagree - the row still said CLOSE and
 * "Community Courtyard" long after the file had moved on - so this writes
 * both, and says which of the two it managed.
 *
 * The file write is the one that fails on Vercel, whose filesystem is
 * read-only. When that happens the row still has the edit, the response says
 * the file did not take it, and `node scripts/sync-events.js --check` will
 * show the drift until the JSON is committed to match.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const guard = await requireAdmin(3)
  if (!guard.ok) return guard.response

  let updated: Record<string, unknown>
  const written = { file: false, database: false }
  const problems: string[] = []

  try {
    const updates = await request.json()
    const filePath = path.join(process.cwd(), 'public', 'data', 'events.json')
    const events = JSON.parse(fs.readFileSync(filePath, 'utf8'))

    const eventIndex = events.findIndex((e: { slug?: string }) => e.slug === slug)
    if (eventIndex === -1) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // The slug and the id identify the event in both stores; an edit that
    // changed either would orphan every ticket pointing at it.
    const safeUpdates = { ...(updates || {}) }
    delete safeUpdates.slug
    delete safeUpdates.id
    updated = { ...events[eventIndex], ...safeUpdates }
    events[eventIndex] = updated

    try {
      fs.writeFileSync(filePath, JSON.stringify(events, null, 2) + '\n')
      written.file = true
    } catch (e) {
      problems.push(
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

  if (!ownsEventRows()) {
    problems.push(
      'This deployment does not own the shared events rows, so the change stayed in its own ' +
      'events.json. Set EVENTS_DB_WRITES=true only where those rows belong.'
    )
  } else {
    try {
      const supabase = await createServiceRoleClient()
      const { error } = await supabase
        .from('events')
        .update(toDatabaseRow(updated))
        .eq('slug', slug)

      if (error) problems.push(`The events row was not updated: ${error.message}`)
      else written.database = true
    } catch (e) {
      problems.push(`The events row was not updated: ${e instanceof Error ? e.message : 'unknown'}`)
    }
  }

  if (!written.file && !written.database) {
    return NextResponse.json({ error: problems.join(' ') || 'Nothing was saved' }, { status: 500 })
  }

  return NextResponse.json({ ...updated, written, warnings: problems })
}
