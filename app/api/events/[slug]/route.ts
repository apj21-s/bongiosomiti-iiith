import { NextResponse } from 'next/server'
import { getEventBySlug } from '@/utils/data/events'
import { stripCoupons } from '@/utils/coupons'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const event = getEventBySlug(slug)

  if (!event) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  // Public: the codes stay on the server. /api/events/<slug>/coupon answers
  // for one code at a time.
  return NextResponse.json(stripCoupons(event))
}
