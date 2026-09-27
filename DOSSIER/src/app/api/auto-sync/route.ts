import { NextResponse } from 'next/server'

/**
 * Lightweight auto-sync trigger.
 * Called by the admin page's setInterval every 2 minutes.
 * Also callable by external cron jobs (pass ?secret=ADMIN_PASSWORD).
 * Forwards to /api/sync internally using the server-side env var.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  // Verify via env secret so the URL doesn't need to expose a password
  // Also accepts no secret if called from the same server (internal)
  const expectedSecret = process.env.ADMIN_PASSWORD
  if (secret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Determine base URL for internal fetch
    const host = request.headers.get('host') ?? 'localhost:3000'
    const protocol = host.startsWith('localhost') ? 'http' : 'https'
    const base = process.env.NEXT_PUBLIC_APP_URL ?? `${protocol}://${host}`

    const res = await fetch(`${base}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
    })

    const data = await res.json()
    return NextResponse.json({ ...data, auto: true, ts: new Date().toISOString() })
  } catch (err) {
    console.error('auto-sync error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
