import { NextResponse } from 'next/server'
import { isAdminOrCronRequest } from '@/lib/adminAuth'

/**
 * Lightweight auto-sync trigger for external schedulers.
 * Requires Authorization: Bearer <ADMIN_PASSWORD or CRON_SECRET>.
 * Forwards to /api/sync internally using the server-side env var.
 */
export async function GET(request: Request) {
  if (!isAdminOrCronRequest(request)) {
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
