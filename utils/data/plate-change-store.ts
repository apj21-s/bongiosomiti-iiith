/**
 * Finding a registration, changing it, and settling the money that follows.
 *
 * The sequencing is the point of this file. A change is money that moves
 * outside the site - one person sends another a UPI transfer - so the booking
 * must not follow until somebody has seen that happen. Raising a change writes
 * a row and sends mail and touches no ticket; approving one re-reads every
 * pass, checks each is still what was quoted, and only then rewrites them.
 *
 * What a change may say is deliberately not constrained. The plate can be any
 * text, the amount any number, and the direction is chosen rather than
 * derived - a super admin fixing somebody's booking at a desk knows things the
 * price table does not, and the suggestion in plate-changes.ts is there to be
 * overridden. What is constrained is the order of events, which is the part
 * that protects the participant.
 */

import { createServiceRoleClient } from '@/utils/supabase/server'
import { getEventById } from '@/utils/data/events'
import { getManagerByUpi, listManagers } from '@/utils/auth/managers'
import {
  sendPlateChangeRequestedEmail,
  sendPlateChangeCollectorEmail,
  sendPlateChangeApprovedEmail,
  sendQRPassEmail,
  type PlateChangeMail,
  type PlateMove,
} from '@/utils/email'

export type Payer = 'PARTICIPANT' | 'COLLECTOR' | 'NOBODY'

/** One pass moving, as stored in plate_changes.passes. */
export type PassChange = {
  ticketId: string
  token: string
  fromPlate: string
  toPlate: string
  fromAmount: number
  toAmount: number
}

export type PlateChangeRow = {
  id: string
  registration_id: string
  event_id: string | null
  participant_name: string | null
  participant_email: string | null
  collector_upi: string | null
  collector_email: string | null
  collector_name: string | null
  passes: PassChange[]
  delta: number
  payer: Payer
  status: 'AWAITING_TRANSFER' | 'APPROVED' | 'CANCELLED'
  reason: string | null
  settlement_note: string | null
  initiated_by: string | null
  initiated_at: string
  settled_by: string | null
  settled_at: string | null
  eventName?: string | null
}

/** A booking as the super admin needs to see it before touching anything. */
export type FoundRegistration = {
  id: string
  eventId: string | null
  eventName: string | null
  participantName: string
  participantEmail: string
  collector: { upi: string | null; email: string | null; name: string }
  total: number
  passes: { id: string; token: string; plate: string; amount: number; paymentStatus: string }[]
}

export type Failure = { error: string; status: number }

const fail = (error: string, status = 400): Failure => ({ error, status })
const isMissingTable = (message: unknown) =>
  /plate_changes/i.test(String(message ?? '')) || String(message ?? '').includes('PGRST205')

/** The registration a ticket belongs to: its token up to the underscore. */
export function registrationIdOf(token: unknown): string {
  const value = String(token ?? '')
  const underscore = value.indexOf('_')
  return underscore === -1 ? value : value.slice(0, underscore)
}

const money = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : 0
}

/**
 * Find a booking by whatever the super admin has to hand.
 *
 * Any of: the participant's address or name, the registration number, a single
 * pass code, or the collector's address - which is matched by resolving it to
 * the UPI id that manager collects at, because that is what the tickets
 * actually carry. Somebody ringing up about a change rarely has the one
 * identifier a system would have chosen.
 */
