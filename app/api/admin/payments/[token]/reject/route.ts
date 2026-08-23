import { getCurrentUser } from '@/utils/auth/server'
import { NextResponse } from 'next/server'
import { createServiceRoleClient, createClient } from '@/utils/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { data: authData } = await getCurrentUser()
  const user = authData?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServiceRoleClient()

  // Reject payment
  // payment_status -> REJECTED
  // status -> PAYMENT_REJECTED
  
  const { data: updated, error } = await supabase
    .from('tickets')
    .update({ payment_status: 'REJECTED', status: 'PAYMENT_REJECTED' })
    .eq('token', token.toUpperCase())
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(updated)
}
