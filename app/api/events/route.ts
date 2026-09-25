import { NextResponse } from 'next/server'
import { getEvents } from '@/utils/data/events'

export async function GET() {
  const events = getEvents().filter((e: any) => e.status === 'OPEN').sort((a: any, b: any) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
  return NextResponse.json(events)
}
