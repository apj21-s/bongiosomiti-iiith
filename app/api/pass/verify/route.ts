import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { z } from 'zod'
import { escapeLikePattern, normaliseIdentifier } from '@/utils/db/filters'

const passVerifySchema = z.object({
  query: z.string().min(1),
})

const TICKET_SELECT = `
        *,
        event:events (
          slug,
          name,
          venue
        )
      `

// Registration IDs are 5 digits and phone numbers 10, so anything shorter than
// this cannot be a real identifier - it can only be an attempt to match broadly.
const MIN_QUERY_LENGTH = 4

const NOT_FOUND = 'No registration found matching those details.'

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const result = passVerifySchema.safeParse(json)
    if (!result.success) {
      return NextResponse.json({ error: 'Please provide a valid Phone Number or Reference Number.' }, { status: 400 })
    }

    const query = normaliseIdentifier(result.data.query)
    if (!query || query.length < MIN_QUERY_LENGTH) {
      return NextResponse.json({ error: NOT_FOUND }, { status: 404 })
    }

    const supabase = await createServiceRoleClient()
    const safeQuery = escapeLikePattern(query)

    // Registration ID (the part of the token before the underscore) first, then
    // phone number. Probed separately so no user input reaches a filter string.
    let ticket: any = null
    for (const probe of [
      { column: 'token', pattern: `${safeQuery}_%` },
      { column: 'phone', pattern: `%${safeQuery}%` },
    ]) {
      const { data, error } = await supabase
        .from('tickets')
        .select(TICKET_SELECT)
        .ilike(probe.column, probe.pattern)
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) continue
      if (data && data.length > 0) {
        ticket = data[0]
        break
      }
    }

    if (!ticket) {
      return NextResponse.json({ error: NOT_FOUND }, { status: 404 })
    }
    
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
