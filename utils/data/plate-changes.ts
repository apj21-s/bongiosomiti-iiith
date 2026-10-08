/**
 * Moving one pass from one plate to another, and the money that follows it.
 *
 * Nothing here reads a request or a database. It takes an event, a ticket and
 * the plate somebody wants instead, and says what that costs and who has to
 * send it to whom - which is what makes the awkward part checkable.
 *
 * The awkward part is which two numbers to subtract. A ticket's `amount` is
 * what that pass actually cost after its share of any coupon, so differencing
 * two tickets' amounts would re-charge or re-refund the discount every time
 * somebody changed their mind. The difference that is owed is the difference
 * between the two plates' own prices at the rate this participant was charged
 * at; the discount they already have rides along untouched. A ₹250 veg lunch
 * bought for ₹200 under a coupon becomes a ₹350 non-veg lunch for ₹300, and
 * ₹100 changes hands - not ₹150, and not ₹50.
 */

import {
  audienceFor,
  passLabel,
  passTypesOf,
  priceOf,
  type Audience,
  type EventLike,
} from '@/utils/pricing'

/** The columns of a ticket this needs. */
export type ChangeableTicket = {
  email?: unknown
  is_iiit?: unknown
  food_pref?: unknown
  amount?: unknown
}

/** Who sends the money. NOBODY when the two plates cost the same. */
export type Payer = 'PARTICIPANT' | 'COLLECTOR' | 'NOBODY'

export type ChangeQuote = {
  fromPlate: string
  toPlate: string
  audience: Audience
  /** What the pass cost, and what it will cost: the discount is carried over. */
  fromAmount: number
  toAmount: number
  /** toAmount - fromAmount. Positive: the participant owes. */
  delta: number
  payer: Payer
  /**
   * Who has to produce the receipt: whoever receives the money. A payer can
   * only say they sent it; the receiver can show it arrived.
   */
  receiptFrom: Exclude<Payer, 'NOBODY'> | null
  /** True when the difference was given rather than worked out. */
  deltaWasGiven: boolean
}

export type QuoteFailure = { error: string }

const isFailure = (v: ChangeQuote | QuoteFailure): v is QuoteFailure =>
  (v as QuoteFailure).error !== undefined

/** A whole number of rupees, or null for anything unusable as money. */
function money(value: unknown): number | null {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.round(n)
}

/** The plates an event offers, by the label tickets are stamped with. */
export function platesOf(event: EventLike): { label: string; price: (a: Audience) => number }[] {
  return passTypesOf(event).map((pt) => ({
    label: passLabel(pt),
    price: (a: Audience) => priceOf(pt, a),
  }))
}

/**
 * What a change would cost, and who owes it.
 *
 * `givenDelta` is the super admin's own figure. It wins whenever it is
 * supplied, because they are the one who has seen the booking - and it is the
 * only way through when the plate somebody holds is one the event has since
 * stopped offering, which has no price left to subtract.
 */
export function quoteChange(
  event: EventLike,
  ticket: ChangeableTicket,
  toPlate: string,
  givenDelta?: unknown,
): ChangeQuote | QuoteFailure {
  const fromPlate = String(ticket.food_pref ?? '').trim()
  const target = String(toPlate ?? '').trim()

  if (!target) return { error: 'Choose the plate to change to.' }
  if (!fromPlate) return { error: 'This pass has no plate recorded, so there is nothing to change from.' }
  if (fromPlate === target) return { error: 'That is the plate the pass already has.' }

  const fromAmount = money(ticket.amount)
  if (fromAmount === null || fromAmount < 0) {
    return { error: 'This pass has no usable amount recorded.' }
  }

  const audience = audienceFor(ticket.email, Boolean(ticket.is_iiit))
  const plates = platesOf(event)
  const to = plates.find((p) => p.label === target)

  if (plates.length > 0 && !to) {
    return { error: `${target} is not a plate this event offers.` }
  }

  const given = givenDelta === undefined || givenDelta === null || givenDelta === ''
    ? null
    : money(givenDelta)

  let delta: number
  let deltaWasGiven: boolean

  if (given !== null) {
    delta = given
    deltaWasGiven = true
  } else {
    const from = plates.find((p) => p.label === fromPlate)
    if (!from || !to) {
      return {
        error: plates.length === 0
          ? 'This event has no plates configured, so the difference cannot be worked out. Enter the amount yourself.'
          : `${fromPlate} is no longer one of this event's plates, so the difference cannot be worked out. Enter the amount yourself.`,
      }
    }
    delta = to.price(audience) - from.price(audience)
    deltaWasGiven = false
  }

  const toAmount = fromAmount + delta
  if (toAmount < 0) {
    return { error: 'That difference would take the pass below zero.' }
  }

  const payer: Payer = delta > 0 ? 'PARTICIPANT' : delta < 0 ? 'COLLECTOR' : 'NOBODY'

  return {
    fromPlate,
    toPlate: target,
    audience,
    fromAmount,
    toAmount,
    delta,
    payer,
    // The receiver of the money is the other party to the payer.
    receiptFrom: payer === 'NOBODY' ? null : payer === 'PARTICIPANT' ? 'COLLECTOR' : 'PARTICIPANT',
    deltaWasGiven,
  }
}

export { isFailure as isQuoteFailure }

/** ₹1,250, the way every other screen writes it. */
export function rupees(n: number): string {
  return `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`
}

/**
 * The sentence the mails and the admin list both use, so the participant and
 * the super admin are reading the same words about the same change.
 */
export function describeChange(quote: ChangeQuote, who: { participant: string; collector: string }): string {
  const move = `${quote.fromPlate} to ${quote.toPlate}`
  if (quote.payer === 'NOBODY') {
    return `${move}. Both plates cost the same, so there is nothing to pay either way.`
  }
  if (quote.payer === 'PARTICIPANT') {
    return `${move}. ${rupees(quote.delta)} is payable by ${who.participant} to ${who.collector}.`
  }
  return `${move}. ${rupees(quote.delta)} is refundable by ${who.collector} to ${who.participant}.`
}
