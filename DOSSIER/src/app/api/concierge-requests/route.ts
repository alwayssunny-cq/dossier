import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const db = createAdminClient()
  const body = await req.json()

  const tripId = (body.trip_id ?? '').trim()
  const requestText = (body.request_text ?? '').trim()
  if (!tripId || !requestText) {
    return NextResponse.json({ error: 'trip_id and request_text are required' }, { status: 400 })
  }

  const { data: trip } = await db.from('trips').select('id').eq('trip_id', tripId).maybeSingle()
  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  const { data, error } = await db
    .from('concierge_requests')
    .insert([{ trip_id: trip.id, request_text: requestText, status: 'submitted' }])
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}
