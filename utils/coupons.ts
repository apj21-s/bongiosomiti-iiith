/**
 * What a coupon takes off, and whether it applies at all.
 *
 * A coupon carries a discount - a flat number of rupees, or a percentage of
 * the subtotal - and up to two conditions under which it is allowed:
 *
 *   the subtotal is above a threshold, or
 *   the person is among the first N registrations for the event.
 *
 * They are alternatives, not requirements: a code set up with both is valid
 * for a big enough basket *or* for an early enough registration. A code with
 * neither applies to anybody who types it.
 *
 * Nothing here reads a request or a database. It takes a coupon, a subtotal
 * and how many registrations already exist, and returns money - so the rule
 * can be tested on its own, and so the form and the register route can reach
 * the same verdict from the same function rather than two that drift.
 */

export type CouponKind = 'fixed' | 'percent'

export type Coupon = {
  code: string
  /** Defaults to 'fixed', which is what every coupon was before this. */
  kind?: CouponKind
  /** Rupees when fixed, percent when percent. */
  value?: number
  /** What older configs called the flat amount. Read when `value` is absent. */
  discount?: number
  /**
   * Applies when the subtotal is strictly greater than this. 0 therefore
   * means "any basket that costs something", which is a useful way to write
   * "no threshold" without a second field.
   */
  minSubtotal?: number | null
  /** Applies when fewer than this many registrations exist for the event. */
  firstN?: number | null
  /** Optional ceiling on a percentage discount, in rupees. */
  maxDiscount?: number | null
}

export type CouponContext = {
  /** The basket before any discount. */
  subtotal: number
  /** Registrations already taken for this event, however many passes each. */
  registrationsSoFar: number
}

export type CouponVerdict =
  | { ok: true; code: string; discount: number; because: 'threshold' | 'early' | 'unconditional' }
  | { ok: false; code: string | null; reason: string }

/** A whole number of rupees, or null if the value is not usable as money. */
function money(value: unknown): number | null {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}

/** A non-negative whole number, or null. */
function whole(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.floor(n)
}

const normalise = (code: unknown) => String(code ?? '').trim().toUpperCase()

/** The coupon on this event with that code, whatever its case or spacing. */
export function findCoupon(event: { config?: { coupons?: unknown } | null }, submitted: unknown): Coupon | null {
  const code = normalise(submitted)
  if (!code) return null

  const list = Array.isArray(event?.config?.coupons) ? (event.config!.coupons as Coupon[]) : []
  return list.find((c) => normalise(c?.code) === code) || null
}

/**
 * What this coupon is worth on this basket, or why it is not.
 *
 * The discount can never exceed the subtotal: a coupon is a reduction, not a
 * payment, and a total below zero would be a refund nobody authorised.
 */
export function valueOf(coupon: Coupon, context: CouponContext): CouponVerdict {
  const code = String(coupon.code ?? '').trim()
  const subtotal = Math.max(0, money(context.subtotal) ?? 0)

  const threshold = whole(coupon.minSubtotal)
  const firstN = whole(coupon.firstN)

  const byThreshold = threshold !== null && subtotal > threshold
  const byEarly = firstN !== null && (whole(context.registrationsSoFar) ?? 0) < firstN
  const unconditional = threshold === null && firstN === null

  if (!unconditional && !byThreshold && !byEarly) {
    // Say which door was closed, so somebody can tell a code that is wrong
    // from one that is right but not yet - or no longer - earned.
    const reasons: string[] = []
    if (threshold !== null) reasons.push(`baskets over ₹${threshold}`)
    if (firstN !== null) reasons.push(`the first ${firstN} registrations`)
    return {
      ok: false,
      code,
      // "neither" only reads correctly when there are two doors to be outside.
      reason: `${code} applies to ${reasons.join(' or ')}. This booking is ${reasons.length > 1 ? 'neither' : 'not'}.`,
    }
  }

  const kind: CouponKind = coupon.kind === 'percent' ? 'percent' : 'fixed'
  const raw = coupon.value !== undefined && coupon.value !== null ? coupon.value : coupon.discount
  const amount = money(raw)

  if (amount === null || amount <= 0) {
    return { ok: false, code, reason: `${code} is not set up with a discount.` }
  }

  let discount: number
  if (kind === 'percent') {
    if (amount > 100) return { ok: false, code, reason: `${code} is not set up correctly.` }
    discount = Math.round((subtotal * amount) / 100)
    const cap = money(coupon.maxDiscount)
    if (cap !== null && cap > 0) discount = Math.min(discount, cap)
  } else {
    discount = amount
  }

  discount = Math.min(discount, subtotal)

  if (discount <= 0) {
    return { ok: false, code, reason: `${code} takes nothing off this booking.` }
  }

  return {
    ok: true,
    code,
    discount,
    because: unconditional ? 'unconditional' : byThreshold ? 'threshold' : 'early',
  }
}

/**
 * Looks the code up on the event and works out what it is worth.
 *
 * The one entry point the route and the preview endpoint both call, so a code
 * accepted in the form cannot be refused at the end or the other way about.
 */
export function resolveCoupon(
  event: { config?: { coupons?: unknown } | null },
  submitted: unknown,
  context: CouponContext
): CouponVerdict {
  const code = normalise(submitted)
  if (!code) return { ok: false, code: null, reason: 'Enter a coupon code first.' }

  const coupon = findCoupon(event, code)
  if (!coupon) return { ok: false, code, reason: `${code} is not a coupon for this event.` }

  return valueOf(coupon, context)
}

/** How a coupon reads in the admin list, for a summary line. */
export function describeCoupon(coupon: Coupon): string {
  const kind: CouponKind = coupon.kind === 'percent' ? 'percent' : 'fixed'
  const raw = coupon.value !== undefined && coupon.value !== null ? coupon.value : coupon.discount
  const amount = money(raw) ?? 0

  const what = kind === 'percent'
    ? `${amount}% off` + (money(coupon.maxDiscount) ? `, up to ₹${money(coupon.maxDiscount)}` : '')
    : `₹${amount} off`

  const threshold = whole(coupon.minSubtotal)
  const firstN = whole(coupon.firstN)
  const when: string[] = []
  if (threshold !== null) when.push(`over ₹${threshold}`)
  if (firstN !== null) when.push(`first ${firstN}`)

  return when.length === 0 ? what : `${what} — ${when.join(' or ')}`
}
