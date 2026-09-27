import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { createAdminClient } from '@/lib/supabase/admin'
import type { BlockObjectResponse, PartialBlockObjectResponse } from '@notionhq/client/build/src/api-endpoints/blocks'

const notion = new Client({ auth: process.env.NOTION_TOKEN })
let _supabase: ReturnType<typeof createAdminClient> | null = null
/** Built on first use — see note above; never at import time. */
const supabase = () => (_supabase ??= createAdminClient())

type AnyBlock = BlockObjectResponse | PartialBlockObjectResponse

// ── Helpers ────────────────────────────────────────────────────────────────────

function cellText(cell: Array<{ plain_text?: string }>): string {
  return cell.map(t => t.plain_text ?? '').join('').trim()
}

async function listChildren(blockId: string): Promise<AnyBlock[]> {
  const results: AnyBlock[] = []
  let cursor: string | undefined
  do {
    const res = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    })
    results.push(...res.results)
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined
  } while (cursor)
  return results
}

function matchColumn(headers: string[], keywords: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase()
    if (keywords.some(k => h.includes(k.toLowerCase()))) return i
  }
  return -1
}

/** Only pass a date to Supabase if it looks like YYYY-MM-DD */
function sanitizeDate(s: string | null | undefined): string | null {
  if (!s) return null
  const trimmed = s.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  return null
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

/**
 * Given a raw date cell value (e.g. "21", "Apr 21", "21 Apr", "21/4") and the
 * trip start date (YYYY-MM-DD), deterministically compute a YYYY-MM-DD date.
 * Rules for bare day numbers:
 *   - if day >= startDay → assume trip start month
 *   - if day < startDay  → assume next month
 * Returns null when the input is empty or unresolvable.
 */
function resolveDateFromDayNumber(rawDate: string, tripStartDate: string): string | null {
  if (!rawDate) return null
  const raw = rawDate.trim()

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  // Parse trip start
  const tripStart = new Date(tripStartDate + 'T00:00:00')
  if (isNaN(tripStart.getTime())) return null
  const startYear  = tripStart.getFullYear()
  const startMonth = tripStart.getMonth() + 1 // 1-indexed
  const startDay   = tripStart.getDate()

  // "DD Mon" or "Mon DD" formats — e.g. "21 Apr" or "Apr 21"
  const withMonthMatch =
    raw.match(/^(\d{1,2})\s+([A-Za-z]{3})/i) ||
    raw.match(/^([A-Za-z]{3})\s+(\d{1,2})/i)
  if (withMonthMatch) {
    let day: number, monthStr: string
    if (/^\d/.test(raw)) {
      day = parseInt(withMonthMatch[1])
      monthStr = withMonthMatch[2].toLowerCase().slice(0, 3)
    } else {
      monthStr = withMonthMatch[1].toLowerCase().slice(0, 3)
      day = parseInt(withMonthMatch[2])
    }
    const month = MONTH_NAMES[monthStr]
    if (month && day >= 1 && day <= 31) {
      const mm = String(month).padStart(2, '0')
      const dd = String(day).padStart(2, '0')
      return `${startYear}-${mm}-${dd}`
    }
  }

  // "DD/MM" or "MM/DD" — treat as DD/MM (European style)
  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (slashMatch) {
    const d = parseInt(slashMatch[1])
    const m = parseInt(slashMatch[2])
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      return `${startYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }

  // Bare day number: "21", "22", etc.
  const bareMatch = raw.match(/^(\d{1,2})$/)
  if (bareMatch) {
    const day = parseInt(bareMatch[1])
    if (day < 1 || day > 31) return null

    let month: number
    let year = startYear

    if (day >= startDay) {
      // Same month as trip start
      month = startMonth
    } else {
      // Next month
      month = startMonth + 1
      if (month > 12) { month = 1; year += 1 }
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return null
}

/** Clean destination — if "City A - City B", use "City B" (arrival) for stays */
function arrivalDest(dest: string | null | undefined): string | null {
  if (!dest) return null
  const parts = dest.split(/\s*[-–]\s*/)
  return parts[parts.length - 1].trim() || null
}

// ── ID generation ─────────────────────────────────────────────────────────────

async function getNextIdNum(table: string, idCol: string): Promise<number> {
  const { data } = await supabase().from(table).select(idCol)
  let max = 0
  for (const row of ((data ?? []) as unknown as Record<string, string>[])) {
    const val = row[idCol] ?? ''
    const match = val.match(/(\d+)$/)
    if (match) max = Math.max(max, parseInt(match[1]))
  }
  return max + 1
}

// ── Claude parsing ────────────────────────────────────────────────────────────

interface RowData {
  date: string
  destination: string
  experience: string
  stay: string
  transit: string
  transfer: string
  notes: string
}

interface ParsedExperience {
  title: string
  description: string | null
  time_of_day: string | null
  duration: string | null
  cost_indicator: string | null
  cost_inr: string | null
  tags: string[]
  meeting_point: string | null
  image_url: string | null
}

interface ParsedStay {
  property_name: string
  room_type: string | null
  bed_type: string | null
  property_price: string | null
  meals: string | null
  description: string | null
}

interface ParsedTransit {
  from_location: string | null
  to_location: string | null
  transfer_mode: string | null
  duration: string | null
  carrier: string | null
  amount: string | null
  time: string | null
  notes: string | null
}

interface ParsedTransfer {
  from_location: string | null
  to_location: string | null
  transfer_mode: string | null
  transfer_purpose: string | null
  duration: string | null
  notes: string | null
}

interface ParsedRow {
  date: string | null
  destination: string | null
  experience: ParsedExperience | null
  stay: ParsedStay | null
  transit: ParsedTransit | null
  transfer: ParsedTransfer | null
  notes: string | null
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function parseRowWithClaude(row: RowData, tripStartDate: string): Promise<ParsedRow | null> {
  const hasData = row.experience || row.stay || row.transit || row.transfer
  if (!hasData) return null

  // Pre-resolve the date deterministically so Claude doesn't guess the wrong month
  const preResolvedDate = resolveDateFromDayNumber(row.date, tripStartDate)

  const prompt = `You are a travel data parser for a luxury travel concierge. Parse this row from a trip planning table and extract structured data. Return ONLY valid JSON, no markdown, no backticks, no explanation.

Trip context: trip starts on ${tripStartDate}. The year is ${tripStartDate.slice(0, 4)}.

Row data:
- Date: ${(preResolvedDate ?? row.date) || '(empty)'} ${preResolvedDate ? `(pre-resolved from raw "${row.date}")` : ''}
- Destination: ${row.destination || '(empty)'}
- Experience: ${row.experience || '(empty)'}
- Stay: ${row.stay || '(empty)'}
- Transit: ${row.transit || '(empty)'}
- Transfer: ${row.transfer || '(empty)'}
- Notes: ${row.notes || '(empty)'}

Return this exact JSON structure:
{
  "date": "YYYY-MM-DD if you can derive it confidently, otherwise null",
  "destination": "primary destination city name only (if 'City A - City B', use City B as arrival)",
  "experience": {
    "title": "main activity name",
    "description": "full description",
    "time_of_day": "Morning or Afternoon or Evening or Full Day or Mid-morning",
    "duration": "duration like 3-4 hours",
    "cost_indicator": "USD price like $500",
    "cost_inr": "INR price if available",
    "tags": ["Adventure", "Cultural", "Fine Dining", "Nature", "Wellness", "Historical"],
    "meeting_point": "meeting location if mentioned",
    "image_url": "first valid http/https URL found anywhere in the Experience cell text (Unsplash, hotel site, image.notion.so, etc.), null if none"
  },
  "stay": {
    "property_name": "hotel or property name",
    "room_type": "room category like Deluxe, Standard, Suite",
    "bed_type": "bed type like King, Queen, Twin",
    "property_price": "ONLY the primary USD price and primary INR price, formatted as '$X,XXX / INR X,XX,XXX'. Do NOT include buffer costs, Otilla prices, Booking.com prices, pay-at-property variants, or any secondary/alternative pricing. If multiple prices exist, choose the middle/primary figure.",
    "meals": "meal plan or No meal",
    "description": "brief description"
  },
  "transit": {
    "from_location": "origin city or airport",
    "to_location": "destination city or airport",
    "transfer_mode": "Flight or Car or Train or Ferry or Bus",
    "duration": "travel duration",
    "carrier": "airline if mentioned",
    "amount": "price if mentioned",
    "time": "departure/arrival times",
    "notes": "additional details"
  },
  "transfer": {
    "from_location": "origin",
    "to_location": "destination",
    "transfer_mode": "Car or similar",
    "transfer_purpose": "Airport Pickup or Airport Drop or Hotel Transfer",
    "duration": "duration if mentioned",
    "notes": "additional details"
  },
  "notes": "notes column content"
}

IMPORTANT:
- Set sections to null if empty.
- For date: if a pre-resolved date is provided above, use it exactly as-is (YYYY-MM-DD). Do not modify it. If no pre-resolved date, return null.
- For property_price: extract ONE clean price only. Never include buffer costs, Otilla, Booking.com alternatives, pay-at-property notes, or secondary options. Format: '$X,XXX / INR X,XX,XXX'.
- For experience cost_indicator: similarly extract ONE primary price only.
- For experience image_url: scan the raw Experience cell text for any http/https URL (Unsplash, hotel websites, image.notion.so). Return the first valid URL found, or null.
- Do not invent data.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Claude API error:', response.status, errText)
      return null
    }

    const data = await response.json()
    const text: string = data.content?.[0]?.text ?? ''
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    return JSON.parse(cleaned) as ParsedRow
  } catch (error) {
    console.error('parseRowWithClaude error:', error)
    return null
  }
}

