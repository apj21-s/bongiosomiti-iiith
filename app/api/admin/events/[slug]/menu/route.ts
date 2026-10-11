import { requireAdmin } from '@/utils/auth/require-admin'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import fs from 'fs'
import path from 'path'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { getEvents } from '@/utils/data/events'

/**
 * Shows or hides an event's menu card.
 *
 * Separate from the registration status on purpose: once registrations shut
 * the menu is still worth showing to the people who are coming. It is kept as
 * `config.menu_locked`, and an event that has never set it shows its menu.
 *
 * Writes both the events file and the row, like the status toggle beside it.
 * Only the config column is touched in the row, so nothing else about the
 * event moves on the way past.
 *
 * Body: `{ locked: boolean }`.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const guard = await requireAdmin(3)
  if (!guard.ok) return guard.response

  let locked: boolean
  try {
    const body = (await request.json()) as Record<string, unknown>
    if (typeof body.locked !== 'boolean') throw new Error()
    locked = body.locked
  } catch {
    return NextResponse.json({ error: 'Say whether the menu is locked: { locked: true | false }.' }, { status: 400 })
  }

  const written = { file: false, database: false }
  const warnings: string[] = []
  let config: Record<string, unknown>

  try {
    const events = (await getEvents()) as Record<string, unknown>[]
    const eventIndex = events.findIndex((e) => e.slug === slug)
    if (eventIndex === -1) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    config = { ...((events[eventIndex].config as Record<string, unknown>) || {}), menu_locked: locked }
    events[eventIndex] = { ...events[eventIndex], config }

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

  try {
    const supabase = await createServiceRoleClient()
    const { error } = await supabase.from('events').update({ config }).eq('slug', slug)

    if (error) warnings.push(`The events row was not updated: ${error.message}`)
    else written.database = true
  } catch (e) {
    warnings.push(`The events row was not updated: ${e instanceof Error ? e.message : 'unknown'}`)
  }

  if (!written.file && !written.database) {
    return NextResponse.json({ error: warnings.join(' ') || 'Nothing was saved' }, { status: 500 })
  }

  revalidatePath('/', 'layout')

  return NextResponse.json({ success: true, menuLocked: locked, written, warnings })
}