export async function findRegistrations(query: string): Promise<FoundRegistration[] | Failure> {
  const q = String(query ?? '').trim()
  if (q.length < 2) return fail('Type at least two characters to search for.')

  const supabase = await createServiceRoleClient()
  const like = `%${q.replace(/[%,()]/g, '')}%`

  // A collector is searched for by their own address, but tickets only know
  // the UPI id the money went to.
  const managers = await listManagers()
  const collectorUpis = managers
    .filter((m) => (m.email || '').toLowerCase().includes(q.toLowerCase()) ||
                   (m.name || '').toLowerCase().includes(q.toLowerCase()) ||
                   m.username.toLowerCase().includes(q.toLowerCase()))
    .map((m) => m.upiId)

  const filters = [
    `email.ilike.${like}`,
    `participant_name.ilike.${like}`,
    `token.ilike.${like}`,
  ]
  if (collectorUpis.length > 0) {
    filters.push(...collectorUpis.map((upi) => `receiver_upi.ilike.%${upi.replace(/[%,()]/g, '')}%`))
  }

  const { data, error } = await supabase
    .from('tickets')
    .select('id, token, participant_name, email, food_pref, amount, payment_status, receiver_upi, event_id')
    .or(filters.join(','))
    .limit(400)

  if (error) return fail(error.message, 500)

  const rows = (data || []) as any[]
  if (rows.length === 0) return []

  // One booking may have matched on only one of its passes; pull the rest in
  // so the super admin is looking at the whole thing.
  const ids = Array.from(new Set(rows.map((r) => registrationIdOf(r.token)))).filter(Boolean).slice(0, 40)
  const { data: siblings } = await supabase
    .from('tickets')
    .select('id, token, participant_name, email, food_pref, amount, payment_status, receiver_upi, event_id')
    .or(ids.map((id) => `token.ilike.${id.replace(/[%,()]/g, '')}%`).join(','))
    .limit(800)

  const all = (siblings && siblings.length > 0 ? siblings : rows) as any[]

  const grouped = new Map<string, any[]>()
  for (const row of all) {
    const id = registrationIdOf(row.token)
    if (!id || !ids.includes(id)) continue
    const bucket = grouped.get(id)
    if (bucket) bucket.push(row)
    else grouped.set(id, [row])
  }

  const eventNames = new Map<string, string>()
  const out: FoundRegistration[] = []

  for (const [id, group] of grouped) {
    const ordered = group.sort((a, b) => String(a.token).localeCompare(String(b.token)))
    const first = ordered[0]

    const eventId = first.event_id || null
    if (eventId && !eventNames.has(eventId)) {
      const event = await getEventById(eventId)
      eventNames.set(eventId, event?.name || '')
    }

    const manager = await getManagerByUpi(first.receiver_upi)
    out.push({
      id,
      eventId,
      eventName: eventId ? eventNames.get(eventId) || null : null,
      participantName: String(first.participant_name || '').trim() || 'Unknown',
      participantEmail: String(first.email || '').trim(),
      collector: {
        upi: manager?.upiId ?? (first.receiver_upi || null),
        email: manager?.email ?? null,
        name: manager?.name || manager?.username || 'the organisers',
      },
      total: ordered.reduce((sum, t) => sum + money(t.amount), 0),
      passes: ordered.map((t) => ({
        id: t.id,
        token: t.token,
        plate: String(t.food_pref || '').trim(),
        amount: money(t.amount),
        paymentStatus: String(t.payment_status || ''),
      })),
    })
  }

  return out.sort((a, b) => a.participantName.localeCompare(b.participantName))
}

function mailDetails(
  row: Pick<PlateChangeRow,
    'participant_name' | 'participant_email' | 'registration_id' | 'delta' | 'payer' |
    'collector_name' | 'collector_email' | 'collector_upi' | 'reason' | 'passes'>,
  eventName: string,
): PlateChangeMail {
  const moves: PlateMove[] = row.passes.map((p) => ({ fromPlate: p.fromPlate, toPlate: p.toPlate }))
  return {
    participantName: row.participant_name || 'there',
    participantEmail: row.participant_email || '',
    eventName,
    moves,
    delta: row.delta,
    payer: row.payer,
    receiptFrom: row.payer === 'NOBODY' || row.delta === 0
      ? null
      : row.payer === 'PARTICIPANT' ? 'COLLECTOR' : 'PARTICIPANT',
    collectorName: row.collector_name || 'the organisers',
    collectorEmail: row.collector_email,
    collectorUpi: row.collector_upi,
    reference: row.registration_id,
    reason: row.reason,
  }
}

