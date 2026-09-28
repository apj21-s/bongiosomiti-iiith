/**
 * The pujas on the Durga Puja map.
 *
 * One source: the puja_locations table. It used to be a JSON file in
 * public/data, which a super admin cannot edit in production - Vercel's
 * filesystem is read-only, so the write went nowhere and the map kept showing
 * last year's pins. The old file is in others/ and is only the seed.
 *
 * The parsing and validation here is shared by the API routes and the seed
 * script, so a coordinate typed into the admin form and a coordinate read out
 * of the JSON are checked by exactly the same rules.
 */

export type PujaLocation = {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  status: string
  sortOrder: number
  /** Derived, never stored - see directionsFor. */
  directions: string
}

/** A row as the table holds it. */
type Row = {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  status: string | null
  sort_order: number | null
}

/**
 * The Google Maps link for a pin.
 *
 * Derived rather than stored. The old JSON kept a `directions` URL beside the
 * coordinates, which meant editing a coordinate left the link pointing at the
 * previous spot - two fields saying where one puja is, disagreeing.
 */
export function directionsFor(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

export function toPujaLocation(row: Row): PujaLocation {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    status: row.status || 'active',
    sortOrder: row.sort_order ?? 0,
    directions: directionsFor(row.lat, row.lng),
  }
}

export type LocationInput = {
  name: string
  address: string
  lat: number
  lng: number
  status: string
  sortOrder: number
}

/**
 * Reads one coordinate.
 *
 * Accepts a number or a string, because the admin form sends text and people
 * paste coordinates with degree signs and stray spaces in them. Returns null
 * rather than NaN so the caller has to deal with it.
 */
export function readCoordinate(value: unknown, limit: 90 | 180): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && Math.abs(value) <= limit ? value : null
  }
  if (typeof value !== 'string') return null

  const cleaned = value.trim().replace(/[°\s]/g, '')
  if (cleaned === '') return null

  const n = Number(cleaned)
  if (!Number.isFinite(n) || Math.abs(n) > limit) return null
  return n
}

/**
 * Pulls a lat/lng out of something pasted from Google Maps.
 *
 * Maps hands out coordinates in several shapes depending on where they are
 * copied from, and retyping them into two boxes is how a digit goes missing.
 * Recognised: "17.385, 78.486", "17.385 78.486", and a maps URL containing
 * either @lat,lng or query=lat,lng.
 */
export function parseCoordinatePair(text: string): { lat: number; lng: number } | null {
  const fromUrl = text.match(/(?:@|query=|q=|ll=)(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  const pair = fromUrl
    ? [fromUrl[1], fromUrl[2]]
    : text.trim().split(/\s*,\s*|\s+/)

  if (pair.length !== 2) return null

  const lat = readCoordinate(pair[0], 90)
  const lng = readCoordinate(pair[1], 180)
  if (lat === null || lng === null) return null

  return { lat, lng }
}

/**
 * What a pin's status may be.
 *
 * Only 'active' is drawn on the map; the rest are kept so a puja that stops
 * for a year, or for good, does not have to be deleted and re-entered with
 * its coordinates typed again. The last two came with the original list and
 * say something 'inactive' does not, so they are kept rather than flattened.
 */
export const STATUSES = ['active', 'inactive', 'temporarily_closed', 'no_longer_exists'] as const

/**
 * Validates what the admin form or the seed script sends.
 *
 * Returns either the cleaned values or every problem at once - one round trip
 * per mistake makes a six-field form miserable to fill in.
 */
export function readLocationInput(
  body: Record<string, unknown>
): { ok: true; value: LocationInput } | { ok: false; errors: string[] } {
  const errors: string[] = []

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (name === '') errors.push('Name is required.')
  else if (name.length > 160) errors.push('Name is too long (160 characters maximum).')

  const address = typeof body.address === 'string' ? body.address.trim() : ''
  if (address === '') errors.push('Address is required.')
  else if (address.length > 300) errors.push('Address is too long (300 characters maximum).')

  const lat = readCoordinate(body.lat, 90)
  if (lat === null) errors.push('Latitude must be a number between -90 and 90.')

  const lng = readCoordinate(body.lng, 180)
  if (lng === null) errors.push('Longitude must be a number between -180 and 180.')

  const status = typeof body.status === 'string' && body.status.trim() !== ''
    ? body.status.trim().toLowerCase()
    : 'active'
  if (!(STATUSES as readonly string[]).includes(status)) {
    errors.push(`Status must be one of: ${STATUSES.join(', ')}.`)
  }

  const rawOrder = body.sortOrder ?? body.sort_order ?? 0
  const sortOrder = Number(rawOrder)
  if (!Number.isInteger(sortOrder)) errors.push('Sort order must be a whole number.')

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: { name, address, lat: lat as number, lng: lng as number, status, sortOrder },
  }
}

/**
 * Every puja on the map, in display order.
 *
 * `onlyActive` is what the public map asks for; the admin list wants the
 * inactive ones too so they can be switched back on.
 *
 * An unreachable database returns an empty list rather than throwing: the
 * Durga Puja page is mostly text and a map, and a map with no pins is a
 * better page than a 500.
 */
export async function getPujaLocations(
  { onlyActive = true }: { onlyActive?: boolean } = {}
): Promise<PujaLocation[]> {
  try {
    // Imported here rather than at the top of the file so that the parsing and
    // validation above stay free of Next's "@/" alias. scripts/seed-puja-
    // locations.js runs this module under bare node, which cannot resolve it.
    const { createServiceRoleClient } = await import('@/utils/supabase/server')

    const supabase = await createServiceRoleClient()
    let query = supabase
      .from('puja_locations')
      .select('id,name,address,lat,lng,status,sort_order')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (onlyActive) query = query.eq('status', 'active')

    const { data, error } = await query
    if (error) {
      console.error('Could not read puja_locations:', error.message)
      return []
    }

    return (data || []).map(toPujaLocation)
  } catch (e) {
    console.error('Could not read puja_locations:', e instanceof Error ? e.message : e)
    return []
  }
}

/** The shape the table takes, from the shape everything else uses. */
export function toDatabaseRow(input: LocationInput, updatedBy?: string) {
  return {
    name: input.name,
    address: input.address,
    lat: input.lat,
    lng: input.lng,
    status: input.status,
    sort_order: input.sortOrder,
    updated_at: new Date().toISOString(),
    ...(updatedBy ? { updated_by: updatedBy } : {}),
  }
}
