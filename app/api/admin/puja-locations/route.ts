import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/utils/auth/require-admin'
import { createServiceRoleClient } from '@/utils/supabase/server'
import {
  getPujaLocations,
  readLocationInput,
  toDatabaseRow,
  toPujaLocation,
} from '@/utils/data/puja-locations'

export const revalidate = 0

/** The table does not exist yet - the migration has not been run. */
function notMigrated(message: string) {
  return /puja_locations/.test(message) && /does not exist|schema cache/i.test(message)
}

const MIGRATION_HINT =
  'Run supabase/puja-locations.sql in the Supabase SQL editor, then ' +
  'node scripts/seed-puja-locations.js to bring the existing pins across.'

/**
 * Lists every pin, including the inactive ones.
 *
 * Super admin only, same as the writes: the public map reads the table
 * directly through getPujaLocations() and never comes here.
 */
export async function GET() {
  const guard = await requireAdmin(3)
  if (!guard.ok) return guard.response

  const locations = await getPujaLocations({ onlyActive: false })
  return NextResponse.json(locations)
}

/** Adds a pin. */
export async function POST(request: Request) {
  const guard = await requireAdmin(3)
  if (!guard.ok) return guard.response

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const input = readLocationInput(body)
  if (!input.ok) {
    return NextResponse.json({ error: input.errors.join(' ') }, { status: 400 })
  }

  try {
    const supabase = await createServiceRoleClient()
    const { data, error } = await supabase
      .from('puja_locations')
      .insert(toDatabaseRow(input.value, guard.user.email || undefined))
      .select('id,name,address,lat,lng,status,sort_order')
      .single()

    if (error) {
      if (notMigrated(error.message)) {
        return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 })
      }
      // The unique index on (name, lat, lng) - see puja-locations.sql.
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'That puja is already on the map at those coordinates.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    revalidatePath('/durga-puja')
    return NextResponse.json(toPujaLocation(data), { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not add the location.' },
      { status: 500 }
    )
  }
}
