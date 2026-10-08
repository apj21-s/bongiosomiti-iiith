import { NextResponse } from 'next/server'
import { getEventBySlug } from '@/utils/data/events'
import { resolveCoupon } from '@/utils/coupons'
import { countRegistrations } from '@/utils/data/registrations'
import { rateLimit, tooManyRequests } from '@/utils/rate-limit'

export const revalidate = 0

/**
 * What a coupon is worth, asked before submitting.
 *
 * A code can depend on things the browser cannot know or be trusted about:
 * how many registrations already exist, and what the event's own table says
 * the coupon does. So the form asks here rather than reading the coupon list
 * and deciding for itself, which is what it used to do - and which meant a
 * conditional coupon could look applied right up until the register route
 * disagreed.
 *
 * The subtotal in the body is only used to price the preview. It is not
 * trusted: /api/register recomputes the subtotal from the verified address
 * and the event's own prices, then resolves the coupon again against that.
 * Inflating it here buys a nicer-looking number on one screen and nothing at
 * all on the booking.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Guessing codes is the obvious abuse, and it costs a database count each
  // time. Per address is not available here, so this one is per caller.
  const allowance = rateLimit(`coupon:${callerKey(request)}`, 20, 60_000)
  if (!allowance.allowed) {
    return tooManyRequests(allowance.retryAfterSeconds, 'Too many coupon checks. Please wait a moment.')
  }

  let body: { code?: unknown; subtotal?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, reason: 'Expected a JSON body.' }, { status: 400 })
  }

  const event = await getEventBySlug(slug)
  if (!event) {
    return NextResponse.json({ ok: false, reason: 'Unknown event.' }, { status: 404 })
  }

  const subtotal = Number(body.subtotal)
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return NextResponse.json({ ok: false, reason: 'Nothing to apply a coupon to yet.' }, { status: 400 })
  }

  const registrationsSoFar = await countRegistrations(event.id)
  const verdict = resolveCoupon(event, body.code, { subtotal, registrationsSoFar })

  // 200 either way: "this code does not apply" is an answer, not a failure,
  // and the form shows the reason rather than a network error.
  return NextResponse.json(verdict)
}

/** Whoever is asking, as far as the request reveals. */
function callerKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return (forwarded ? forwarded.split(',')[0] : '').trim() || 'unknown'
}
