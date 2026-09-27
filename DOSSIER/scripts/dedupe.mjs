/**
 * Deduplication script — run with:
 *   node --env-file=.env.local scripts/dedupe.mjs
 *
 * Deletes duplicate rows keeping the row with the lowest id (first inserted).
 * Prints deleted counts per table.
 *
 * UNIQUE CONSTRAINTS — run these once in your Supabase SQL editor:
 *
 *   CREATE UNIQUE INDEX IF NOT EXISTS unique_experience_per_trip
 *     ON experiences(title, trip_id) WHERE title IS NOT NULL;
 *
 *   CREATE UNIQUE INDEX IF NOT EXISTS unique_stay_per_trip
 *     ON stays(property_name, trip_id) WHERE property_name IS NOT NULL;
 *
 *   CREATE UNIQUE INDEX IF NOT EXISTS unique_transfer_per_trip
 *     ON transfers(from_location, to_location, date, trip_id)
 *     WHERE from_location IS NOT NULL;
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function dedupe(table, keyFields, selectFields) {
  const { data, error } = await supabase
    .from(table)
    .select(selectFields)
    .order('id', { ascending: true })

  if (error || !data) {
    console.error(`[${table}] select error:`, error?.message)
    return 0
  }

  const seen = new Map()
  const toDelete = []

  for (const row of data) {
    const key = keyFields.map(f => String(row[f] ?? '').toLowerCase().trim()).join('::')
    if (seen.has(key)) {
      toDelete.push(row.id)
    } else {
      seen.set(key, row.id)
    }
  }

  if (toDelete.length === 0) {
    console.log(`[${table}] No duplicates found (${data.length} rows)`)
    return 0
  }

  const { error: delErr } = await supabase.from(table).delete().in('id', toDelete)
  if (delErr) {
    console.error(`[${table}] delete error:`, delErr.message)
    return 0
  }

  console.log(`[${table}] Deleted ${toDelete.length} duplicates (kept ${seen.size})`)
  return toDelete.length
}

async function main() {
  console.log('=== CQ Deduplication Script ===\n')

  const exp  = await dedupe('experiences', ['trip_id', 'title'],                               'id,trip_id,title')
  const stay = await dedupe('stays',       ['trip_id', 'property_name'],                       'id,trip_id,property_name')
  const trf  = await dedupe('transfers',   ['trip_id', 'from_location', 'to_location', 'date'], 'id,trip_id,from_location,to_location,date')

  console.log('\n=== Summary ===')
  console.log(`experiences deleted: ${exp}`)
  console.log(`stays deleted:       ${stay}`)
  console.log(`transfers deleted:   ${trf}`)
  console.log('\nDone. Now run CREATE UNIQUE INDEX commands in Supabase SQL editor (see comments at top of this file).')
}

main().catch(console.error)
