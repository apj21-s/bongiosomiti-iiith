import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { sendQRPassEmail } from '@/utils/email'
import { getEventById } from '@/utils/data/events'
import { escapeLikePattern, normaliseIdentifier } from '@/utils/db/filters'
import { rateLimit, tooManyRequests } from '@/utils/rate-limit'

const NOT_FOUND = 'No digital pass found matching those details.'
const MIN_QUERY_LENGTH = 4

// This endpoint sends mail to whichever address the matched booking holds, so it
// is throttled per recipient to keep it from being used as a mail cannon.
const RESEND_LIMIT = 3
const RESEND_WINDOW_MS = 10 * 60 * 1000

export async function POST(request: Request) {
  try {
    const { query } = await request.json()
    const cleanQuery = normaliseIdentifier(query)
    if (!cleanQuery || cleanQuery.length < MIN_QUERY_LENGTH) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
    }

    const supabase = await createServiceRoleClient()
    const safeQuery = escapeLikePattern(cleanQuery)

    // Query could be token, college_id, email, or phone. Each is probed on its
    // own so that no user input is ever spliced into a filter string.
    let primaryTicket: any = null
    const probes: { column: string; op: 'eq' | 'ilike'; value: string }[] = [
      { column: 'token', op: 'eq', value: cleanQuery },
      { column: 'college_id', op: 'eq', value: cleanQuery },
      { column: 'email', op: 'ilike', value: safeQuery },
      { column: 'phone', op: 'ilike', value: `%${safeQuery}%` },
    ]

    for (const probe of probes) {
      const builder = supabase.from('tickets').select('*')
      const { data, error } =
        probe.op === 'eq'
          ? await builder.eq(probe.column, probe.value).order('created_at', { ascending: false }).limit(1)
          : await builder.ilike(probe.column, probe.value).order('created_at', { ascending: false }).limit(1)

      if (error) continue
      if (data && data.length > 0) {
        primaryTicket = data[0]
        break
      }
    }

    if (!primaryTicket) {
      return NextResponse.json({ error: NOT_FOUND }, { status: 404 })
    }

    const limit = rateLimit(`resend:${String(primaryTicket.email).toLowerCase()}`, RESEND_LIMIT, RESEND_WINDOW_MS)
    if (!limit.allowed) {
      return tooManyRequests(
        limit.retryAfterSeconds,
        'A pass was just sent to this registration. Please check your inbox before requesting another.'
      )
    }
    
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
    const event = getEventById(primaryTicket.event_id)
    
    const tokens = allApprovedTickets.map((t: any) => t.token)
    await sendQRPassEmail(primaryTicket.email, primaryTicket.participant_name, event?.name || 'Utsav Event', tokens)

    // Hide part of the email for privacy in the response
    const emailParts = String(primaryTicket.email || '').split('@')
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
