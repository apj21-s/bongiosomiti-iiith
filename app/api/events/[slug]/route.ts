import { NextResponse } from 'next/server'
import { getEventBySlug } from '@/utils/data/events'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const event = getEventBySlug(slug)

  if (!event) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  return NextResponse.json(event)
}
