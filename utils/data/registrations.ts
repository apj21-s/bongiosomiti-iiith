import { createServiceRoleClient } from '@/utils/supabase/server'

/** The registration a ticket belongs to: its token up to the underscore. */
function registrationIdOf(token: unknown): string | null {
  const value = String(token ?? '')
  if (!value) return null
  const underscore = value.indexOf('_')
  return underscore === -1 ? value : value.slice(0, underscore)
}

/**
 * How many registrations an event already has.
 *
 * Registrations, not tickets. A booking of three plates is three ticket rows
 * that share one registration id, and a coupon offered to "the first 50
 * registrations" means fifty bookings - counting rows would exhaust it after
 * seventeen people who each brought two friends.
 *
 * The id is the part of the token before the underscore, which is how it is
 * built in the register route: `${registrationId}_${passCode}`.
 *
 * Rejected registrations still count. They occupied a place at the time, and
 * a coupon that silently came back into stock because somebody's payment
 * failed would be a different promise from the one that was made.
 */
export async function countRegistrations(eventId: string): Promise<number> {
  try {
    const supabase = await createServiceRoleClient()
    const { data, error } = await supabase
      .from('tickets')
      .select('token')
      .eq('event_id', eventId)

    if (error) {
      console.error('Could not count registrations:', error.message)
      // Fail closed: an unknown count must not hand out an early-bird
      // discount that may already be spent.
      return Number.MAX_SAFE_INTEGER
    }

    const ids = new Set<string>()
    for (const row of data || []) {
      const id = registrationIdOf((row as { token?: unknown }).token)
      if (id) ids.add(id)
    }

    return ids.size
  } catch (e) {
    console.error('Could not count registrations:', e instanceof Error ? e.message : e)
    return Number.MAX_SAFE_INTEGER
  }
}

export type RegistrationStats = {
  /** Registrations so far - what a first-N coupon is measured against. */
  registrations: number
  /** Registrations that used each code, keyed by the code in upper case. */
  couponUses: Record<string, number>
}

/**
 * Registrations and coupon uses for each of these events, for /admin/coupons.
 *
 * Counted the same way as countRegistrations - by registration, not by ticket
 * row - so the "12 of 50 taken" the admin reads is the number the register
 * route will compare against. Null when the tickets could not be read, so the
 * page can say it does not know rather than show a confident zero.
 */
export async function registrationStats(eventIds: string[]): Promise<Record<string, RegistrationStats> | null> {
  const stats: Record<string, RegistrationStats> = {}
  for (const id of eventIds) stats[id] = { registrations: 0, couponUses: {} }
  if (eventIds.length === 0) return stats

  try {
    const supabase = await createServiceRoleClient()
    const { data, error } = await supabase
      .from('tickets')
      .select('token, event_id, coupon_code')
      .in('event_id', eventIds)

    if (error) {
      console.error('Could not read registrations for coupon stats:', error.message)
      return null
    }

    const seen = new Set<string>()
    const used = new Set<string>()
    for (const row of (data || []) as { token?: unknown; event_id?: unknown; coupon_code?: unknown }[]) {
      const eventId = String(row.event_id ?? '')
      const id = registrationIdOf(row.token)
      if (!id || !stats[eventId]) continue

      const key = `${eventId}|${id}`
      if (!seen.has(key)) {
        seen.add(key)
        stats[eventId].registrations += 1
      }

      const code = String(row.coupon_code ?? '').trim().toUpperCase()
      // Every ticket in a booking carries the code; the booking is one use.
      if (code && !used.has(key)) {
        used.add(key)
        stats[eventId].couponUses[code] = (stats[eventId].couponUses[code] || 0) + 1
      }
    }

    return stats
  } catch (e) {
    console.error('Could not read registrations for coupon stats:', e instanceof Error ? e.message : e)
    return null
  }
}
