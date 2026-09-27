import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const db = createAdminClient()
  const body = await req.json()

  // The form shows the contact details already on file so they can be
  // corrected rather than retyped. If the client changed one, it is written
  // back — otherwise the correction would live only inside the request and
  // the dossier would keep the stale value.
  if (body.client_id && (body.contact_email || body.contact_phone || body.contact_name)) {
    if (body.contact_email || body.contact_name) {
      await db.from('clients').update({
        ...(body.contact_email ? { email: body.contact_email } : {}),
        ...(body.contact_name ? { client_name: body.contact_name } : {}),
      }).eq('id', body.client_id)
    }
    if (body.contact_phone || body.contact_email) {
      const { data: primary } = await db
        .from('travelers').select('id')
        .eq('client_id', body.client_id)
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
      client_id:        body.client_id        ?? null,
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

export async function GET() {
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
  const db = createAdminClient()
  const { id, status } = await req.json()

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
