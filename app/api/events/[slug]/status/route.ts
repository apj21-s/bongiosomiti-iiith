import { NextResponse } from 'next/server'
import { eventOpenNow } from '@/utils/data/events'

/**
 * Whether an event is still taking registrations, for a form that is already
 * open in somebody's browser.
 *
 * The registration form asks this on a timer and before every step that
 * commits the visitor - the payment screen, the receipt, the submit - so an
 * admin closing registration reaches people mid-form instead of at the end.
 * Never cached: the answer is only useful if it is current.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const check = await eventOpenNow(slug)
  const headers = { 'Cache-Control': 'no-store' }

  // Unknown is not "open": the form keeps going and the register route, which
  // refuses when it cannot tell, has the last word.
  if (!check.known) {
    return NextResponse.json({ error: 'Could not read the event status' }, { status: 503, headers })
  }
  return NextResponse.json({ open: check.open, status: check.status }, { headers })
}
