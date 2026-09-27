import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminAuth'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
let _supabase: ReturnType<typeof createAdminClient> | null = null
/** Built on first use — see note above; never at import time. */
const supabase = () => (_supabase ??= createAdminClient())

const NOTION_HEADERS = {
  'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
}

// ── Extract Notion page ID from a URL ─────────────────────────────────────────

function extractNotionPageId(url: string): string | null {
  // Handles: notion.so/workspace/Title-abc123, notion.so/abc123, app.notion.com/p/.../Title-abc123
  const patterns = [
    /notion\.so\/[^/]+\/[^/]*-([a-f0-9]{32})(?:[?#].*)?$/,
    /notion\.so\/([a-f0-9]{32})(?:[?#].*)?$/,
    /notion\.so\/[^/]*-([a-f0-9]{32})(?:[?#].*)?$/,
    /notion\.com\/p\/[^/]+\/[^/]*-([a-f0-9]{32})(?:[?#].*)?$/,
    /notion\.com\/p\/[^/]+\/([a-f0-9]{32})(?:[?#].*)?$/,
  ]
  for (const re of patterns) {
    const m = url.match(re)
    if (m) return m[1]
  }
  // Raw 32-char hex
  const raw = url.match(/([a-f0-9]{32})/)
  return raw ? raw[1] : null
}

// ── Fetch all blocks from a Notion page as plain text ─────────────────────────

async function fetchNotionPageText(pageId: string): Promise<string> {
  let cursor: string | undefined
  const lines: string[] = []

  do {
    const url = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`
    const res = await fetch(url, { headers: NOTION_HEADERS })
    if (!res.ok) throw new Error(`Notion page fetch failed: ${res.status}`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as { results: any[]; has_more: boolean; next_cursor: string | null }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getText = (rt: any[]): string => (rt ?? []).map((t: any) => t.plain_text).join('')

    for (const block of data.results) {
      const type = block.type as string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = (block as any)[type]
      if (type === 'heading_1')           lines.push(`# ${getText(c.rich_text)}`)
      else if (type === 'heading_2')      lines.push(`## ${getText(c.rich_text)}`)
      else if (type === 'heading_3')      lines.push(`### ${getText(c.rich_text)}`)
      else if (type === 'paragraph')      { const t = getText(c.rich_text); if (t.trim()) lines.push(t) }
      else if (type === 'bulleted_list_item') lines.push(`• ${getText(c.rich_text)}`)
      else if (type === 'numbered_list_item') lines.push(`- ${getText(c.rich_text)}`)
      else if (type === 'callout')        lines.push(getText(c.rich_text))
      else if (type === 'quote')          lines.push(`"${getText(c.rich_text)}"`)
      else if (type === 'toggle')         lines.push(getText(c.rich_text))
    }

    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined
  } while (cursor)

  return lines.filter(Boolean).join('\n')
}

// ── Fetch a generic webpage and strip HTML ────────────────────────────────────

async function fetchWebPageText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CQ-Portal/1.0)' },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Failed to fetch page: ${res.status}`)
  const html = await res.text()
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .slice(0, 8000)
    .trim()
}

// ── Claude: extract key insights from reading content ─────────────────────────

async function extractInsightsWithClaude(pageText: string): Promise<string> {
  const stream = await anthropic.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 1500,
    thinking: { type: 'adaptive' },
    messages: [{
      role: 'user',
      content: `You are a designer at CQ (Closequarters), a studio that designs narrative-led journeys. You've just reviewed a client's Reading questionnaire or intake document. Extract the key insights that will guide the design of their perfect trip.

Reading content:
${pageText}

Write 3-5 concise insights in plain prose — one insight per line, separated by a single newline. Each insight is a single clear sentence capturing something meaningful about this traveler: their preferences, their "why", their travel style, what excites them, or what they value. Keep the tone concise, atmospheric and quietly authoritative — an equal speaking to an equal. No exclamation points, jargon or buzzwords. Never use: luxury, premium, elite, bespoke, VIP, experiential, bucket-list, wanderlust, vacation, breathtaking, stunning, magical. If the sentence could have been written by Marriott Bonvoy, write it again.

Within each sentence, wrap 2-3 of the most revealing or evocative phrases in ==double equals== — these will be visually highlighted for the client. Choose phrases that are specific and meaningful, not generic.

Example format:
==Aditi and Lalith== travel for connection over comfort, seeking the unscripted moments a morning market or roadside chai stall can offer.
They've mastered ==the art of slowing down==, which makes ==Nagaland's unhurried rhythm== a natural fit.

Write only the insights. No preamble, no "Here are the insights:", no sign-off.`,
    }],
  })

  const msg = await stream.finalMessage()
  const textBlock = msg.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') return ''
  return textBlock.text.trim()
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, string>

    if (!isAdminRequest(request, body)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { tripId, readingPageUrl } = body
    if (!tripId || !readingPageUrl) {
      return NextResponse.json({ success: false, error: 'tripId and readingPageUrl required' }, { status: 400 })
    }

    // 1. Fetch page content
    console.log('[reading-insights] fetching page:', readingPageUrl)
    let pageText: string

    const notionPageId = extractNotionPageId(readingPageUrl)
    if (notionPageId) {
      console.log('[reading-insights] detected Notion page, using API:', notionPageId)
      pageText = await fetchNotionPageText(notionPageId)
    } else {
      console.log('[reading-insights] fetching as web URL')
      pageText = await fetchWebPageText(readingPageUrl)
    }

    if (!pageText.trim()) {
      return NextResponse.json({ success: false, error: 'Page appears to be empty or inaccessible' }, { status: 400 })
    }

    console.log(`[reading-insights] got ${pageText.length} chars, sending to Claude...`)

    // 2. Claude extracts insights
    const insights = await extractInsightsWithClaude(pageText)
    if (!insights) {
      return NextResponse.json({ success: false, error: 'Claude could not extract insights from this page' }, { status: 500 })
    }

    console.log('[reading-insights] insights extracted, saving to Supabase...')

    // 3. Save to Supabase trips table
    const { error } = await supabase()
      .from('trips')
      .update({ reading_page_url: readingPageUrl, reading_insights: insights })
      .eq('trip_id', tripId)

    if (error) {
      console.error('[reading-insights] Supabase update error:', error.message)
      const isMissingColumn = error.message.toLowerCase().includes('column') || error.message.toLowerCase().includes('schema cache')
      return NextResponse.json({
        success: false,
        error: isMissingColumn
          ? 'DB columns missing. Run in Supabase SQL Editor: ALTER TABLE trips ADD COLUMN IF NOT EXISTS reading_page_url TEXT; ALTER TABLE trips ADD COLUMN IF NOT EXISTS reading_insights TEXT;'
          : error.message,
      }, { status: 500 })
    }

    return NextResponse.json({ success: true, insights })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[reading-insights] error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
