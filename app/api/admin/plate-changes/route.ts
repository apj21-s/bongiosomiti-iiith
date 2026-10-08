import { NextResponse } from 'next/server'
import { requireAdmin } from '@/utils/auth/require-admin'
import { listPlateChanges, raisePlateChange } from '@/utils/data/plate-change-store'

/**
 * Only a super admin, both to raise a change and to see the queue.
 *
 * A manager has every reason to want one - the money runs through them - but
 * the whole point of the flow is that the person who confirms the transfer is
 * not the person holding the money.
 */
const REQUIRED_TIER = 3

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  const guard = await requireAdmin(REQUIRED_TIER)
  if (!guard.ok) return guard.response

  const status = new URL(request.url).searchParams.get('status') || undefined
  if (status && !['AWAITING_TRANSFER', 'APPROVED', 'CANCELLED'].includes(status)) {
    return NextResponse.json({ error: 'Unknown status' }, { status: 400 })
  }

  const result = await listPlateChanges(status)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result)
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
  const ticketId = typeof input.ticketId === 'string' ? input.ticketId.trim() : ''
  const toPlate = typeof input.toPlate === 'string' ? input.toPlate.trim() : ''
  const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 500) : null

  if (!UUID.test(ticketId)) return NextResponse.json({ error: 'Choose a pass to change.' }, { status: 400 })
  if (!toPlate) return NextResponse.json({ error: 'Choose the plate to change to.' }, { status: 400 })

  const result = await raisePlateChange({
    ticketId,
    toPlate,
    // Left undefined unless it was actually typed, so the price table decides
    // by default and a blank box does not read as "no difference".
    delta: input.delta === '' || input.delta === null || input.delta === undefined ? undefined : input.delta,
    reason,
    actor: String(guard.user.email || guard.user.id),
  })

  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.change, { status: 201 })
}
