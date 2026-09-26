import { NextResponse } from 'next/server'
import type { AdminTier } from './admin-roles'
import { getAdminTier, getCurrentUser, type EffectiveTier } from './server'

// Covers both shapes getCurrentUser() can return: a Supabase user and the
// synthetic user built for the env-credential tier admins.
type AdminUser = {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown>
}

type Guard =
  | { ok: true; tier: EffectiveTier; user: AdminUser; response: null }
  | { ok: false; tier: EffectiveTier; user: null; response: NextResponse }

// Route-level authorisation. The admin pages already redirect on tier, but the
// API routes used to check only "is anyone signed in", which let a lower tier
// call them directly. The minimum passed here mirrors the tier guard on the
// page that owns each endpoint.
export async function requireAdmin(minTier: AdminTier): Promise<Guard> {
  const tier = await getAdminTier()

  if (!tier) {
    return {
      ok: false,
      tier: 0,
      user: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  if (tier < minTier) {
    return {
      ok: false,
      tier,
      user: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  const { data: authData } = await getCurrentUser()
  const user = authData?.user
  if (!user) {
    return {
      ok: false,
      tier,
      user: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return { ok: true, tier, user, response: null }
}
