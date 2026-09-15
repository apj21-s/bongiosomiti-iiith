import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { getCurrentUser } from '@/utils/auth/server'
import { scannerLookupSchema } from '@/utils/schemas'

export async function POST(request: Request) {
  try {
    // Session validation (ensure it's an admin/scanner)
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const json = await request.json()
    const result = scannerLookupSchema.safeParse(json)
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { token, eventSlug } = result.data
    const supabase = await createServiceRoleClient()

    const { data: ticket, error } = await supabase
      .from('tickets')
      .select(`
        *,
        event:events (
          slug,
          name,
          venue
        )
      `)
      .ilike('token', `%_${token.toUpperCase()}`)
      .single()

    if (error || !ticket) {
      return NextResponse.json({ 
        outcome: "INVALID", 
        message: "No pass found for this token in system records.", 
        ticket: null 
      })
    }

    const formattedTicket = {
      ...ticket,
      eventSlug: ticket.event?.slug,
      eventName: ticket.event?.name,
      venue: ticket.event?.venue,
    }

    if (eventSlug && ticket.event?.slug !== eventSlug && eventSlug !== "all") {
      return NextResponse.json({
        outcome: "BLOCKED",
        message: `This pass is registered for ${formattedTicket.eventName}, not ${eventSlug}.`,
        ticket: formattedTicket
      })
    }
    if (ticket.status === "USED") {
      return NextResponse.json({
        outcome: "ALREADY_USED",
        message: `Already checked in at ${ticket.redeemed_gate || "Gate"} on ${new Date(ticket.redeemed_at).toLocaleDateString()}.`,
        ticket: formattedTicket
      })
    }
    if (ticket.status === "PENDING_PAYMENT" || ticket.payment_status === "PENDING") {
      return NextResponse.json({
        outcome: "PAYMENT_PENDING",
        message: `Payment verification is pending for UTR ${ticket.utr || "N/A"}.`,
        ticket: formattedTicket
      })
    }
    if (ticket.status === "PAYMENT_REJECTED") {
        return NextResponse.json({
            outcome: "PAYMENT_PENDING", // Mapping to prototype's non-enterable outcome
            message: `Payment was rejected for UTR ${ticket.utr || "N/A"}.`,
            ticket: formattedTicket
        })
    }

    return NextResponse.json({ 
      outcome: "VALID", 
      message: "Pass verified & valid for entry.", 
      ticket: formattedTicket 
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
