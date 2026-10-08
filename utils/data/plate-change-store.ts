/**
 * The waiting room for a plate change: raising one, listing them, settling one.
 *
 * The sequencing is the point of this file. A change is money that moves
 * outside the site - one person sends another a UPI transfer - so the booking
 * must not follow until somebody has seen that happen. Every function here
 * keeps to that: raising a change writes a row and sends mail and touches no
 * ticket; approving one re-reads the ticket, checks it is still the booking
 * that was quoted, and only then rewrites it.
 *
 * Pricing lives in plate-changes.ts, which has no database in it and is
 * tested on its own.
 */

import { createServiceRoleClient } from '@/utils/supabase/server'
import { getEventById } from '@/utils/data/events'
import { getManagerByUpi } from '@/utils/auth/managers'
import {
  quoteChange,
  isQuoteFailure,
  type ChangeQuote,
  type Payer,
} from '@/utils/data/plate-changes'
import {
  sendPlateChangeRequestedEmail,
  sendPlateChangeCollectorEmail,
  sendPlateChangeApprovedEmail,
  sendQRPassEmail,
  type PlateChangeMail,
} from '@/utils/email'

export type PlateChangeRow = {
  id: string
  ticket_id: string
  event_id: string | null
  from_plate: string
  to_plate: string
  from_amount: number
  to_amount: number
  delta: number
  payer: Payer
  collector_upi: string | null
  collector_email: string | null
  collector_name: string | null
  status: 'AWAITING_TRANSFER' | 'APPROVED' | 'CANCELLED'
  reason: string | null
  settlement_note: string | null
  initiated_by: string | null
  initiated_at: string
  settled_by: string | null
  settled_at: string | null
}

/** A row with enough of its ticket attached to be shown without a second trip. */
export type PlateChangeListing = PlateChangeRow & {
  ticket: {
    token: string
    participant_name: string
    email: string | null
    food_pref: string | null
    amount: number
    payment_status: string
    event_id: string | null
  } | null
  eventName: string | null
}

export type Failure = { error: string; status: number }

const fail = (error: string, status = 400): Failure => ({ error, status })
const isMissingTable = (message: unknown) =>
  /plate_changes/i.test(String(message ?? '')) || String(message ?? '').includes('PGRST205')

/** The registration a ticket belongs to: its token up to the underscore. */
function registrationIdOf(token: string): string {
  const underscore = token.indexOf('_')
  return underscore === -1 ? token : token.slice(0, underscore)
}

async function loadTicket(supabase: any, ticketId: string) {
  const { data } = await supabase
    .from('tickets')
    .select('id, token, participant_name, email, is_iiit, food_pref, amount, payment_status, receiver_upi, event_id')
    .eq('id', ticketId)
    .maybeSingle()
  return data
}

/** Everything the three mails need, assembled once. */
function mailDetails(
  ticket: any,
  eventName: string,
  quote: Pick<ChangeQuote, 'fromPlate' | 'toPlate' | 'delta' | 'payer' | 'receiptFrom'>,
  collector: { name: string; email: string | null; upi: string | null },
  reason?: string | null,
): PlateChangeMail {
  return {
    participantName: ticket.participant_name,
    participantEmail: ticket.email,
    eventName,
    fromPlate: quote.fromPlate,
    toPlate: quote.toPlate,
    delta: quote.delta,
    payer: quote.payer,
    receiptFrom: quote.receiptFrom,
    collectorName: collector.name,
    collectorEmail: collector.email,
    collectorUpi: collector.upi,
    reference: ticket.token,
    reason: reason ?? null,
  }
}

/**
 * Raise a change: price it, record it, tell both sides.
 *
 * No ticket is touched. If the mail fails the row is removed again, because a
 * change nobody was told about is one that will sit in the queue forever
 * waiting for a receipt that was never asked for.
 */
