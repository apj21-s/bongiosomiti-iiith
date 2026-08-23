import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createServiceRoleClient()
  
  // Note: we need to join events to get event name, venue, etc.
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select(`
      *,
      event:events (
        slug,
        name,
        venue
      )
    `)
    .eq('token', token.toUpperCase())
    .single()

  if (error || !ticket) {
    return NextResponse.json({ error: 'Pass not found' }, { status: 404 })
  }

  // Format response to match expected structure on frontend
  const formattedTicket = {
    ...ticket,
    eventSlug: ticket.event?.slug,
    eventName: ticket.event?.name,
    venue: ticket.event?.venue,
  }

  return NextResponse.json(formattedTicket)
}
