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
  | { ok: true; upi: string | null }
  | { ok: false; error: string; status: number }

export async function getPaymentScope(): Promise<PaymentScope> {
  const { managerId } = await getAdminIdentity()
  if (!managerId) return { ok: true, upi: null }

  const manager = await getManagerById(managerId)
  if (!manager) {
    return { ok: false, error: 'Manager profile is no longer active', status: 403 }
  }

  return { ok: true, upi: normaliseUpiId(manager.upiId) }
}

/** True when the scope permits acting on a ticket with this receiver UPI id. */
export function scopeAllows(scope: { upi: string | null }, receiverUpi: unknown): boolean {
  if (scope.upi === null) return true
  if (typeof receiverUpi !== 'string' || receiverUpi.trim() === '') return false
  return normaliseUpiId(receiverUpi) === scope.upi
}
