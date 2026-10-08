import { NextResponse } from 'next/server'
import { requireAdmin } from '@/utils/auth/require-admin'
import { approvePlateChange, cancelPlateChange } from '@/utils/data/plate-change-store'

/** Settling a change moves money and rewrites a pass. Super admin only. */
const REQUIRED_TIER = 3

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(REQUIRED_TIER)
  if (!guard.ok) return guard.response

  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Invalid change id' }, { status: 400 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const input = (body ?? {}) as Record<string, unknown>
  const action = typeof input.action === 'string' ? input.action : ''
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 500) : null
  const actor = String(guard.user.email || guard.user.id)

  if (action === 'approve') {
    const result = await approvePlateChange({ id, note, actor })
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json(result.change)
  }

  if (action === 'cancel') {
    const result = await cancelPlateChange({ id, note, actor })
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json(result.change)
  }

  return NextResponse.json({ error: 'action must be approve or cancel' }, { status: 400 })
}