// ── Stay date computation ─────────────────────────────────────────────────────

interface StayDateRange {
  checkIn: string | null
  checkOut: string | null
  nights: number | null
}

function computeStayDates(
  parsedRows: Array<{ parsed: ParsedRow | null }>
): Record<string, StayDateRange> {
  const result: Record<string, StayDateRange> = {}

  // First pass: find check-in date (date of row where stay first appears)
  const stayFirstIdx: Record<string, number> = {}
  for (let i = 0; i < parsedRows.length; i++) {
    const p = parsedRows[i].parsed
    if (!p?.stay?.property_name) continue
    const name = p.stay.property_name
    if (!(name in stayFirstIdx)) {
      stayFirstIdx[name] = i
      result[name] = {
        checkIn: sanitizeDate(p.date),
        checkOut: null,
        nights: null,
      }
    }
  }

  // Second pass: find check-out (date of first row with a DIFFERENT stay after this stay)
  for (const [name, firstIdx] of Object.entries(stayFirstIdx)) {
    let inStay = false
    for (let i = 0; i < parsedRows.length; i++) {
      const p = parsedRows[i].parsed
      if (!p) continue
      if (p.stay?.property_name === name) { inStay = true; continue }
      if (inStay) {
        // First row after this stay ends
        const date = sanitizeDate(p.date)
        if (date) {
          result[name].checkOut = date
        } else if (p.stay?.property_name) {
          // Even without a valid date, mark it as changing
          result[name].checkOut = sanitizeDate(parsedRows[firstIdx].parsed?.date)
        }
        break
      }
    }

    // Compute nights
    const { checkIn, checkOut } = result[name]
    if (checkIn && checkOut) {
      const d1 = new Date(checkIn)
      const d2 = new Date(checkOut)
      const nights = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
      result[name].nights = nights > 0 ? nights : null
    }
  }

  return result
}

// ── Supabase write helpers ────────────────────────────────────────────────────

interface TripRecord {
  id: string
  trip_id: string
  start_date: string | null
  notion_page_id: string | null
}

/** Fetch the iteration page title from Notion (used as version label) */
async function getIterationTitle(pageId: string): Promise<string> {
  try {
    const page = await notion.pages.retrieve({ page_id: pageId }) as {
      properties?: Record<string, {
        type: string
        title?: Array<{ plain_text?: string }>
      }>
    }
    const titleProp = Object.values(page.properties ?? {}).find(p => p.type === 'title')
    const title = titleProp?.title?.map(t => t.plain_text ?? '').join('').trim()
    return title || pageId.slice(0, 8)
  } catch {
    return pageId.slice(0, 8)
  }
}

