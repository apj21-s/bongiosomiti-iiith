import { requireAdmin } from '@/utils/auth/require-admin'
import { getPaymentScope, scopeAllows } from '@/utils/auth/payment-scope'
import { isReceiptPath } from '@/utils/payments/receipt-gate'
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'

/**
 * The receipt behind one payment, as a short-lived signed URL.
 *
 * The receipts bucket is private - these are screenshots of somebody's banking
 * app - so the stored path is useless on its own and there is no public URL to
 * hand out. This is the one way back to the image, and it is the route the
 * upload in app/api/receipts/route.ts was always written against.
 *
 * Who may see it is the same rule that governs approving: a manager profile
 * gets the payments whose receiver UPI id is its own, and nobody else's. The
 * scope comes out of the signed session, so asking with another payment's
 * token does not widen it - which matters more here than on the list, because
 * a receipt shows a stranger's name, bank and balance.
 *
 * The URL expires in two minutes. Long enough to open the image, short enough
 * that a link copied out of the network tab is worthless by the time it is
 * used.
 */

const EXPIRES_IN_SECONDS = 120

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const guard = await requireAdmin(2)
  if (!guard.ok) return guard.response

  const scope = await getPaymentScope()
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

  const supabase = await createServiceRoleClient()

  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('token, receiver_upi, payment_proof_url')
    .eq('token', token.toUpperCase())
    .maybeSingle()

  if (error || !ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  if (!scopeAllows(scope, ticket.receiver_upi)) {
    return NextResponse.json({ error: 'This payment belongs to another collector' }, { status: 403 })
  }

  const path = ticket.payment_proof_url
  if (!path) {
    return NextResponse.json({ error: 'No receipt was uploaded for this payment' }, { status: 404 })
  }

  // The column holds whatever was filed against the ticket. Checking its shape
  // again here keeps a stored value from being used to reach somewhere else in
  // the bucket.
  if (!isReceiptPath(path)) {
    return NextResponse.json({ error: 'The stored receipt path is not usable' }, { status: 422 })
  }

  if (!('storage' in supabase)) {
    return NextResponse.json(
      { error: 'Receipts cannot be read while DUMMY_DB is on.' },
      { status: 503 }
    )
  }

  const { data: signed, error: signError } = await supabase.storage
    .from('receipts')
    .createSignedUrl(String(path).replace(/^receipts\//, ''), EXPIRES_IN_SECONDS)

  if (signError || !signed?.signedUrl) {
    const missing = /not found|does not exist/i.test(signError?.message || '')
    return NextResponse.json(
      { error: missing ? 'That receipt is no longer in storage' : 'Could not open the receipt' },
      { status: missing ? 404 : 500 }
    )
  }

  return NextResponse.json({ url: signed.signedUrl, expiresIn: EXPIRES_IN_SECONDS })
}
