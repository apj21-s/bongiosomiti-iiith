import { toPujaLocation, PujaLocation } from './puja-locations'
import { createServiceRoleClient } from '@/utils/supabase/server'

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
