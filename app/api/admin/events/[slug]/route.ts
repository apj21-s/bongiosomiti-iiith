import { requireAdmin } from '@/utils/auth/require-admin'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const guard = await requireAdmin(3)
  if (!guard.ok) return guard.response

  return NextResponse.json({ error: 'Deleting events is disabled' }, { status: 403 })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const guard = await requireAdmin(3)
  if (!guard.ok) return guard.response

  try {
    const updates = await request.json()
    const filePath = path.join(process.cwd(), 'public', 'data', 'events.json')
    const events = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    
    const eventIndex = events.findIndex((e: any) => e.slug === slug)
    if (eventIndex === -1) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    events[eventIndex] = { ...events[eventIndex], ...updates }
    fs.writeFileSync(filePath, JSON.stringify(events, null, 2))
    
    return NextResponse.json(events[eventIndex])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
