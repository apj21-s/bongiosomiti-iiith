import { NextResponse } from 'next/server'
import { requireAdmin } from '@/utils/auth/require-admin'
import { changeEventCoupons } from '@/utils/data/coupon-store'
import { validateCoupon, type Coupon } from '@/utils/coupons'

const REQUIRED_TIER = 3

type Params = { params: Promise<{ slug: string; code: string }> }

const same = (a: unknown, b: unknown) =>
  String(a ?? '').trim().toUpperCase() === String(b ?? '').trim().toUpperCase()

/**
 * Replaces one coupon. Body: `{ coupon }`, the whole coupon as it should now
 * read - which is also how it is switched on and off, and renamed.
 */
export async function PUT(request: Request, { params }: Params) {
  const { slug, code } = await params
  const guard = await requireAdmin(REQUIRED_TIER)
  if (!guard.ok) return guard.response

  let body: { coupon?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  let saved: Coupon | null = null
  const result = await changeEventCoupons(slug, (current) => {
    const index = current.findIndex((c) => same(c.code, code))
    if (index === -1) return { error: `${code} is not a coupon for this event.`, status: 404 }

    const others = current.filter((_, i) => i !== index).map((c) => String(c.code ?? ''))
    const checked = validateCoupon(body.coupon, others)
    if (!checked.ok) return { error: checked.error }

    saved = checked.coupon
    const next = [...current]
    next[index] = checked.coupon
    return next
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(saved)
}

/**
 * Deletes one coupon. Bookings that already used it keep the code on their
 * tickets; it simply stops applying to new ones.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const { slug, code } = await params
  const guard = await requireAdmin(REQUIRED_TIER)
  if (!guard.ok) return guard.response

  const result = await changeEventCoupons(slug, (current) => {
    if (!current.some((c) => same(c.code, code))) {
      return { error: `${code} is not a coupon for this event.`, status: 404 }
    }
    return current.filter((c) => !same(c.code, code))
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true })
}
