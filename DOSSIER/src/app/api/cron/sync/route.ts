import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/adminAuth'
import { runNotionSync } from '@/lib/notionSync'

// Vercel calls this with: Authorization: Bearer <CRON_SECRET>
// Runs the sync in-process: an HTTP call back to /api/sync would be stopped
// by Vercel Authentication.
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = await runNotionSync()
    console.log('[cron/sync] completed at', new Date().toISOString(), JSON.stringify(data.results), JSON.stringify(data.errors))
    return NextResponse.json({
      triggered_at: new Date().toISOString(),
      success: true,
      results: data.results,
      errors: data.errors,
    })
  } catch (error) {
    console.error('[cron/sync] error:', error)
    return NextResponse.json(
      { triggered_at: new Date().toISOString(), success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
