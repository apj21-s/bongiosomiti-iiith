/**
 * Keeping public/data/events.json and the events table saying the same thing.
 *
 * The site reads the JSON file - every page, every API route, through
 * `utils/data/events.ts`. The database row exists for the things the file
 * cannot do: tickets.event_id points at it, and the admin counts come off it.
 * Two stores for one fact is a standing invitation to drift, and they had:
 * the row still said CLOSE, "Community Courtyard" and 12 October while the
 * file said LOCKED, "IIIT HYDERABAD" and the 10th.
 *
 * So the file is the truth and the row is its mirror. This module holds the
 * mapping between them and the comparison that proves they agree; the writer
 * updates both, and scripts/sync-events.js reconciles or reports on demand.
 *
 * Kept free of imports so it can be exercised on its own.
 */

/**
 * Whether this deployment may write the shared events rows.
 *
 * Every deployment pointed at this Supabase project - the live site, this
 * branch, a preview - reads and writes one events table. The file is per
 * branch; the row is not. So opening an event here would reach into whatever
 * else is pointed at the same project, which is not what a dev branch is for.
 *
 * Only the deployment that owns those rows sets EVENTS_DB_WRITES=true, and
 * only it mirrors. Everywhere else the edit stays in that deployment's own
 * events.json, which is exactly as far as it should travel. Off by default, so
 * a new environment is isolated until somebody says otherwise.
 */
export function ownsEventRows(): boolean {
  return process.env.EVENTS_DB_WRITES === 'true'
}

/** The columns the events table actually has. config and created_at are file-only. */
export const MIRRORED_FIELDS = [
  'id',
  'slug',
  'name',
  'event_date',
  'venue',
  'capacity',
  'price',
  'category',
  'description',
  'image_url',
  'status',
  'config',
] as const

export type MirroredField = (typeof MIRRORED_FIELDS)[number]
export type EventRecord = Record<string, unknown>

/** The row this file event should have in the database. */
export function toDatabaseRow(event: EventRecord): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  for (const field of MIRRORED_FIELDS) {
    if (event[field] !== undefined) row[field] = event[field]
  }
  return row
}

function same(a: unknown, b: unknown): boolean {
  // Dates arrive from Postgres as YYYY-MM-DD and from the file the same way,
  // but a timestamp would not match on its string alone.
  if (a instanceof Date) a = a.toISOString().slice(0, 10)
  if (b instanceof Date) b = b.toISOString().slice(0, 10)
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  if (typeof a === 'string' && typeof b === 'string') return a === b
  if (a === null || a === undefined) return b === null || b === undefined
  return a === b
}

export type FieldDrift = { field: MirroredField; file: unknown; database: unknown }

/** Where a file event and its row disagree. Empty means they match. */
export function driftBetween(event: EventRecord, row: EventRecord | null | undefined): FieldDrift[] {
  if (!row) {
    return [{ field: 'slug', file: event.slug, database: null }]
  }

  const drift: FieldDrift[] = []
  for (const field of MIRRORED_FIELDS) {
    if (event[field] === undefined) continue
    if (!same(event[field], row[field])) {
      drift.push({ field, file: event[field], database: row[field] ?? null })
    }
  }
  return drift
}

export type SyncReport = {
  inSync: boolean
  missingFromDatabase: string[]
  drifted: { slug: string; fields: FieldDrift[] }[]
  onlyInDatabase: string[]
}

/**
 * Compares the whole file against the whole table.
 *
 * A row with no file entry is reported but never deleted: tickets point at
 * these, and an event that has left the JSON is still an event people hold
 * passes for.
 */
export function compareEvents(fileEvents: EventRecord[], rows: EventRecord[]): SyncReport {
  const bySlug = new Map(rows.map((row) => [String(row.slug), row]))

  const missingFromDatabase: string[] = []
  const drifted: { slug: string; fields: FieldDrift[] }[] = []

  for (const event of fileEvents) {
    const slug = String(event.slug)
    const row = bySlug.get(slug)
    if (!row) {
      missingFromDatabase.push(slug)
      continue
    }
    const fields = driftBetween(event, row)
    if (fields.length > 0) drifted.push({ slug, fields })
  }

  const fileSlugs = new Set(fileEvents.map((e) => String(e.slug)))
  const onlyInDatabase = rows.map((r) => String(r.slug)).filter((slug) => !fileSlugs.has(slug))

  return {
    inSync: missingFromDatabase.length === 0 && drifted.length === 0,
    missingFromDatabase,
    drifted,
    onlyInDatabase,
  }
}
