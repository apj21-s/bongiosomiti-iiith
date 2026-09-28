import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/utils/auth/require-admin'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { readLocationInput, toDatabaseRow, toPujaLocation } from '@/utils/data/puja-locations'

export const revalidate = 0

const MIGRATION_HINT =
  'Run supabase/puja-locations.sql in the Supabase SQL editor, then ' +
  'node scripts/seed-puja-locations.js to bring the existing pins across.'

function notMigrated(message: string) {
  return /puja_locations/.test(message) && /does not exist|schema cache/i.test(message)
}

/** Edits a pin. Every field is replaced, so the form always sends all of them. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(3)
  if (!guard.ok) return guard.response

  const { id } = await params

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
      .update(toDatabaseRow(input.value, guard.user.email || undefined))
      .eq('id', id)
      .select('id,name,address,lat,lng,status,sort_order')
      .maybeSingle()

    if (error) {
      if (notMigrated(error.message)) {
        return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 })
      }
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Another pin already has that name at those coordinates.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'That location no longer exists.' }, { status: 404 })
    }

    revalidatePath('/durga-puja')
    return NextResponse.json(toPujaLocation(data))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not save the location.' },
      { status: 500 }
    )
  }
}

/**
 * Removes a pin.
 *
 * A real delete, not a status change: 'inactive' already exists for a puja
 * that is only skipping a year, so reaching for Delete means the entry was
 * wrong. The row is returned so the caller can say what went.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(3)
  if (!guard.ok) return guard.response

  const { id } = await params

  try {
    const supabase = await createServiceRoleClient()
    const { data, error } = await supabase
      .from('puja_locations')
      .delete()
      .eq('id', id)
      .select('id,name,address,lat,lng,status,sort_order')
      .maybeSingle()

    if (error) {
      if (notMigrated(error.message)) {
        return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'That location no longer exists.' }, { status: 404 })
    }

    revalidatePath('/durga-puja')
    return NextResponse.json({ deleted: toPujaLocation(data) })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not delete the location.' },
      { status: 500 }
    )
  }
}
