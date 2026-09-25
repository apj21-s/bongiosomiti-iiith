import { getCurrentUser } from '@/utils/auth/server'
import { NextResponse } from 'next/server'
import { createServiceRoleClient, createClient } from '@/utils/supabase/server'
import { getEvents } from '@/utils/data/events'

export async function GET() {
  const { data: authData } = await getCurrentUser()
  const user = authData?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServiceRoleClient()

  const events = await getEvents()
  const eventCount = events.length

  // Get total tickets
  const { count: ticketCount } = await supabase.from('tickets').select('*', { count: 'exact', head: true })

  // Get total revenue (amount of APPROVED payment_status tickets)
  const { data: paidTickets } = await supabase
    .from('tickets')
    .select('amount')
    .eq('payment_status', 'APPROVED')
    
  const revenue = (paidTickets || []).reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)

  // Get verified count (USED or APPROVED payment_status)
  // Actually prototype says: tickets.filter((t) => t.status === "USED" || t.paymentStatus === "APPROVED").length
  const { count: verifiedCount } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .or('status.eq.USED,payment_status.eq.APPROVED')

  // Get checkin count
  const { count: checkinCount } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'USED')

  return NextResponse.json({
    eventCount: eventCount || 0,
    ticketCount: ticketCount || 0,
    revenue,
    verifiedCount: verifiedCount || 0,
    checkinCount: checkinCount || 0
  })
}
