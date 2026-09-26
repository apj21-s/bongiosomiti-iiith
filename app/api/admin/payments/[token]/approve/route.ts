import { requireAdmin } from '@/utils/auth/require-admin'
import { getPaymentScope, scopeAllows } from '@/utils/auth/payment-scope'
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { sendQRPassEmail } from '@/utils/email'
import { getEventById } from '@/utils/data/events'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const guard = await requireAdmin(2)
  if (!guard.ok) return guard.response

  const scope = await getPaymentScope()
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

  const supabase = await createServiceRoleClient()

  // Approve payment
  // payment_status -> APPROVED
  // status -> UNUSED (unless it was USED, but usually PENDING_PAYMENT -> UNUSED)
  // Actually, wait, prototype says: 
  // if status === 'USED' keep it 'USED' else 'UNUSED'
  
  const { data: ticket } = await supabase.from('tickets').select('*').eq('token', token.toUpperCase()).single()
  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

  // A manager may only act on payments made to their own UPI id; without this
  // the list filter could be sidestepped by calling the route with a token.
  if (!scopeAllows(scope, ticket.receiver_upi)) {
    return NextResponse.json({ error: 'This payment belongs to another collector' }, { status: 403 })
  }

  const newStatus = ticket.status === 'USED' ? 'USED' : 'UNUSED'

  // Update all tickets with the same UTR, or just this one if UTR is empty
  let updateQuery = supabase.from('tickets').update({ payment_status: 'APPROVED', status: newStatus })
  if (ticket.utr && ticket.utr !== 'FREE-PASS') {
    updateQuery = updateQuery.eq('utr', ticket.utr)
  } else {
    updateQuery = updateQuery.eq('token', ticket.token)
  }

  const { data: updatedTickets, error } = await updateQuery.select()

  if (error || !updatedTickets || updatedTickets.length === 0) {
    return NextResponse.json({ error: error?.message || 'Failed to update tickets' }, { status: 500 })
  }

  const tokens = updatedTickets.map((t: any) => t.token)
  const primaryTicket = updatedTickets[0]

  const event = getEventById(primaryTicket.event_id)
  if (event) {
    await sendQRPassEmail(primaryTicket.email, primaryTicket.participant_name, event.name, tokens).catch(e => {
      console.error('Failed to send email:', e)
    })
  } else {
    console.error(`[payments] Event not found for event_id: ${primaryTicket.event_id}`)
  }

  return NextResponse.json(primaryTicket)
}
