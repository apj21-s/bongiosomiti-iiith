import fs from 'fs'
import path from 'path'
import type { Coupon } from '@/utils/coupons'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { getEvents } from './events'

/**
 * Writing an event's coupon list.
 *
 * Coupons live where they always have, in the event's `config.coupons` inside
 * public/data/events.json or the events table.
 *
 * We now write the change to the Supabase database.
 */

const EVENTS_FILE = () => path.join(process.cwd(), 'public', 'data', 'events.json')

export type CouponChange =
  | { ok: true; coupons: Coupon[] }
  | { ok: false; status: number; error: string }

/**
 * Reads the event's coupons, hands them to `change`, and writes back what it
 * returns. `change` returns an error string instead to refuse the edit, in
 * which case nothing is written.
 */
export async function changeEventCoupons(
  slug: string,
  change: (current: Coupon[]) => Coupon[] | { error: string; status?: number }
): CouponChange {
  let events: Record<string, unknown>[]
  try {
    events = await getEvents()
  } catch (e) {
    return { ok: false, status: 500, error: `Could not read the events from database: ${e instanceof Error ? e.message : 'unknown'}` }
  }

  const index = events.findIndex((e) => e?.slug === slug)
  if (index === -1) return { ok: false, status: 404, error: 'Event not found.' }

  const event = events[index]
  const config = (event.config && typeof event.config === 'object' ? event.config : {}) as Record<string, unknown>
  const current = Array.isArray(config.coupons) ? (config.coupons as Coupon[]) : []

  const next = change(current)
  if (!Array.isArray(next)) return { ok: false, status: next.status ?? 400, error: next.error }

  events[index] = { ...event, config: { ...config, coupons: next } }

  try {
    const supabase = await createServiceRoleClient()
    const { error } = await supabase
      .from('events')
      .update({ config: events[index].config })
      .eq('slug', slug)

    if (error) throw error

    // Best effort write to local file
    try {
      fs.writeFileSync(EVENTS_FILE(), JSON.stringify(events, null, 2) + '\n')
    } catch (e) {}
  } catch (e) {
    return {
      ok: false,
      status: 500,
      error:
        `The events could not be updated in the database (${e instanceof Error ? e.message : 'unknown'}).`,
    }
  }

  return { ok: true, coupons: next }
}
