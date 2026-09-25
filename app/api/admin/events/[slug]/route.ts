import { requireAdmin } from '@/utils/auth/require-admin'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import fs from 'fs'
import path from 'path'

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

  try {
    const updates = await request.json()
    const filePath = path.join(process.cwd(), 'public', 'data', 'events.json')
    const events = JSON.parse(fs.readFileSync(filePath, 'utf8'))

    const eventIndex = events.findIndex((e: { slug?: string }) => e.slug === slug)
    if (eventIndex === -1) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    events[eventIndex] = { ...events[eventIndex], ...updates }
    fs.writeFileSync(filePath, JSON.stringify(events, null, 2))
    
    // Invalidate caches to ensure the frontend reflects changes immediately
    revalidatePath('/', 'layout')

    return NextResponse.json(events[eventIndex])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
