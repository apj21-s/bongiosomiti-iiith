/**
 * What each manager is told, and when they are told nothing.
 *
 * A collector has no reason to open the admin site on a quiet day, so the
 * digest goes to them. It answers the three questions they would otherwise
 * have to sign in to ask - how much came in, how much is done, how much is
 * waiting - and names anything the super admin has rerouted to them, since
 * that is work they did not know they had.
 *
 * The counting is kept here, free of the mailer and the database, so the rule
 * about when *not* to send can be tested on its own. That rule matters more
 * than the numbers: a digest that arrives every day saying nothing teaches
 * people to ignore digests.
 */

export type DigestCounts = {
  /** Every payment routed to this manager, whatever its state. */
  total: number
  verified: number
  pending: number
  rejected: number
  /** Rerouted here by a super admin since the last digest. */
  reallocated: number
}

export type DigestTicket = {
  payment_status?: string | null
  assigned_manager_id?: string | null
  assigned_at?: string | null
}

/**
 * Counts one manager's payments.
 *
 * `since` is when they were last written to; an assignment older than that has
 * already been reported and is not news again.
 */
export function countForDigest(
  tickets: readonly DigestTicket[],
  managerId: string,
  since: Date | null
): DigestCounts {
  const counts: DigestCounts = { total: 0, verified: 0, pending: 0, rejected: 0, reallocated: 0 }

  for (const t of tickets) {
    counts.total += 1
    const status = (t.payment_status || '').toUpperCase()
    if (status === 'APPROVED') counts.verified += 1
    else if (status === 'REJECTED') counts.rejected += 1
    else counts.pending += 1

    if (t.assigned_manager_id === managerId && t.assigned_at) {
      const at = new Date(t.assigned_at)
      if (!since || at > since) counts.reallocated += 1
    }
  }

  return counts
}

/**
 * Whether this digest is worth sending.
 *
 * Nothing routed here and nothing rerouted here means there is nothing to
 * say. Saying it anyway is how a useful message becomes one people filter.
 */
export function worthSending(counts: DigestCounts): boolean {
  return counts.total > 0 || counts.reallocated > 0
}

/** A plain-language line for the subject, so the inbox list is already useful. */
export function digestSubject(counts: DigestCounts): string {
  if (counts.reallocated > 0 && counts.pending > 0) {
    return `${counts.pending} payment${counts.pending === 1 ? '' : 's'} to verify, ${counts.reallocated} newly assigned`
  }
  if (counts.reallocated > 0) {
    return `${counts.reallocated} payment${counts.reallocated === 1 ? '' : 's'} assigned to you`
  }
  if (counts.pending > 0) {
    return `${counts.pending} payment${counts.pending === 1 ? '' : 's'} waiting to be verified`
  }
  return 'All your payments are verified'
}
