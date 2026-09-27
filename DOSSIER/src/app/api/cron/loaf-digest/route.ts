import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/adminAuth'

// Vercel calls this with: Authorization: Bearer <CRON_SECRET>
// Proxies to /api/ai/loaf-digest using admin password.
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const res = await fetch(`${baseUrl}/api/ai/loaf-digest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
  })

  const data = await res.json()

  console.log('[cron/loaf-digest] completed at', new Date().toISOString(), JSON.stringify(data.story))

  return NextResponse.json({
    triggered_at: new Date().toISOString(),
    success: data.success,
    story: data.story,
    notion_page_id: data.notion_page_id,
  })
}
