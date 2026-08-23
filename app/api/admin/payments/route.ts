import { getCurrentUser } from '@/utils/auth/server'
import { NextResponse } from 'next/server'
import { createServiceRoleClient, createClient } from '@/utils/supabase/server'

export async function GET() {
  const { data: authData } = await getCurrentUser()
  const user = authData?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
