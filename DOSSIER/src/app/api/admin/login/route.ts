import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminAuth'

// Verifies the admin password server-side. The page keeps what was typed in
// memory and sends it with each admin API call; nothing is stored.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  if (!isAdminRequest(request, body)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
