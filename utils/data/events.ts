import fs from 'fs';
import path from 'path';

export function getEvents() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'events.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error("Failed to read events.json:", error);
    return [];
  }
}

export function getEventBySlug(slug: string) {
  return getEvents().find((e: any) => e.slug === slug);
}

export function getEventById(id: string) {
  return getEvents().find((e: any) => e.id === id);
}

// Fallback for files that haven't been updated yet, though we will update them.
export const staticEvents = getEvents();
