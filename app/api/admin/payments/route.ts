import { requireAdmin } from '@/utils/auth/require-admin'
import { NextResponse } from 'next/server'
import { createServiceRoleClient, createClient } from '@/utils/supabase/server'

export async function GET() {
  const guard = await requireAdmin(2)
  if (!guard.ok) return guard.response

  const supabase = await createServiceRoleClient()
  const { data: payments, error } = await supabase
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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(payments)
}
