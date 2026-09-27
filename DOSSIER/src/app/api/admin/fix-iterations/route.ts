import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminAuth'
import { createAdminClient } from '@/lib/supabase/admin'

let _supabase: ReturnType<typeof createAdminClient> | null = null
/** Built on first use — see note above; never at import time. */
const supabase = () => (_supabase ??= createAdminClient())

/**
 * One-time migration: enforce single is_current iteration per trip.
 * For each trip with multiple is_current=true iterations, keep the most
 * recently synced one and set all others to is_current=false.
 *
 * Also resets is_current on experiences/stays/transfers to match
 * their iteration's is_current flag.
 *
 * GET /api/admin/fix-iterations  (Authorization: Bearer <ADMIN_PASSWORD>)
 */
export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const report: {
    tripId: string
    action: string
    keptIteration: string | null
    archivedIterations: string[]
    expFixed: number
    stayFixed: number
    trfFixed: number
  }[] = []
  const errors: string[] = []

  // Fetch all trips
  const { data: trips, error: tripsErr } = await supabase()
    .from('trips').select('id, trip_id').order('created_at', { ascending: true })
  if (tripsErr || !trips) {
    return NextResponse.json({ error: 'Failed to fetch trips', detail: tripsErr?.message }, { status: 500 })
  }

  for (const trip of trips as { id: string; trip_id: string }[]) {
    // Fetch all iterations for this trip, ordered by synced_at desc
    const { data: iters, error: itersErr } = await supabase()
      .from('iterations')
      .select('id, name, is_current, synced_at')
      .eq('trip_id', trip.id)
      .order('synced_at', { ascending: false })

    if (itersErr || !iters || iters.length === 0) continue

    const currentOnes = (iters as { id: string; name: string; is_current: boolean; synced_at: string }[])
      .filter(i => i.is_current)

    if (currentOnes.length <= 1) {
      // Already consistent — ensure data rows match
      const currentIter = currentOnes[0] ?? null
      if (!currentIter) continue
      // Nothing to archive
      report.push({ tripId: trip.trip_id, action: 'already_consistent', keptIteration: currentIter.name, archivedIterations: [], expFixed: 0, stayFixed: 0, trfFixed: 0 })
      continue
    }

    // Multiple is_current iterations — keep the first (most recent by synced_at), archive rest
    const [keep, ...archive] = currentOnes
    const archivedNames: string[] = []

    for (const iter of archive) {
      const { error: archErr } = await supabase()
        .from('iterations').update({ is_current: false }).eq('id', iter.id)
      if (archErr) {
        errors.push(`${trip.trip_id} archive ${iter.name}: ${archErr.message}`)
      } else {
        archivedNames.push(iter.name)
      }
    }

    // Sync is_current on data rows: true for rows under keep, false for everything else
    let expFixed = 0, stayFixed = 0, trfFixed = 0

    for (const table of ['experiences', 'stays', 'transfers'] as const) {
      // Set is_current=true for kept iteration's rows
      await supabase().from(table).update({ is_current: true })
        .eq('trip_id', trip.id).eq('iteration_id', keep.id)
      // Set is_current=false for all other iterations' rows
      await supabase().from(table).update({ is_current: false })
        .eq('trip_id', trip.id).neq('iteration_id', keep.id)

      if (table === 'experiences') expFixed = 1
      if (table === 'stays') stayFixed = 1
      if (table === 'transfers') trfFixed = 1
    }

    report.push({
      tripId: trip.trip_id,
      action: 'fixed_multiple_current',
      keptIteration: keep.name,
      archivedIterations: archivedNames,
      expFixed,
      stayFixed,
      trfFixed,
    })
  }

  return NextResponse.json({
    success: true,
    fixed: report.filter(r => r.action === 'fixed_multiple_current').length,
    report,
    errors,
  })
}
