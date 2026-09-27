import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Signing out is a POST, and only a POST.
 *
 * It used to answer GET, reached from a `<Link href="/api/auth/signout">` in
 * the header. Next prefetches links as they enter the viewport, so simply
 * arriving on the dashboard fired this route in the background and destroyed
 * the session the reader had just created. The page they were looking at kept
 * rendering — it was already sent — so nothing looked wrong until the next
 * navigation, which found no session and bounced to /login. Clicking through
 * to a trip was usually that next navigation, which is why the trip pages
 * appeared to be the broken ones.
 *
 * A GET that changes state is prefetchable, link-previewable and
 * crawler-visible. This one is a form POST now; see DashboardHeader.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  // 303, not 307: the redirect must turn the POST into a GET of /login.
  const { origin } = new URL(request.url)
  return NextResponse.redirect(`${origin}/login`, 303)
}