async function resolveTrip(tripId: string): Promise<TripRecord | null> {
  const isUuid = /^[0-9a-f-]{36}$/i.test(tripId)
  const { data } = isUuid
    ? await supabase().from('trips').select('id, trip_id, start_date, notion_page_id').eq('id', tripId).maybeSingle()
    : await supabase().from('trips').select('id, trip_id, start_date, notion_page_id').eq('trip_id', tripId).maybeSingle()
  return data as TripRecord | null
}

// ── Iteration management ──────────────────────────────────────────────────────

const NOTION_ITERATIONS_DB = '349cc540df098020997df419800eb085'

interface IterationRecord {
  id: string
  notion_id: string | null
  name: string
  trip_id: string
  notion_page_id: string
  is_current: boolean
  synced_at: string
}

/**
 * Create a row in the Notion CQ Iterations database.
 * Returns the new page ID, or null on failure.
 */
async function createNotionIterationRow(
  name: string,
  tripNotionPageId: string,
  iterationNotionPageId: string,
): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {
      'Name': { title: [{ text: { content: name || 'Iteration' } }] },
      'Notion Page ID': { rich_text: [{ text: { content: iterationNotionPageId } }] },
      'Is Current': { checkbox: true },
      'Synced At': { date: { start: new Date().toISOString() } },
    }
    if (tripNotionPageId) {
      properties['Trip'] = { relation: [{ id: tripNotionPageId }] }
    }
    const page = await notion.pages.create({ parent: { database_id: NOTION_ITERATIONS_DB }, properties })
    return page.id
  } catch (err) {
    console.error('[sync] createNotionIterationRow error:', err)
    return null
  }
}

/**
 * Flip is_current on an existing Notion CQ Iterations row.
 */
async function flipNotionIterationCurrent(notionRowId: string, isCurrent: boolean): Promise<void> {
  try {
    await notion.pages.update({
      page_id: notionRowId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties: { 'Is Current': { checkbox: isCurrent } } as any,
    })
  } catch (err) {
    console.warn('[sync] flipNotionIterationCurrent error:', err)
  }
}

interface ResolvedIteration {
  iterationUuid: string
  notionRowId: string | null  // Notion CQ Iterations page ID
  isResync: boolean
}

/**
 * Determine whether this is a brand-new iteration or a resync of an existing one.
 *
 * RESYNC  (same name already in iterations table):
 *   - Update synced_at on the existing row
 *   - DELETE all exp/stays/transfers tagged with that iteration_id
 *     (they'll be re-inserted fresh below)
 *
 * NEW ITERATION:
 *   - Flip previous is_current iteration to is_current=false
 *   - Flip its tagged exp/stays/transfers to is_current=false + is_active_version=false
 *   - Flip its Notion CQ Iterations row to Is Current=false
 *   - INSERT new iteration into Supabase + Notion
 */
