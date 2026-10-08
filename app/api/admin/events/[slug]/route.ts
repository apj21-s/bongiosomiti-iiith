import { requireAdmin } from '@/utils/auth/require-admin'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import fs from 'fs'
import path from 'path'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { toDatabaseRow } from '@/utils/data/event-sync'
import { getEvents } from '@/utils/data/events'

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
    const events = (await getEvents()) as Record<string, unknown>[]

    const eventIndex = events.findIndex((e) => e.slug === slug)
    if (eventIndex === -1) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // The slug and the id identify the event in both stores; an edit that
    // changed either would orphan every ticket pointing at it.
    const safeUpdates = { ...(updates || {}) }
    delete safeUpdates.slug
    delete safeUpdates.id

    // Coupons are written by /admin/coupons alone. The editor sends the whole
    // config it loaded, coupons included, so an editor tab opened before a
    // coupon was added would otherwise put the old list back on save.
    if (safeUpdates.config && typeof safeUpdates.config === 'object') {
      const config = events[eventIndex]?.config as Record<string, unknown> | undefined
      const onFile = config?.coupons
      safeUpdates.config = { ...safeUpdates.config }
      if (onFile === undefined) delete safeUpdates.config.coupons
      else safeUpdates.config.coupons = onFile
    }

    updated = { ...events[eventIndex], ...safeUpdates }
    events[eventIndex] = updated

    try {
      const filePath = path.join(process.cwd(), 'public', 'data', 'events.json')
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
      { error: error instanceof Error ? error.message : 'Could not fetch events' },
      { status: 500 }
    )
  }

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

  if (!written.file && !written.database) {
    return NextResponse.json({ error: problems.join(' ') || 'Nothing was saved' }, { status: 500 })
  }

  // The pages that read events.json are cached, so an edit that saved but was
  // not revalidated shows the old text until the next build.
  revalidatePath('/', 'layout')

  return NextResponse.json({ ...updated, written, warnings: problems })
}