export async function raisePlateChange(input: {
  ticketId: string
  toPlate: string
  delta?: unknown
  reason?: string | null
  actor: string
}): Promise<{ change: PlateChangeRow } | Failure> {
  const supabase = await createServiceRoleClient()

  const ticket = await loadTicket(supabase, input.ticketId)
  if (!ticket) return fail('That pass does not exist.', 404)
  if (!ticket.email) return fail('That pass has no email address, so nobody could be told about the change.')
  if (ticket.payment_status !== 'APPROVED') {
    return fail('That registration is not approved yet. Settle the payment before changing the plate.')
  }

  const event = ticket.event_id ? await getEventById(ticket.event_id) : null
  if (!event) return fail('The event for that pass could not be found.', 404)

  const quote = quoteChange(event, ticket, input.toPlate, input.delta)
  if (isQuoteFailure(quote)) return fail(quote.error)

  const manager = await getManagerByUpi(ticket.receiver_upi)
  const collector = {
    name: manager?.name || manager?.username || 'the organisers',
    email: manager?.email ?? null,
    upi: manager?.upiId ?? (ticket.receiver_upi || null),
  }

  const { data, error } = await supabase
    .from('plate_changes')
    .insert({
      ticket_id: ticket.id,
      event_id: ticket.event_id,
      from_plate: quote.fromPlate,
      to_plate: quote.toPlate,
      from_amount: quote.fromAmount,
      to_amount: quote.toAmount,
      delta: quote.delta,
      payer: quote.payer,
      collector_upi: collector.upi,
      collector_email: collector.email,
      collector_name: collector.name,
      reason: input.reason || null,
      initiated_by: input.actor,
    })
    .select()
    .single()

  if (error || !data) {
    if (isMissingTable(error?.message)) {
      return fail('Run supabase/plate-changes.sql first.', 503)
    }
    // The partial unique index: one unsettled change per pass.
    if (/plate_changes_one_open_per_ticket/i.test(error?.message || '')) {
      return fail('That pass already has a change waiting. Settle or cancel it first.', 409)
    }
    return fail(error?.message || 'The change could not be recorded.', 500)
  }

  const details = mailDetails(ticket, event.name, quote, collector, input.reason)

  try {
    await sendPlateChangeRequestedEmail(details)
  } catch (e) {
    // Nobody was told, so there is nothing to wait for. Take the row back out
    // rather than leave a change hanging over a pass.
    await supabase.from('plate_changes').delete().eq('id', data.id)
    return fail(e instanceof Error ? e.message : 'The participant could not be emailed, so nothing was changed.', 502)
  }

  // Best effort: the participant's mail already copies them in, so a failure
  // here is a missing nudge rather than a missing notice.
  await sendPlateChangeCollectorEmail(details).catch((e) =>
    console.error('[plate-change] collector notice failed:', e instanceof Error ? e.message : e))

  return { change: data as PlateChangeRow }
}

/** The queue, newest first, with each row's ticket and event attached. */
export async function listPlateChanges(status?: string): Promise<PlateChangeListing[] | Failure> {
  const supabase = await createServiceRoleClient()

  let query = supabase
    .from('plate_changes')
    .select('*, ticket:tickets(token, participant_name, email, food_pref, amount, payment_status, event_id)')
    .order('initiated_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    if (isMissingTable(error.message)) return fail('Run supabase/plate-changes.sql first.', 503)
    return fail(error.message, 500)
  }

  const rows = (data || []) as PlateChangeListing[]
  const names = new Map<string, string>()
  for (const row of rows) {
    const id = row.event_id
    if (!id || names.has(id)) continue
    const event = await getEventById(id)
    names.set(id, event?.name || '')
  }
  for (const row of rows) row.eventName = row.event_id ? names.get(row.event_id) || null : null

  return rows
}

/**
 * Settle a change: apply it to the ticket and tell everyone.
 *
 * The ticket is re-read and checked against what was quoted before anything is
 * written. Between raising a change and approving it somebody may have changed
 * the same pass another way, and applying a stale quote would overwrite that
 * silently and charge against a plate the pass no longer has.
 */
