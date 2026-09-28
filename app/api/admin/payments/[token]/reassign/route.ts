import { requireAdmin } from '@/utils/auth/require-admin'
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { getManagerById } from '@/utils/auth/managers'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Routes a wrongly allocated payment to the manager who should verify it.
 *
 * Super admin only: a manager may say a payment is not theirs, but deciding
 * whose it is settles who gets to approve money, and that is not a call one
 * collector should make about another.
 *
 * Setting assigned_manager_id is what moves it - receiver_upi still records
 * where the money actually landed, which is exactly the fact somebody will
 * want later when asking how it went astray. The flag is cleared at the same
 * time, so the payment leaves the Wrong Allocations list and appears in the
 * new manager's queue on their next load.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const guard = await requireAdmin(3)
  if (!guard.ok) return guard.response

  let managerId = ''
  try {
    const body = (await request.json()) as Record<string, unknown>
    if (typeof body.managerId === 'string') managerId = body.managerId.trim()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!UUID.test(managerId)) {
    return NextResponse.json({ error: 'Choose a manager to assign this to.' }, { status: 400 })
  }

  // Active profiles only: assigning to a deactivated one would park the
  // payment somewhere nobody can sign in to reach.
  const manager = await getManagerById(managerId)
  if (!manager) {
    return NextResponse.json({ error: 'That manager profile is not active.' }, { status: 400 })
  }

  const supabase = await createServiceRoleClient()

  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('token, utr')
    .eq('token', token.toUpperCase())
    .maybeSingle()

  if (error || !ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  // The whole booking moves together, as it was flagged together.
  let update = supabase.from('tickets').update({
    assigned_manager_id: manager.id,
    assigned_at: new Date().toISOString(),
    assigned_by: String(guard.user.email || guard.user.id),
    allocation_flagged_at: null,
  })
  update = ticket.utr && ticket.utr !== 'FREE-PASS'
    ? update.eq('utr', ticket.utr)
    : update.eq('token', ticket.token)

  const { data: moved, error: updateError } = await update.select('token')

  if (updateError) {
    if (/assigned_manager_id|allocation_flagged_at/.test(updateError.message || '')) {
      return NextResponse.json({ error: 'Run supabase/wrong-allocations.sql first.' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Could not reassign this payment.' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    assignedTo: { id: manager.id, username: manager.username, upiId: manager.upiId },
    moved: moved?.length ?? 0,
  })
}
