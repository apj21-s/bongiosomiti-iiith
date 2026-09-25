import { getCurrentUser } from '@/utils/auth/server'
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { getEventById } from '@/utils/data/events'
import { sendPaymentRejectedEmail } from '@/utils/email'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { data: authData } = await getCurrentUser()
  const user = authData?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServiceRoleClient()

  const { data: ticket } = await supabase.from('tickets').select('*').eq('token', token.toUpperCase()).single()
  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

  let updateQuery = supabase.from('tickets').update({ payment_status: 'REJECTED', status: 'PAYMENT_REJECTED' })
  if (ticket.utr && ticket.utr !== 'FREE-PASS') {
    updateQuery = updateQuery.eq('utr', ticket.utr)
  } else {
    updateQuery = updateQuery.eq('token', ticket.token)
  }

  const { data: updatedTickets, error } = await updateQuery.select()

  if (error || !updatedTickets || updatedTickets.length === 0) {
    return NextResponse.json({ error: error?.message || 'Failed to update tickets' }, { status: 500 })
  }

  const primaryTicket = updatedTickets[0]
  const event = getEventById(primaryTicket.event_id)

  if (event) {
    await sendPaymentRejectedEmail(primaryTicket.email, primaryTicket.participant_name, event.name).catch(e => {
      console.error('Failed to send rejection email:', e)
    })
  }

  return NextResponse.json(primaryTicket)
}
