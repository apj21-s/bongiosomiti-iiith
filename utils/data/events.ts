import { createClient } from '@/utils/supabase/server';

export async function getEvents() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('events').select('*');
    if (error) {
      console.error("Supabase events fetch error:", error);
      return [];
    }
    
    // Backfill config from events.json if it's missing in Supabase
    let events = data || [];
    const hasMissingConfig = events.some(e => !e.config || Object.keys(e.config).length === 0);
    
    if (hasMissingConfig) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const staticPath = path.join(process.cwd(), 'public', 'data', 'events.json');
        const fileContents = fs.readFileSync(staticPath, 'utf8');
        const localEvents = JSON.parse(fileContents);
        
        events = events.map(e => {
          if (!e.config || Object.keys(e.config).length === 0) {
            const localE = localEvents.find((le: any) => le.slug === e.slug);
            if (localE && localE.config) {
              e.config = localE.config;
              // Attempt to save this backfill to Supabase in the background
              supabase.from('events').update({ config: localE.config }).eq('slug', e.slug).then();
            }
          }
          return e;
        });
      } catch (e) {
        console.error("Failed to backfill config:", e);
      }
    }
    
    return events;
  } catch (error) {
    console.error("Failed to read events from Supabase:", error);
    return [];
  }
}

export async function updateEvents(newEvents: any[]) {
  // Not used in batch anymore, we update single events.
}

export async function getEventBySlug(slug: string) {
  const events = await getEvents();
  return events.find((e: any) => e.slug === slug);
}

export async function getEventById(id: string) {
  const events = await getEvents();
  return events.find((e: any) => e.id === id);
}
