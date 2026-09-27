import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminAuth'
import { createAdminClient } from '@/lib/supabase/admin'

let _db: ReturnType<typeof createAdminClient> | null = null
/** Built on first use — see note above; never at import time. */
const db = () => (_db ??= createAdminClient())

// GET trips list
export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)

  const action = searchParams.get('action')

  if (action === 'messages') {
    const tripId = searchParams.get('tripId') // UUID
    if (!tripId) return NextResponse.json({ error: 'Missing tripId' }, { status: 400 })
    const { data, error } = await db()
      .from('messages')
      .select('*')
      .eq('trip_id', tripId)
      .order('timestamp', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }

  // Default: list trips
  const { data, error } = await db()
    .from('trips')
    .select('*')
    .order('start_date', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST: send a message
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  if (!isAdminRequest(request, body)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tripId, sender, sender_name, message_type, content } = body
  if (!tripId || !content) {
    return NextResponse.json({ error: 'Missing tripId or content' }, { status: 400 })
  }

  const { data, error } = await db().from('messages').insert({
    trip_id: tripId,
    sender: sender ?? 'cq',
    sender_name: sender_name ?? 'CloseQuarters',
    message_type: message_type ?? 'update',
    content,
    timestamp: new Date().toISOString(),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
