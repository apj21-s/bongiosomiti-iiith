import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export const revalidate = 0; // Prevent caching so album updates are instant

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    const { data: photos, error } = await supabase
      .from('album_photos')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      // If table doesn't exist yet, fallback to the local JSON file
      if (error.code === '42P01') {
        const filepath = path.join(process.cwd(), 'public', 'data', 'album.json');
        if (fs.existsSync(filepath)) {
          const fileData = fs.readFileSync(filepath, 'utf8');
          return NextResponse.json(JSON.parse(fileData));
        }
      }
      throw error;
    }

    if (!photos || photos.length === 0) {
      // Fallback to local JSON file if empty
      const filepath = path.join(process.cwd(), 'public', 'data', 'album.json');
      if (fs.existsSync(filepath)) {
        const fileData = fs.readFileSync(filepath, 'utf8');
        return NextResponse.json(JSON.parse(fileData));
      }
      return NextResponse.json([]);
    }

    // Format back to the expected array format for the frontend
    const formattedPhotos = photos.map(row => ({
      id: row.id,
      title: row.title,
      date: row.date,
      src: row.src,
      pos: row.pos,
    }));

    return NextResponse.json(formattedPhotos);
  } catch (error) {
    console.error("Fetch album error:", error);
    
    // Fallback to local JSON file
    try {
      const filepath = path.join(process.cwd(), 'public', 'data', 'album.json');
      if (fs.existsSync(filepath)) {
        const fileData = fs.readFileSync(filepath, 'utf8');
        return NextResponse.json(JSON.parse(fileData));
      }
    } catch (e) {
      // Ignore fallback error
    }
    
    return NextResponse.json({ success: false, error: 'Failed to fetch album data' }, { status: 500 });
  }
}