/**
 * Raise a change: record what is wanted, tell both sides.
 *
 * No ticket is touched. If the participant could not be told, the row is taken
 * back out - a change nobody was told about would sit in the queue forever
 * waiting for a receipt that was never asked for.
 */
export async function raisePlateChange(input: {
  registrationId: string
  /** Only the passes that actually move. */
  passes: { ticketId: string; toPlate: string; toAmount: unknown }[]
  delta: unknown
  payer: Payer
  reason?: string | null
  actor: string
}): Promise<{ change: PlateChangeRow } | Failure> {
  const supabase = await createServiceRoleClient()

  if (input.passes.length === 0) return fail('Nothing was changed on this registration.')

  const { data: ticketRows } = await supabase
    .from('tickets')
    .select('id, token, participant_name, email, food_pref, amount, payment_status, receiver_upi, event_id')
    .in('id', input.passes.map((p) => p.ticketId))

  const tickets = (ticketRows || []) as any[]
  if (tickets.length !== input.passes.length) return fail('One of those passes could not be found.', 404)

  const stray = tickets.find((t) => registrationIdOf(t.token) !== input.registrationId)
  if (stray) return fail('Those passes are not all from the same registration.')

  const passes: PassChange[] = []
  for (const wanted of input.passes) {
    const ticket = tickets.find((t) => t.id === wanted.ticketId)
    const toPlate = String(wanted.toPlate ?? '').trim()
    if (!toPlate) return fail('Every pass being changed needs a plate.')

    const fromPlate = String(ticket.food_pref || '').trim()
    const toAmount = money(wanted.toAmount)
    if (toAmount < 0) return fail('A pass cannot be set below zero.')

    if (toPlate === fromPlate && toAmount === money(ticket.amount)) continue

    passes.push({
      ticketId: ticket.id,
      token: ticket.token,
      fromPlate,
      toPlate,
      fromAmount: money(ticket.amount),
      toAmount,
    })
  }

  if (passes.length === 0) return fail('Nothing was changed on this registration.')

  const first = tickets[0]
  const event = first.event_id ? await getEventById(first.event_id) : null
  const manager = await getManagerByUpi(first.receiver_upi)

  const delta = money(input.delta)
  const payer: Payer = delta === 0 ? 'NOBODY' : input.payer === 'COLLECTOR' ? 'COLLECTOR' : 'PARTICIPANT'

  const { data, error } = await supabase
    .from('plate_changes')
    .insert({
      registration_id: input.registrationId,
      event_id: first.event_id,
      participant_name: first.participant_name,
      participant_email: first.email,
      collector_upi: manager?.upiId ?? (first.receiver_upi || null),
      collector_email: manager?.email ?? null,
      collector_name: manager?.name || manager?.username || 'the organisers',
      passes,
      delta: Math.abs(delta),
      payer,
      reason: input.reason || null,
      initiated_by: input.actor,
    })
    .select()
    .single()

  if (error || !data) {
    if (isMissingTable(error?.message)) return fail('Run supabase/plate-changes.sql first.', 503)
    if (/one_open_per_registration/i.test(error?.message || '')) {
      return fail('This registration already has a change waiting. Settle or cancel it first.', 409)
    }
    return fail(error?.message || 'The change could not be recorded.', 500)
  }

  const row = data as PlateChangeRow
  if (!row.participant_email) {
    await supabase.from('plate_changes').delete().eq('id', row.id)
    return fail('That registration has no email address, so nobody could be told about the change.')
  }

  const details = mailDetails(row, event?.name || 'the event')

  try {
    await sendPlateChangeRequestedEmail(details)
  } catch (e) {
    await supabase.from('plate_changes').delete().eq('id', row.id)
    return fail(e instanceof Error ? e.message : 'The participant could not be emailed, so nothing was changed.', 502)
  }

  await sendPlateChangeCollectorEmail(details).catch((e) =>
    console.error('[plate-change] collector notice failed:', e instanceof Error ? e.message : e))

  return { change: row }
}

