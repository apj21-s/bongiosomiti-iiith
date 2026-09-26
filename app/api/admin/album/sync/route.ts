import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const photos = await request.json();
    
    if (!Array.isArray(photos)) {
      return NextResponse.json({ success: false, error: 'Invalid payload, expected array' }, { status: 400 });
    }

    // Convert array to database rows with sort_order
    const dbRows = photos.map((photo, index) => ({
      id: photo.id,
      title: photo.title,
      date: photo.date,
      src: photo.src,
      pos: photo.pos,
      sort_order: index
    }));

    // Upsert all photos to Supabase
    const { error } = await supabase
      .from('album_photos')
      .upsert(dbRows, { onConflict: 'id' });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json({ success: false, error: 'Failed to sync album data to database' }, { status: 500 });
  }
}
