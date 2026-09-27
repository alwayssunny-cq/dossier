import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminAuth'
import { createAdminClient } from '@/lib/supabase/admin'

let _supabase: ReturnType<typeof createAdminClient> | null = null
/** Built on first use — see note above; never at import time. */
const supabase = () => (_supabase ??= createAdminClient())

/** Find and delete duplicate rows, keeping the one with the lowest UUID (alphabetically first). */
async function dedupeTable(
  table: string,
  keyFields: string[],
  selectFields: string
): Promise<{ deleted: number; kept: number }> {
  const { data, error } = await supabase().from(table).select(selectFields).order('id', { ascending: true })
  if (error || !data) {
    console.error(`[cleanup/${table}] select error:`, error?.message)
    return { deleted: 0, kept: 0 }
  }

  const seen = new Map<string, string>() // key → first id
  const toDelete: string[] = []

  for (const row of data as unknown as Record<string, string | null>[]) {
    const key = keyFields.map(f => (row[f] ?? '').toLowerCase().trim()).join('::')
    if (seen.has(key)) {
      toDelete.push(row.id ?? '')
    } else {
      seen.set(key, row.id ?? '')
    }
  }

  if (toDelete.length > 0) {
    const { error: delErr } = await supabase().from(table).delete().in('id', toDelete)
    if (delErr) {
      console.error(`[cleanup/${table}] delete error:`, delErr.message)
      return { deleted: 0, kept: seen.size }
    }
  }

  return { deleted: toDelete.length, kept: seen.size }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { password?: string }
  if (!isAdminRequest(request, body)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, { deleted: number; kept: number }> = {}

  // Deduplicate experiences by (trip_id, title)
  results.experiences = await dedupeTable('experiences', ['trip_id', 'title'], 'id,trip_id,title')

  // Deduplicate stays by (trip_id, property_name)
  results.stays = await dedupeTable('stays', ['trip_id', 'property_name'], 'id,trip_id,property_name')

  // Deduplicate transfers by (trip_id, from_location, to_location, date)
  results.transfers = await dedupeTable('transfers', ['trip_id', 'from_location', 'to_location', 'date'], 'id,trip_id,from_location,to_location,date')

  // Verify final counts
  const counts: Record<string, number> = {}
  for (const table of ['experiences', 'stays', 'transfers']) {
    const { count } = await supabase().from(table).select('id', { count: 'exact', head: true })
    counts[table] = count ?? -1
  }

  return NextResponse.json({ success: true, results, final_counts: counts })
}
