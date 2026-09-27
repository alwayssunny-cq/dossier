import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminAuth'
import { runNotionSync } from '@/lib/notionSync'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    if (!isAdminRequest(request, body)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ success: true, ...(await runNotionSync()) })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Use POST to trigger sync.' }, { status: 405 })
}
