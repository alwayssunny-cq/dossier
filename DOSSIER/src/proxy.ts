import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Called for the refresh, not the answer: getUser rotates the token and
  // setAll above writes the new pair onto supabaseResponse. Who gets in is
  // decided by the pages.
  await supabase.auth.getUser()

  // Deliberately no redirects here.
  //
  // Deciding access in the proxy meant one failure mode took the whole app
  // down: if the session could not be read at the edge, every protected route
  // bounced to login — which is what happened after signing in, and what made
  // the verify button look dead when it had in fact worked. Pages and layouts
  // enforce access now, reading the cookie the way the dashboard always has.
  // If this refresh fails, the worst case is a session that expires early,
  // not a reader locked out.

  return supabaseResponse
}

export const config = {
  // API routes are excluded: they authenticate with the service-role client and
  // never read this session, so refreshing it before each one was a Supabase
  // round trip per call that bought nothing and cost latency on every request.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
