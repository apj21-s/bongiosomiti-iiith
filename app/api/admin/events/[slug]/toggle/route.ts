import { getCurrentUser } from '@/utils/auth/server'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  
  const { data: authData } = await getCurrentUser()
  const user = authData?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'events.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const events = JSON.parse(fileContents);
    
    const eventIndex = events.findIndex((e: any) => e.slug === slug);
    if (eventIndex === -1) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    
    // Toggle status
    events[eventIndex].status = events[eventIndex].status === 'OPEN' ? 'LOCKED' : 'OPEN';
    
    fs.writeFileSync(filePath, JSON.stringify(events, null, 2), 'utf8');
    
    return NextResponse.json({ success: true, status: events[eventIndex].status });
  } catch (error: any) {
    console.error("Error toggling event:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
