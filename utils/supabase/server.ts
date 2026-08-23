import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  if (process.env.DUMMY_DB === 'True') {
    const { createMockClient } = await import('./mock-client')
    return createMockClient()
  }
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
          }
        },
      },
    }
  )
}

export async function createServiceRoleClient() {
  if (process.env.DUMMY_DB === 'True') {
    const { createMockClient } = await import('./mock-client')
    return createMockClient()
  }
  const cookieStore = await cookies() // Need this just to satisfy any Next.js rules about calling cookies, or just ignore since we don't need cookies for service role. Actually, Next.js requires cookies to be awaited if we use it, but service role doesn't strictly need them unless passing them through. But let's follow the standard format.
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {}
      },
    }
  )
}
