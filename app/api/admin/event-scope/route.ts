import { NextResponse } from 'next/server'
import { requireAdmin } from '@/utils/auth/require-admin'
import { getEventScope } from '@/utils/admin/event-scope'
import { ALL_EVENTS, byDateDescending } from '@/utils/admin/event-scope-shared'

export const revalidate = 0

/** The events the sidebar picker offers, and which of them is in effect. */
export async function GET() {
  const guard = await requireAdmin(1)
  if (!guard.ok) return guard.response

  const { events, event } = await getEventScope()
  return NextResponse.json({
    events: byDateDescending(events),
    selected: event ? event.id : ALL_EVENTS,
  })
}
