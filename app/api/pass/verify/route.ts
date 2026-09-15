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
      return NextResponse.json({ error: 'Please provide a valid Phone Number or Pass Token.' }, { status: 400 })
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
      .or(`token.eq."${query}",phone.eq."${query}"`)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error || !tickets || tickets.length === 0) {
      return NextResponse.json({ error: 'No registration found matching those details.' }, { status: 404 })
    }

    const ticket = tickets[0]

    return NextResponse.json({
      token: ticket.token,
      participantName: ticket.participant_name,
      email: ticket.email,
      eventName: ticket.event?.name,
      venue: ticket.event?.venue,
      utr: ticket.utr,
      amount: ticket.amount,
      payment_status: ticket.payment_status,
      status: ticket.status,
      createdAt: ticket.created_at,
      verificationSubmittedAt: ticket.created_at,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
