import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { z } from 'zod'

const passVerifySchema = z.object({
  query: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const result = passVerifySchema.safeParse(json)
    if (!result.success) {
      return NextResponse.json({ error: 'Please provide a valid Phone Number or Reference Number.' }, { status: 400 })
    }

    const query = result.data.query.trim()

    const supabase = await createServiceRoleClient()
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select(`
        *,
        event:events (
          slug,
          name,
          venue
        )
      `)
      .or(`token.ilike."${query}_%",phone.ilike."%${query}%"`)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error || !tickets || tickets.length === 0) {
      return NextResponse.json({ error: 'No registration found matching those details.' }, { status: 404 })
    }

    const ticket = tickets[0]
    
    // Extract registration ID (first part of the token)
    const registrationId = ticket.token.includes('_') ? ticket.token.split('_')[0] : ticket.token

    let totalAmount = ticket.amount
    let numPasses = 1
    // Return ONLY the passCode part in allTokens
    let allTokens = [ticket.token.includes('_') ? ticket.token.split('_')[1] : ticket.token]
    let redeemedCount = ticket.status === 'USED' ? 1 : 0

    if (ticket.utr && ticket.utr !== 'FREE-PASS') {
      const { data: relatedTickets } = await supabase
        .from('tickets')
        .select('amount, token, status')
        .eq('utr', ticket.utr)
      
      if (relatedTickets && relatedTickets.length > 0) {
        totalAmount = relatedTickets.reduce((sum: number, t: any) => sum + t.amount, 0)
        numPasses = relatedTickets.length
        redeemedCount = relatedTickets.filter((t: any) => t.status === 'USED').length
        allTokens = relatedTickets.map((t: any) => t.token.includes('_') ? t.token.split('_')[1] : t.token)
      }
    } else {
      // For FREE-PASS, group by email and exact creation time
      const { data: relatedTickets } = await supabase
        .from('tickets')
        .select('amount, token, status')
        .eq('email', ticket.email)
        .eq('event_id', ticket.event_id)
        .eq('created_at', ticket.created_at)
        
      if (relatedTickets && relatedTickets.length > 0) {
        totalAmount = relatedTickets.reduce((sum: number, t: any) => sum + t.amount, 0)
        numPasses = relatedTickets.length
        redeemedCount = relatedTickets.filter((t: any) => t.status === 'USED').length
        allTokens = relatedTickets.map((t: any) => t.token.includes('_') ? t.token.split('_')[1] : t.token)
      }
    }

    return NextResponse.json({
      token: registrationId,
      participantName: ticket.participant_name,
      email: ticket.email,
      eventName: ticket.event?.name,
      venue: ticket.event?.venue,
      utr: ticket.utr,
      amount: totalAmount,
      numPasses: numPasses,
      redeemedCount: redeemedCount,
      allTokens: allTokens,
      payment_status: ticket.payment_status,
      status: ticket.status,
      createdAt: ticket.created_at,
      verificationSubmittedAt: ticket.created_at,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