/** The queue, newest first. */
export async function listPlateChanges(status?: string): Promise<PlateChangeRow[] | Failure> {
  const supabase = await createServiceRoleClient()

  let query = supabase.from('plate_changes').select('*').order('initiated_at', { ascending: false })
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    if (isMissingTable(error.message)) return fail('Run supabase/plate-changes.sql first.', 503)
    return fail(error.message, 500)
  }

  const rows = (data || []) as PlateChangeRow[]
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
 * Settle a change: apply every pass in it and tell everyone.
 *
 * Each ticket is re-read and checked against what was recorded before anything
 * is written. Between raising a change and approving it somebody may have
 * altered the same booking another way, and applying a stale record would
 * overwrite that silently.
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

  const passes = (change.passes || []) as PassChange[]
  const { data: current } = await supabase
    .from('tickets')
    .select('id, token, food_pref, amount, participant_name, email, event_id')
    .in('id', passes.map((p) => p.ticketId))

  const tickets = (current || []) as any[]

  for (const pass of passes) {
    const ticket = tickets.find((t) => t.id === pass.ticketId)
    if (!ticket) {
      return fail(`One of the passes in this change no longer exists (${pass.token}). Cancel it and raise it again.`, 409)
    }
    if (String(ticket.food_pref || '') !== pass.fromPlate || money(ticket.amount) !== pass.fromAmount) {
      return fail(
        `${pass.token} has changed since this was raised - it is now ${ticket.food_pref || 'without a plate'} ` +
        `at ₹${money(ticket.amount)}, not ${pass.fromPlate || 'without a plate'} at ₹${pass.fromAmount}. ` +
        'Cancel this change and raise it again against what the booking actually has.',
        409,
      )
    }
  }

  // Applied one by one; if one fails the ones already done are put back, so a
  // booking is never left half changed.
  const applied: PassChange[] = []
  for (const pass of passes) {
    const { error } = await supabase
      .from('tickets')
      .update({ food_pref: pass.toPlate, amount: pass.toAmount })
      .eq('id', pass.ticketId)

    if (error) {
      for (const done of applied) {
        await supabase
          .from('tickets')
          .update({ food_pref: done.fromPlate, amount: done.fromAmount })
          .eq('id', done.ticketId)
      }
      return fail(error.message || 'The booking could not be updated; nothing was changed.', 500)
    }
    applied.push(pass)
  }

  const { data: settled, error: settleError } = await supabase
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

  if (settleError) {
    for (const done of applied) {
      await supabase
        .from('tickets')
        .update({ food_pref: done.fromPlate, amount: done.fromAmount })
        .eq('id', done.ticketId)
    }
    return fail(settleError.message || 'The change could not be marked settled; the booking was put back.', 500)
  }

  const event = change.event_id ? await getEventById(change.event_id) : null
  const details = mailDetails(change as PlateChangeRow, event?.name || 'the event')

  await sendPlateChangeApprovedEmail({ ...details, settlementNote: input.note || null })
    .catch((e) => console.error('[plate-change] confirmation failed:', e instanceof Error ? e.message : e))

  // The passes in their inbox are captioned with the old plates.
  await resendPasses(supabase, change.registration_id, event?.name || 'the event')
    .catch((e) => console.error('[plate-change] pass resend failed:', e instanceof Error ? e.message : e))

  return { change: settled as PlateChangeRow }
}

/** Every pass in this booking, re-sent with the captions it has now. */
async function resendPasses(supabase: any, registrationId: string, eventName: string) {
  const { data } = await supabase
    .from('tickets')
    .select('token, participant_name, email, food_pref')
    .like('token', `${registrationId}_%`)
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
