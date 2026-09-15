import { NextResponse } from 'next/server'
import { staticEvents } from '@/utils/data/events'

export async function GET() {
  const events = staticEvents.filter(e => e.status === 'OPEN').sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
  return NextResponse.json(events)
}
