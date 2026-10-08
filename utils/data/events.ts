import fs from 'fs';
import path from 'path';
import { createServiceRoleClient } from '@/utils/supabase/server';

export async function getEvents() {
  try {
    const supabase = await createServiceRoleClient();
    const { data: events, error } = await supabase.from('events').select('*');
    if (error) {
      console.error("Failed to read events from DB:", error);
      throw error;
    }
    if (events && events.length > 0) {
      return events;
    }
  } catch (error) {
    console.error("Failed to fetch from DB, falling back to events.json:", error);
  }
  
  // Fallback to local file if DB fetch fails or returns empty
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'events.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error("Failed to read events.json:", error);
    return [];
  }
}

export async function getEventBySlug(slug: string) {
  const events = await getEvents();
  return events.find((e: any) => e.slug === slug);
}

export async function getEventById(id: string) {
  const events = await getEvents();
  return events.find((e: any) => e.id === id);
}

