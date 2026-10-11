import { NextResponse } from 'next/server'
import { requireAdmin } from '@/utils/auth/require-admin'
import { createManager, listManagerEvents, listManagers, setManagerEvents } from '@/utils/auth/managers'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { getEventScope } from '@/utils/admin/event-scope'
import { verifiedTotals, type SettledChange, type TotalsTicket } from '@/utils/data/manager-totals'

// Creating and listing manager profiles is a super-admin job.
const REQUIRED_TIER = 3

// PostgREST returns at most this many rows per request, silently. A festival
// past it would have had its totals quietly cut short.
const PAGE = 1000

async function loadAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message?: string } | null }>,
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) return { rows, error: error.message || 'query failed' }
    const batch = (Array.isArray(data) ? data : []) as T[]
    rows.push(...batch)
    if (batch.length < PAGE) return { rows, error: null }
  }
}

export async function GET() {
  const guard = await requireAdmin(REQUIRED_TIER)
  if (!guard.ok) return guard.response

  const [managers, assignments, scope] = await Promise.all([
    listManagers(),
    listManagerEvents(),
    getEventScope(),
  ])
  const event = scope.event

  const supabase = await createServiceRoleClient()

  // Every ticket in scope, not only approved ones: a plate change is traced
  // to its collector through its tickets. Ordered by id so the pages are
  // stable while they are read.
  const tickets = await loadAll<TotalsTicket>((from, to) => {
    let query = supabase
      .from('tickets')
      .select('id, amount, payment_status, receiver_upi, assigned_manager_id, allocation_flagged_at, utr')
      .order('id')
      .range(from, to)
    if (event) query = query.eq('event_id', event.id)
    return query
  })
  if (tickets.error) {
    return NextResponse.json({ error: `Could not total the payments: ${tickets.error}` }, { status: 500 })
  }

  // A missing plate_changes table means no changes have ever been settled,
  // which is the same as an empty list.
  const changes = await loadAll<SettledChange>((from, to) => {
    let query = supabase
      .from('plate_changes')
      .select('id, status, delta, payer, passes')
      .eq('status', 'APPROVED')
      .order('id')
      .range(from, to)
    if (event) query = query.eq('event_id', event.id)
    return query
  })

  const totals = verifiedTotals(tickets.rows, changes.error ? [] : changes.rows, managers)

  const enrichedManagers = managers.map(m => ({
    ...m,
    totalVerifiedAmount: totals.get(m.id) || 0,
    eventIds: assignments?.get(m.id) || [],
  }))

  return NextResponse.json({
    managers: enrichedManagers,
    // Which event the amounts are for, as picked in the admin sidebar.
    event: event ? { id: event.id, name: event.name } : null,
    events: scope.events.map((e) => ({ id: e.id, name: e.name })),
    // False until supabase/manager-events.sql has been run.
    assignmentsAvailable: assignments !== null,
  })
}

export async function POST(request: Request) {
  const guard = await requireAdmin(REQUIRED_TIER)
  if (!guard.ok) return guard.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const input = (body ?? {}) as Record<string, unknown>
  const username = typeof input.username === 'string' ? input.username : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const upiId = typeof input.upiId === 'string' ? input.upiId : ''
  const email = typeof input.email === 'string' ? input.email : ''
  const name = typeof input.name === 'string' ? input.name : undefined
  const eventIds = Array.isArray(input.eventIds)
    ? input.eventIds.filter((id): id is string => typeof id === 'string')
    : []

  const result = await createManager({
    username,
    password,
    upiId,
    email,
    name,
    createdBy: String(guard.user.email || guard.user.id),
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  // The profile exists either way; an assignment that fails is reported so it
  // can be set again from the table rather than undoing the account.
  const known = new Set((await getEventScope()).events.map((e) => e.id))
  const assignedIds = eventIds.filter((id) => known.has(id))
  if (assignedIds.length > 0) {
    const assigned = await setManagerEvents(result.manager.id, assignedIds)
    if (!assigned.ok) {
      return NextResponse.json({ ...result.manager, eventIds: [], warning: assigned.error }, { status: 201 })
    }
  }

  return NextResponse.json({ ...result.manager, eventIds: assignedIds }, { status: 201 })
}
