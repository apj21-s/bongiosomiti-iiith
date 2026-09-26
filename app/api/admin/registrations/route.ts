import { requireAdmin } from '@/utils/auth/require-admin'
import { NextResponse } from 'next/server'
import { createServiceRoleClient, createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const guard = await requireAdmin(3)
  if (!guard.ok) return guard.response

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.toLowerCase()
  const eventSlug = searchParams.get('event')
  const status = searchParams.get('status')

  const supabase = await createServiceRoleClient()
  let queryBuilder = supabase
    .from('tickets')
    .select(`
      *,
      event:events (
        slug,
        name
      )
    `)
    .order('created_at', { ascending: false })

  if (eventSlug && eventSlug !== 'all') {
    // We need to filter by event.slug. PostgREST allows filtering on related tables if configured, 
    // but a safer way is to fetch the event id first, or use an inner join.
    // For simplicity, we filter the related column.
    queryBuilder = queryBuilder.eq('event.slug', eventSlug)
  }

  if (status && status !== 'all') {
    if (status === 'USED' || status === 'UNUSED') {
      queryBuilder = queryBuilder.eq('status', status)
    } else {
      queryBuilder = queryBuilder.eq('payment_status', status)
    }
  }

  if (query) {
    queryBuilder = queryBuilder.or(`token.ilike.%${query}%,participant_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
  }

  const { data: tickets, error } = await queryBuilder

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Filter out null events if we filtered by eventSlug and it didn't match
  const filteredTickets = eventSlug && eventSlug !== 'all' 
    ? tickets.filter((t: any) => t.event) 
    : tickets

  return NextResponse.json(filteredTickets)
}
