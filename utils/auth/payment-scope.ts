import { getAdminIdentity } from './server'
import { getManagerById, normaliseUpiId } from './managers'

/**
 * Which payments the signed-in admin may act on.
 *
 * A manager profile is limited to the payments whose receiver UPI id matches
 * its own; everyone else (the env-credential tiers and super admins) is
 * unrestricted. The manager id comes out of the signed session, so the scope
 * cannot be widened by the caller.
 *
 * This is enforced on the individual approve and reject routes as well as on
 * the list, otherwise a manager could act on somebody else's payment simply by
 * knowing its token.
 */
export type PaymentScope =
  | { ok: true; upi: string | null; managerId: string | null }
  | { ok: false; error: string; status: number }

export async function getPaymentScope(): Promise<PaymentScope> {
  const { managerId } = await getAdminIdentity()
  if (!managerId) return { ok: true, upi: null, managerId: null }

  const manager = await getManagerById(managerId)
  if (!manager) {
    return { ok: false, error: 'Manager profile is no longer active', status: 403 }
  }

  return { ok: true, upi: normaliseUpiId(manager.upiId), managerId: manager.id }
}

/**
 * The shape of a ticket, as far as routing is concerned.
 *
 * assigned_manager_id is the super admin's override, set when a wrongly
 * allocated payment is handed to the right collector. receiver_upi still says
 * where the money went and is never rewritten - the two answer different
 * questions and both are needed.
 */
export type RoutableTicket = {
  receiver_upi?: unknown
  assigned_manager_id?: unknown
  allocation_flagged_at?: unknown
}

/**
 * Whether this scope may see and act on this payment.
 *
 * In order: an explicit assignment wins outright, a payment someone has
 * reported as not theirs belongs to nobody until the super admin routes it,
 * and otherwise the UPI id decides as it always did.
 */
export function scopeAllows(
  scope: { upi: string | null; managerId?: string | null },
  receiverUpiOrTicket: unknown
): boolean {
  if (scope.upi === null) return true

  const ticket: RoutableTicket =
    receiverUpiOrTicket !== null && typeof receiverUpiOrTicket === 'object'
      ? (receiverUpiOrTicket as RoutableTicket)
      : { receiver_upi: receiverUpiOrTicket }

  const assigned = ticket.assigned_manager_id
  if (typeof assigned === 'string' && assigned !== '') {
    return Boolean(scope.managerId) && assigned === scope.managerId
  }

  // Reported as wrongly allocated and not yet rerouted: out of every queue, so
  // it cannot sit unverifiable in the wrong one while it waits.
  if (ticket.allocation_flagged_at) return false

  const receiverUpi = ticket.receiver_upi
  if (typeof receiverUpi !== 'string' || receiverUpi.trim() === '') return false
  return normaliseUpiId(receiverUpi) === scope.upi
}
