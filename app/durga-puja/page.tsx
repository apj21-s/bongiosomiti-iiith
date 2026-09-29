import { getPujaLocations } from '@/utils/data/puja-locations-server'
import DurgaPujaClient, { type MapPuja } from './DurgaPujaClient'

// The pins are edited from /admin/map-locations, so the page cannot be built
// once and cached - an edit has to show on the next request.
export const revalidate = 0

/**
 * The Durga Puja map.
 *
 * A thin server component so the pins can come from the database, which is
 * where they are kept now. They used to be imported straight from
 * public/data/pujas-raw-65-finalversion-1.json, which meant a super admin
 * could not change them without a commit and a deploy - and on Vercel could
 * not change them at all, the filesystem being read-only.
 *
 * The rename to the table's columns happens here rather than in the client,
 * so the map code below keeps the field names it was written against.
 */
export default async function DurgaPujaPage() {
  const locations = await getPujaLocations()

  const pujas: MapPuja[] = locations.map((l) => ({
    id: l.id,
    puja: l.name,
    venue: l.address,
    lat: l.lat,
    lng: l.lng,
    status: l.status,
    directions: l.directions,
  }))

  return <DurgaPujaClient pujas={pujas} />
}
