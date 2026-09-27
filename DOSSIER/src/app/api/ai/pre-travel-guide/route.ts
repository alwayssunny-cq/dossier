import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 120

let _supabase: ReturnType<typeof createAdminClient> | null = null
/** Built on first use — see note above; never at import time. */
const supabase = () => (_supabase ??= createAdminClient())

const NOTION_HEADERS = {
  'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
}

// ── Notion helpers ─────────────────────────────────────────────────────────────

function extractNotionPageId(url: string): string | null {
  const patterns = [
    /notion\.so\/[^/]+\/[^/]*-([a-f0-9]{32})(?:[?#].*)?$/,
    /notion\.so\/([a-f0-9]{32})(?:[?#].*)?$/,
    /notion\.so\/[^/]*-([a-f0-9]{32})(?:[?#].*)?$/,
  ]
  for (const re of patterns) { const m = url.match(re); if (m) return m[1] }
  const raw = url.match(/([a-f0-9]{32})/)
  return raw ? raw[1] : null
}

async function fetchNotionPageText(pageId: string): Promise<string> {
  let cursor: string | undefined
  const lines: string[] = []
  do {
    const url = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`
    const res = await fetch(url, { headers: NOTION_HEADERS })
    if (!res.ok) throw new Error(`Notion fetch failed: ${res.status}`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as { results: any[]; has_more: boolean; next_cursor: string | null }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getText = (rt: any[]): string => (rt ?? []).map((t: any) => t.plain_text).join('')
    for (const block of data.results) {
      const type = block.type as string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = (block as any)[type]
      if (['heading_1','heading_2','heading_3'].includes(type)) lines.push(getText(c.rich_text))
      else if (type === 'paragraph') { const t = getText(c.rich_text); if (t.trim()) lines.push(t) }
      else if (['bulleted_list_item','numbered_list_item'].includes(type)) lines.push(getText(c.rich_text))
      else if (['callout','quote','toggle'].includes(type)) lines.push(getText(c.rich_text))
    }
    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined
  } while (cursor)
  return lines.filter(Boolean).join(' ').slice(0, 5000)
}

// ── JSON repair: fix literal newlines/tabs inside string values ───────────────

function repairJson(raw: string): string {
  let inString = false
  let escaped  = false
  let result   = ''

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]

    if (escaped) { result += ch; escaped = false; continue }
    if (ch === '\\' && inString) { result += ch; escaped = true; continue }
    if (ch === '"') { inString = !inString; result += ch; continue }

    if (inString) {
      if (ch === '\n')      { result += '\\n';  continue }
      if (ch === '\r')      { result += '\\r';  continue }
      if (ch === '\t')      { result += '\\t';  continue }
      // Replace smart/curly quotes inside strings with straight apostrophe
      if (ch === '‘' || ch === '’') { result += "'"; continue }
      if (ch === '“' || ch === '”') { result += '\\"'; continue }
    }

    result += ch
  }
  return result
}

// ── Raw Anthropic API call (bypasses SDK JSON parser) ─────────────────────────

interface AnthropicToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  // raw string from the API — we parse it ourselves after repair
  input: Record<string, unknown>
}

interface AnthropicResponse {
  content: Array<{ type: string } & Partial<AnthropicToolUseBlock>>
  stop_reason: string
}

async function callAnthropicWithToolUse(prompt: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const body = {
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    tools: [{
      name: 'save_pre_travel_guide',
      description: 'Save the generated pre-travel guide.',
      input_schema: {
        type: 'object',
        required: ['opening_note', 'cultural_picks', 'things_to_know'],
        properties: {
          opening_note: { type: 'string' },
          cultural_picks: {
            type: 'array',
            items: {
              type: 'object',
              required: ['type', 'title', 'creator', 'description'],
              properties: {
                type:        { type: 'string', enum: ['film', 'music', 'read'] },
                title:       { type: 'string' },
                creator:     { type: 'string' },
                year:        { type: 'string' },
                description: { type: 'string' },
              },
            },
          },
          things_to_know: {
            type: 'array',
            items: {
              type: 'object',
              required: ['category', 'title', 'insight'],
              properties: {
                category: { type: 'string' },
                title:    { type: 'string' },
                insight:  { type: 'string' },
              },
            },
          },
        },
      },
    }],
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: prompt }],
  }

  // Fetch raw text — do NOT let the SDK parse it
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(100_000),
  })

  const rawText = await res.text()

  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}: ${rawText.slice(0, 300)}`)
  }

  // Repair before parsing — fixes literal newlines / smart quotes inside strings
  const repairedText = repairJson(rawText)

  let parsed: AnthropicResponse
  try {
    parsed = JSON.parse(repairedText) as AnthropicResponse
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[pre-travel-guide] JSON repair failed:', msg)
    console.error('[pre-travel-guide] repaired snippet:', repairedText.slice(0, 500))
    throw new Error(`JSON parse failed even after repair: ${msg}`)
  }

  const toolBlock = parsed.content.find(b => b.type === 'tool_use') as AnthropicToolUseBlock | undefined
  if (!toolBlock) {
    throw new Error(`No tool_use block in response. stop_reason=${parsed.stop_reason}`)
  }

  // input is already a parsed JS object (the Anthropic API sends it as JSON)
  return toolBlock.input
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, string>

    if (body.password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { tripId, notionUrl } = body
    if (!tripId) return NextResponse.json({ success: false, error: 'tripId required' }, { status: 400 })

    // Fetch trip
    const { data: trip, error: tripErr } = await supabase()
      .from('trips')
      .select('trip_name, destination_country, state_county, towns_cities, start_date, end_date')
      .eq('trip_id', tripId)
      .maybeSingle()

    if (tripErr || !trip) {
      return NextResponse.json({ success: false, error: 'Trip not found' }, { status: 404 })
    }

    const destination = [trip.towns_cities, trip.state_county, trip.destination_country]
      .filter(Boolean).join(', ') || 'the destination'

    // Optional Notion context
    let notionContext = ''
    if (notionUrl?.trim()) {
      try {
        const pageId = extractNotionPageId(notionUrl.trim())
        if (pageId) notionContext = await fetchNotionPageText(pageId)
      } catch (e) {
        console.warn('[pre-travel-guide] Notion fetch failed:', e)
      }
    }

    console.log('[pre-travel-guide] generating for:', destination)

    const contextSection = notionContext
      ? `\n\nCurator notes:\n${notionContext}`
      : ''

    const prompt = `You are CQ (Closequarters), a studio that designs narrative-led journeys. Generate a pre-travel guide for a client visiting ${destination} on trip "${trip.trip_name}" (${trip.start_date ?? 'TBD'} to ${trip.end_date ?? 'TBD'}).${contextSection}

Call save_pre_travel_guide with EXACTLY:
- opening_note: one sentence about ${destination}
- cultural_picks: EXACTLY 5 items total — 2 of type "film", 2 of type "music", 1 of type "read" — all must be real works with a genuine connection to ${destination}
- things_to_know: EXACTLY 5 items — one each for categories: Culture, Food, Practical, Etiquette, Nature — all specific to ${destination}

IMPORTANT: Keep all strings on a single line. No line breaks inside any string value. Keep descriptions under 100 characters. Keep insights under 180 characters.`

    const guide = await callAnthropicWithToolUse(prompt)

    if (!guide.cultural_picks || !guide.things_to_know) {
      return NextResponse.json({ success: false, error: 'Incomplete guide returned — retry' }, { status: 500 })
    }

    const { error: saveErr } = await supabase()
      .from('trips')
      .update({ pre_travel_guide: JSON.stringify(guide) })
      .eq('trip_id', tripId)

    if (saveErr) {
      const isMissing = saveErr.message.toLowerCase().includes('column') || saveErr.message.toLowerCase().includes('schema')
      return NextResponse.json({
        success: false,
        error: isMissing
          ? 'Column missing — run: ALTER TABLE trips ADD COLUMN IF NOT EXISTS pre_travel_guide TEXT;'
          : saveErr.message,
      }, { status: 500 })
    }

    console.log('[pre-travel-guide] saved for trip:', tripId)
    return NextResponse.json({ success: true, guide })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[pre-travel-guide] error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
