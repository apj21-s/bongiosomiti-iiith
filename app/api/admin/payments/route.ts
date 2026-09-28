import { requireAdmin } from '@/utils/auth/require-admin'
import { getPaymentScope } from '@/utils/auth/payment-scope'
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'

export async function GET() {
  const guard = await requireAdmin(2)
  if (!guard.ok) return guard.response

  // A manager profile only ever sees the payments made to its own UPI id.
  // The scope comes from the signed session, so it cannot be widened by the
  // caller. Super admins and the env-credential tiers see everything.
  const scope = await getPaymentScope()
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

  const supabase = await createServiceRoleClient()
  let query = supabase
    .from('tickets')
    .select(`
      *,
      event:events (
        slug,
        name
      )
    `)
    // APPROVED belongs here too. The screen offers a "VERIFIED (Active
    // Passes)" filter, which could only ever come back empty while this list
    // stopped at PENDING and REJECTED - and a manager who has approved a
    // payment can no longer look at the receipt behind it, which is the one
    // record of where their money came from.
    .in('payment_status', ['PENDING', 'REJECTED', 'APPROVED'])
    .order('created_at', { ascending: false })

  if (scope.upi) {
    // Three cases, in the order they decide:
    //   assigned to me            -> mine, whatever receiver_upi says
    //   unassigned, unflagged,
    //     and paid to my id       -> mine, as before
    //   flagged, unassigned       -> nobody's, until the super admin routes it
    query = query.or(
      [
        `assigned_manager_id.eq.${scope.managerId}`,
        `and(assigned_manager_id.is.null,allocation_flagged_at.is.null,receiver_upi.ilike.${scope.upi})`,
      ].join(',')
    )
  }

  const { data: payments, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(payments)
}
