import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminAuth'
import { clientIdsForPhone, getSessionUser } from '@/lib/tripAccess'

export async function POST(req: NextRequest) {
  // Signed-in clients only. The client is always the caller's own traveler
  // record; any client_id in the body is ignored.
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const clientId = (await clientIdsForPhone(user.phone))[0] ?? null

  const db = createAdminClient()
  const body = await req.json().catch(() => ({}))

  // The form shows the contact details already on file so they can be
  // corrected rather than retyped. If the client changed one, it is written
  // back — otherwise the correction would live only inside the request and
  // the dossier would keep the stale value.
  if (clientId && (body.contact_email || body.contact_phone || body.contact_name)) {
    if (body.contact_email || body.contact_name) {
      await db.from('clients').update({
        ...(body.contact_email ? { email: body.contact_email } : {}),
        ...(body.contact_name ? { client_name: body.contact_name } : {}),
      }).eq('id', clientId)
    }
    if (body.contact_phone || body.contact_email) {
      const { data: primary } = await db
        .from('travelers').select('id')
        .eq('client_id', clientId)
        .order('is_primary', { ascending: false })
        .limit(1).maybeSingle()
      const tid = (primary as { id?: string } | null)?.id
      if (tid) {
        await db.from('travelers').update({
          ...(body.contact_phone ? { phone: body.contact_phone } : {}),
          ...(body.contact_email ? { email: body.contact_email } : {}),
        }).eq('id', tid)
      }
    }
  }

  const { data, error } = await db
    .from('trip_requests')
    .insert([{
      client_id:        clientId,
      destination_ideas: body.destination_ideas ?? null,
      start_date:       body.start_date        || null,
      end_date:         body.end_date          || null,
      travelers_count:  body.travelers_count   ?? 1,
      budget_range:     body.budget_range      ?? null,
      the_question:     body.the_question      ?? null,
      additional_notes: body.additional_notes  ?? null,
      status:           'Pending',
    }])
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createAdminClient()

  const { data, error } = await db
    .from('trip_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (!isAdminRequest(req, body)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createAdminClient()
  const { id, status } = body

  const { data, error } = await db
    .from('trip_requests')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}
