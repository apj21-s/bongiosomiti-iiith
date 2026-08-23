import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { getCurrentUser } from '@/utils/auth/server'
import { scannerCheckinSchema } from '@/utils/schemas'

export async function POST(request: Request) {
  try {
    // Session validation
    const { data: userData, error: authError } = await getCurrentUser()
    const user = userData?.user
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const json = await request.json()
    const result = scannerCheckinSchema.safeParse(json)
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { token, gate } = result.data
    const supabase = await createServiceRoleClient()

    // Atomic conditional update
    const { data: updatedTickets, error } = await supabase
      .from('tickets')
      .update({
        status: 'USED',
        redeemed_at: new Date().toISOString(),
        redeemed_gate: gate,
        redeemed_by: user.id
      })
      .eq('token', token.toUpperCase())
      .eq('status', 'UNUSED')
      .select(`
        *,
        event:events (
          slug,
          name,
          venue
        )
      `)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!updatedTickets || updatedTickets.length === 0) {
      // The update affected 0 rows. It was either not UNUSED, or doesn't exist.
      // To give a better error message, we check the actual state.
      const { data: ticket } = await supabase.from('tickets').select('*').eq('token', token.toUpperCase()).single()
      if (!ticket) {
        return NextResponse.json({ outcome: 'INVALID', message: 'Pass not found' }, { status: 404 })
      }
      if (ticket.status === 'USED') {
        return NextResponse.json({ outcome: 'ALREADY_USED', message: 'Ticket has already been redeemed' }, { status: 400 })
      }
      if (ticket.status === 'PENDING_PAYMENT') {
        return NextResponse.json({ outcome: 'PAYMENT_PENDING', message: 'Ticket payment is pending' }, { status: 400 })
      }
      return NextResponse.json({ outcome: 'BLOCKED', message: 'Ticket cannot be redeemed' }, { status: 400 })
    }

    // Insert checkin log
    const ticket = updatedTickets[0]
    await supabase.from('checkins').insert({
      ticket_id: ticket.id,
      gate: gate,
      scanned_by: user.id
    })

    const formattedTicket = {
      ...ticket,
      eventSlug: ticket.event?.slug,
      eventName: ticket.event?.name,
      venue: ticket.event?.venue,
    }

    return NextResponse.json({
      outcome: 'SUCCESS',
      message: 'Check-in successful',
      ticket: formattedTicket
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
