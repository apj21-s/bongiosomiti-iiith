import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { lookupSchema } from '@/utils/schemas'
import { normaliseIdentifier } from '@/utils/db/filters'
import { findTicketByIdentifier } from '@/utils/db/ticket-lookup'

const NOT_FOUND = 'No pass found matching that token or ID'

function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null
  return email.replace(/(.{3})(.*)(?=@)/, '$1***')
}

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const result = lookupSchema.safeParse(json)
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    // A wildcard or control character here is never a real token or roll number,
    // so it is treated as "not found" rather than being passed to the database.
    const query = normaliseIdentifier(result.data.query)
    if (!query) {
      return NextResponse.json({ error: NOT_FOUND }, { status: 404 })
    }

    const supabase = await createServiceRoleClient()

    // Matches token/collegeId/email/phone
    const ticket = await findTicketByIdentifier(
      supabase,
      query,
      'token, college_id, email, phone, payment_status, event_id, events(name)'
    )

    if (!ticket) {
      return NextResponse.json({ error: NOT_FOUND }, { status: 404 })
    }

    return NextResponse.json({ 
      token: ticket.token,
      payment_status: ticket.payment_status,
      event_name: ticket.events?.name,
      masked_email: maskEmail(ticket.email)
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