async function resolveOrCreateIteration(
  tripRecord: TripRecord,
  iterationPageId: string,
  name: string,
): Promise<ResolvedIteration> {
  const tripUuid = tripRecord.id

  // 1. Look for an existing iteration with this name for the trip
  const { data: existingByName } = await supabase()
    .from('iterations')
    .select('id, notion_id, name, is_current')
    .eq('trip_id', tripUuid)
    .eq('name', name)
    .maybeSingle() as { data: IterationRecord | null }

  if (existingByName) {
    // ── RESYNC ──────────────────────────────────────────────────────────────
    console.log('[sync] RESYNC — existing iteration found:', existingByName.id, 'name:', name)

    // Enforce single is_current: archive any OTHER iteration that still has is_current=true
    const { data: otherCurrents } = await supabase()
      .from('iterations')
      .select('id, notion_id, name')
      .eq('trip_id', tripUuid)
      .eq('is_current', true)
      .neq('id', existingByName.id)
    for (const other of (otherCurrents ?? []) as IterationRecord[]) {
      await supabase().from('iterations').update({ is_current: false }).eq('id', other.id)
      if (other.notion_id) await flipNotionIterationCurrent(other.notion_id, false)
      console.log('[sync] RESYNC — archived stale is_current iteration:', other.name)
    }

    // Set this iteration as current with fresh synced_at
    await supabase().from('iterations')
      .update({ synced_at: new Date().toISOString(), is_current: true })
      .eq('id', existingByName.id)

    // Delete all rows tagged with this iteration so they re-insert fresh
    const [delExp, delStay, delTrf] = await Promise.all([
      supabase().from('experiences').delete().eq('iteration_id', existingByName.id),
      supabase().from('stays').delete().eq('iteration_id', existingByName.id),
      supabase().from('transfers').delete().eq('iteration_id', existingByName.id),
    ])
    console.log('[sync] Deleted rows for iteration', existingByName.id,
      '— exp err:', delExp.error?.message ?? 'none',
      'stay err:', delStay.error?.message ?? 'none',
      'trf err:', delTrf.error?.message ?? 'none')

    return { iterationUuid: existingByName.id, notionRowId: existingByName.notion_id, isResync: true }
  }

  // ── NEW ITERATION ────────────────────────────────────────────────────────

  // Find any currently-active iteration for this trip
  const { data: prevIteration } = await supabase()
    .from('iterations')
    .select('id, notion_id')
    .eq('trip_id', tripUuid)
    .eq('is_current', true)
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: IterationRecord | null }

  if (prevIteration) {
    // Look up the previous iteration name for the log
    const { data: prevName } = await supabase().from('iterations').select('name').eq('id', prevIteration.id).maybeSingle()
    console.log(`[sync] NEW iteration — archiving previous: ${prevName?.name ?? prevIteration.id}`)
    // Flip previous iteration row
    await supabase().from('iterations').update({ is_current: false }).eq('id', prevIteration.id)
    console.log(`[sync] Previous iteration "${prevName?.name}" flipped to is_current=false`)
    // Flip its data rows
    await Promise.all([
      supabase().from('experiences').update({ is_current: false })
        .eq('trip_id', tripUuid).eq('iteration_id', prevIteration.id),
      supabase().from('stays').update({ is_current: false })
        .eq('trip_id', tripUuid).eq('iteration_id', prevIteration.id),
      supabase().from('transfers').update({ is_current: false })
        .eq('trip_id', tripUuid).eq('iteration_id', prevIteration.id),
    ])
    // Flip Notion CQ Iterations row
    if (prevIteration.notion_id) {
      await flipNotionIterationCurrent(prevIteration.notion_id, false)
    }
  }

  // Create the new iteration row in Supabase
  const { data: newIteration, error: iterErr } = await supabase()
    .from('iterations')
    .insert({
      name,
      trip_id: tripUuid,
      notion_page_id: iterationPageId,
      is_current: true,
      synced_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (iterErr || !newIteration) {
    throw new Error(`Failed to create iteration in Supabase: ${iterErr?.message}`)
  }
  const iterationUuid = (newIteration as { id: string }).id
  console.log('[sync] Created new iteration in Supabase:', iterationUuid, 'name:', name)

  // Create the iteration row in Notion CQ Iterations DB
  const tripNotionPageId = tripRecord.notion_page_id ?? ''
  const notionRowId = await createNotionIterationRow(name, tripNotionPageId, iterationPageId)

  // Backfill notion_id onto the Supabase row
  if (notionRowId) {
    await supabase().from('iterations').update({ notion_id: notionRowId }).eq('id', iterationUuid)
  }

  return { iterationUuid, notionRowId, isResync: false }
}

// ── Notion write helpers ──────────────────────────────────────────────────────

/** Extract the first USD numeric value from a price string, e.g. "$1,500" → 1500 */
function extractUsdAmount(s: string | null | undefined): number | null {
  if (!s) return null
  const m = s.match(/\$[\d,]+(?:\.\d+)?/)
  if (m) {
    const n = parseFloat(m[0].replace(/[$,]/g, ''))
    return isNaN(n) ? null : n
  }
  return null
}

/** Extract duration as total minutes from a string like "2 hours 30 min" or "1.5h" */
function extractDurationMinutes(s: string | null | undefined): number | null {
  if (!s) return null
  const hours = s.match(/(\d+(?:\.\d+)?)\s*h/i)
  const mins = s.match(/(\d+)\s*m(?:in)?/i)
  let total = 0
  if (hours) total += parseFloat(hours[1]) * 60
  if (mins) total += parseInt(mins[1])
  return total > 0 ? Math.round(total) : null
}

function rt(text: string | null | undefined) {
  return text ? [{ text: { content: text.slice(0, 2000) } }] : []
}

/** Notion select options cannot contain commas — strip them */
function sel(value: string | null | undefined): string | null {
  if (!value) return null
  return value.replace(/,/g, '').replace(/\s{2,}/g, ' ').trim() || null
}

interface NotionWriteResult {
  pageId: string
  uniqueId: string | null  // e.g. "EXP-5" — used as the Supabase experience_id
}

function extractNotionUniqueId(page: { properties: Record<string, unknown> }, propName: string, prefix: string): string | null {
  const prop = page.properties[propName] as { type: string; unique_id?: { prefix: string | null; number: number | null } } | undefined
  if (prop?.type === 'unique_id' && prop.unique_id?.number != null) {
    const p = prop.unique_id.prefix ?? prefix
    return `${p}-${prop.unique_id.number}`
  }
  return null
}

async function writeExperienceToNotion(
  parsed: ParsedRow,
  tripNotionPageId: string,
  dayNumber: number,
  sortOrder: number
): Promise<NotionWriteResult | null> {
  if (!parsed.experience) return null
  const exp = parsed.experience
  const dbId = process.env.NOTION_EXPERIENCES_CREATE_DB
  if (!dbId) { console.error('Missing NOTION_EXPERIENCES_CREATE_DB'); return null }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {
      'Experience Name': { title: rt(exp.title || 'Experience') },
      'CQ Trips': { relation: [{ id: tripNotionPageId }] },
      'Day Number': { number: dayNumber },
      'Sort Order': { number: sortOrder },
    }

    if (parsed.date) properties['Date'] = { date: { start: parsed.date } }
    const timeOfDay = sel(exp.time_of_day)
    if (timeOfDay) properties['Time of Day'] = { select: { name: timeOfDay } }
    if (parsed.destination) properties['Location'] = { rich_text: rt(arrivalDest(parsed.destination)) }
    if (exp.duration) properties['Duration'] = { rich_text: rt(exp.duration) }
    if (exp.description) properties['Description'] = { rich_text: rt(exp.description) }
    const tag = sel(exp.tags?.[0] ?? null)
    if (tag) properties['Tags'] = { select: { name: tag } }

    const costNum = extractUsdAmount(exp.cost_indicator)
    if (costNum !== null) properties['Cost'] = { number: costNum }

    const page = await notion.pages.create({ parent: { database_id: dbId }, properties })
    return {
      pageId: page.id,
      uniqueId: extractNotionUniqueId(page as unknown as { properties: Record<string, unknown> }, 'Experience ID', 'EXP'),
    }
  } catch (err) {
    console.error('writeExperienceToNotion error:', err)
    return null
  }
}

async function writeStayToNotion(
  parsed: ParsedRow,
  tripNotionPageId: string,
  sortOrder: number,
  dates: StayDateRange
): Promise<NotionWriteResult | null> {
  if (!parsed.stay) return null
  const stay = parsed.stay
  const dbId = process.env.NOTION_STAYS_CREATE_DB
  if (!dbId) { console.error('Missing NOTION_STAYS_CREATE_DB'); return null }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {
      'Property Name': { title: rt(stay.property_name || 'Property') },
      'CQ Trips': { relation: [{ id: tripNotionPageId }] },
      'Sort Order': { number: sortOrder },
    }

    if (parsed.destination) properties['Destination'] = { rich_text: rt(arrivalDest(parsed.destination)) }
    const roomType = sel(stay.room_type)
    if (roomType) properties['Room Type'] = { select: { name: roomType } }
    const bedType = sel(stay.bed_type)
    if (bedType) properties['Bed Type'] = { select: { name: bedType } }
    if (stay.description) properties['Description'] = { rich_text: rt(stay.description) }
    if (dates.nights != null) properties['Nights'] = { number: dates.nights }
    if (dates.checkIn) properties['Check In'] = { date: { start: dates.checkIn } }
    if (dates.checkOut) properties['Check Out Date'] = { date: { start: dates.checkOut } }

    if (stay.meals && stay.meals !== 'No meal') {
      properties['Meals'] = { multi_select: [{ name: stay.meals }] }
    }

    const priceNum = extractUsdAmount(stay.property_price)
    if (priceNum !== null) properties['Property Price'] = { number: priceNum }

    const page = await notion.pages.create({ parent: { database_id: dbId }, properties })
    return {
      pageId: page.id,
      uniqueId: extractNotionUniqueId(page as unknown as { properties: Record<string, unknown> }, 'Stay ID', 'STY'),
    }
  } catch (err) {
    console.error('writeStayToNotion error:', err)
    return null
  }
}

