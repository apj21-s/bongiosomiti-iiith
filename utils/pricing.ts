/**
 * What a registration costs, decided in one place.
 *
 * The form and the register route were each working it out on their own and
 * disagreeing: with pass types configured the form charged
 * `sum(count x pass price)` while the route charged `passes x one flat rate`,
 * so a basket of two at 350 was shown as 700 and recorded as 500. The number
 * that matters is the server's, and the number people see is the form's, so
 * they have to come from the same function.
 *
 * Nothing here reads a request or a database. It takes an event's config, a
 * basket and who is buying, and returns money - which is what makes it
 * testable, and what lets the server recompute the total from the verified
 * email rather than trusting an amount posted by the browser.
 */

import { isIiitEmail } from './email-verification'

/**
 * Who is buying.
 *
 * The institute issues student and research addresses under their own
 * subdomains, and everybody else on the campus under the others. That is the
 * whole of the distinction: 'staff' here means "of the institute, but not a
 * student", not a job title.
 */
export type Audience = 'student' | 'staff' | 'guest'

/** The subdomains that mean the holder is studying or researching here. */
export const STUDENT_SUBDOMAINS = ['students', 'research'] as const

export type PassType = {
  name: string
  /** Groups the pass into a section - 'Breakfast', 'Lunch'. Optional. */
  meal?: string
  /** A single price, for events configured before per-audience pricing. */
  price?: number
  /** Per-audience prices. Any missing one falls back to `price`. */
  prices?: Partial<Record<Audience, number>>
}

/**
 * What a pass type is counted under.
 *
 * Not the name: "Veg" under Breakfast and "Veg" under Lunch are two different
 * plates, and an admin naming them both "Veg" is the natural thing to do -
 * the section already says which meal it is. Keying the basket on the name
 * alone made them one counter wearing two hats, so adding a breakfast added a
 * lunch as well.
 *
 * A pass with no meal keys on its name, so an event configured before the
 * sections existed counts exactly as it did.
 */
export function keyOf(passType: PassType): string {
  return passType.meal && passType.meal.trim() !== ''
    ? `${passType.meal}|${passType.name}`
    : passType.name
}

export type EventLike = {
  price?: number
  config?: {
    pass_types?: PassType[] | null
    /** Per-audience prices for events with no pass types. */
    audience_prices?: Partial<Record<Audience, number>> | null
    [k: string]: unknown
  } | null
}

/**
 * Which audience a *verified* address belongs to.
 *
 * `claimsIiit` is what the visitor said about themselves; the address is what
 * can be checked. Both have to agree before anything but the guest rate
 * applies - somebody who registers as a guest is a guest whatever their
 * address, and somebody who claims the institute without an institute address
 * is a guest too.
 */
export function audienceFor(email: unknown, claimsIiit: boolean): Audience {
  if (!claimsIiit) return 'guest'
  if (!isIiitEmail(email)) return 'guest'

  const address = String(email).trim().toLowerCase()
  const domain = address.slice(address.indexOf('@') + 1)
  const sub = domain.endsWith('.iiit.ac.in')
    ? domain.slice(0, -'.iiit.ac.in'.length)
    : null

  return sub !== null && (STUDENT_SUBDOMAINS as readonly string[]).includes(sub)
    ? 'student'
    : 'staff'
}

/** A whole number of rupees, or null when the value is not usable as money. */
function money(value: unknown): number | null {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}

/**
 * What one pass of this type costs this audience.
 *
 * Falls back through per-audience price, then the pass's single price, then
 * nothing. An event configured before per-audience pricing therefore charges
 * everybody its one price, which is what it did before.
 */
export function priceOf(passType: PassType, audience: Audience): number {
  const perAudience = passType.prices ? money(passType.prices[audience]) : null
  if (perAudience !== null) return perAudience

  const single = money(passType.price)
  return single === null ? 0 : single
}

/** The pass types an event offers, always as an array. */
export function passTypesOf(event: EventLike): PassType[] {
  const types = event.config?.pass_types
  return Array.isArray(types) && types.length > 0 ? types : []
}

/**
 * Pass types in the order they should appear, grouped into their sections.
 *
 * A pass with no `meal` goes into one unnamed group, which is how an event
 * configured before the Breakfast/Lunch split still renders as a single list.
 */
export function groupByMeal(passTypes: readonly PassType[]): { meal: string | null; types: PassType[] }[] {
  const groups: { meal: string | null; types: PassType[] }[] = []

  for (const pt of passTypes) {
    const meal = pt.meal && pt.meal.trim() !== '' ? pt.meal : null
    const existing = groups.find((g) => g.meal === meal)
    if (existing) existing.types.push(pt)
    else groups.push({ meal, types: [pt] })
  }

  return groups
}

export type Basket = {
  /** Counts by pass type name, for events that have pass types. */
  selections?: Record<string, number> | null
  /** How many passes, for events that do not. */
  numPasses?: number
}

