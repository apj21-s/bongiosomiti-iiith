import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/utils/auth/require-admin';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  // This route had no authentication at all: any caller could overwrite the
  // published album.
  const guard = await requireAdmin(3)
  if (!guard.ok) return guard.response

  try {
    const photos = await request.json();
    
    if (!Array.isArray(photos)) {
      return NextResponse.json({ success: false, error: 'Invalid payload, expected array' }, { status: 400 });
    }

    const filepath = path.join(process.cwd(), 'public', 'data', 'album.json');
    const data = JSON.stringify(photos, null, 2);

    await writeFile(filepath, data, 'utf-8');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json({ success: false, error: 'Failed to sync album data' }, { status: 500 });
  }
}
