import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { getEventBySlug } from '@/utils/data/events'
import { listCollectionUpiIds } from '@/utils/auth/managers'
import { normaliseUpi, isValidUpi } from '@/utils/payments/receipt-gate'

/**
 * Orders ids by how many payments each has already received, fewest first.
 *
 * Ties keep the order they came in, so the result is stable for an untouched
 * festival. A counting query that fails is not worth failing the request over -
 * the list is still correct, merely unordered - so the original order stands.
 */
async function orderByLeastUsed(ids: string[]): Promise<string[]> {
  if (ids.length < 2) return ids

  try {
    const supabase = await createServiceRoleClient()
    if (!('from' in supabase)) return ids

    const { data, error } = await supabase
      .from('tickets')
      .select('receiver_upi')
      .in('payment_status', ['PENDING', 'APPROVED'])

    if (error || !Array.isArray(data)) return ids

    const used = new Map<string, number>()
    for (const row of data as { receiver_upi?: string | null }[]) {
      const id = normaliseUpi(row.receiver_upi || '')
      if (id) used.set(id, (used.get(id) || 0) + 1)
    }

    return ids
      .map((id, i) => ({ id, n: used.get(normaliseUpi(id)) || 0, i }))
      .sort((a, b) => (a.n - b.n) || (a.i - b.i))
      .map((x) => x.id)
  } catch {
    return ids
  }
}

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
    const event = (await getEventBySlug(slug)) as { config?: { upi_ids?: unknown; upi_id?: unknown } } | null
    const configured = event?.config?.upi_ids
    const list = Array.isArray(configured)
      ? configured
      : (typeof event?.config?.upi_id === 'string' ? [event.config.upi_id] : [])

    fromEvent = list
      .map((id) => normaliseUpi(id))
      .filter((id) => isValidUpi(id))
  }

  const base = fromManagers.length > 0 ? fromManagers : Array.from(new Set(fromEvent))

  /**
   * Least used first.
   *
   * Every registrant is shown the same list, so without this the first id
   * collects nearly everything and the collector behind it does all the
   * verifying while the others idle. Ordering by how much each has already
   * taken spreads the work by default, because most people accept whatever is
   * at the top - which is exactly the behaviour being used here.
   *
   * Counted from tickets actually filed, so it self-corrects: an id that runs
   * ahead sinks, and one nobody has paid stays first.
   */
  const upiIds = await orderByLeastUsed(base)

  return NextResponse.json(
    { upiIds, source: fromManagers.length > 0 ? 'managers' : 'event', orderedBy: 'least-used' },
    // Short-lived: a new manager should show up without a deploy, but this does
    // not need to be read on every keystroke either.
    { headers: { 'Cache-Control': 'public, max-age=60' } }
  )
}
