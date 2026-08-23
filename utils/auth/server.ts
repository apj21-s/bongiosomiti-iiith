import { createClient } from '@/utils/supabase/server'
import { dummyLogin, dummyLogout, getDummyUser } from './dummy-auth'

export function isDummyMode() {
  return process.env.DUMMY_DB === 'True'
}

export async function getCurrentUser() {
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
  if (isDummyMode()) {
    return dummyLogout()
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()
  return { error: error?.message || null }
}