/** One pass, as it will be issued: which plate it is and what it cost. */
export type IssuedPass = {
  /** The pass type's name, e.g. "Veg". */
  name: string
  /** Its section, e.g. "Breakfast". Null when the event has no sections. */
  meal: string | null
  /** What to print on the pass: "Breakfast · Veg", or just "Veg". */
  label: string
  price: number
}

/**
 * The basket as individual passes, one entry each.
 *
 * A booking of one breakfast and two lunches is three passes, and each is
 * admitted to a different thing - so each has to carry its own plate rather
 * than the whole order. Every ticket used to be stamped with the joined
 * summary of the lot ("1 Breakfast Veg, 2 Lunch Non-Veg"), which tells
 * whoever is serving nothing about the pass in front of them.
 *
 * The price travels with the pass for the same reason: splitting the total
 * evenly across passes is wrong the moment two plates cost different amounts.
 */
export function expandToPasses(event: EventLike, basket: Basket, audience: Audience): IssuedPass[] {
  const { lines } = quote(event, basket, audience)
  const passes: IssuedPass[] = []

  for (const line of lines) {
    for (let i = 0; i < line.count; i += 1) {
      passes.push({
        name: line.name,
        meal: line.meal,
        label: passLabel(line),
        price: line.each,
      })
    }
  }

  return passes
}

/**
 * What a pass of this type says it is: "Breakfast · Veg", or just "Veg" when
 * the event has no sections - and not "Breakfast · Breakfast Veg" for somebody
 * who put the meal in the name as well as in the field. This is what lands in
 * tickets.food_pref, so it is also how a ticket is matched back to its plate.
 */
export function passLabel(passType: { name: string; meal?: string | null }): string {
  const meal = passType.meal && passType.meal.trim() !== '' ? passType.meal : null
  const alreadyNamed = meal ? passType.name.toLowerCase().startsWith(meal.toLowerCase()) : false
  return meal && !alreadyNamed ? `${meal} · ${passType.name}` : passType.name
}

/**
 * A booking's passes in the order a mail lists them: grouped by plate, in the
 * order the event offers its plates, then by token.
 *
 * Grouped, because "Plate 2 of 3" only reads naturally next to plates 1 and 3;
 * the tokens are random, and ordering by them alone scattered one booking's
 * breakfasts between its lunches. Stable, because a ticket's plate and token
 * never change - so the first mail, the approval and any resend number every
 * plate the same way. A plate the event no longer offers (renamed since) and
 * a pass with no plate go last, still in token order.
 */
export function inPassOrder<T extends { token?: unknown; food_pref?: unknown }>(
  event: EventLike | null | undefined,
  tickets: readonly T[]
): T[] {
  const rank = new Map<string, number>()
  for (const passType of event ? passTypesOf(event) : []) {
    const label = passLabel(passType)
    if (!rank.has(label)) rank.set(label, rank.size)
  }
  const rankOf = (ticket: T) => rank.get(String(ticket.food_pref ?? '')) ?? rank.size
  return [...tickets].sort((a, b) => rankOf(a) - rankOf(b) || String(a.token).localeCompare(String(b.token)))
}

export type Quote = {
  subtotal: number
  /** Total passes, whichever way the event is configured. */
  passes: number
  /** One line per pass type actually chosen, for showing a breakdown. */
  lines: { name: string; meal: string | null; count: number; each: number; total: number }[]
}

/**
 * What the basket comes to, before any coupon.
 *
 * A free event stays free whatever the config says, which is the one rule
 * that outranks the price table.
 */
export function quote(event: EventLike, basket: Basket, audience: Audience): Quote {
  const types = passTypesOf(event)
  const eventIsFree = money(event.price) === 0

  if (types.length > 0) {
    const selections = basket.selections || {}
    const lines = types
      .map((pt) => {
        const count = Math.max(0, Math.trunc(Number(selections[keyOf(pt)]) || 0))
        const each = eventIsFree ? 0 : priceOf(pt, audience)
        return { name: pt.name, meal: pt.meal ?? null, count, each, total: count * each }
      })
      .filter((l) => l.count > 0)

    return {
      subtotal: lines.reduce((sum, l) => sum + l.total, 0),
      passes: lines.reduce((sum, l) => sum + l.count, 0),
      lines,
    }
  }

  // No pass types: one rate for the whole event, per audience.
  const passes = Math.max(0, Math.trunc(Number(basket.numPasses) || 0))
  const configured = event.config?.audience_prices
    ? money(event.config.audience_prices[audience])
    : null
  const each = eventIsFree ? 0 : configured !== null ? configured : (money(event.price) ?? 0)

  return {
    subtotal: passes * each,
    passes,
    lines: passes > 0 ? [{ name: 'Pass', meal: null, count: passes, each, total: passes * each }] : [],
  }
}
