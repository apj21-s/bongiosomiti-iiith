import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createServiceRoleClient()
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'OPEN')
    .order('event_date', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(events)
}
