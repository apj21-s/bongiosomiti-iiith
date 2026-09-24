import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  let user = null;
  
  // Check for tier-based admin session cookie first
  const tierSession = request.cookies.get('bangiya.samiti.iiith_dummy_session')
  if (tierSession && tierSession.value.startsWith('admin-tier-')) {
    user = {
      id: tierSession.value,
      email: 'admin',
      user_metadata: { role: 'organiser' }
    }
  }

  if (!user && process.env.DUMMY_DB === 'True') {
    const dummySession = request.cookies.get('bangiya.samiti.iiith_dummy_session')
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
