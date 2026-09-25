import { getCurrentUser } from '@/utils/auth/server'
import { NextResponse } from 'next/server'
import { getEvents } from '@/utils/data/events'

export async function GET() {
  const { data: authData } = await getCurrentUser()
  const user = authData?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json(getEvents())
}

export async function POST(request: Request) {
  const { data: authData } = await getCurrentUser()
  const user = authData?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({ error: 'Creating events is disabled' }, { status: 403 })
}
