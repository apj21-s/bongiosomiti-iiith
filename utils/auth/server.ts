import { createClient } from '@/utils/supabase/server'
import { dummyLogin, dummyLogout, getDummyUser } from './dummy-auth'
import { matchAdminCredentials, getTierForEmail, type AdminTier } from './admin-roles'
import {
  SESSION_COOKIE,
  LEGACY_TIER_COOKIE,
  createSessionToken,
  readSessionToken,
  sessionCookieOptions,
} from './session'

// 0 means "authenticated but not an authorised admin".
export type EffectiveTier = AdminTier | 0

export function isDummyMode() {
  return process.env.DUMMY_DB === 'True'
}

async function getVerifiedTierSession() {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  return readSessionToken(cookieStore.get(SESSION_COOKIE)?.value)
}

export async function getCurrentUser() {
  // Signed tier session (the env-credential admins).
  const session = await getVerifiedTierSession()
  if (session) {
    return {
      data: {
        user: {
          id: `admin-tier-${session.tier}`,
          email: `tier${session.tier}@admin`,
          user_metadata: { role: 'organiser', tier: session.tier }
        }
      },
      error: null
    }
  }

  if (isDummyMode()) {
    return getDummyUser()
  }
  const supabase = await createClient()
  return supabase.auth.getUser()
}

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  // Check tier-based credentials first
  const tier = matchAdminCredentials(email, password)
  if (tier) {
    const token = await createSessionToken(tier)
    if (!token) {
      return { error: 'Server session configuration is incomplete. Contact the administrator.' }
    }

    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()

    cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions())
    // The tier now travels inside the signed session; drop the old unsigned copy.
    cookieStore.delete(LEGACY_TIER_COOKIE)

    return { error: null }
  }

  if (isDummyMode()) {
    return dummyLogin(email, password)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  return { error: null }
}

export async function logout() {
  // Always clear tier cookies
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
  cookieStore.delete(LEGACY_TIER_COOKIE)

  if (isDummyMode()) {
    return dummyLogout()
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()
  return { error: error?.message || null }
}

export async function getAdminTier(): Promise<EffectiveTier> {
  const session = await getVerifiedTierSession()
  if (session) return session.tier

  if (isDummyMode()) {
    const { data } = await getDummyUser()
    return data?.user ? 3 : 0
  }

  // Supabase-auth admins: being signed in is not enough, the account must also
  // have an admin_profiles row. Without this check any user in the Supabase
  // project would inherit full access.
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user
  if (!user) return 0

  const { data: profile } = await supabase
    .from('admin_profiles')
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    console.warn(`[auth] Supabase user ${user.id} has no admin_profiles row; denying admin access.`)
    return 0
  }

  // An explicitly configured tier wins; otherwise a provisioned admin profile
  // keeps the super-admin level it has always had.
  return getTierForEmail(profile.email || user.email || '') || 3
}
