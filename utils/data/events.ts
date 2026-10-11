import fs from 'fs';
import path from 'path';
import { createServiceRoleClient } from '@/utils/supabase/server';
import { todayInIndia } from '@/utils/admin/event-scope-shared';

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


/**
 * Whether an event is taking registrations right now, read fresh from the
 * database.
 *
 * Not through getEvents(): that falls back to public/data/events.json when the
 * database cannot be read, and the file can still say OPEN for an event an
 * admin closed minutes ago (on Vercel the toggle cannot write it). For the
 * question "may this registration go in", not knowing is answered as no -
 * `known: false` - and the caller refuses rather than guesses.
 *
 * Closed means any status but OPEN, or the event's day already behind us.
 */
export type OpenCheck = { known: true; open: boolean; status: string } | { known: false }

export async function eventOpenNow(slug: string): Promise<OpenCheck> {
  try {
    const supabase = await createServiceRoleClient()
    const { data, error } = await supabase
      .from('events')
      .select('status, event_date')
      .eq('slug', slug)
      .maybeSingle()
    if (error) return { known: false }
    if (!data) return { known: true, open: false, status: 'NOT_FOUND' }

    const status = String(data.status || '')
    const day = String(data.event_date || '').slice(0, 10)
    if (day && day < todayInIndia()) return { known: true, open: false, status: 'CLOSED' }
    return { known: true, open: status === 'OPEN', status }
  } catch {
    return { known: false }
  }
}
