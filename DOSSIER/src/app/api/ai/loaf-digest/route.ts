import { NextResponse } from 'next/server'
import { isAdminOrCronRequest } from '@/lib/adminAuth'
import { runLoafDigest } from '@/lib/loafDigest'

export async function POST(request: Request) {
  // Auth: accept ADMIN_PASSWORD (from sync UI) or CRON_SECRET (from scheduler)
  const body = await request.json().catch(() => ({}))
  if (!isAdminOrCronRequest(request, body)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const { status, body: result } = await runLoafDigest()
  return NextResponse.json(result, { status })
}

export async function GET() {
  return NextResponse.json({ message: 'POST to /api/ai/loaf-digest to run the AI digest.' }, { status: 405 })
}
