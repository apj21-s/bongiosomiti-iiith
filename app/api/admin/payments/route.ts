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
    .in('payment_status', ['PENDING', 'REJECTED'])
    .order('created_at', { ascending: false })

  if (scope.upi) {
    query = query.ilike('receiver_upi', scope.upi)
  }

  const { data: payments, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(payments)
}
