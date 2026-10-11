/**
 * How much money each manager is holding for the festival.
 *
 * Summing `amount` over approved tickets by `receiver_upi` - what the Manager
 * Profiles page used to do - is wrong in exactly the cases somebody checks
 * the figure for:
 *
 * - A payment the super admin reassigned (Wrong Allocations) still counted
 *   for the UPI id on the receipt rather than for the manager now answerable
 *   for it, and one reported as "not mine" and still awaiting a new home
 *   counted for the manager who disowned it.
 * - A plate change rewrites the pass's `amount` to the new plate's price, but
 *   what actually changed hands is the change's own `delta` and `payer`,
 *   which the super admin sets and which need not match - a goodwill swap
 *   moves no money at all. Summing the rewritten amounts recorded money that
 *   was never sent, or missed a refund that was.
 *
 * So: each approved ticket counts for the manager `resolveCollector()` names
 * (the same rule the registrations table and the payment queues use), and
 * each settled plate change corrects that manager's figure by the difference
 * between what it actually moved and what it rewrote on the passes.
 *
 * Pure: the route loads the rows, this does the arithmetic.
 */

import { resolveCollector, type CollectableTicket, type CollectorManager } from './collectors'

export type TotalsTicket = CollectableTicket & {
  id: string
  payment_status?: unknown
}

/** A row of plate_changes, as far as money is concerned. */
export type SettledChange = {
  status?: unknown
  delta?: unknown
  payer?: unknown
  passes?: unknown
}

const money = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : 0
}

/** What a settled change actually moved into (+) or out of (-) the collector's account. */
function transferred(change: SettledChange): number {
  const delta = Math.abs(money(change.delta))
  if (change.payer === 'PARTICIPANT') return delta
  if (change.payer === 'COLLECTOR') return -delta
  return 0
}

type PassMove = { ticketId?: unknown; fromAmount?: unknown; toAmount?: unknown }

/**
 * Verified money per manager id.
 *
 * `tickets` should be every ticket in scope (any status - only APPROVED ones
 * count, but a plate change is attributed through its tickets, so they must
 * be findable); `changes` the plate changes for the same scope.
 */
export function verifiedTotals(
  tickets: TotalsTicket[],
  changes: SettledChange[],
  managers: CollectorManager[],
): Map<string, number> {
  const totals = new Map<string, number>()
  const add = (managerId: string | null, amount: number) => {
    if (!managerId || amount === 0) return
    totals.set(managerId, (totals.get(managerId) || 0) + amount)
  }

  const byId = new Map<string, TotalsTicket>()
  for (const ticket of tickets) byId.set(String(ticket.id), ticket)

  const holder = (ticket: TotalsTicket | undefined): string | null => {
    if (!ticket || ticket.payment_status !== 'APPROVED') return null
    return resolveCollector(ticket, managers).managerId
  }

  for (const ticket of tickets) {
    add(holder(ticket), money(ticket.amount))
  }

  for (const change of changes) {
    if (change.status !== 'APPROVED') continue
    const passes = (Array.isArray(change.passes) ? change.passes : []) as PassMove[]
    if (passes.length === 0) continue

    // The tickets already carry the new prices; take that rewrite back out and
    // put in what was really sent instead.
    const rewritten = passes.reduce((sum, p) => sum + money(p.toAmount) - money(p.fromAmount), 0)
    const correction = transferred(change) - rewritten

    // One booking, one collector: the change is settled with whoever holds the
    // booking's money now, read off its first pass that still counts.
    const owner = passes
      .map((p) => holder(byId.get(String(p.ticketId))))
      .find((id) => id !== null) ?? null
    add(owner, correction)
  }

  return totals
}
