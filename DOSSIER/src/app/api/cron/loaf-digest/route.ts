import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/adminAuth'
import { runLoafDigest } from '@/lib/loafDigest'

// Vercel calls this with: Authorization: Bearer <CRON_SECRET>
// Runs the digest in-process: an HTTP call back to /api/ai/loaf-digest would
// be stopped by Vercel Authentication.
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { status, body: data } = await runLoafDigest()

  console.log('[cron/loaf-digest] completed at', new Date().toISOString(), JSON.stringify(data.story))

  return NextResponse.json({
    triggered_at: new Date().toISOString(),
    success: data.success,
    story: data.story,
    notion_page_id: data.notion_page_id,
    ...(data.error ? { error: data.error } : {}),
  }, { status })
}
