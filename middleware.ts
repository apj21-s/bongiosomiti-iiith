import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, readSessionToken } from '@/utils/auth/session'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  let user = null;

  // Signed tier-based admin session. The signature is what makes this
  // trustworthy: the cookie value alone proves nothing.
  const tierSession = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value)
  if (tierSession) {
    user = {
      id: `admin-tier-${tierSession.tier}`,
      email: 'admin',
      user_metadata: { role: 'organiser', tier: tierSession.tier }
    }
  }

  if (!user && process.env.DUMMY_DB === 'True') {
    const dummySession = request.cookies.get(SESSION_COOKIE)
    if (dummySession && dummySession.value === 'dummy-admin-session') {
      user = {
        id: 'dummy-admin',
        email: process.env.DUMMY_ADMIN_EMAIL || 'admin@bangiya.samiti.iiith.local',
        user_metadata: { role: 'organiser' }
      }
    }
  }
  
  if (!user) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )
    const { data } = await supabase.auth.getUser()
    user = data.user
  }

  if (request.nextUrl.pathname.startsWith('/admin') && !request.nextUrl.pathname.startsWith('/admin/login')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }
  }

  // Handle /scanner redirect to /admin/scanner
  if (request.nextUrl.pathname.startsWith('/scanner')) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/scanner'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
