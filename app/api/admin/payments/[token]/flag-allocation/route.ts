import { requireAdmin } from '@/utils/auth/require-admin'
import { getPaymentScope, scopeAllows } from '@/utils/auth/payment-scope'
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'

/**
 * "This payment is not mine."
 *
 * A manager sees a payment because its receiver UPI id matches theirs. When
 * that is wrong - a mistyped handle, a misread receipt, a shared QR poster -
 * they are holding something they cannot honestly verify and previously had
 * no way to hand on. This is that way.
 *
 * Flagging takes the payment out of every manager's queue and puts it in the
 * super admin's Wrong Allocations list, where it can be routed to whoever
 * actually collected it. It deliberately does not approve, reject, or touch
 * receiver_upi: the record of where the money went is not the manager's to
 * revise, and a payment in dispute should not quietly resolve itself either
 * way while it waits.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const guard = await requireAdmin(2)
  if (!guard.ok) return guard.response

  const scope = await getPaymentScope()
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

  let reason = ''
  try {
    const body = (await request.json()) as Record<string, unknown>
    if (typeof body.reason === 'string') reason = body.reason.trim().slice(0, 500)
  } catch {
    // A reason is welcome, not required.
  }

  const supabase = await createServiceRoleClient()

  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('token, utr, receiver_upi, assigned_manager_id, allocation_flagged_at, payment_status')
    .eq('token', token.toUpperCase())
    .maybeSingle()

  if (error || !ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  // Only from the queue it is actually in - otherwise knowing a token would be
  // enough to pull somebody else's payment out of their list.
  if (!scopeAllows(scope, ticket)) {
    return NextResponse.json({ error: 'This payment belongs to another collector' }, { status: 403 })
  }

  if (ticket.payment_status === 'APPROVED') {
    return NextResponse.json(
      { error: 'This payment has already been verified. Ask a super admin to look at it.' },
      { status: 409 }
    )
  }

  // Every pass in one booking shares a UTR and was paid in one transfer, so
  // they are misallocated together or not at all.
  let update = supabase.from('tickets').update({
    allocation_flagged_at: new Date().toISOString(),
    allocation_flag_reason: reason || null,
    allocation_flagged_by: scope.managerId,
    assigned_manager_id: null,
  })
  update = ticket.utr && ticket.utr !== 'FREE-PASS'
    ? update.eq('utr', ticket.utr)
    : update.eq('token', ticket.token)

  const { data: flagged, error: updateError } = await update.select('token')

  if (updateError) {
    if (/allocation_flagged_at|assigned_manager_id/.test(updateError.message || '')) {
      return NextResponse.json({ error: 'Run supabase/wrong-allocations.sql first.' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Could not report this payment.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, reported: flagged?.length ?? 0 })
}
