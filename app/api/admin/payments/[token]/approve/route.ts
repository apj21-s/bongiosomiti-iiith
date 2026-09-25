import { getCurrentUser } from '@/utils/auth/server'
import { NextResponse } from 'next/server'
import { createServiceRoleClient, createClient } from '@/utils/supabase/server'
import { sendQRPassEmail } from '@/utils/email'
import { getEventById } from '@/utils/data/events'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { data: authData } = await getCurrentUser()
  const user = authData?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServiceRoleClient()

  // Approve payment
  // payment_status -> APPROVED
  // status -> UNUSED (unless it was USED, but usually PENDING_PAYMENT -> UNUSED)
  // Actually, wait, prototype says: 
  // if status === 'USED' keep it 'USED' else 'UNUSED'
  
  const { data: ticket } = await supabase.from('tickets').select('*').eq('token', token.toUpperCase()).single()
  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

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

  const event = await getEventById(primaryTicket.event_id)
  if (event) {
    require('fs').appendFileSync('scratch/api_debug.log', `Sending email to ${primaryTicket.email} for event ${event.name} with tokens ${JSON.stringify(tokens)}\n`);
    await sendQRPassEmail(primaryTicket.email, primaryTicket.participant_name, event.name, tokens).catch(e => {
      require('fs').appendFileSync('scratch/api_debug.log', `Error sending email: ${e}\n`);
      console.error('Failed to send email:', e)
    })
  } else {
    require('fs').appendFileSync('scratch/api_debug.log', `Event not found for event_id: ${primaryTicket.event_id}\n`);
  }

  return NextResponse.json(primaryTicket)
}
