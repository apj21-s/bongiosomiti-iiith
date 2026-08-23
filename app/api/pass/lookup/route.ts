import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { lookupSchema } from '@/utils/schemas'

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const result = lookupSchema.safeParse(json)
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const query = result.data.query.trim().toLowerCase()
    const supabase = await createServiceRoleClient()

    // Matches token/collegeId/email/phone
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('token, college_id, email, phone, payment_status, event_id, events(name)')
      .or(`token.ilike.${query},college_id.ilike.${query},email.ilike.${query},phone.ilike.${query}`)
      .limit(1)

    if (error || !tickets || tickets.length === 0) {
      return NextResponse.json({ error: 'No pass found matching that token or ID' }, { status: 404 })
    }

    const ticket = tickets[0]
    return NextResponse.json({ 
      token: ticket.token,
      payment_status: ticket.payment_status,
      event_name: ticket.events?.name,
      masked_email: ticket.email.replace(/(.{3})(.*)(?=@)/, '$1***')
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
