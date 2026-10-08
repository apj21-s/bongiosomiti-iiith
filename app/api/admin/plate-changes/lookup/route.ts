import { NextResponse } from 'next/server'
import { requireAdmin } from '@/utils/auth/require-admin'
import { findRegistrations } from '@/utils/data/plate-change-store'

/**
 * Looking a booking up by whatever the super admin has to hand: the
 * participant's address or name, the registration number, a single pass code,
 * or the collector's address. Super admin only - it returns somebody's whole
 * booking, which nobody below that tier has a reason to read in one piece.
 */
const REQUIRED_TIER = 3

export async function GET(request: Request) {
  const guard = await requireAdmin(REQUIRED_TIER)
  if (!guard.ok) return guard.response

  const q = new URL(request.url).searchParams.get('q') || ''
  const result = await findRegistrations(q)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result)
}
