import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Stay } from '@/lib/types'

export const maxDuration = 120

let _supabase: ReturnType<typeof createAdminClient> | null = null
/** Built on first use — see note above; never at import time. */
const supabase = () => (_supabase ??= createAdminClient())

// ── JSON repair ────────────────────────────────────────────────────────────────

function repairJson(raw: string): string {
  let inString = false
  let escaped  = false
  let result   = ''
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (escaped)                       { result += ch; escaped = false; continue }
    if (ch === '\\' && inString)       { result += ch; escaped = true;  continue }
    if (ch === '"')                    { inString = !inString; result += ch; continue }
    if (inString) {
      if (ch === '\n')                 { result += '\\n';  continue }
      if (ch === '\r')                 { result += '\\r';  continue }
      if (ch === '\t')                 { result += '\\t';  continue }
      if (ch === '‘' || ch === '’') { result += "'";    continue }
      if (ch === '“' || ch === '”') { result += '\\"';  continue }
    }
    result += ch
  }
  return result
}

// ── Plain text from ParsedBlock tree ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function blocksToText(blocks: any[]): string {
  const lines: string[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(block: any) {
    const t = block.text?.trim()
    if (t) lines.push(t)
    if (Array.isArray(block.children)) block.children.forEach(walk)
  }
  blocks.forEach(walk)
  return lines.join(' ').slice(0, 6000)
}

// ── Claude call ────────────────────────────────────────────────────────────────

async function generateNarratives(
  destinations: string[],
  blocksText: string,
  stays: Stay[],
): Promise<Array<{ destination: string; narrative: string }>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const staysText = stays.map(s =>
    `${s.property_name} (${s.destination ?? 'unknown'}) — ${s.check_in ?? '?'} to ${s.check_out ?? '?'}, ${s.nights ?? '?'} nights`
  ).join('\n')

  const prompt = `You are the editorial voice for Closequarters, a studio that designs narrative-led journeys.
Write a single evocative sentence for each destination on this trip — the kind of line that makes a traveller feel the place before they arrive.

Destinations: ${destinations.join(', ')}

Itinerary context:
${blocksText.slice(0, 3000)}

Accommodations:
${staysText}

For each destination, produce one sentence (max 25 words). Atmospheric, sensory, understated. No clichés. No "nestled" or "vibrant".`

  const body = {
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    tools: [{
      name: 'save_narratives',
      description: 'Save the destination narratives.',
      input_schema: {
        type: 'object',
        required: ['destinations'],
        properties: {
          destinations: {
            type: 'array',
            items: {
              type: 'object',
              required: ['destination', 'narrative'],
              properties: {
                destination: { type: 'string' },
                narrative:   { type: 'string' },
              },
            },
          },
        },
      },
    }],
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: prompt }],
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key':             apiKey,
      'anthropic-version':     '2023-06-01',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  })

  const rawText = await res.text()
  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${rawText.slice(0, 300)}`)

  const json = JSON.parse(repairJson(rawText))
  const toolBlock = json.content?.find((b: { type: string }) => b.type === 'tool_use')
  if (!toolBlock) throw new Error('No tool_use block in Claude response')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input = toolBlock.input as any
  return input.destinations ?? []
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { tripId?: string; password?: string }

  if (body.password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tripId } = body
  if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 })

  // Resolve UUID from trip_id slug
  const { data: tripRow } = await supabase().from('trips').select('id').eq('trip_id', tripId).maybeSingle()
  if (!tripRow) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  const tripUuid = tripRow.id

  // Read dates_destinations parsed content
  const { data: contentPage, error: contentErr } = await supabase()
    .from('trip_content_pages')
    .select('parsed_content')
    .eq('trip_id', tripUuid)
    .eq('type', 'dates_destinations')
    .maybeSingle()

  if (contentErr) return NextResponse.json({ error: contentErr.message }, { status: 500 })
  if (!contentPage?.parsed_content) return NextResponse.json({ error: 'No dates_destinations content synced yet' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = contentPage.parsed_content as any
  const blocks = parsed?.blocks ?? []

  // Extract destination names from H1 blocks
  const destinations: string[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const block of blocks as any[]) {
    if (block.type === 'heading' && block.level === 1) {
      const raw = (block.text ?? '').trim()
      const place = raw.split('|')[0].trim()
      if (place) destinations.push(place)
    }
  }

  if (destinations.length === 0) {
    return NextResponse.json({ error: 'No destination headings found in content' }, { status: 422 })
  }

  // Read stays
  const { data: stays } = await supabase().from('stays').select('*').eq('trip_id', tripUuid).eq('is_current', true)
  const stayList: Stay[] = (stays as Stay[]) ?? []

  // Generate narratives via Claude
  const narratives = await generateNarratives(destinations, blocksToText(blocks), stayList)

  // Save to trip_content_pages (type: 'carousel')
  await supabase().from('trip_content_pages').upsert(
    {
      trip_id:        tripUuid,
      type:           'carousel',
      parsed_content: { narratives },
      synced_at:      new Date().toISOString(),
    },
    { onConflict: 'trip_id,type' }
  )

  return NextResponse.json({ ok: true, narratives })
}
