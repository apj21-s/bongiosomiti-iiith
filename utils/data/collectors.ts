/**
 * Which manager account a payment landed in.
 *
 * A ticket records where the money went as `receiver_upi` - the UPI id read off
 * the payer's receipt - and the manager who holds that id is the one who
 * verified and now owes an account of it. `assigned_manager_id` is the super
 * admin's override, set from the Wrong Allocations screen when a payment was
 * credited to the wrong collector; it moves who is answerable for the money
 * without rewriting where the money actually went, which is why both fields
 * exist and why this reads them in that order.
 *
 * Pure on purpose: the routes hand it the manager list they already loaded, so
 * this does no I/O and can be tested on its own.
 */

export type CollectorSource =
  /** Reassigned by a super admin; `upi` still says where the money landed. */
  | 'assigned'
  /** The UPI id on the receipt belongs to this manager. */
  | 'receipt'
  /** Reported as wrongly allocated and not yet rerouted. */
  | 'flagged'
  /** A UPI id nobody holds - a profile deleted, or its id edited since. */
  | 'orphan'
  /** No money changed hands. */
  | 'free'
  /** No receiver recorded at all. */
  | 'unknown'

export type Collector = {
  /** What a table cell shows: a manager's name, a bare UPI id, or a dash. */
  label: string
  /** The UPI id the payment was actually made to, where one was recorded. */
  upi: string | null
  username: string | null
  source: CollectorSource
  /** A line of explanation where the label alone would mislead. */
  note: string | null
}

export type CollectorManager = {
  id: string
  username: string
  upiId: string
  name?: string | null
  isActive?: boolean
}

export type CollectableTicket = {
  receiver_upi?: unknown
  assigned_manager_id?: unknown
  allocation_flagged_at?: unknown
  utr?: unknown
  amount?: unknown
}

/** The same normalisation utils/auth/managers.ts stores and compares ids with. */
function normalise(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function nameOf(manager: CollectorManager): string {
  const name = (manager.name || '').trim()
  return name || manager.username
}

export function resolveCollector(
  ticket: CollectableTicket,
  managers: CollectorManager[]
): Collector {
  const receiverUpi = String(ticket.receiver_upi ?? '').trim() || null

  // An explicit assignment wins outright, the same order scopeAllows() applies.
  const assignedId = typeof ticket.assigned_manager_id === 'string' ? ticket.assigned_manager_id : ''
  if (assignedId) {
    const manager = managers.find((m) => m.id === assignedId)
    if (manager) {
      return {
        label: nameOf(manager),
        upi: manager.upiId,
        username: manager.username,
        source: 'assigned',
        // Where it was paid, against where it was moved to - the discrepancy is
        // the whole reason anyone opens this column.
        note: receiverUpi && normalise(receiverUpi) !== normalise(manager.upiId)
          ? `reassigned from ${receiverUpi}`
          : 'reassigned',
      }
    }
    // Assigned to a profile that has since been deleted. Fall through rather
    // than claim the receipt's manager holds it, which is what the override
    // said was wrong.
    return {
      label: 'Unassigned',
      upi: receiverUpi,
      username: null,
      source: 'orphan',
      note: 'was assigned to a manager profile that no longer exists',
    }
  }

  if (ticket.allocation_flagged_at) {
    return {
      label: 'Awaiting allocation',
      upi: receiverUpi,
      username: null,
      source: 'flagged',
      note: 'a collector reported this as not theirs',
    }
  }

  if (!receiverUpi) {
    const free = normalise(ticket.utr) === 'free-pass' || Number(ticket.amount ?? 0) === 0
    return {
      label: free ? 'Free pass' : '—',
      upi: null,
      username: null,
      source: free ? 'free' : 'unknown',
      note: free ? null : 'no receiver recorded',
    }
  }

  const wanted = normalise(receiverUpi)
  const manager = managers.find((m) => normalise(m.upiId) === wanted)
  if (manager) {
    return {
      label: nameOf(manager),
      upi: manager.upiId,
      username: manager.username,
      source: 'receipt',
      // An inactive manager still collected this payment, and whoever is
      // reconciling needs to know the account is closed to new ones.
      note: manager.isActive === false ? 'profile deactivated' : null,
    }
  }

  return {
    label: receiverUpi,
    upi: receiverUpi,
    username: null,
    source: 'orphan',
    note: 'no manager profile holds this UPI id',
  }
}
