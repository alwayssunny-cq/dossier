import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/adminAuth'

// Vercel calls this with: Authorization: Bearer <CRON_SECRET>
// The route proxies to the main sync endpoint using the admin password.
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const res = await fetch(`${baseUrl}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
  })

  const data = await res.json()

  console.log('[cron/sync] completed at', new Date().toISOString(), JSON.stringify(data.results))

  return NextResponse.json({
    triggered_at: new Date().toISOString(),
    success: data.success,
    results: data.results,
  })
}