async function writeTransferToNotion(
  data: ParsedTransit | ParsedTransfer,
  style: 'Transit' | 'Transfer',
  tripNotionPageId: string,
  rawDate: string | null,
  sortOrder: number
): Promise<NotionWriteResult | null> {
  const dbId = process.env.NOTION_TRANSFERS_CREATE_DB
  if (!dbId) { console.error('Missing NOTION_TRANSFERS_CREATE_DB'); return null }

  const fromLoc = data.from_location
  const toLoc = data.to_location
  const name = fromLoc && toLoc
    ? `${fromLoc} → ${toLoc}`
    : fromLoc || toLoc || (style === 'Transit' ? 'Transit' : 'Transfer')

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {
      'Transfer Name': { title: rt(name) },
      'CQ Trips': { relation: [{ id: tripNotionPageId }] },
      'Transfer Style': { select: { name: style } },
      'Sort Order': { number: sortOrder },
    }

    if (rawDate) properties['Date'] = { date: { start: rawDate } }
    const transferMode = sel(data.transfer_mode)
    if (transferMode) properties['Transfer Mode'] = { select: { name: transferMode } }
    if (data.from_location) properties['From'] = { rich_text: rt(data.from_location) }
    if (data.to_location) properties['To'] = { rich_text: rt(data.to_location) }
    if (data.notes) properties['Notes'] = { rich_text: rt(data.notes) }

    if (style === 'Transfer') {
      const purpose = sel((data as ParsedTransfer).transfer_purpose)
      if (purpose) properties['Transfer Purpose'] = { multi_select: [{ name: purpose }] }
    }

    if (style === 'Transit') {
      const transit = data as ParsedTransit
      if (transit.carrier) properties['Carrier'] = { rich_text: rt(transit.carrier) }
    }

    const durationMins = extractDurationMinutes(data.duration)
    if (durationMins !== null) properties['Duration'] = { number: durationMins }

    const page = await notion.pages.create({ parent: { database_id: dbId }, properties })
    return {
      pageId: page.id,
      uniqueId: extractNotionUniqueId(page as unknown as { properties: Record<string, unknown> }, 'Transfer ID', 'TRF'),
    }
  } catch (err) {
    console.error('writeTransferToNotion error:', err)
    return null
  }
}

async function clearTripData(tripUuid: string) {
  await Promise.all([
    supabase().from('experiences').delete().eq('trip_id', tripUuid),
    supabase().from('stays').delete().eq('trip_id', tripUuid),
    supabase().from('transfers').delete().eq('trip_id', tripUuid),
  ])
}

/** Archive all existing Notion CQ pages for this trip so auto-sync doesn't re-import stale data.
 *  Paginates through all results to handle trips with many existing pages. */
