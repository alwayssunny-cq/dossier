/**
 * One-time setup: creates the "CQ Dates & Destinations" database in Notion.
 *
 * Usage:
 *   node scripts/setup-notion-dates-db.mjs <parent-page-id>
 *
 * The parent page must be shared with the CQ Notion integration.
 * Prints the new database id — add it to .env.local as NOTION_DATES_DESTINATIONS_DB.
 *
 * Row model (one row = one destination in one iteration of one trip):
 *   Place (title)        e.g. "Kohima"
 *   Trip ID (text)       e.g. "TRIP-4" — ties the row to the trip
 *   Iteration (number)   1, 2, 3 … — the portal shows the highest by default
 *   Sort (number)        order of destinations within the iteration
 *   Dates (text)         e.g. "9 – 11 May"
 *   Duration (text)      e.g. "2 nights"
 *   Description (text)   the editorial paragraph for this destination
 *   Image (files)        destination imagery
 *   Map Image (files)    optional hand-made route map for the iteration
 */
import { readFileSync } from 'fs'

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = {}
envText.split('\n').forEach(l => { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2] })

const parentPageId = process.argv[2]
if (!parentPageId) {
  console.error('Usage: node scripts/setup-notion-dates-db.mjs <parent-page-id>')
  process.exit(1)
}

const res = await fetch('https://api.notion.com/v1/databases', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${env.NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    parent: { type: 'page_id', page_id: parentPageId.replace(/-/g, '') },
    title: [{ type: 'text', text: { content: 'CQ Dates & Destinations' } }],
    properties: {
      'Place':       { title: {} },
      'Trip ID':     { rich_text: {} },
      'Iteration':   { number: { format: 'number' } },
      'Sort':        { number: { format: 'number' } },
      'Dates':       { rich_text: {} },
      'Duration':    { rich_text: {} },
      'Description': { rich_text: {} },
      'Image':       { files: {} },
      'Map Image':   { files: {} },
    },
  }),
})

const body = await res.json()
if (!res.ok) {
  console.error('Failed:', JSON.stringify(body, null, 2))
  process.exit(1)
}
console.log('Created database:', body.id)
console.log('\nAdd to .env.local:\nNOTION_DATES_DESTINATIONS_DB=' + body.id)
