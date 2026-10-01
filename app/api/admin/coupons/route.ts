import { NextResponse } from 'next/server'
import { requireAdmin } from '@/utils/auth/require-admin'
import { getEvents } from '@/utils/data/events'
import { registrationStats } from '@/utils/data/registrations'
import { changeEventCoupons } from '@/utils/data/coupon-store'
import { validateCoupon, type Coupon } from '@/utils/coupons'

export const revalidate = 0

// Coupons change what people pay, so they are a super-admin job end to end.
const REQUIRED_TIER = 3

type EventRow = { id: string; slug: string; name: string; status?: string; event_date?: string; config?: { coupons?: Coupon[] } }

/**
 * Every event with its coupons, and how far each has been used.
 *
 * `registrations` is what a first-N coupon is measured against, and `uses` is
 * how many bookings carried the code. Both are null when the tickets could not
 * be read - the page says it does not know rather than showing a zero.
 */
export async function GET() {
  const guard = await requireAdmin(REQUIRED_TIER)
  if (!guard.ok) return guard.response

  const events = ((await getEvents()) || []) as EventRow[]
  const stats = await registrationStats(events.map((e) => e.id))

  return NextResponse.json(
    events.map((event) => {
      const own = stats ? stats[event.id] : null
      const coupons = Array.isArray(event.config?.coupons) ? event.config!.coupons! : []
      return {
        slug: event.slug,
        name: event.name,
        status: event.status ?? null,
        eventDate: event.event_date ?? null,
        registrations: own ? own.registrations : null,
        coupons: coupons.map((coupon) => ({
          ...coupon,
          uses: own ? own.couponUses[String(coupon.code ?? '').trim().toUpperCase()] || 0 : null,
        })),
      }
    })
  )
}

/** Adds a coupon to one event. Body: `{ eventSlug, coupon }`. */
export async function POST(request: Request) {
  const guard = await requireAdmin(REQUIRED_TIER)
  if (!guard.ok) return guard.response

  let body: { eventSlug?: unknown; coupon?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const slug = typeof body.eventSlug === 'string' ? body.eventSlug : ''
  if (!slug) return NextResponse.json({ error: 'Choose an event.' }, { status: 400 })

  let created: Coupon | null = null
  const result = await changeEventCoupons(slug, (current) => {
    const checked = validateCoupon(body.coupon, current.map((c) => String(c.code ?? '')))
    if (!checked.ok) return { error: checked.error }
    created = checked.coupon
    return [...current, checked.coupon]
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(created, { status: 201 })
}
