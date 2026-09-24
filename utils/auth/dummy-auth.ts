import { cookies } from 'next/headers'

const DUMMY_SESSION_COOKIE = 'bangiya.samiti.iiith_dummy_session'

export async function dummyLogin(email: string, password: string) {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@bangiya.samiti.iiith.local'
  const adminPassword = process.env.DUMMY_ADMIN_PASSWORD || 'admin123'

  if (email === adminEmail && password === adminPassword) {
    const cookieStore = await cookies()
    cookieStore.set(DUMMY_SESSION_COOKIE, 'dummy-admin-session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 // 1 day
    })
    return { error: null }
  }

  return { error: { message: 'Invalid dummy credentials' } }
}

export async function dummyLogout() {
  const cookieStore = await cookies()
  cookieStore.delete(DUMMY_SESSION_COOKIE)
  return { error: null }
}

export async function getDummyUser() {
  const cookieStore = await cookies()
  const session = cookieStore.get(DUMMY_SESSION_COOKIE)

  if (session && session.value === 'dummy-admin-session') {
    return {
      data: {
        user: {
          id: 'dummy-admin',
          email: process.env.DUMMY_ADMIN_EMAIL || 'admin@bangiya.samiti.iiith.local',
          user_metadata: { role: 'organiser' }
        }
      },
      error: null
    }
  }

  return { data: { user: null }, error: null }
}
