import fs from 'fs'
import path from 'path'
import type { Coupon } from '@/utils/coupons'

/**
 * Writing an event's coupon list.
 *
 * Coupons live where they always have, in the event's `config.coupons` inside
 * public/data/events.json - the register route and the coupon preview read
 * them from there through getEventBySlug, so nothing that prices a booking
 * had to change. What changed is who writes them: /admin/coupons, through
 * this, and no longer the event editor's whole-config save.
 *
 * config is not mirrored to the events table (see event-sync.ts), so there is
 * only the file to write. On a read-only deployment that write fails, and the
 * caller is told so rather than shown a success that did not happen.
 */

const EVENTS_FILE = () => path.join(process.cwd(), 'public', 'data', 'events.json')

export type CouponChange =
  | { ok: true; coupons: Coupon[] }
  | { ok: false; status: number; error: string }

/**
 * Reads the event's coupons, hands them to `change`, and writes back what it
 * returns. `change` returns an error string instead to refuse the edit, in
 * which case nothing is written.
 *
 * The read and the write are one synchronous step, so two saves arriving
 * together cannot interleave and drop each other's coupon.
 */
export function changeEventCoupons(
  slug: string,
  change: (current: Coupon[]) => Coupon[] | { error: string; status?: number }
): CouponChange {
  let events: Record<string, unknown>[]
  try {
    events = JSON.parse(fs.readFileSync(EVENTS_FILE(), 'utf8'))
  } catch (e) {
    return { ok: false, status: 500, error: `Could not read the events file: ${e instanceof Error ? e.message : 'unknown'}` }
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
    fs.writeFileSync(EVENTS_FILE(), JSON.stringify(events, null, 2) + '\n')
  } catch (e) {
    return {
      ok: false,
      status: 500,
      error:
        `The events file could not be written (${e instanceof Error ? e.message : 'unknown'}). ` +
        'On a read-only deployment coupons have to be edited in public/data/events.json in the repository.',
    }
  }

  return { ok: true, coupons: next }
}
