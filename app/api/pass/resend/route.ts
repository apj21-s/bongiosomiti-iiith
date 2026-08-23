import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { sendQRPassEmail } from '@/utils/email'

export async function POST(request: Request) {
  try {
    const { query } = await request.json()
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
    }

    const supabase = await createServiceRoleClient()

    // Query could be token, college_id, email, or phone
    const cleanQuery = query.trim()

    // Try finding by token first
    let { data: tickets, error } = await supabase
      .from('tickets')
      .select('*')
      .or(`token.eq."${cleanQuery}",college_id.eq."${cleanQuery}",email.ilike."${cleanQuery}",phone.eq."${cleanQuery}"`)
      .order('created_at', { ascending: false })

    if (error || !tickets || tickets.length === 0) {
      return NextResponse.json({ error: 'No digital pass found matching those details.' }, { status: 404 })
    }

    // Now we have some tickets. Let's find the primary one to get the email and event_id
    const primaryTicket = tickets[0]
    
    // Fetch ALL tickets for this email and event that are APPROVED
    const { data: allApprovedTickets } = await supabase
      .from('tickets')
      .select('*')
      .eq('email', primaryTicket.email)
      .eq('event_id', primaryTicket.event_id)
      .eq('payment_status', 'APPROVED')

    if (!allApprovedTickets || allApprovedTickets.length === 0) {
      return NextResponse.json({ error: 'No approved digital passes found to resend.' }, { status: 404 })
    }

    // Pass found, dispatch email
    const { data: event } = await supabase.from('events').select('name').eq('id', primaryTicket.event_id).single()
    
    const tokens = allApprovedTickets.map((t: any) => t.token)
    await sendQRPassEmail(primaryTicket.email, primaryTicket.participant_name, event?.name || 'Utsav Event', tokens)

    // Hide part of the email for privacy in the response
    const emailParts = primaryTicket.email.split('@')
    const maskedEmail = emailParts.length === 2 
      ? `${emailParts[0].slice(0, 3)}***@${emailParts[1]}`
      : primaryTicket.email

    return NextResponse.json({ 
      success: true, 
      message: `Your pass has been securely dispatched to ${maskedEmail}`,
      email: maskedEmail
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
