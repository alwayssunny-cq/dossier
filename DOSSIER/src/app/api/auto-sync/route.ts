import { NextResponse } from 'next/server'
import { isAdminOrCronRequest } from '@/lib/adminAuth'
import { runNotionSync } from '@/lib/notionSync'

/**
 * Lightweight auto-sync trigger for external schedulers.
 * Requires Authorization: Bearer <ADMIN_PASSWORD or CRON_SECRET>.
 * Runs the sync in-process (no HTTP call back to /api/sync).
 */
export async function GET(request: Request) {
  if (!isAdminOrCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = await runNotionSync()
    return NextResponse.json({ success: true, ...data, auto: true, ts: new Date().toISOString() })
  } catch (err) {
    console.error('auto-sync error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
