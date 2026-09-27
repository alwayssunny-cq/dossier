/**
 * One-time seed: lifts the destination cards from the already-synced
 * "Dates & Destinations" Notion page into the new structured
 * CQ Dates & Destinations database as Iteration 1.
 *
 * Images are left empty — Notion's file URLs are signed and expire, so
 * imagery and the route map are uploaded by hand per iteration.
 *
 * Usage: node scripts/seed-dates-destinations.mjs [--dry]
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .split('\n').forEach(l => { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2] })

const dry = process.argv.includes('--dry')
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const flatten = block => {
  const out = []
  const walk = n => {
    if (!n) return
    if (Array.isArray(n)) return n.forEach(walk)
    out.push(n)
    ;(n.children ?? []).forEach(walk)
  }
  walk(block.children ?? [])
  return out
}
const textOf = b => (b.richText ?? []).map(r => r.text ?? '').join('') || (b.text ?? '')

const { data: trips } = await db.from('trips').select('id, trip_id')
const { data: pages } = await db
  .from('trip_content_pages').select('trip_id, parsed_content').eq('type', 'dates_destinations')

const rows = []
for (const page of pages ?? []) {
  const trip = trips.find(t => t.id === page.trip_id)
  if (!trip) continue
  const blocks = page.parsed_content?.blocks ?? []
  const firstH1 = blocks.findIndex(b => b.type === 'heading' && b.level === 1)
  const leading = firstH1 === -1 ? blocks : blocks.slice(0, firstH1)

  leading.filter(b => b.type === 'column_list').forEach((cl, i) => {
    const flat = flatten(cl)
    const heads = flat.filter(b => b.type === 'heading').map(textOf).filter(Boolean)
    const paras = flat.filter(b => b.type === 'paragraph').map(textOf).filter(Boolean)
    if (heads.length < 2) return
    const [place, duration] = heads[1].split('|').map(s => s.trim())
    rows.push({
      tripId: trip.trip_id,
      dates: heads[0] || '',
      place: place || heads[1],
      duration: duration || '',
      description: paras[0] ?? '',
      sort: i + 1,
    })
  })
}

console.log(`Parsed ${rows.length} destination(s):`)
rows.forEach(r => console.log(`  ${r.tripId}  ${r.sort}. ${r.place} — ${r.dates} ${r.duration}`))
if (dry) { console.log('\n(dry run — nothing written)'); process.exit(0) }

const rt = v => ({ rich_text: [{ type: 'text', text: { content: v ?? '' } }] })
let created = 0
for (const r of rows) {
  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parent: { database_id: env.NOTION_DATES_DESTINATIONS_DB },
      properties: {
        'Place':       { title: [{ type: 'text', text: { content: r.place } }] },
        'Trip ID':     rt(r.tripId),
        'Iteration':   { number: 1 },
        'Sort':        { number: r.sort },
        'Dates':       rt(r.dates),
        'Duration':    rt(r.duration),
        'Description': rt(r.description),
      },
    }),
  })
  if (res.ok) { created++ }
  else console.error('  failed:', r.place, JSON.stringify(await res.json()).slice(0, 200))
}
console.log(`\nCreated ${created} Notion row(s).`)
