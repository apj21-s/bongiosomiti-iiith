import { getCurrentUser } from '@/utils/auth/server'
import { NextResponse } from 'next/server'
import { createServiceRoleClient, createClient } from '@/utils/supabase/server'

export async function GET() {
  const { data: authData } = await getCurrentUser()
  const user = authData?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServiceRoleClient()
  const { data: checkins, error } = await supabase
    .from('checkins')
    .select(`
      *,
      ticket:tickets (
        token,
        participant_name,
        event:events (
          name
        )
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Format the output to match prototype expectations
  const formattedCheckins = checkins.map((c: any) => ({
    id: c.id,
    token: c.ticket?.token,
    participantName: c.ticket?.participant_name,
    eventName: c.ticket?.event?.name,
    gate: c.gate,
    timestamp: c.created_at
  }))

  return NextResponse.json(formattedCheckins)
}