export async function approvePlateChange(input: {
  id: string
  note?: string | null
  actor: string
}): Promise<{ change: PlateChangeRow } | Failure> {
  const supabase = await createServiceRoleClient()

  const { data: change } = await supabase.from('plate_changes').select('*').eq('id', input.id).maybeSingle()
  if (!change) return fail('That change does not exist.', 404)
  if (change.status !== 'AWAITING_TRANSFER') {
    return fail(`That change is already ${String(change.status).toLowerCase().replace('_', ' ')}.`, 409)
  }

  const ticket = await loadTicket(supabase, change.ticket_id)
  if (!ticket) return fail('The pass this change belongs to no longer exists.', 404)

  if (String(ticket.food_pref ?? '') !== change.from_plate) {
    return fail(
      `This pass is now ${ticket.food_pref || 'without a plate'}, not ${change.from_plate}. ` +
      'Cancel this change and raise it again against what the pass actually has.',
      409,
    )
  }
  if (Number(ticket.amount) !== Number(change.from_amount)) {
    return fail(
      `This pass is now ₹${ticket.amount}, not the ₹${change.from_amount} this change was priced against. ` +
      'Cancel it and raise it again.',
      409,
    )
  }

  const { error: ticketError } = await supabase
    .from('tickets')
    .update({ food_pref: change.to_plate, amount: change.to_amount })
    .eq('id', ticket.id)

  if (ticketError) return fail(ticketError.message || 'The pass could not be updated.', 500)

  const { data: settled, error } = await supabase
    .from('plate_changes')
    .update({
      status: 'APPROVED',
      settled_by: input.actor,
      settled_at: new Date().toISOString(),
      settlement_note: input.note || null,
    })
    .eq('id', change.id)
    .select()
    .single()

  if (error) {
    // The ticket moved but the row did not. Put the ticket back, so the two
    // cannot disagree about what this pass admits to.
    await supabase
      .from('tickets')
      .update({ food_pref: change.from_plate, amount: change.from_amount })
      .eq('id', ticket.id)
    return fail(error.message || 'The change could not be marked settled; the pass was put back.', 500)
  }

  const event = change.event_id ? await getEventById(change.event_id) : null
  const details = mailDetails(
    ticket,
    event?.name || 'the event',
    {
      fromPlate: change.from_plate,
      toPlate: change.to_plate,
      delta: change.delta,
      payer: change.payer,
      receiptFrom: change.payer === 'NOBODY' ? null : change.payer === 'PARTICIPANT' ? 'COLLECTOR' : 'PARTICIPANT',
    },
    { name: change.collector_name || 'the organisers', email: change.collector_email, upi: change.collector_upi },
    change.reason,
  )

  await sendPlateChangeApprovedEmail({ ...details, settlementNote: input.note || null })
    .catch((e) => console.error('[plate-change] confirmation failed:', e instanceof Error ? e.message : e))

  // The passes in their inbox are captioned with the old plate, so send the
  // set again now that one of them admits to something else.
  await resendPassesFor(supabase, ticket.token, event?.name || 'the event')
    .catch((e) => console.error('[plate-change] pass resend failed:', e instanceof Error ? e.message : e))

  return { change: settled as PlateChangeRow }
}

/** Every pass in this booking, re-sent with the captions it has now. */
async function resendPassesFor(supabase: any, token: string, eventName: string) {
  const registration = registrationIdOf(token)
  const { data } = await supabase
    .from('tickets')
    .select('token, participant_name, email, food_pref')
    .like('token', `${registration}_%`)
    .eq('payment_status', 'APPROVED')

  const tickets = (data || []) as { token: string; participant_name: string; email: string; food_pref: string | null }[]
  if (tickets.length === 0) return

  const ordered = [...tickets].sort((a, b) => a.token.localeCompare(b.token))
  await sendQRPassEmail(
    ordered[0].email,
    ordered[0].participant_name,
    eventName,
    ordered.map((t) => t.token),
    ordered.map((t) => t.food_pref || ''),
  )
}

/** Call a change off. Only one that is still waiting can be called off. */
export async function cancelPlateChange(input: {
  id: string
  note?: string | null
  actor: string
}): Promise<{ change: PlateChangeRow } | Failure> {
  const supabase = await createServiceRoleClient()

  const { data, error } = await supabase
    .from('plate_changes')
    .update({
      status: 'CANCELLED',
      settled_by: input.actor,
      settled_at: new Date().toISOString(),
      settlement_note: input.note || null,
    })
    .eq('id', input.id)
    .eq('status', 'AWAITING_TRANSFER')
    .select()
    .maybeSingle()

  if (error) return fail(error.message, 500)
  if (!data) return fail('That change is not waiting, so there is nothing to cancel.', 409)

  return { change: data as PlateChangeRow }
}