async function clearNotionTripData(tripNotionPageId: string) {
  const TOKEN = process.env.NOTION_TOKEN!
  const dbIds = [
    process.env.NOTION_EXPERIENCES_CREATE_DB,
    process.env.NOTION_STAYS_CREATE_DB,
    process.env.NOTION_TRANSFERS_CREATE_DB,
  ].filter(Boolean) as string[]

  for (const dbId of dbIds) {
    try {
      let cursor: string | null = null
      do {
        const body: Record<string, unknown> = {
          page_size: 100,
          filter: { property: 'CQ Trips', relation: { contains: tripNotionPageId } },
        }
        if (cursor) body.start_cursor = cursor
        const r = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!r.ok) break
        const data = await r.json() as { results: { id: string; archived: boolean }[]; has_more: boolean; next_cursor: string | null }
        for (const page of data.results) {
          if (page.archived) continue
          await fetch(`https://api.notion.com/v1/pages/${page.id}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
            body: JSON.stringify({ archived: true }),
          })
          await sleep(200)
        }
        cursor = data.has_more ? data.next_cursor : null
      } while (cursor)
    } catch (e) {
      console.warn('clearNotionTripData error for', dbId, e)
    }
  }
}

async function writeExperience(
  parsed: ParsedRow,
  tripUuid: string,
  dayNumber: number,
  idNum: number,
  sortOrder: number,
  notionResult?: NotionWriteResult | null,
  iterationId?: string,
): Promise<{ ok: boolean; errorMsg?: string }> {
  if (!parsed.experience) return { ok: false }
  const exp = parsed.experience
  const title = exp.title ?? 'Experience'
  const experienceId = notionResult?.uniqueId ?? `EXP-${idNum}`

  // Remove any row for this trip with the same title belonging to a DIFFERENT iteration.
  // This prevents the unique_experience_per_trip constraint from blocking the insert.
  if (iterationId) {
    const { error: delErr } = await supabase().from('experiences')
      .delete()
      .eq('trip_id', tripUuid)
      .eq('title', title)
      .neq('iteration_id', iterationId)
    if (delErr) console.warn('[sync] pre-delete exp conflict error:', delErr.message)
  }

  const { error } = await supabase().from('experiences').insert({
    experience_id: experienceId,
    notion_page_id: notionResult?.pageId ?? null,
    trip_id: tripUuid,
    day_number: dayNumber,
    date: sanitizeDate(parsed.date),
    location: arrivalDest(parsed.destination),
    title,
    description: exp.description,
    time_of_day: exp.time_of_day,
    duration: exp.duration,
    cost_indicator: exp.cost_indicator,
    tags: exp.tags ?? [],
    sort_order: sortOrder,
    meeting_point: exp.meeting_point ?? null,
    image_url: exp.image_url ?? null,
    iteration_id: iterationId ?? null,
    is_current: true,
  })
  if (error) {
    console.error('insert experience error:', error.message, '| code:', error.code)
    return { ok: false, errorMsg: `exp "${title}": [${error.code}] ${error.message}` }
  }
  return { ok: true }
}

async function writeStay(
  parsed: ParsedRow,
  tripUuid: string,
  idNum: number,
  sortOrder: number,
  dates: StayDateRange,
  notionResult?: NotionWriteResult | null,
  iterationId?: string,
): Promise<{ ok: boolean; errorMsg?: string }> {
  if (!parsed.stay) return { ok: false }
  const stay = parsed.stay
  const propertyName = stay.property_name ?? 'Property'
  const stayId = notionResult?.uniqueId ?? `STY-${idNum}`

  // Remove any row for this trip with the same property_name from a DIFFERENT iteration.
  if (iterationId) {
    const { error: delErr } = await supabase().from('stays')
      .delete()
      .eq('trip_id', tripUuid)
      .eq('property_name', propertyName)
      .neq('iteration_id', iterationId)
    if (delErr) console.warn('[sync] pre-delete stay conflict error:', delErr.message)
  }

  const { error } = await supabase().from('stays').insert({
    stay_id: stayId,
    notion_page_id: notionResult?.pageId ?? null,
    trip_id: tripUuid,
    destination: arrivalDest(parsed.destination),
    property_name: propertyName,
    room_type: stay.room_type,
    bed_type: stay.bed_type,
    property_price: stay.property_price,
    meals: stay.meals,
    description: stay.description,
    check_in: dates.checkIn,
    check_out: dates.checkOut,
    nights: dates.nights,
    sort_order: sortOrder,
    iteration_id: iterationId ?? null,
    is_current: true,
  })
  if (error) {
    console.error('insert stay error:', error.message, '| code:', error.code)
    return { ok: false, errorMsg: `stay "${propertyName}": [${error.code}] ${error.message}` }
  }
  return { ok: true }
}

async function writeTransfer(
  data: ParsedTransit | ParsedTransfer,
  style: 'Transit' | 'Transfer',
  tripUuid: string,
  rawDate: string | null,
  idNum: number,
  sortOrder: number,
  notionResult?: NotionWriteResult | null,
  iterationId?: string,
): Promise<{ ok: boolean; errorMsg?: string }> {
  const transferId = notionResult?.uniqueId ?? `TRF-${idNum}`
  const name = `${data.from_location ?? ''}→${data.to_location ?? ''}`

  // Remove any row for this trip with the same from/to from a DIFFERENT iteration.
  // Targets the unique_transfer_per_trip constraint columns (trip_id, from_location, to_location).
  if (iterationId && data.from_location && data.to_location) {
    const { error: delErr } = await supabase().from('transfers')
      .delete()
      .eq('trip_id', tripUuid)
      .eq('from_location', data.from_location)
      .eq('to_location', data.to_location)
      .neq('iteration_id', iterationId)
    if (delErr) console.warn('[sync] pre-delete transfer conflict error:', delErr.message)
  }

  const { error } = await supabase().from('transfers').insert({
    transfer_id: transferId,
    notion_page_id: notionResult?.pageId ?? null,
    trip_id: tripUuid,
    transfer_mode: data.transfer_mode,
    transfer_style: style,
    transfer_purpose: style === 'Transfer' ? (data as ParsedTransfer).transfer_purpose : null,
    from_location: data.from_location,
    to_location: data.to_location,
    date: sanitizeDate(rawDate),
    duration: data.duration,
    carrier: style === 'Transit' ? (data as ParsedTransit).carrier : null,
    amount: style === 'Transit' ? (data as ParsedTransit).amount : null,
    notes: data.notes,
    sort_order: sortOrder,
    iteration_id: iterationId ?? null,
    is_current: true,
  })
  if (error) {
    console.error('insert transfer error:', error.message, '| code:', error.code)
    return { ok: false, errorMsg: `transfer "${name}": [${error.code}] ${error.message}` }
  }
  return { ok: true }
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as {
      password?: string
      iterationPageId?: string
      tripId?: string
      preview?: boolean
      clear?: boolean
      force?: boolean
    }

    if (body.password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { iterationPageId, tripId, preview = true, clear = false, force = false } = body
    if (!iterationPageId) return NextResponse.json({ error: 'Missing iterationPageId' }, { status: 400 })
    if (!tripId) return NextResponse.json({ error: 'Missing tripId' }, { status: 400 })

    console.log(`[sync] START — pageId=${iterationPageId}, tripId=${tripId}, preview=${preview}`)

    // ── Step 1: Read the Notion table ────────────────────────────────────────

    console.log('[sync] STEP 1 — fetching children of iterationPageId:', iterationPageId)
    const blocks = await listChildren(iterationPageId)
    console.log('[sync] blocks found:', blocks.length, '| types:', blocks.map(b => (b as Record<string, unknown>).type))
    const tableBlock = blocks.find(b => (b as Record<string, unknown>).type === 'table')

    if (!tableBlock) {
      console.log('[sync] ABORT — no table block found in iteration page')
      return NextResponse.json({
        error: 'No table found in this iteration page.',
        diagnostic: blocks.slice(0, 10).map(b => ({ type: (b as Record<string, unknown>).type })),
      }, { status: 404 })
    }

    console.log('[sync] table block id:', (tableBlock as Record<string, unknown>).id)
    const tableRows = await listChildren((tableBlock as Record<string, unknown>).id as string)
    const rowBlocks = tableRows.filter(b => (b as Record<string, unknown>).type === 'table_row')
    console.log('[sync] table_row blocks:', rowBlocks.length, '(includes header row)')

    if (rowBlocks.length < 2) {
      console.log('[sync] ABORT — table has fewer than 2 rows')
      return NextResponse.json({ error: 'Table has fewer than 2 rows (header + data).' }, { status: 400 })
    }

    const headerRow = rowBlocks[0] as Record<string, unknown>
    const headerCells = ((headerRow.table_row as Record<string, unknown>)?.cells ?? []) as Array<Array<{ plain_text?: string }>>
    const headers = headerCells.map(cell => cellText(cell))
    console.log('[sync] headers:', headers)

    const colDate        = matchColumn(headers, ['date', 'day'])
    const colDest        = matchColumn(headers, ['destination', 'location', 'city'])
    const colTransit     = matchColumn(headers, ['transit', 'flight', 'train', 'air'])
    const colTransfer    = matchColumn(headers, ['transfer', 'pickup', 'drop', 'ground'])
    const colStay        = matchColumn(headers, ['stay', 'accommodation', 'hotel', 'property'])
    const colExperience  = matchColumn(headers, ['experience', 'activity'])
    const colNotes       = matchColumn(headers, ['notes', 'remarks', 'comment'])
    console.log('[sync] column map:', { colDate, colDest, colTransit, colTransfer, colStay, colExperience, colNotes })

    function getCell(cells: Array<Array<{ plain_text?: string }>>, colIndex: number): string {
      if (colIndex < 0 || colIndex >= cells.length) return ''
      return cellText(cells[colIndex])
    }

    // ── Step 2: Resolve trip + get start date + iteration title ─────────────

    // Fetch iteration title early (needed for version label)
    const iterationTitle = await getIterationTitle(iterationPageId)
    console.log('[sync] Iteration name extracted:', JSON.stringify(iterationTitle))

    let tripStartDate = new Date().getFullYear() + '-04-01' // fallback
    let tripRecord: TripRecord | null = null

    if (!preview) {
      tripRecord = await resolveTrip(tripId)
      if (!tripRecord) {
        return NextResponse.json({ error: `Trip "${tripId}" not found in database.` }, { status: 404 })
      }
      tripStartDate = tripRecord.start_date ?? tripStartDate
    } else {
      // Even for preview, resolve trip for start_date context
      const resolved = await resolveTrip(tripId)
      if (resolved?.start_date) tripStartDate = resolved.start_date
    }

    // ── Step 2b: Detect resync vs new iteration (informational for preview) ──
    // For preview we just surface whether this is a known iteration name.
    // Actual iteration creation happens in Step 4 (non-preview only).
    let isResyncPreview = false
    if (iterationTitle && preview) {
      try {
        const resolved = tripRecord ?? await resolveTrip(tripId)
        if (resolved) {
          const { data: existing } = await supabase()
            .from('iterations')
            .select('id')
            .eq('trip_id', resolved.id)
            .eq('name', iterationTitle)
            .maybeSingle()
          isResyncPreview = !!existing
        }
      } catch {
        // iterations table may not exist yet — proceed normally
      }
    }

    // ── Step 3: Parse each data row with Claude ──────────────────────────────

    console.log('[sync] STEP 3 — parsing', rowBlocks.length - 1, 'data rows with Claude')
    const parsedRows: Array<{ raw: RowData; parsed: ParsedRow | null; error?: string }> = []
    let skippedEmpty = 0

    for (let i = 1; i < rowBlocks.length; i++) {
      const rowBlock = rowBlocks[i] as Record<string, unknown>
      const cells = ((rowBlock.table_row as Record<string, unknown>)?.cells ?? []) as Array<Array<{ plain_text?: string }>>

      const raw: RowData = {
        date:        getCell(cells, colDate),
        destination: getCell(cells, colDest),
        transit:     getCell(cells, colTransit),
        transfer:    getCell(cells, colTransfer),
        stay:        getCell(cells, colStay),
        experience:  getCell(cells, colExperience),
        notes:       getCell(cells, colNotes),
      }

      const isEmpty = !raw.date && !raw.destination && !raw.experience && !raw.stay && !raw.transit && !raw.transfer
      if (isEmpty) { skippedEmpty++; continue }

      console.log(`[sync] row ${i} raw:`, JSON.stringify(raw))

      if (i > 1) await sleep(400)

      const parsed = await parseRowWithClaude(raw, tripStartDate)
      console.log(`[sync] row ${i} parsed:`, parsed
        ? `date=${parsed.date} exp=${parsed.experience?.title ?? 'null'} stay=${parsed.stay?.property_name ?? 'null'} transit=${parsed.transit?.transfer_mode ?? 'null'} transfer=${parsed.transfer?.transfer_mode ?? 'null'}`
        : 'FAILED (null)')
      parsedRows.push({ raw, parsed, error: parsed ? undefined : 'Claude parsing failed' })
    }
    console.log('[sync] rows parsed:', parsedRows.length, '| skipped as empty:', skippedEmpty)

    // ── Step 4: Write to Supabase (if not preview) ──────────────────────────

    const writeErrors: string[] = []

    const created: {
      experiences: number; stays: number; transfers: number; cleared: boolean
      iterationId: string | null; iterationName: string; isResync: boolean
      notion?: { experiences: number; stays: number; transfers: number }
    } = { experiences: 0, stays: 0, transfers: 0, cleared: false, iterationId: null, iterationName: iterationTitle, isResync: false }

    if (!preview && tripRecord) {
      const tripNotionId = tripRecord.notion_page_id

      // Optionally nuclear-clear all trip data first
      if (clear) {
        await clearTripData(tripRecord.id)
        if (tripNotionId) await clearNotionTripData(tripNotionId)
        created.cleared = true
      }

      // ── Resolve or create iteration ─────────────────────────────────────
      console.log('[sync] STEP 4a — resolving iteration:', iterationTitle)
      const { iterationUuid, isResync } = await resolveOrCreateIteration(
        tripRecord, iterationPageId, iterationTitle,
      )
      created.iterationId = iterationUuid
      created.isResync = isResync
      console.log('[sync] iteration UUID:', iterationUuid, 'isResync:', isResync)

      // ── Clean up orphaned rows (NULL iteration_id) for this trip ────────
      // Prevents stale pre-versioning data from appearing in sub-tab queries
      const [orphanExpDel, orphanStayDel, orphanTrfDel] = await Promise.all([
        supabase().from('experiences').delete().eq('trip_id', tripRecord.id).is('iteration_id', null),
        supabase().from('stays').delete().eq('trip_id', tripRecord.id).is('iteration_id', null),
        supabase().from('transfers').delete().eq('trip_id', tripRecord.id).is('iteration_id', null),
      ])
      if (orphanExpDel.error) console.warn('[sync] orphan exp delete error:', orphanExpDel.error.message)
      if (orphanStayDel.error) console.warn('[sync] orphan stay delete error:', orphanStayDel.error.message)
      if (orphanTrfDel.error) console.warn('[sync] orphan trf delete error:', orphanTrfDel.error.message)
      console.log('[sync] Cleaned orphaned (NULL iteration_id) rows for trip', tripRecord.id)

      // ── Write rows ───────────────────────────────────────────────────────
      const stayDates = computeStayDates(parsedRows)

      let expIdNum  = await getNextIdNum('experiences', 'experience_id')
      let stayIdNum = await getNextIdNum('stays', 'stay_id')
      let trfIdNum  = await getNextIdNum('transfers', 'transfer_id')
      let sortOrder = 1
      const writtenStays = new Set<string>()

      const notionCreated = { experiences: 0, stays: 0, transfers: 0 }
      console.log('[sync] STEP 4b — writing', parsedRows.filter(r => r.parsed).length, 'parsed rows')

      for (const { parsed } of parsedRows) {
        if (!parsed) continue
        const dayNumber = sortOrder
        const rowWrites = { exp: 0, stay: 0, trf: 0 }

        if (parsed.experience) {
          let notionExpResult: NotionWriteResult | null = null
          if (tripNotionId) {
            await sleep(350)
            notionExpResult = await writeExperienceToNotion(parsed, tripNotionId, dayNumber, sortOrder)
            if (notionExpResult) notionCreated.experiences++
          }
          const { ok, errorMsg: expErr } = await writeExperience(parsed, tripRecord.id, dayNumber, expIdNum, sortOrder, notionExpResult, iterationUuid)
          console.log(`[sync]   experience "${parsed.experience.title}" write:`, ok ? 'OK' : `FAILED — ${expErr}`)
          if (expErr) writeErrors.push(expErr)
          if (ok) { expIdNum++; created.experiences++; rowWrites.exp++ }
        }

        if (parsed.stay) {
          const stayName = parsed.stay.property_name
          if (!writtenStays.has(stayName)) {
            const dates = stayDates[stayName] ?? { checkIn: null, checkOut: null, nights: null }
            let notionStayResult: NotionWriteResult | null = null
            if (tripNotionId) {
              await sleep(350)
              notionStayResult = await writeStayToNotion(parsed, tripNotionId, sortOrder, dates)
              if (notionStayResult) notionCreated.stays++
            }
            const { ok, errorMsg: stayErr } = await writeStay(parsed, tripRecord.id, stayIdNum, sortOrder, dates, notionStayResult, iterationUuid)
            console.log(`[sync]   stay "${stayName}" write:`, ok ? 'OK' : `FAILED — ${stayErr}`)
            if (stayErr) writeErrors.push(stayErr)
            if (ok) { stayIdNum++; created.stays++; writtenStays.add(stayName); rowWrites.stay++ }
          }
        }

        if (parsed.transit) {
          let notionTrfResult: NotionWriteResult | null = null
          if (tripNotionId) {
            await sleep(350)
            notionTrfResult = await writeTransferToNotion(parsed.transit, 'Transit', tripNotionId, sanitizeDate(parsed.date), sortOrder)
            if (notionTrfResult) notionCreated.transfers++
          }
          const { ok, errorMsg: trfErr } = await writeTransfer(parsed.transit, 'Transit', tripRecord.id, parsed.date, trfIdNum, sortOrder, notionTrfResult, iterationUuid)
          console.log(`[sync]   transit "${parsed.transit.from_location}→${parsed.transit.to_location}" write:`, ok ? 'OK' : `FAILED — ${trfErr}`)
          if (trfErr) writeErrors.push(trfErr)
          if (ok) { trfIdNum++; created.transfers++; rowWrites.trf++ }
        }

        if (parsed.transfer) {
          let notionTrfResult: NotionWriteResult | null = null
          if (tripNotionId) {
            await sleep(350)
            notionTrfResult = await writeTransferToNotion(parsed.transfer, 'Transfer', tripNotionId, sanitizeDate(parsed.date), sortOrder)
            if (notionTrfResult) notionCreated.transfers++
          }
          const { ok: ok2, errorMsg: trf2Err } = await writeTransfer(parsed.transfer, 'Transfer', tripRecord.id, parsed.date, trfIdNum, sortOrder, notionTrfResult, iterationUuid)
          console.log(`[sync]   transfer "${parsed.transfer.from_location}→${parsed.transfer.to_location}" write:`, ok2 ? 'OK' : `FAILED — ${trf2Err}`)
          if (trf2Err) writeErrors.push(trf2Err)
          if (ok2) { trfIdNum++; created.transfers++; rowWrites.trf++ }
        }

        console.log(`[sync]   row ${sortOrder} writes: exp=${rowWrites.exp} stay=${rowWrites.stay} trf=${rowWrites.trf} → iteration_id=${iterationUuid}`)
        sortOrder++
      }
      console.log(`[sync] FINAL COUNTS — experiences: ${created.experiences}, stays: ${created.stays}, transfers: ${created.transfers}`)
      console.log(`[sync] Tagged ${created.experiences} experiences / ${created.stays} stays / ${created.transfers} transfers with iteration_id=${iterationUuid}`)
      console.log('[sync] DONE — created:', created)

      // NOTE: We intentionally do NOT trigger Notion→Supabase sync here.
      // Drawing Board writes directly to both Supabase and Notion, so a
      // subsequent sync would re-import and duplicate everything.

      created.notion = notionCreated
    }

    return NextResponse.json({
      success: true,
      preview,
      iterationTitle,
      isResync: preview ? isResyncPreview : created.isResync,
      headers,
      columnMap: { colDate, colDest, colTransit, colTransfer, colStay, colExperience, colNotes },
      parsed: parsedRows.map(({ raw, parsed, error }) => ({ raw, parsed, error })),
      created,
      writeErrors: writeErrors.length > 0 ? writeErrors : undefined,
    })
  } catch (error) {
    console.error('sync-drawing-board error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
