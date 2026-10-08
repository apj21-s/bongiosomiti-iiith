/**
 * Who bought which plate, and what that came to.
 *
 * Nothing here touches a database. It takes ticket rows and an event's config
 * and returns numbers, which is what makes it checkable: the awkward cases -
 * a plate the event has since renamed, a ticket with no food preference at
 * all, a booking spread over several rows - are all decidable from the input.
 *
 * Two rules it keeps to:
 *
 *   A ticket's audience is worked out the same way the price was. `is_iiit`
 *   records whether anything but the guest rate applied, and audienceFor()
 *   turns that plus the address back into student, staff or guest - so the
 *   grid says what was actually charged rather than re-deciding it later
 *   against an address that may since have changed.
 *
 *   A ticket's plate is matched on the exact string in food_pref, which is
 *   what passLabel() wrote there. No parsing, no guessing at punctuation.
 */

import { audienceFor, passLabel, passTypesOf, type Audience, type EventLike } from '@/utils/pricing'

/** The columns of tickets this needs. Anything else on the row is ignored. */
export type StatTicket = {
  token?: unknown
  email?: unknown
  is_iiit?: unknown
  food_pref?: unknown
  amount?: unknown
}

/** In the order they are shown, which is cheapest rate first. */
export const AUDIENCES = ['student', 'staff', 'guest'] as const

/**
 * What each rate is called on screen.
 *
 * "Members" is the staff rate: an institute address that is not a student or
 * research one. The event editor calls the same column "Staff ₹", and the
 * page says so underneath, so the two cannot be mistaken for each other.
 */
export const AUDIENCE_LABEL: Record<Audience, string> = {
  student: 'Students',
  staff: 'Members',
  guest: 'Guests',
}

export type Cell = { passes: number; amount: number }

const empty = (): Cell => ({ passes: 0, amount: 0 })
const add = (cell: Cell, amount: number) => { cell.passes += 1; cell.amount += amount }

/** A whole number of rupees, or 0 for anything that is not usable as money. */
function money(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n) : 0
}

export type Breakdown = {
  /** Column labels: the event's own plates, then any the tickets add. */
  plates: string[]
  /**
   * Plates the tickets name but the event's own list does not. Empty when the
   * event has no list, since then there is nothing to have been dropped from.
   */
  retired: string[]
  /** cells[audience][plate] */
  cells: Record<Audience, Record<string, Cell>>
  byAudience: Record<Audience, Cell>
  byPlate: Record<string, Cell>
  total: Cell
  /** Tickets with no food preference recorded at all. */
  unplated: Cell
}

/**
 * The grid: every rate against every plate.
 *
 * The columns come from the event rather than from the tickets, so a plate
 * nobody has bought yet still gets a column and reads as a zero rather than
 * vanishing. A plate the tickets mention but the event has dropped is added
 * on the end and listed in `retired`, because quietly leaving those rows out
 * would make the totals disagree with the money actually taken.
 */
export function breakdown(event: EventLike, tickets: readonly StatTicket[]): Breakdown {
  const configured = passTypesOf(event).map(passLabel)
  const plates = [...configured]
  const retired: string[] = []

  const cells = {} as Record<Audience, Record<string, Cell>>
  const byAudience = {} as Record<Audience, Cell>
  for (const audience of AUDIENCES) {
    cells[audience] = {}
    byAudience[audience] = empty()
  }
  const byPlate: Record<string, Cell> = {}
  const total = empty()
  const unplated = empty()

  for (const ticket of tickets) {
    const amount = money(ticket.amount)
    // claimsIiit is what the booking asserted; the address is what could be
    // checked. Both were needed for the price, so both are needed here.
    const audience = audienceFor(ticket.email, Boolean(ticket.is_iiit))

    add(byAudience[audience], amount)
    add(total, amount)

    const plate = String(ticket.food_pref ?? '').trim()
    if (!plate) { add(unplated, amount); continue }

    if (!plates.includes(plate)) {
      plates.push(plate)
      // Only "retired" against an event that has a list to have dropped it
      // from. An event carrying no pass types at all has not retired
      // anything - its columns simply come from the tickets instead.
      if (configured.length > 0) retired.push(plate)
    }
    if (!cells[audience][plate]) cells[audience][plate] = empty()
    if (!byPlate[plate]) byPlate[plate] = empty()
    add(cells[audience][plate], amount)
    add(byPlate[plate], amount)
  }

  for (const plate of plates) if (!byPlate[plate]) byPlate[plate] = empty()

  return { plates, retired, cells, byAudience, byPlate, total, unplated }
}

/** One bar: a sum somebody paid, and how many paid exactly that. */
export type PaymentBar = { value: number; count: number; amount: number }

/** The registration a ticket belongs to: its token up to the underscore. */
function registrationIdOf(token: unknown): string | null {
  const value = String(token ?? '')
  if (!value) return null
  const underscore = value.indexOf('_')
  return underscore === -1 ? value : value.slice(0, underscore)
}

/**
 * What people paid, and how often.
 *
 * Per registration, not per ticket: somebody who booked three plates made one
 * payment of the three amounts together, and a histogram of ticket rows would
 * show three payments that nobody made. The registration is the part of the
 * token before the underscore, which is how the register route builds it.
 *
 * Sorted by value so the bars read left to right as a price scale.
 */
export function paymentHistogram(tickets: readonly StatTicket[]): PaymentBar[] {
  const perRegistration = new Map<string, number>()

  for (const ticket of tickets) {
    const id = registrationIdOf(ticket.token)
    if (!id) continue
    perRegistration.set(id, (perRegistration.get(id) ?? 0) + money(ticket.amount))
  }

  const counts = new Map<number, number>()
  for (const value of perRegistration.values()) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count, amount: value * count }))
    .sort((a, b) => a.value - b.value)
}
