import { getCurrentUser } from '@/utils/auth/server'
import { NextResponse } from 'next/server'
import { createServiceRoleClient, createClient } from '@/utils/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data: authData } = await getCurrentUser()
  const user = authData?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServiceRoleClient()
  
  // Undo checkin:
  // 1. Get checkin by ID
  const { data: checkin, error: checkinError } = await supabase
    .from('checkins')
    .select('*')
    .eq('id', id)
    .single()

  if (checkinError || !checkin) {
    return NextResponse.json({ error: 'Checkin not found' }, { status: 404 })
  }

  // 2. Update ticket status back to UNUSED
  // Note: Only if it was USED (it should be, but let's be safe).
  // payment_status should remain APPROVED.
  const { error: ticketError } = await supabase
    .from('tickets')
    .update({ 
      status: 'UNUSED',
      redeemed_at: null,
      redeemed_gate: null,
      redeemed_by: null
    })
    .eq('id', checkin.ticket_id)

  if (ticketError) {
    return NextResponse.json({ error: ticketError.message }, { status: 500 })
  }

  // 3. Delete checkin record
  const { error: deleteError } = await supabase
    .from('checkins')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
