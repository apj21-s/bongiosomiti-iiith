import { createServiceRoleClient } from '@/utils/supabase/server'

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
      const token = String((row as { token?: unknown }).token ?? '')
      if (!token) continue
      const underscore = token.indexOf('_')
      ids.add(underscore === -1 ? token : token.slice(0, underscore))
    }

    return ids.size
  } catch (e) {
    console.error('Could not count registrations:', e instanceof Error ? e.message : e)
    return Number.MAX_SAFE_INTEGER
  }
}
