import { requireAdmin } from '@/utils/auth/require-admin'
import { NextResponse } from 'next/server'
import { getEvents } from '@/utils/data/events'

export async function GET() {
  const guard = await requireAdmin(3)
  if (!guard.ok) return guard.response

  return NextResponse.json(getEvents())
}

export async function POST(request: Request) {
  const guard = await requireAdmin(3)
  if (!guard.ok) return guard.response

  return NextResponse.json({ error: 'Creating events is disabled' }, { status: 403 })
}
