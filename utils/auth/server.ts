import { createClient } from '@/utils/supabase/server'
import { dummyLogin, dummyLogout, getDummyUser } from './dummy-auth'
import { matchAdminCredentials, getTierForEmail, type AdminTier } from './admin-roles'

export function isDummyMode() {
  return process.env.DUMMY_DB === 'True'
}

export async function getCurrentUser() {
  // Check for tier-based admin session first
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const tierSession = cookieStore.get('bangiya.samiti.iiith_dummy_session')
  if (tierSession && tierSession.value.startsWith('admin-tier-')) {
    const tier = tierSession.value.replace('admin-tier-', '')
    return {
      data: {
        user: {
          id: `admin-tier-${tier}`,
          email: `tier${tier}@admin`,
          user_metadata: { role: 'organiser', tier: parseInt(tier) }
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
    // Use the dummy auth system for env-based admins
    // Store tier info in cookie
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    
    // Set admin session
    cookieStore.set('bangiya.samiti.iiith_dummy_session', `admin-tier-${tier}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 // 1 day
    })
    
    // Store tier separately for easy lookup
    cookieStore.set('bangiya.samiti.iiith_admin_tier', String(tier), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24
    })
    
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
  cookieStore.delete('bangiya.samiti.iiith_dummy_session')
  cookieStore.delete('bangiya.samiti.iiith_admin_tier')

  if (isDummyMode()) {
    return dummyLogout()
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()
  return { error: error?.message || null }
}

export async function getAdminTier(): Promise<AdminTier> {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const tierCookie = cookieStore.get('bangiya.samiti.iiith_admin_tier')
  
  if (tierCookie) {
    const tier = parseInt(tierCookie.value)
    if (tier === 1 || tier === 2 || tier === 3) return tier
  }
  
  // Default: check if logged in via supabase (super admin)
  return 3
}
