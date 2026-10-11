import { requireAdmin } from '@/utils/auth/require-admin'
import { NextResponse } from 'next/server'
import { createServiceRoleClient, createClient } from '@/utils/supabase/server'
import { getEventScope } from '@/utils/admin/event-scope'

export async function GET() {
  const guard = await requireAdmin(2)
  if (!guard.ok) return guard.response

  const supabase = await createServiceRoleClient()
  const { event } = await getEventScope()

  // Filtered through the ticket for the event picked in the admin sidebar. The
  // join has to be inner for that filter to drop other events' check-ins
  // rather than return them with the ticket blanked out.
  const ticket: string = event
    ? 'ticket:tickets!inner ( token, participant_name, event_id, event:events ( name ) )'
    : 'ticket:tickets ( token, participant_name, event:events ( name ) )'
  let query = supabase
    .from('checkins')
    .select(`*, ${ticket}`)
    .order('created_at', { ascending: false })
  if (event) query = query.eq('ticket.event_id', event.id)

  const { data: checkins, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Format the output to match prototype expectations
  const formattedCheckins = checkins.map((c: any) => ({
    id: c.id,
    token: c.ticket?.token,
    participantName: c.ticket?.participant_name,
    eventName: c.ticket?.event?.name,
    gate: c.gate,
    timestamp: c.created_at
  }))

  return NextResponse.json(formattedCheckins)
}
