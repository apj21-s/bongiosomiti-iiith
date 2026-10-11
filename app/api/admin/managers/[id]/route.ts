import { NextResponse } from 'next/server'
import { requireAdmin } from '@/utils/auth/require-admin'
import { deleteManager, setManagerActive, setManagerEvents } from '@/utils/auth/managers'
import { getEventScope } from '@/utils/admin/event-scope'

const REQUIRED_TIER = 3
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(REQUIRED_TIER)
  if (!guard.ok) return guard.response

  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Invalid profile id' }, { status: 400 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const input = (body ?? {}) as Record<string, unknown>

  // Which events this manager collects for, replacing whatever was set.
  if (Array.isArray(input.eventIds)) {
    const known = new Set((await getEventScope()).events.map((e) => e.id))
    const eventIds = input.eventIds.filter((id): id is string => typeof id === 'string')
    if (eventIds.some((id) => !known.has(id))) {
      return NextResponse.json({ error: 'One of those events does not exist' }, { status: 400 })
    }
    const result = await setManagerEvents(id, eventIds)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
    return NextResponse.json({ success: true, eventIds })
  }

  const isActive = input.isActive
  if (typeof isActive !== 'boolean') {
    return NextResponse.json({ error: 'isActive must be true or false' }, { status: 400 })
  }

  if (!(await setManagerActive(id, isActive))) {
    return NextResponse.json({ error: 'Could not update the profile' }, { status: 500 })
  }

  return NextResponse.json({ success: true, isActive })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(REQUIRED_TIER)
  if (!guard.ok) return guard.response

  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Invalid profile id' }, { status: 400 })

  if (!(await deleteManager(id))) {
    return NextResponse.json({ error: 'Could not delete the profile' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
