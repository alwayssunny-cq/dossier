import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminAuth'
import { createAdminClient } from '@/lib/supabase/admin'

let _db: ReturnType<typeof createAdminClient> | null = null
/** Built on first use; never at import time. */
const db = () => (_db ??= createAdminClient())

/**
 * Reads and writes the admin page used to make from the browser. RLS blocks
 * the anon client, so they run here with the service-role key, behind the
 * admin password. Each action is a fixed query — no table or column comes
 * from the request except where listed below.
 *
 * POST { password, action, ... }
 *   financial-summary { tripId }                  quotations / inbound payments / invoices
 *   image-items       { tripId }                  active experiences + stays with images
 *   sync-history      { tripId }                  experiences.iteration_version rows
 *   content-pages     { tripUuid }                trip_content_pages type + synced_at
 *   update-trip       { tripId, field, value }    field: cover_image_url | drawing_board_url
 *   update-image      { table, id, image_url, image_urls? }  table: experiences | stays
 *
 * tripId is the text trip ID (TRIP-1); tripUuid is trips.id.
 */

const TRIP_FIELDS = ['cover_image_url', 'drawing_board_url'] as const
const IMAGE_TABLES = ['experiences', 'stays'] as const

async function tripUuidFor(tripId: unknown): Promise<string | null> {
  if (typeof tripId !== 'string' || !tripId) return null
  const { data } = await db().from('trips').select('id').eq('trip_id', tripId).maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  if (!isAdminRequest(request, body)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  switch (body.action) {
    case 'financial-summary': {
      const tripUuid = await tripUuidFor(body.tripId)
      if (!tripUuid) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
      const [q, p, i] = await Promise.all([
        db().from('quotations').select('total_amount, currency').eq('trip_id', tripUuid),
        db().from('payments').select('amount, currency').eq('trip_id', tripUuid).eq('direction', 'inbound'),
        db().from('invoices').select('id').eq('trip_id', tripUuid),
      ])
      const error = q.error ?? p.error ?? i.error
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ quotations: q.data, payments: p.data, invoices: i.data })
    }

    case 'image-items': {
      const tripUuid = await tripUuidFor(body.tripId)
      if (!tripUuid) return NextResponse.json({ experiences: [], stays: [] })
      const [e, s] = await Promise.all([
        db().from('experiences').select('id, experience_id, title, image_url').eq('trip_id', tripUuid).eq('is_active_version', true).order('sort_order', { ascending: true }),
        db().from('stays').select('id, stay_id, property_name, image_url, image_urls').eq('trip_id', tripUuid).eq('is_active_version', true).order('sort_order', { ascending: true }),
      ])
      const error = e.error ?? s.error
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ experiences: e.data, stays: s.data })
    }

    case 'sync-history': {
      const tripUuid = await tripUuidFor(body.tripId)
      if (!tripUuid) return NextResponse.json({ data: null })
      const { data, error } = await db()
        .from('experiences')
        .select('iteration_version')
        .eq('trip_id', tripUuid)
        .not('iteration_version', 'is', null)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    }

    case 'content-pages': {
      if (typeof body.tripUuid !== 'string' || !body.tripUuid) {
        return NextResponse.json({ error: 'Missing tripUuid' }, { status: 400 })
      }
      const { data, error } = await db()
        .from('trip_content_pages')
        .select('type, synced_at')
        .eq('trip_id', body.tripUuid)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    }

    case 'update-trip': {
      const field = TRIP_FIELDS.find(f => f === body.field)
      if (!field || typeof body.tripId !== 'string' || !body.tripId || typeof body.value !== 'string') {
        return NextResponse.json({ error: 'Invalid update' }, { status: 400 })
      }
      const { error } = await db().from('trips').update({ [field]: body.value }).eq('trip_id', body.tripId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    case 'update-image': {
      const table = IMAGE_TABLES.find(t => t === body.table)
      if (!table || typeof body.id !== 'string' || !body.id) {
        return NextResponse.json({ error: 'Invalid update' }, { status: 400 })
      }
      const imageUrl = typeof body.image_url === 'string' ? body.image_url : null
      const update: Record<string, unknown> = { image_url: imageUrl }
      if (table === 'stays') {
        const urls = Array.isArray(body.image_urls)
          ? body.image_urls.filter((u): u is string => typeof u === 'string')
          : null
        update.image_urls = urls && urls.length ? urls : null
      }
      const { error } = await db().from(table).update(update).eq('id', body.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
