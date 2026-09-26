import { requireAdmin } from '@/utils/auth/require-admin'
import { NextResponse } from 'next/server'
import { createServiceRoleClient, createClient } from '@/utils/supabase/server'

export async function GET() {
  const guard = await requireAdmin(2)
  if (!guard.ok) return guard.response

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
