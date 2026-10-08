import { NextResponse } from 'next/server'
import { getEvents } from '@/utils/data/events'
import { stripCoupons } from '@/utils/coupons'

export async function GET() {
  const allEvents = await getEvents()
  const events = allEvents.filter((e: any) => e.status === 'OPEN').sort((a: any, b: any) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
  // Public: coupon codes are not part of what an event shows the world.
  return NextResponse.json(events.map(stripCoupons))
}
