import { getCurrentUser } from '@/utils/auth/server'
import { getEvents, updateEvents } from '@/utils/data/events'
import { NextResponse } from 'next/server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { data: authData } = await getCurrentUser()
  const user = authData?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({ error: 'Deleting events is disabled' }, { status: 403 })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { data: authData } = await getCurrentUser()
  const user = authData?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const updates = await request.json()
    const events = await getEvents()
    
    const eventIndex = events.findIndex((e: any) => e.slug === slug)
    if (eventIndex === -1) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Try to update Supabase
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    // In case the `config` column does not exist yet (as seen in seed.sql), 
    // it will throw an error. Users must add the `config` column to the `events` table:
    // ALTER TABLE events ADD COLUMN config JSONB DEFAULT '{}'::jsonb;
    const { error: dbError } = await supabase.from('events').update(updates).eq('slug', slug)
    if (dbError) {
      console.error("Supabase update error (make sure the 'config' column exists on 'events' table!):", dbError)
      return NextResponse.json({ error: "Failed to update Supabase. Did you add the 'config' column? " + dbError.message }, { status: 500 })
    }

    return NextResponse.json({ ...events[eventIndex], ...updates })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
