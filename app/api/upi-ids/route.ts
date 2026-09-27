import { NextResponse } from 'next/server'
import { getEventBySlug } from '@/utils/data/events'
import { listCollectionUpiIds } from '@/utils/auth/managers'
import { normaliseUpi, isValidUpi } from '@/utils/payments/receipt-gate'

/**
 * The UPI ids a registration may name as the receiver.
 *
 * One per active manager, so the form can check what the OCR read off the
 * receipt against the real list rather than accepting whatever the image
 * happened to contain. Only the ids go out - never the manager behind one -
 * and a payer is shown the id to pay to anyway.
 *
 * Until any manager profiles exist, the event's own configured ids stand in, so
 * the festival keeps working on a database where the migration has not been run.
 */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('event') || ''

  const fromManagers = await listCollectionUpiIds()

  let fromEvent: string[] = []
  if (fromManagers.length === 0 && slug) {
    const event = getEventBySlug(slug) as { config?: { upi_ids?: unknown; upi_id?: unknown } } | null
    const configured = event?.config?.upi_ids
    const list = Array.isArray(configured)
      ? configured
      : (typeof event?.config?.upi_id === 'string' ? [event.config.upi_id] : [])

    fromEvent = list
      .map((id) => normaliseUpi(id))
      .filter((id) => isValidUpi(id))
  }

  const upiIds = fromManagers.length > 0 ? fromManagers : Array.from(new Set(fromEvent))

  return NextResponse.json(
    { upiIds, source: fromManagers.length > 0 ? 'managers' : 'event' },
    // Short-lived: a new manager should show up without a deploy, but this does
    // not need to be read on every keystroke either.
    { headers: { 'Cache-Control': 'public, max-age=60' } }
  )
}
