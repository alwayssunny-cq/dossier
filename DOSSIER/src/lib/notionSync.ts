import { Client, isFullPage } from '@notionhq/client'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints/common'
import type { QueryDataSourceResponse } from '@notionhq/client/build/src/api-endpoints/data-sources'

const notion = new Client({ auth: process.env.NOTION_TOKEN })
let _supabase: ReturnType<typeof createAdminClient> | null = null
/** Built on first use — see note above; never at import time. */
const supabase = () => (_supabase ??= createAdminClient())

// ── helpers ──────────────────────────────────────────────────────────────────

/** Extract a 32-char Notion page ID from any notion.so URL format. */
function extractNotionPageId(url: string | null): string | null {
  if (!url) return null
  // UUID with dashes: 8-4-4-4-12
  const uuidMatch = url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
  if (uuidMatch) return uuidMatch[1].replace(/-/g, '')
  // 32 hex chars at end of path (no dashes)
  const hashMatch = url.match(/([0-9a-f]{32})(?:[?#]|$)/i)
  if (hashMatch) return hashMatch[1]
  return null
}

type Props = PageObjectResponse['properties']
type Prop = Props[string]

function text(prop: Prop | undefined): string | null {
  if (!prop) return null
  if (prop.type === 'title') return prop.title.map((t: { plain_text: string }) => t.plain_text).join('') || null
  if (prop.type === 'rich_text') return prop.rich_text.map((t: { plain_text: string }) => t.plain_text).join('') || null
  if (prop.type === 'email') return prop.email ?? null
  if (prop.type === 'phone_number') return prop.phone_number ?? null
  if (prop.type === 'url') return prop.url ?? null
  return null
}

function select(prop: Prop | undefined): string | null {
  if (!prop) return null
  if (prop.type === 'select') return (prop.select as { name: string } | null)?.name ?? null
  if (prop.type === 'status') return (prop.status as { name: string } | null)?.name ?? null
  return null
}

function multiSelect(prop: Prop | undefined): string[] {
  if (!prop) return []
  if (prop.type === 'multi_select') return (prop.multi_select as { name: string }[]).map(o => o.name)
  return []
}

function multiSelectText(prop: Prop | undefined): string | null {
  const vals = multiSelect(prop)
  return vals.length > 0 ? vals.join(', ') : null
}

function num(prop: Prop | undefined): number | null {
  if (!prop || prop.type !== 'number') return null
  return prop.number ?? null
}

function numText(prop: Prop | undefined): string | null {
  const n = num(prop)
  return n != null ? String(n) : null
}

function date(prop: Prop | undefined): string | null {
  if (!prop || prop.type !== 'date') return null
  return (prop.date as { start: string } | null)?.start ?? null
}

function bool(prop: Prop | undefined): boolean | null {
  if (!prop || prop.type !== 'checkbox') return null
  return prop.checkbox ?? null
}

function uniqueId(prop: Prop | undefined): string | null {
  if (!prop || prop.type !== 'unique_id') return null
  const uid = prop.unique_id as { prefix: string | null; number: number | null }
  if (uid.number == null) return null
  return uid.prefix ? `${uid.prefix}-${uid.number}` : String(uid.number)
}

function relationIds(prop: Prop | undefined): string[] {
  if (!prop || prop.type !== 'relation') return []
  return (prop.relation as { id: string }[]).map(r => r.id)
}

interface NotionFile { name: string; url: string }

/** Extract {name, url} for each item in a Notion "files" property.
 *  Notion-hosted files return presigned S3 URLs that expire (~1hr) — same
 *  trade-off already accepted elsewhere in this file for cover images, relies
 *  on periodic re-sync to keep links fresh. */
function files(prop: Prop | undefined): NotionFile[] {
  if (!prop || prop.type !== 'files') return []
  const items = prop.files as { name: string; type: 'file' | 'external'; file?: { url: string }; external?: { url: string } }[]
  return items
    .map(f => ({ name: f.name, url: f.type === 'external' ? (f.external?.url ?? '') : (f.file?.url ?? '') }))
    .filter(f => !!f.url)
}

async function queryAll(dataSourceId: string): Promise<PageObjectResponse[]> {
  const pages: PageObjectResponse[] = []
  let cursor: string | undefined = undefined
  do {
    const res: QueryDataSourceResponse = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
    })
    for (const item of res.results) {
      if (isFullPage(item) && !item.archived) pages.push(item)
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined
  } while (cursor)
  return pages
}

/** Query a specific Notion database via the standard REST API (not dataSources).
 *  Only returns non-archived pages from the exact database we write to. */
async function queryAllStandard(databaseId: string): Promise<PageObjectResponse[]> {
  const pages: PageObjectResponse[] = []
  let cursor: string | undefined = undefined
  do {
    const body: Record<string, unknown> = { page_size: 100 }
    if (cursor) body.start_cursor = cursor
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.error('queryAllStandard error:', await res.text())
      break
    }
    const data = await res.json() as { results: PageObjectResponse[]; has_more: boolean; next_cursor: string | null }
    for (const item of data.results) {
      if (isFullPage(item) && !item.archived) pages.push(item)
    }
    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined
  } while (cursor)
  return pages
}

async function buildIdMap(table: string): Promise<Map<string, string>> {
  const { data } = await supabase().from(table).select('id, notion_page_id')
  const map = new Map<string, string>()
  for (const row of ((data ?? []) as { id: string; notion_page_id: string | null }[])) {
    if (row.notion_page_id) map.set(row.notion_page_id, row.id)
  }
  return map
}

/** Maps trip notion_page_id → trips.trip_id (the TEXT column, e.g. "TRIP-1").
 *  Used by financial tables which FK on the text trip_id, not the UUID. */
async function buildTripTextIdMap(): Promise<Map<string, string>> {
  const { data } = await supabase().from('trips').select('notion_page_id, trip_id')
  const map = new Map<string, string>()
  for (const row of ((data ?? []) as { notion_page_id: string | null; trip_id: string }[])) {
    if (row.notion_page_id) map.set(row.notion_page_id, row.trip_id)
  }
  return map
}

// ── sync functions ────────────────────────────────────────────────────────────

async function syncClients() {
  const pages = await queryAll(process.env.NOTION_CLIENTS_DB!)
  let upserted = 0
  for (const p of pages) {
    const props = p.properties
    const record = {
      notion_page_id: p.id,
      client_id: uniqueId(props['Client ID']) ?? p.id.replace(/-/g, '').slice(0, 8),
      client_name: text(props['Name']) ?? 'Unknown',
      email: text(props['Contact Email']),
      status: select(props['Status']),
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase().from('clients').upsert(record, { onConflict: 'client_id' })
    if (!error) upserted++
  }
  return upserted
}

async function syncTravelers() {
  const pages = await queryAll(process.env.NOTION_TRAVELERS_DB!)
  const clientMap = await buildIdMap('clients')
  let upserted = 0
  for (const p of pages) {
    const props = p.properties
    const clientNotionIds = relationIds(props['Related Client ID'])
    const clientId = clientNotionIds.length > 0 ? (clientMap.get(clientNotionIds[0]) ?? null) : null
    const record = {
      notion_page_id: p.id,
      traveler_id: uniqueId(props['Traveller ID']) ?? p.id.replace(/-/g, '').slice(0, 8),
      full_name: text(props['Name']) ?? 'Unknown',
      phone: text(props['Phone']),
      email: text(props['Email']),
      client_id: clientId,
      is_primary: bool(props['Is Primary']),
      relationship: select(props['Relationship']),
      diet_type: multiSelect(props['Diet Type']),
      restrictions: multiSelect(props['Restrictions']),
      allergies: multiSelect(props['Allergies']),
      passport_name: text(props['Passport Name']),
      passport_number: text(props['Passport Number']),
      nationality: select(props['Nationality']),
      date_of_birth: date(props['Date of Birth']),
      notes: text(props['Notes']),
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase().from('travelers').upsert(record, { onConflict: 'traveler_id' })
    if (!error) upserted++
  }
  return upserted
}

async function syncDestinationInfo() {
  const pages = await queryAllStandard(process.env.NOTION_DESTINATION_INFO_DB!)
  let upserted = 0
  for (const p of pages) {
    const props = p.properties
    const record = {
      notion_page_id: p.id,
      destination: text(props['Destination']) ?? 'Untitled',
      meal_cost_local: text(props['Meal Cost (Local)']) ?? text(props['Meal Cost']),
      meal_cost_inr: text(props['Meal Cost (INR)']),
      coffee_cost_local: text(props['Coffee Cost (Local)']) ?? text(props['Coffee Cost']),
      coffee_cost_inr: text(props['Coffee Cost (INR)']),
      local_radio: text(props['Local Radio']),
      local_media: text(props['Local Media Recommends']),
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase().from('destination_info').upsert(record, { onConflict: 'notion_page_id' })
    if (error) {
      console.error('[sync/destination_info] upsert error:', error.message, 'for', record.destination)
    } else {
      upserted++
    }
  }
  return upserted
}

/** Fallback match when a trip has no manual "CQ Destination Info" relation set in Notion:
 *  compare its state/county and town/city text against known destination_info names. */
function matchDestinationInfo(
  stateCounty: string | null,
  townsCities: string | null,
  destinationList: { id: string; destination: string }[],
): string | null {
  const candidates = [
    stateCounty,
    ...(townsCities ? townsCities.split(',').map(t => t.trim()) : []),
  ].filter((s): s is string => !!s).map(s => s.toLowerCase())

  for (const d of destinationList) {
    if (candidates.includes(d.destination.toLowerCase())) return d.id
  }
  return null
}

/**
 * Sync CQ Daily Briefs from Notion → Supabase.
 *
 * Notion property names:
 *   CQ Trips — relation  → links to trips
 *   Date     — date      → the day this brief is for
 *   Title    — rich_text → headline
 *   Body     — rich_text → brief content
 */
async function syncDailyBriefs(): Promise<number> {
  const dbId = process.env.NOTION_DAILY_BRIEFS_DB
  if (!dbId) return 0

  const pages = await queryAllStandard(dbId)
  const tripUuidMap = await buildIdMap('trips')
  let upserted = 0

  for (const p of pages) {
    const props = p.properties
    const tripNotionIds = relationIds(props['CQ Trips'])
    const tripUuid = tripNotionIds.length > 0 ? (tripUuidMap.get(tripNotionIds[0]) ?? null) : null
    const briefDate = date(props['Date'])
    if (!tripUuid || !briefDate) continue

    const record = {
      notion_page_id: p.id,
      trip_id: tripUuid,
      date: briefDate,
      title: text(props['Title']),
      body: text(props['Body']),
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase().from('daily_briefs').upsert(record, { onConflict: 'notion_page_id' })
    if (error) {
      console.error('[sync/daily_briefs] upsert error:', error.message)
    } else {
      upserted++
    }
  }
  return upserted
}

/**
 * Sync CQ Recommends from Notion → Supabase.
 *
 * Notion property names:
 *   Name        — title      → place name
 *   CQ Trips    — relation   → links to trips
 *   Category    — select     → Food & Drinks | Shopping | Other
 *   Destination — rich_text  → groups places within a trip
 *   Description — rich_text
 *   Timings     — rich_text
 *   Map Link    — url
 */
async function syncRecommends(): Promise<number> {
  const dbId = process.env.NOTION_RECOMMENDS_DB
  if (!dbId) return 0

  const pages = await queryAllStandard(dbId)
  const tripUuidMap = await buildIdMap('trips')
  let upserted = 0

  for (const p of pages) {
    const props = p.properties
    const tripNotionIds = relationIds(props['CQ Trips'])
    const tripUuid = tripNotionIds.length > 0 ? (tripUuidMap.get(tripNotionIds[0]) ?? null) : null
    const name = text(props['Name'])
    if (!tripUuid || !name) continue

    const record = {
      notion_page_id: p.id,
      trip_id: tripUuid,
      name,
      category: select(props['Category']),
      // The property is "Place Name" in Notion; reading "Destination"
      // silently wrote null on every row.
      destination: text(props['Place Name']),
      description: text(props['Description']),
      timings: text(props['Timings']),
      map_link: text(props['Map Link']),
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase().from('recommendations').upsert(record, { onConflict: 'notion_page_id' })
    if (error) {
      console.error('[sync/recommendations] upsert error:', error.message)
    } else {
      upserted++
    }
  }
  return upserted
}

/**
 * CQ Suggestions — what to read when there is no trip running.
 *
 * Recommendations hang off a trip; suggestions hang off an archetype, so they
 * carry no trip relation and are synced whole. The dashboard picks between the
 * two: on the ground it shows CQ Recommends for the place, and between trips
 * it shows the suggestions matching the client's archetype.
 *
 * Notion properties:
 *   Headline         — title
 *   Content          — rich_text
 *   Category         — select
 *   Archetype        — select
 *   Publication Date — date
 *   Image URL        — url
 *   Status           — status
 */
async function syncSuggestions(): Promise<number> {
  const dbId = process.env.NOTION_SUGGESTIONS_DB
  if (!dbId) return 0

  const pages = await queryAllStandard(dbId)
  let upserted = 0

  for (const p of pages) {
    const props = p.properties
    const headline = text(props['Headline'])
    if (!headline) continue

    const record = {
      notion_page_id: p.id,
      headline,
      content:      text(props['Content']),
      category:     select(props['Category']),
      archetype:    select(props['Archetype']),
      image_url:    text(props['Image URL']),
      status:       select(props['Status']),
      published_at: date(props['Publication Date']),
      updated_at:   new Date().toISOString(),
    }
    const { error } = await supabase().from('suggestions').upsert(record, { onConflict: 'notion_page_id' })
    if (error) {
      console.error('[sync/suggestions] upsert error:', error.message)
    } else {
      upserted++
    }
  }
  return upserted
}


/**
 * A cover may be a pasted link or a file uploaded into the property.
 *
 * The link is used as-is. An uploaded file is stored as a path to the
 * notion-image proxy rather than its own URL, because Notion signs those and
 * they expire within the hour — storing one would leave a broken frame behind
 * a day later. The proxy resolves a fresh URL per request and caches it.
 *
 * Property names are matched loosely on purpose: several of these carry a
 * trailing space in Notion, which is invisible in the UI and impossible to
 * spot in a bug report.
 */
function coverFrom(
  props: Record<string, Prop | undefined>,
  pageId: string,
  urlProp: string,
  fileProp: string,
): string | null {
  const find = (want: string) => {
    const key = Object.keys(props).find(k => k.trim().toLowerCase() === want.trim().toLowerCase())
    return key ? props[key] : undefined
  }

  const link = text(find(urlProp))
  if (link) return link

  const uploaded = files(find(fileProp))[0]
  if (!uploaded) return null

  // An external file in the property is already a stable link.
  if (!/amazonaws\.com|notion-static|secure\.notion/.test(uploaded.url)) return uploaded.url

  return `/api/notion-image?pageId=${encodeURIComponent(pageId)}&prop=${encodeURIComponent(fileProp)}`
}

async function syncTrips() {
  const pages = await queryAllStandard(process.env.NOTION_TRIPS_DB!)
  console.log('[sync/trips] fetched', pages.length, 'pages')
  const clientMap = await buildIdMap('clients')
  const destinationInfoMap = await buildIdMap('destination_info')
  const { data: destRows } = await supabase().from('destination_info').select('id, destination')
  const destinationList = (destRows ?? []) as { id: string; destination: string }[]

  let upserted = 0
  for (const p of pages) {
    const props = p.properties
    const clientNotionIds = relationIds(props['CQ Clients'])
    const clientId = clientNotionIds.length > 0 ? (clientMap.get(clientNotionIds[0]) ?? null) : null

    const stateCounty = multiSelect(props['State/County'])[0] ?? null
    const townsCities = multiSelectText(props['Town/Cities'])
    const destInfoNotionIds = relationIds(props['CQ Destination Info'])
    const destinationInfoId =
      (destInfoNotionIds.length > 0 ? destinationInfoMap.get(destInfoNotionIds[0]) : undefined) ??
      matchDestinationInfo(stateCounty, townsCities, destinationList) ??
      null

    const record = {
      notion_page_id: p.id,
      trip_id: uniqueId(props['Trip ID']) ?? p.id.replace(/-/g, '').slice(0, 8),
      trip_name: text(props['Trip Name']) ?? 'Untitled Trip',
      client_id: clientId,
      destination_country: multiSelectText(props['Destination Country']),
      state_county: stateCounty,
      towns_cities: townsCities,
      start_date: date(props['Start Date']),
      end_date: date(props['End Date']),
      status: select(props['Status']),
      // The brief allows either: a pasted link, or a file uploaded into the
      // Cover Image property. Only the link was ever read, so an uploaded
      // cover was invisible and the hero fell through to its gradient.
      // The link is preferred because Notion's own file URLs are signed and
      // expire; an uploaded cover only holds until the next sync refreshes it.
      cover_image_url: coverFrom(props, p.id, 'Cover Image URL', 'Cover Image'),
      blueprint_version: text(props['Blueprint Version']),
      blueprint_confirmed: bool(props['Blueprint Confirmed']) ?? false,
      dates_destinations_link: text(props['datesanddestinations']) ?? text(props['Dates and Destination']),
      trip_cost: num(props['Trip Cost']),
      stay_link_url: (() => {
        const raw = text(props['Stay'])
        if (raw && !raw.startsWith('http')) {
          console.warn('[sync/trips] "Stay" property is not a URL:', raw)
          return null
        }
        return raw
      })(),
      stay_notion_page_id: extractNotionPageId(text(props['Stay'])),
      experience_link: text(props['Experience']),
      glimpse_link: text(props['The Glimpse']),
      destination_info_id: destinationInfoId,
      updated_at: new Date().toISOString(),
    }


    const { error } = await supabase().from('trips').upsert(record, { onConflict: 'trip_id' })
    if (error) {
      console.error('[sync/trips] upsert error:', JSON.stringify(error), 'record trip_id:', record.trip_id)
    } else {
      upserted++
    }
  }
  return upserted
}

async function syncTripTravelers() {
  const pages = await queryAllStandard(process.env.NOTION_TRIPS_DB!)
  const tripMap = await buildIdMap('trips')
  const travelerMap = await buildIdMap('travelers')
  let upserted = 0
  for (const p of pages) {
    const props = p.properties
    const tripSupabaseId = tripMap.get(p.id)
    if (!tripSupabaseId) continue
    const travelerNotionIds = relationIds(props['CQ Travelers'])
    for (const tNotionId of travelerNotionIds) {
      const travelerSupabaseId = travelerMap.get(tNotionId)
      if (!travelerSupabaseId) continue
      const { error } = await supabase().from('trip_travelers').upsert(
        { trip_id: tripSupabaseId, traveler_id: travelerSupabaseId },
        { onConflict: 'trip_id,traveler_id', ignoreDuplicates: true }
      )
      if (!error) upserted++
    }
  }
  return upserted
}

async function syncExperiences() {
  const pages = await queryAllStandard(process.env.NOTION_EXPERIENCES_CREATE_DB!)
  const tripMap = await buildIdMap('trips')

  // Pre-load existing (trip_id, title) → experience_id to detect cross-run duplicates
  const { data: existing } = await supabase().from('experiences').select('experience_id,trip_id,title')
  const existingMap = new Map<string, string>() // "tripId::title" → experience_id
  for (const row of (existing ?? []) as { experience_id: string; trip_id: string; title: string }[]) {
    existingMap.set(`${row.trip_id}::${row.title.toLowerCase().trim()}`, row.experience_id)
  }

  const seen = new Set<string>() // deduplicate within this sync run
  let upserted = 0
  for (const p of pages) {
    const props = p.properties
    const tripNotionIds = relationIds(props['CQ Trips'])
    const tripId = tripNotionIds.length > 0 ? (tripMap.get(tripNotionIds[0]) ?? null) : null
    if (!tripId) continue
    const title = text(props['Experience Name']) ?? 'Experience'
    const dedupKey = `${tripId}::${title.toLowerCase().trim()}`
    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)
    const tagsSelect = select(props['Tags'])
    // Reuse existing experience_id if one already exists for this (trip, title)
    const existingId = existingMap.get(dedupKey)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cover = (p as any).cover
    const coverUrl: string | null =
      cover?.type === 'external' ? (cover.external?.url ?? null) :
      cover?.type === 'file'     ? (cover.file?.url ?? null) : null

    const record = {
      notion_page_id: p.id,
      experience_id: existingId ?? uniqueId(props['Experience ID']) ?? p.id.replace(/-/g, '').slice(0, 8),
      trip_id: tripId,
      day_number: num(props['Day Number']),
      date: date(props['Date']),
      location: text(props['Location']),
      title,
      description: text(props['Description']),
      time_of_day: select(props['Time of Day']),
      duration: text(props['Duration']),
      tags: tagsSelect ? [tagsSelect] : [],
      cost_indicator: numText(props['Cost']),
      image_url: text(props['Image URL']) ?? coverUrl,
      sort_order: num(props['Sort Order']),
      status: select(props['Status']),
      booking_code: text(props['Code']) ?? text(props['CODE']) ?? text(props['Booking Code']),
      coupon_url: text(props['Coupon']) ?? text(props['Ticket']) ?? text(props['Coupon URL']) ?? text(props['Ticket URL']),
      iteration_num: iterationNum(props['Iteration']),
      iteration_date: date(props['Iteration Date']),
    }
    const { error } = await upsertTolerant('experiences', record, 'experience_id')
    if (!error) upserted++
  }
  return upserted
}


/**
 * Iteration is a select in Notion ("1", "2", "3"). Accept a number as well so a
 * change of field type never silently collapses every row onto version 1.
 */
function iterationNum(prop: Prop | undefined): number | null {
  if (prop && prop.type === 'number') return prop.number ?? null
  if (prop && prop.type === 'select') {
    const parsed = parseInt(prop.select?.name ?? '', 10)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/**
 * Upsert that survives a schema that hasn't caught up yet. A column we write but
 * Postgres doesn't have would otherwise fail the whole row — so drop the named
 * column and retry, keeping the rest of the record. Reports which keys it lost.
 */
const droppedColumns = new Set<string>()
async function upsertTolerant(
  table: string,
  record: Record<string, unknown>,
  onConflict: string,
): Promise<{ error: { message: string } | null }> {
  const row = { ...record }
  for (let attempt = 0; attempt < 6; attempt++) {
    const { error } = await supabase().from(table).upsert(row, { onConflict })
    if (!error) return { error: null }
    // 42703 = undefined column (direct SQL); PGRST204 = unknown to the schema cache
    const missing = error.message.match(/column "?(?:\w+\.)?(\w+)"? does not exist/i)
      ?? error.message.match(/Could not find the '(\w+)' column/i)
    if (!missing || !(missing[1] in row)) return { error }
    delete row[missing[1]]
    const key = `${table}.${missing[1]}`
    if (!droppedColumns.has(key)) {
      droppedColumns.add(key)
      console.warn(`[sync] ${key} missing in Postgres — syncing without it`)
    }
  }
  return { error: { message: `${table}: too many missing columns` } }
}

async function syncStays() {
  const pages = await queryAllStandard(process.env.NOTION_STAYS_CREATE_DB!)
  const tripMap = await buildIdMap('trips')

  const { data: existingStays } = await supabase().from('stays').select('stay_id,trip_id,property_name')
  const existingStayMap = new Map<string, string>()
  for (const row of (existingStays ?? []) as { stay_id: string; trip_id: string; property_name: string }[]) {
    // Normalize key so "Asilomar" and "asilomar " both resolve to the same existing record
    existingStayMap.set(`${row.trip_id}::${row.property_name.toLowerCase().trim()}`, row.stay_id)
  }

  const seen = new Set<string>()
  let upserted = 0
  for (const p of pages) {
    const props = p.properties
    const tripNotionIds = relationIds(props['CQ Trips'])
    const tripId = tripNotionIds.length > 0 ? (tripMap.get(tripNotionIds[0]) ?? null) : null
    if (!tripId) continue
    const propertyName = text(props['Property Name']) ?? 'Stay'
    const dedupKey = `${tripId}::${propertyName.toLowerCase().trim()}`
    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)
    const existingStayId = existingStayMap.get(dedupKey)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stayCover = (p as any).cover
    const stayCoverUrl: string | null =
      stayCover?.type === 'external' ? (stayCover.external?.url ?? null) :
      stayCover?.type === 'file'     ? (stayCover.file?.url ?? null) : null

    // A room needs several views, so gather every source: files dropped into
    // 'Image Upload', links pasted into 'Image URL' (one per line), then the page
    // cover. Order is preserved, duplicates dropped, capped at ten.
    const uploadedStay = files(props['Image Upload']).map(f => f.url).filter(Boolean)
    const linkedStay = (text(props['Image URL']) ?? '')
      .split(/[\n,]+/).map(u => u.trim()).filter(u => /^https?:\/\//i.test(u))
    const stayGallery = [...new Set([...uploadedStay, ...linkedStay, ...(stayCoverUrl ? [stayCoverUrl] : [])])].slice(0, 10)

    const record = {
      notion_page_id: p.id,
      stay_id: existingStayId ?? uniqueId(props['Stay ID']) ?? p.id.replace(/-/g, '').slice(0, 8),
      trip_id: tripId,
      // The property is "Place Name" in Notion; reading "Destination"
      // silently wrote null on every row.
      destination: text(props['Place Name']),
      property_name: propertyName,
      room_type: select(props['Room Type']),
      bed_type: select(props['Bed Type']),
      room_features: multiSelect(props['Room Features']),
      meals: multiSelectText(props['Meals']),
      meal_preferences: multiSelect(props['Meal Preferences']),
      check_in: date(props['Check In']),
      check_out: date(props['Check Out Date']),
      nights: num(props['Nights']),
      property_price: numText(props['Property Price']),
      description: text(props['Description']),
      image_url: stayGallery[0] ?? null,
      image_urls: stayGallery,
      sort_order: num(props['Sort Order']),
      status: select(props['Status']),
      booking_code: text(props['Code']) ?? text(props['CODE']) ?? text(props['Booking Code']),
      coupon_url: text(props['Coupon']) ?? text(props['Ticket']) ?? text(props['Coupon URL']) ?? text(props['Ticket URL']),
      iteration_num: iterationNum(props['Iteration']),
      iteration_date: date(props['Iteration Date']),
    }
    const { error } = await upsertTolerant('stays', record, 'stay_id')
    if (!error) upserted++
  }
  return upserted
}

async function syncTransfers() {
  const pages = await queryAllStandard(process.env.NOTION_TRANSFERS_CREATE_DB!)
  const tripMap = await buildIdMap('trips')

  const { data: existingTrf } = await supabase().from('transfers').select('transfer_id,trip_id,from_location,to_location')
  const existingTrfMap = new Map<string, string>()
  for (const row of (existingTrf ?? []) as { transfer_id: string; trip_id: string; from_location: string | null; to_location: string | null }[]) {
    existingTrfMap.set(`${row.trip_id}::${(row.from_location ?? '').toLowerCase().trim()}::${(row.to_location ?? '').toLowerCase().trim()}`, row.transfer_id)
  }

  const seen = new Set<string>()
  let upserted = 0
  for (const p of pages) {
    const props = p.properties
    const tripNotionIds = relationIds(props['CQ Trips'])
    const tripId = tripNotionIds.length > 0 ? (tripMap.get(tripNotionIds[0]) ?? null) : null
    if (!tripId) continue
    const fromLoc = text(props['From']) ?? ''
    const toLoc = text(props['To']) ?? ''
    const dedupKey = `${tripId}::${fromLoc.toLowerCase().trim()}::${toLoc.toLowerCase().trim()}`
    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)
    const existingTrfId = existingTrfMap.get(dedupKey)
    const record = {
      notion_page_id: p.id,
      transfer_id: existingTrfId ?? uniqueId(props['Transfer ID']) ?? p.id.replace(/-/g, '').slice(0, 8),
      trip_id: tripId,
      transfer_mode: select(props['Transfer Mode']) ?? select(props['Mode']),
      transfer_style: select(props['Transfer Style']),
      transfer_purpose: multiSelectText(props['Transfer Purpose']),
      from_location: fromLoc || null,
      to_location: toLoc || null,
      date: date(props['Date']),
      duration: numText(props['Duration']),
      carrier: text(props['Carrier']),
      amount: numText(props['Transfer Amount']),
      notes: text(props['Notes']),
      image_url: text(props['Image URL']),
      sort_order: num(props['Sort Order']),
      status: select(props['Status']),
      booking_code: text(props['Code']) ?? text(props['CODE']) ?? text(props['Booking Code']),
      coupon_url: text(props['Coupon']) ?? text(props['Ticket']) ?? text(props['Coupon URL']) ?? text(props['Ticket URL']),
      iteration_num: iterationNum(props['Iteration']),
      iteration_date: date(props['Iteration Date']),
    }
    const { error } = await upsertTolerant('transfers', record, 'transfer_id')
    if (!error) upserted++
  }
  return upserted
}

async function syncMessages() {
  const pages = await queryAll(process.env.NOTION_MESSAGES_DB!)
  const tripMap = await buildIdMap('trips')

  // Collect trip IDs that have messages, delete existing messages for those trips
  const tripIds = new Set<string>()
  for (const p of pages) {
    const tripNotionIds = relationIds(p.properties['CQ Trips'])
    const tripId = tripNotionIds.length > 0 ? (tripMap.get(tripNotionIds[0]) ?? null) : null
    if (tripId) tripIds.add(tripId)
  }
  for (const tripId of tripIds) {
    await supabase().from('messages').delete().eq('trip_id', tripId)
  }

  let inserted = 0
  for (const p of pages) {
    const props = p.properties
    const tripNotionIds = relationIds(props['CQ Trips'])
    const tripId = tripNotionIds.length > 0 ? (tripMap.get(tripNotionIds[0]) ?? null) : null
    if (!tripId) continue
    const record = {
      notion_page_id: p.id,
      message_id: uniqueId(props['Message ID']) ?? p.id.replace(/-/g, '').slice(0, 8),
      trip_id: tripId,
      sender: select(props['Sender'])?.toLowerCase() ?? 'cq',
      sender_name: text(props['Message Sender']) ?? select(props['Sender']) ?? 'CQ',
      message_type: select(props['Message Type'])?.toLowerCase() ?? 'note',
      content: text(props['Content']) ?? '',
      timestamp: p.created_time,
    }
    const { error } = await supabase().from('messages').insert(record)
    if (!error) inserted++
  }
  return inserted
}

async function syncDocuments() {
  const pages = await queryAll(process.env.NOTION_DOCUMENTS_DB!)
  const travelerMap = await buildIdMap('travelers')
  const tripMap = await buildIdMap('trips')
  const experienceMap = await buildIdMap('experiences')
  const stayMap = await buildIdMap('stays')
  const transferMap = await buildIdMap('transfers')
  let upserted = 0
  for (const p of pages) {
    const props = p.properties
    const travelerIds = relationIds(props['CQ Travelers'])
    const tripIds = relationIds(props['CQ Trips'])
    const expIds = relationIds(props['CQ Experiences'])
    const stayIds = relationIds(props['CQ Stays'])
    const transferIds = relationIds(props['CQ Transfers'])
    const record = {
      notion_page_id: p.id,
      document_id: uniqueId(props['Document ID']) ?? p.id.replace(/-/g, '').slice(0, 8),
      document_name: text(props['Document Name']) ?? 'Document',
      traveler_id: travelerIds.length > 0 ? (travelerMap.get(travelerIds[0]) ?? null) : null,
      trip_id: tripIds.length > 0 ? (tripMap.get(tripIds[0]) ?? null) : null,
      linked_experience_id: expIds.length > 0 ? (experienceMap.get(expIds[0]) ?? null) : null,
      linked_stay_id: stayIds.length > 0 ? (stayMap.get(stayIds[0]) ?? null) : null,
      linked_transfer_id: transferIds.length > 0 ? (transferMap.get(transferIds[0]) ?? null) : null,
      document_type: select(props['Document Type']),
      category: select(props['Select']),
      file_url: text(props['File URL']),
      expiry_date: date(props['Expiry Date']),
      notes: text(props['Notes']),
    }
    const { error } = await supabase().from('documents').upsert(record, { onConflict: 'document_id' })
    if (error) {
      console.error('[sync/documents] upsert error:', error.message, '| record:', record.document_name)
    } else {
      upserted++
    }
  }
  return upserted
}

async function syncNewsletter() {
  const dbId = process.env.NOTION_NEWSLETTER_DB
  if (!dbId) return 0

  const pages = await queryAll(dbId)
  let upserted = 0
  for (const p of pages) {
    const props = p.properties
    const record = {
      notion_page_id: p.id,
      post_id: uniqueId(props['Post ID']) ?? p.id.replace(/-/g, '').slice(0, 8),
      headline: text(props['Headline']) ?? text(props['Name']) ?? 'Post',
      content: text(props['Content ']), // trailing space is the actual Notion property name
      category: select(props['Category']),
      image_url: text(props['Image URL']),
      published_date: date(props['Publication Date']),
      status: select(props['Status']),
      target_audience: multiSelectText(props['Target Audience']),
    }
    const { error } = await supabase().from('newsletter').upsert(record, { onConflict: 'post_id' })
    if (!error) upserted++
  }
  return upserted
}

/**
 * Sync CQ Quotations from Notion → Supabase.
 *
 * Each Notion page = one line item. Pages are grouped by (trip + Blueprint Version)
 * to produce a single quotation record per group, with child line_items rows.
 *
 * Expected Notion property names:
 *   Name / Description  — title or rich_text  → line item description
 *   Amount USD          — number              → amount (USD)
 *   Amount INR          — number              → stored in notes as INR ref
 *   Category            — select              → Experiences | Stays | Transfers | Fees | Other
 *   Blueprint Version   — rich_text / text   → quotation version name
 *   Status              — select              → draft | sent | accepted | superseded
 *   Trip                — relation            → links to CQ Trips
 */
async function syncQuotations(): Promise<number> {
  const dbId = process.env.NOTION_QUOTATIONS_DB
  if (!dbId) return 0

  const pages = await queryAllStandard(dbId)
  const tripMap = await buildTripTextIdMap()

  // Group pages by (trip_id, blueprint_version)
  const groups = new Map<string, { tripId: string; version: string; status: string; pages: PageObjectResponse[] }>()
  for (const p of pages) {
    const props = p.properties
    const tripNotionIds = relationIds(props['Trip'])
    const tripId = tripNotionIds.length > 0 ? (tripMap.get(tripNotionIds[0]) ?? null) : null
    if (!tripId) continue
    const version = text(props['Blueprint Version']) ?? 'Draft'
    const status  = select(props['Status']) ?? 'draft'
    const key = `${tripId}::${version.toLowerCase().trim()}`
    if (!groups.has(key)) groups.set(key, { tripId, version, status, pages: [] })
    groups.get(key)!.pages.push(p)
  }

  let upserted = 0
  for (const [, group] of groups) {
    const { tripId, version, status, pages: gPages } = group
    const quotationId = `QUO-${tripId}-${version.replace(/\s+/g, '-').toLowerCase().slice(0, 20)}`

    const totalUSD = gPages.reduce((s, p) => s + (num(p.properties['Amount USD']) ?? 0), 0)

    const { error: qErr } = await supabase().from('quotations').upsert({
      quotation_id: quotationId,
      trip_id:      tripId,
      version,
      status:       status.toLowerCase(),
      currency:     'USD',
      total_amount: totalUSD,
    }, { onConflict: 'quotation_id' })

    if (qErr) {
      console.error('[sync/quotations] upsert error:', qErr.message)
      continue
    }

    // Rebuild line items: delete existing, insert fresh
    await supabase().from('quotation_line_items').delete().eq('quotation_id', quotationId)
    const lineItems = gPages.map((p, i) => {
      const props = p.properties
      const amountINR = num(props['Amount INR'])
      return {
        quotation_id: quotationId,
        category:     select(props['Category']) ?? 'Other',
        description:  text(props['Name']) ?? text(props['Description']) ?? 'Item',
        amount:       num(props['Amount USD']),
        currency:     'USD',
        notes:        amountINR != null ? `INR ${amountINR.toLocaleString('en-IN')}` : null,
        sort_order:   i,
      }
    })
    if (lineItems.length > 0) {
      await supabase().from('quotation_line_items').insert(lineItems)
    }
    upserted++
  }
  return upserted
}

/**
 * Sync CQ Payments Database from Notion → Supabase trips table.
 *
 * One record per trip — writes payment summary directly onto the trip row.
 *
 * Notion property names:
 *   CQ Trips                — relation → links to trips
 *   Total Vacation Amount   — number   → trip_cost
 *   Paid Vacation Amount    — number   → amount_paid
 *   Pending Vacation Amount — number   → amount_pending (stored for reference)
 *   Next Payment            — date     → next_payment_date
 */
async function syncPayments(): Promise<number> {
  const dbId = process.env.NOTION_PAYMENTS_DB
  if (!dbId) return 0

  const pages = await queryAllStandard(dbId)
  const tripMap = await buildTripTextIdMap()
  const tripUuidMap = await buildIdMap('trips')
  let upserted = 0

  for (const p of pages) {
    const props = p.properties
    const tripNotionIds = relationIds(props['CQ Trips'])
    const tripId = tripNotionIds.length > 0 ? (tripMap.get(tripNotionIds[0]) ?? null) : null
    if (!tripId) continue

    const update = {
      trip_cost:         num(props['Total Vacation Amount']),
      amount_paid:       num(props['Paid Vacation Amount']),
      amount_pending:    num(props['Pending Vacation Amount']),
      next_payment_date: date(props['Next Payment due date']) ?? date(props['Next Payment']),
      updated_at:        new Date().toISOString(),
    }

    const { error } = await supabase().from('trips')
      .update(update)
      .eq('trip_id', tripId)

    if (error) {
      console.error('[sync/payments] update error:', error.message)
    } else {
      upserted++
    }

    // Receipts — files uploaded to the "Recipts" property, surfaced under
    // Receipts in the Reservations stage via the documents table.
    const tripUuid = tripNotionIds.length > 0 ? (tripUuidMap.get(tripNotionIds[0]) ?? null) : null
    if (tripUuid) {
      await supabase().from('documents').delete().eq('trip_id', tripUuid).eq('document_type', 'Receipt')
      const receiptFiles = files(props['Recipts'])
      if (receiptFiles.length > 0) {
        const receiptRows = receiptFiles.map((f, i) => ({
          notion_page_id: `${p.id}-receipt-${i}`,
          document_id:    `RCPT-${p.id.replace(/-/g, '').slice(0, 12)}-${i}`,
          document_name:  f.name || 'Receipt',
          trip_id:        tripUuid,
          document_type:  'Receipt',
          category:       'Receipt',
          file_url:       f.url,
        }))
        const { error: rErr } = await supabase().from('documents').upsert(receiptRows, { onConflict: 'document_id' })
        if (rErr) console.error('[sync/payments] receipt upsert error:', rErr.message)
      }
    }
  }
  return upserted
}

/**
 * Sync CQ Invoices from Notion → Supabase.
 *
 * Expected Notion property names:
 *   Invoice Number — title     → invoice_number
 *   Amount         — number    → amount
 *   Currency       — select    → USD | INR | EUR | GBP | SGD | AED
 *   Status         — select    → draft | issued | paid | cancelled
 *   Issued Date    — date      → issued_date
 *   Due Date       — date      → due_date
 *   File URL       — url/text  → file_url (PDF link)
 *   Notes          — rich_text → notes
 *   Trip           — relation  → links to CQ Trips
 */
async function syncInvoices(): Promise<number> {
  const dbId = process.env.NOTION_INVOICES_DB
  if (!dbId) return 0

  const pages = await queryAllStandard(dbId)
  const tripMap = await buildTripTextIdMap()
  let upserted = 0

  for (const p of pages) {
    const props = p.properties
    const tripNotionIds = relationIds(props['Trip'])
    const tripId = tripNotionIds.length > 0 ? (tripMap.get(tripNotionIds[0]) ?? null) : null
    if (!tripId) continue

    const invoiceId = `INV-${p.id.replace(/-/g, '').slice(0, 12)}`
    const record = {
      invoice_id:     invoiceId,
      trip_id:        tripId,
      invoice_number: text(props['Invoice Number']),
      status:         (select(props['Status']) ?? 'issued').toLowerCase(),
      amount:         num(props['Amount']),
      currency:       select(props['Currency']) ?? 'USD',
      issued_date:    date(props['Issued Date']),
      due_date:       date(props['Due Date']),
      file_url:       text(props['File URL']),
      notes:          text(props['Notes']),
    }
    const { error } = await supabase().from('invoices').upsert(record, { onConflict: 'invoice_id' })
    if (error) {
      console.error('[sync/invoices] upsert error:', error.message)
    } else {
      upserted++
    }
  }
  return upserted
}

// ── Types for Notion block parsing ───────────────────────────────────────────

type RichTextItem = { plain_text: string; href?: string | null }
type BlockResult  = {
  id: string
  type: string
  heading_1?:  { rich_text: RichTextItem[] }
  heading_2?:  { rich_text: RichTextItem[] }
  heading_3?:  { rich_text: RichTextItem[] }
  paragraph?:  { rich_text: RichTextItem[] }
  divider?:    object
  child_database?: { title: string }
}

function blockText(rts: RichTextItem[] | undefined): string {
  return (rts ?? []).map(r => r.plain_text).join('')
}

function blockLink(rts: RichTextItem[] | undefined): string | null {
  for (const r of rts ?? []) { if (r.href) return r.href }
  return null
}

async function fetchThisWeekFromPage(pageId: string): Promise<{
  headline: string | null; location: string | null; summary: string | null
  story: string | null; reading_link: string | null
} | null> {
  const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
    headers: { 'Authorization': `Bearer ${process.env.NOTION_TOKEN}`, 'Notion-Version': '2022-06-28' },
  })
  if (!res.ok) return null
  const data = await res.json() as { results: BlockResult[] }

  let inThisWeek = false
  let headline: string | null = null
  let location: string | null = null
  const bodyParts: string[] = []
  let reading_link: string | null = null

  for (const block of data.results) {
    if (block.type === 'heading_1') {
      const h1 = blockText(block.heading_1?.rich_text)
      if (h1.toLowerCase().includes('this week')) { inThisWeek = true; continue }
      if (inThisWeek) break // hit "Past Issues" heading — stop
    }
    if (!inThisWeek) continue
    if (block.type === 'child_database') break

    if (block.type === 'heading_2') {
      headline = blockText(block.heading_2?.rich_text) || null
    } else if (block.type === 'heading_3') {
      const h3 = blockText(block.heading_3?.rich_text)
      if (h3) bodyParts.push(`**${h3}**`)
    } else if (block.type === 'paragraph') {
      const para = blockText(block.paragraph?.rich_text)
      if (!para) continue
      // Location/date line: "Place · Date" in italics right after title
      if (headline && !location && para.includes('·')) {
        location = para.split('·')[0].trim()
        continue
      }
      const link = blockLink(block.paragraph?.rich_text)
      if (link) reading_link = link
      bodyParts.push(para)
    }
  }

  if (!headline) return null
  const summary = bodyParts.find(p => p.length > 60 && !p.startsWith('**')) ?? null
  return { headline, location, summary: summary?.slice(0, 300) ?? null, story: bodyParts.join('\n\n'), reading_link }
}

async function syncLoaf(): Promise<number> {
  const dbId     = process.env.NOTION_LOAF_DB
  const pageId   = process.env.NOTION_LOAF_PAGE_ID
  if (!dbId && !pageId) return 0

  let upserted = 0

  // Determine this week's headline from the CQ LOAF page, so the matching
  // Past Issues DB entry below can be flagged is_this_week correctly.
  const tw = pageId ? await fetchThisWeekFromPage(pageId) : null
  const thisWeekHeadline = tw?.headline?.toLowerCase().trim() ?? null

  // Past Issues database
  if (dbId) {
    const pages = await queryAllStandard(dbId)
    for (const p of pages) {
      const props = p.properties
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cover = (p as any).cover
      const coverUrl: string | null =
        cover?.type === 'external' ? (cover.external?.url ?? null) :
        cover?.type === 'file'     ? (cover.file?.url ?? null) : null

      const headline = text(props['Headline']) ?? 'Untitled'
      const record = {
        notion_page_id: p.id,
        headline,
        location:       text(props['Location']),
        summary:        text(props['Summary']),
        story:          text(props['Story']),
        reading_link:   text(props['Reading Link']),
        tags:           multiSelect(props['Tags']),
        source:         select(props['Source']),
        submitted_by:   text(props['Submitted By']),
        why_interesting: text(props["Why It's Interesting"]),
        date_featured:  date(props['Date Featured']),
        is_this_week:   thisWeekHeadline !== null && headline.toLowerCase().trim() === thisWeekHeadline,
        // A pasted link, else an uploaded file, else the page cover.
        cover_url:      coverFrom(props, p.id, 'Cover URL', 'Cover Image') ?? coverUrl,
        updated_at:     new Date().toISOString(),
      }
      const { error } = await supabase()
        .from('loaf_stories')
        .upsert(record, { onConflict: 'notion_page_id' })
      if (!error) upserted++
    }
  }

  return upserted
}

// ── Dates & Destinations (structured, iterated) ───────────────────────────────
// One Notion row per destination per iteration. The portal shows the highest
// iteration number by default and lets the client browse earlier ones.
async function syncDatesDestinations() {
  const dbId = process.env.NOTION_DATES_DESTINATIONS_DB
  if (!dbId) return 0
  const num = (prop: Prop | undefined): number | null =>
    prop && prop.type === 'number' ? (prop.number as number | null) : null

  const { data: tripRows } = await supabase().from('trips').select('id, trip_id')
  const tripMap = new Map((tripRows ?? []).map((t: { id: string; trip_id: string }) => [t.trip_id.toUpperCase(), t.id]))

  const rawPages = await queryAllStandard(dbId)

  // Walk in the order the curator numbered them, so activity ordering is theirs
  const sortOf = (pg: PageObjectResponse): number => {
    const sp = pg.properties['Sort']
    return (sp && sp.type === 'number' ? sp.number : null) ?? 0
  }
  const pages = [...rawPages].sort((a, b) => sortOf(a) - sortOf(b))

  // Activities name their place in Notion via "Belongs To". Rather than adding a
  // join column, resolve that name to the destination sort order and store the
  // activity at parentSort*100 + n, so the portal groups them arithmetically.
  const destSort = new Map<string, number>()
  for (const dp of pages) {
    const pr = dp.properties
    const rtProp = pr['Row Type']
    const rt = rtProp && rtProp.type === 'select' ? (rtProp.select?.name ?? null) : null
    if (rt !== 'Destination') continue
    const nm = (text(pr['Place']) ?? '').trim().toLowerCase()
    const soProp = pr['Sort']
    const so = (soProp && soProp.type === 'number' ? soProp.number : null) ?? 0
    if (nm) destSort.set(nm, so)
  }
  const bandCounter = new Map<number, number>()

  let upserted = 0
  for (const p of pages) {
    const props = p.properties
    const tripKey = (text(props['Trip ID']) ?? '').trim().toUpperCase()
    const tripUuid = tripMap.get(tripKey)
    if (!tripUuid) continue
    // Images come from two places: files dropped into the Image property, and
    // links pasted into Image URLs (one per line). Uploads lead, links follow;
    // duplicates dropped, capped at ten per row.
    const urlProp = (prop: Prop | undefined): string | null =>
      prop && prop.type === 'url' ? (prop.url ?? null) : null
    const pastedUrls = (text(props['Image URLs']) ?? '')
      .split(/[\n,]+/).map(u => u.trim()).filter(u => /^https?:\/\//i.test(u))
    const uploaded = files(props['Image']).map(f => f.url).filter(Boolean)
    const gallery  = [...new Set([...uploaded, ...pastedUrls])].slice(0, 10)
    const mapImage = files(props['Map Image'])[0]?.url ?? urlProp(props['Map Image URL'])
    const sel = (prop: Prop | undefined): string | null =>
      prop && prop.type === 'select' ? (prop.select?.name ?? null) : null
    const record = {
      notion_page_id: p.id,
      trip_id: tripUuid,
      row_type:      sel(props['Row Type']) ?? 'Destination',
      // Iteration is a select in Notion ("1", "2", "3"), though it began life as
      // a number — accept either so a schema change never collapses versions.
      iteration_num: (() => {
        const n = num(props['Iteration'])
        if (n != null) return n
        const parsed = parseInt(sel(props['Iteration']) ?? '', 10)
        return Number.isFinite(parsed) ? parsed : 1
      })(),
      iteration_date: date(props['Iteration Date']),
      sort_order:    (() => {
        if (sel(props['Row Type']) !== 'Activity') return num(props['Sort']) ?? 0
        const parent = (text(props['Belongs To']) ?? '').trim().toLowerCase()
        const base = (destSort.get(parent) ?? 0) * 100
        const n = (bandCounter.get(base) ?? 0) + 1
        bandCounter.set(base, n)
        return base + n
      })(),
      dates_label:   text(props['Dates']),
      place:         text(props['Place']) ?? 'Untitled',
      display_name:  text(props['Display Name']),
      arrival_date:  date(props['Arrival Date']),
      nights:        num(props['Nights']),
      duration:      text(props['Duration']),
      description:   text(props['Description']),
      atmosphere:    text(props['Atmosphere']),
      things_to_do:  text(props['Things to Do']),
      where_you_stay: text(props['Where You Stay']),
      from_location: text(props['From']),
      to_location:   text(props['To']),
      travel_time:   text(props['Travel Time']),
      mode:          sel(props['Mode']),
      theme_intro:    text(props['Theme Intro']),
      pull_quote:     text(props['Pull Quote']),
      what_to_expect: text(props['What to Expect']),
      what_it_means:  text(props['What It Means']),
      closing_note:   text(props['Closing Note']),
      sign_off:       text(props['Sign Off']),
      image_url:  gallery[0] ?? null,
      image_urls: gallery,
      map_image_url: mapImage,
      synced_at: new Date().toISOString(),
    }
    const { error } = await supabase().from('dates_destinations').upsert(record, { onConflict: 'notion_page_id' })
    if (error) console.error('[sync/dates_destinations] upsert error:', error.message, 'for', record.place)
    else upserted++
  }

  // Prune rows whose Notion page was archived or deleted
  const liveIds = new Set(pages.map(pg => pg.id))
  const { data: stored } = await supabase().from('dates_destinations').select('id, notion_page_id')
  const orphaned = (stored ?? [])
    .filter((r: { id: string; notion_page_id: string | null }) => !r.notion_page_id || !liveIds.has(r.notion_page_id))
    .map((r: { id: string }) => r.id)
  if (orphaned.length > 0) {
    await supabase().from('dates_destinations').delete().in('id', orphaned)
    console.log('[sync/dates_destinations] pruned', orphaned.length, 'orphaned rows')
  }

  return upserted
}

// ── entry point ──────────────────────────────────────────────────────────────

export type NotionSyncResult = {
  synced_at: string
  results: Record<string, number>
  errors: Record<string, string>
  preCleaned: Record<string, number>
  postCleaned: Record<string, number>
}

/**
 * Full Notion → Supabase sync. Called directly by /api/sync, the cron routes,
 * auto-sync and the LOAF digest — never over HTTP, which Vercel
 * Authentication would block. A failing table is recorded in errors and the
 * rest still sync; only the dedupe passes can throw.
 */
export async function runNotionSync(): Promise<NotionSyncResult> {
  // Pre-sync deduplication: clean any existing duplicates before building
  // existingMaps, so lookups always resolve to a single canonical row.
  async function dedupeTable(table: string, keyFields: string[], selectFields: string): Promise<number> {
    const { data } = await supabase().from(table).select(selectFields).order('id', { ascending: true })
    if (!data) return 0
    const seen = new Map<string, string>()
    const toDelete: string[] = []
    for (const row of data as unknown as Record<string, string | null>[]) {
      const key = keyFields.map(f => (row[f] ?? '').toLowerCase().trim()).join('::')
      if (seen.has(key)) toDelete.push(row.id ?? '')
      else seen.set(key, row.id ?? '')
    }
    if (toDelete.length > 0) {
      await supabase().from(table).delete().in('id', toDelete)
    }
    return toDelete.length
  }

  const preCleaned = {
    experiences: await dedupeTable('experiences', ['trip_id', 'title'], 'id,trip_id,title'),
    stays:       await dedupeTable('stays', ['trip_id', 'property_name'], 'id,trip_id,property_name'),
    transfers:   await dedupeTable('transfers', ['trip_id', 'from_location', 'to_location'], 'id,trip_id,from_location,to_location'),
  }

  const results: Record<string, number> = {}
  const errors: Record<string, string> = {}

  // Each table syncs on its own: one failure is recorded and the rest carry on.
  const steps: [string, () => Promise<number>][] = [
    ['loaf', syncLoaf],
    ['clients', syncClients],
    ['travelers', syncTravelers],
    ['destination_info', syncDestinationInfo],
    ['dates_destinations', syncDatesDestinations],
    ['trips', syncTrips],
    ['trip_travelers', syncTripTravelers],
    ['experiences', syncExperiences],
    ['stays', syncStays],
    ['transfers', syncTransfers],
    ['messages', syncMessages],
    ['documents', syncDocuments],
    ['newsletter', syncNewsletter],
    ['quotations', syncQuotations],
    ['payments', syncPayments],
    ['invoices', syncInvoices],
    ['daily_briefs', syncDailyBriefs],
    ['recommendations', syncRecommends],
    ['suggestions', syncSuggestions],
  ]
  for (const [table, run] of steps) {
    try {
      results[table] = await run()
    } catch (err) {
      console.error(`[sync/${table}]`, err)
      errors[table] = err instanceof Error ? err.message : String(err)
    }
  }

  // Post-sync deduplication: catch anything that slipped through
  const postCleaned = {
    experiences: await dedupeTable('experiences', ['trip_id', 'title'], 'id,trip_id,title'),
    stays:       await dedupeTable('stays', ['trip_id', 'property_name'], 'id,trip_id,property_name'),
    transfers:   await dedupeTable('transfers', ['trip_id', 'from_location', 'to_location'], 'id,trip_id,from_location,to_location'),
  }

  return { synced_at: new Date().toISOString(), results, errors, preCleaned, postCleaned }
}
