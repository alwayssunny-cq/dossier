import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_TOKEN })
const NOTION_ITERATIONS_DB = '349cc540df098020997df419800eb085'

let _supabase: ReturnType<typeof createAdminClient> | null = null
/** Built on first use — see note above; never at import time. */
const supabase = () => (_supabase ??= createAdminClient())

// ── Types ─────────────────────────────────────────────────────────────────────

interface TripRow {
  id: string
  trip_id: string
  notion_page_id: string | null
}

interface IterationRow {
  id: string
  name: string
  is_current: boolean
}

// ── Notion helper ─────────────────────────────────────────────────────────────

async function createNotionIterationRow(
  name: string,
  tripNotionPageId: string | null,
): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {
      'Name': { title: [{ text: { content: name || 'Iteration' } }] },
      'Notion Page ID': { rich_text: [{ text: { content: 'legacy-backfill' } }] },
      'Is Current': { checkbox: true },
      'Synced At': { date: { start: new Date().toISOString() } },
    }
    if (tripNotionPageId) {
      properties['Trip'] = { relation: [{ id: tripNotionPageId }] }
    }
    const page = await notion.pages.create({
      parent: { database_id: NOTION_ITERATIONS_DB },
      properties,
    })
    return page.id
  } catch (err) {
    console.error('[backfill] createNotionIterationRow error:', err)
    return null
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const report: {
    trips: Array<{
      tripId: string
      action: string
      iterationId: string | null
      iterationName: string | null
      experiencesBackfilled: number
      staysBackfilled: number
      transfersBackfilled: number
      notionRowCreated: boolean
    }>
    errors: string[]
    sql: string
  } = {
    trips: [],
    errors: [],
    sql: `-- Run this in your Supabase SQL editor to create the city_coordinates cache table:
CREATE TABLE IF NOT EXISTS city_coordinates (
  name TEXT PRIMARY KEY,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  country TEXT,
  cached_at TIMESTAMPTZ DEFAULT now()
);`,
  }

  // Fetch all trips
  const { data: trips, error: tripsErr } = await supabase()
    .from('trips')
    .select('id, trip_id, notion_page_id')
    .order('created_at', { ascending: true })

  if (tripsErr || !trips) {
    return NextResponse.json({ error: 'Failed to fetch trips', detail: tripsErr?.message }, { status: 500 })
  }

  for (const trip of trips as TripRow[]) {
    // Count orphaned rows (NULL iteration_id)
    const [{ count: expCount }, { count: stayCount }, { count: trfCount }] = await Promise.all([
      supabase().from('experiences').select('id', { count: 'exact', head: true })
        .eq('trip_id', trip.id).is('iteration_id', null),
      supabase().from('stays').select('id', { count: 'exact', head: true })
        .eq('trip_id', trip.id).is('iteration_id', null),
      supabase().from('transfers').select('id', { count: 'exact', head: true })
        .eq('trip_id', trip.id).is('iteration_id', null),
    ])

    const orphanCount = (expCount ?? 0) + (stayCount ?? 0) + (trfCount ?? 0)

    if (orphanCount === 0) {
      // Nothing to backfill for this trip
      continue
    }

    // Find existing iterations for this trip
    const { data: existingIterations } = await supabase()
      .from('iterations')
      .select('id, name, is_current')
      .eq('trip_id', trip.id)
      .order('synced_at', { ascending: false }) as { data: IterationRow[] | null }

    let targetIterationId: string | null = null
    let targetIterationName: string | null = null
    let action = ''
    let notionRowCreated = false

    // Check if there's a "27/3" iteration (TRIP-4 specific, but check all trips)
    const iterWith27 = (existingIterations ?? []).find(i => i.name === '27/3')
    const currentIter = (existingIterations ?? []).find(i => i.is_current)

    if (iterWith27) {
      // RESYNC case: assign orphans to the existing "27/3" iteration
      targetIterationId = iterWith27.id
      targetIterationName = iterWith27.name
      action = 'assigned_to_existing_27_3'
    } else if (currentIter) {
      // Assign orphans to the existing current iteration
      targetIterationId = currentIter.id
      targetIterationName = currentIter.name
      action = 'assigned_to_existing_current'
    } else {
      // No iterations exist — create one
      const iterName = trip.trip_id === 'TRIP-4' ? '27/3' : 'Initial'

      // Create Notion row first
      const notionRowId = await createNotionIterationRow(iterName, trip.notion_page_id)
      notionRowCreated = !!notionRowId

      // Create Supabase iteration row
      const { data: newIter, error: iterErr } = await supabase()
        .from('iterations')
        .insert({
          name: iterName,
          trip_id: trip.id,
          notion_page_id: 'legacy-backfill',
          is_current: true,
          synced_at: new Date().toISOString(),
          ...(notionRowId ? { notion_id: notionRowId } : {}),
        })
        .select('id')
        .single()

      if (iterErr || !newIter) {
        report.errors.push(`${trip.trip_id}: failed to create iteration — ${iterErr?.message}`)
        continue
      }

      targetIterationId = (newIter as { id: string }).id
      targetIterationName = iterName
      action = 'created_new_iteration'
    }

    if (!targetIterationId) {
      report.errors.push(`${trip.trip_id}: could not resolve target iteration`)
      continue
    }

    // Backfill all orphaned rows to this iteration
    const [expResult, stayResult, trfResult] = await Promise.all([
      supabase().from('experiences')
        .update({ iteration_id: targetIterationId, is_current: true })
        .eq('trip_id', trip.id)
        .is('iteration_id', null),
      supabase().from('stays')
        .update({ iteration_id: targetIterationId, is_current: true })
        .eq('trip_id', trip.id)
        .is('iteration_id', null),
      supabase().from('transfers')
        .update({ iteration_id: targetIterationId, is_current: true })
        .eq('trip_id', trip.id)
        .is('iteration_id', null),
    ])

    if (expResult.error) report.errors.push(`${trip.trip_id} experiences: ${expResult.error.message}`)
    if (stayResult.error) report.errors.push(`${trip.trip_id} stays: ${stayResult.error.message}`)
    if (trfResult.error) report.errors.push(`${trip.trip_id} transfers: ${trfResult.error.message}`)

    report.trips.push({
      tripId: trip.trip_id,
      action,
      iterationId: targetIterationId,
      iterationName: targetIterationName,
      experiencesBackfilled: expCount ?? 0,
      staysBackfilled: stayCount ?? 0,
      transfersBackfilled: trfCount ?? 0,
      notionRowCreated,
    })

    console.log(`[backfill] ${trip.trip_id}: ${action} → iteration ${targetIterationId} | exp=${expCount} stay=${stayCount} trf=${trfCount}`)
  }

  return NextResponse.json({
    success: true,
    backfilledTrips: report.trips.length,
    trips: report.trips,
    errors: report.errors,
    note: report.sql,
  })
}
