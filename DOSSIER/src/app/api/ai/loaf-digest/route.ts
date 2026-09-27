import { NextResponse } from 'next/server'
import { isAdminOrCronRequest } from '@/lib/adminAuth'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
let _supabase: ReturnType<typeof createAdminClient> | null = null
/** Built on first use — see note above; never at import time. */
const supabase = () => (_supabase ??= createAdminClient())

// ── Notion block types we care about ─────────────────────────────────────────

type RichTextItem = { plain_text: string; href?: string | null }
type NotionBlock = {
  id: string
  type: string
  heading_1?:  { rich_text: RichTextItem[] }
  heading_2?:  { rich_text: RichTextItem[] }
  heading_3?:  { rich_text: RichTextItem[] }
  paragraph?:  { rich_text: RichTextItem[] }
  bulleted_list_item?: { rich_text: RichTextItem[] }
  numbered_list_item?: { rich_text: RichTextItem[] }
  quote?:      { rich_text: RichTextItem[] }
  callout?:    { rich_text: RichTextItem[] }
  divider?:    object
  child_database?: { title: string }
}

function rt(items: RichTextItem[] | undefined): string {
  return (items ?? []).map(r => r.plain_text).join('')
}

function extractLink(items: RichTextItem[] | undefined): string | null {
  for (const r of items ?? []) if (r.href) return r.href
  return null
}

// ── Fetch all blocks from a Notion page ──────────────────────────────────────

async function fetchPageBlocks(pageId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = []
  let cursor: string | undefined = undefined

  do {
    const url = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
      },
    })
    if (!res.ok) throw new Error(`Notion blocks fetch failed: ${res.status} ${await res.text()}`)
    const data = await res.json() as { results: NotionBlock[]; has_more: boolean; next_cursor: string | null }
    blocks.push(...data.results)
    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined
  } while (cursor)

  return blocks
}

// ── Convert LOAF page blocks → raw text for Claude ───────────────────────────

function blocksToText(blocks: NotionBlock[]): string {
  const lines: string[] = []
  let inThisWeek = false

  for (const b of blocks) {
    if (b.type === 'heading_1') {
      const h = rt(b.heading_1?.rich_text)
      if (h.toLowerCase().includes('this week')) { inThisWeek = true; lines.push(`# ${h}`); continue }
      if (h.toLowerCase().includes('past issue') || h.toLowerCase().includes('archive')) break
      if (inThisWeek) lines.push(`# ${h}`)
    }
    if (!inThisWeek) continue
    if (b.type === 'child_database') break

    switch (b.type) {
      case 'heading_2': lines.push(`## ${rt(b.heading_2?.rich_text)}`); break
      case 'heading_3': lines.push(`### ${rt(b.heading_3?.rich_text)}`); break
      case 'paragraph': {
        const text = rt(b.paragraph?.rich_text)
        const link = extractLink(b.paragraph?.rich_text)
        if (text) lines.push(link ? `${text} [link: ${link}]` : text)
        break
      }
      case 'bulleted_list_item': lines.push(`• ${rt(b.bulleted_list_item?.rich_text)}`); break
      case 'numbered_list_item': lines.push(`- ${rt(b.numbered_list_item?.rich_text)}`); break
      case 'quote': lines.push(`> ${rt(b.quote?.rich_text)}`); break
      case 'callout': lines.push(rt(b.callout?.rich_text)); break
      case 'divider': lines.push('---'); break
    }
  }

  return lines.filter(Boolean).join('\n')
}

// ── Claude extraction ─────────────────────────────────────────────────────────

interface LoafStory {
  headline: string
  location: string | null
  summary: string
  story: string
  reading_link: string | null
  tags: string[]
  why_interesting: string
}

async function extractStoryWithClaude(rawText: string): Promise<LoafStory> {
  const stream = await anthropic.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 2000,
    thinking: { type: 'adaptive' },
    messages: [{
      role: 'user',
      content: `You are the editor of CQ (Closequarters), a studio that designs narrative-led journeys. The newsletter is called "The CQ LOAF." Read the following raw content from this week's LOAF page and extract the story.

Return ONLY valid JSON matching this exact shape — no markdown fences, no extra text:
{
  "headline": "The story title (concise, punchy)",
  "location": "City, Country or region (null if not mentioned)",
  "summary": "1–2 sentences that capture the essence — what happened and why it carries weight for a discerning reader",
  "story": "The full story text, cleaned up and formatted naturally (preserve all key details, remove Notion formatting artifacts)",
  "reading_link": "The URL from the content if any, or null",
  "tags": ["array", "of", "2-4", "relevant", "tags", "from: Adventure, Culture, Food, Wellness, Design, Nature, Urban, Hidden Gem, Seasonal, Budget, Restrained, Family, Solo"],
  "why_interesting": "1–2 sentences from your editorial perspective — WHY a CQ traveler would care about this place/story"
}

RAW LOAF PAGE CONTENT:
${rawText}`,
    }],
  })

  const msg = await stream.finalMessage()
  const textBlock = msg.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('Claude returned no text block')

  const cleaned = textBlock.text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
  return JSON.parse(cleaned) as LoafStory
}

// ── Write to Notion LOAF DB (past issues archive) ────────────────────────────

async function writeToNotionLoafDb(story: LoafStory, today: string): Promise<string | null> {
  const dbId = process.env.NOTION_LOAF_DB
  if (!dbId) return null

  const body = {
    parent: { database_id: dbId },
    properties: {
      Headline: { title: [{ text: { content: story.headline } }] },
      Location: story.location ? { rich_text: [{ text: { content: story.location } }] } : undefined,
      Summary: story.summary ? { rich_text: [{ text: { content: story.summary.slice(0, 2000) } }] } : undefined,
      Story: story.story ? { rich_text: [{ text: { content: story.story.slice(0, 2000) } }] } : undefined,
      'Reading Link': story.reading_link ? { url: story.reading_link } : undefined,
      Tags: { multi_select: story.tags.map(t => ({ name: t })) },
      "Why It's Interesting": story.why_interesting ? { rich_text: [{ text: { content: story.why_interesting } }] } : undefined,
      'Date Featured': { date: { start: today } },
      Source: { select: { name: 'CQ LOAF' } },
    },
  }

  // Remove undefined property keys
  const cleanedBody = JSON.parse(JSON.stringify(body))

  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cleanedBody),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[loaf-digest] Notion create page error:', errText)
    return null
  }

  const page = await res.json() as { id: string }
  return page.id
}

// ── Write to Supabase loaf_stories ────────────────────────────────────────────

async function writeToSupabase(story: LoafStory, notionPageId: string | null, today: string): Promise<void> {
  if (!notionPageId) {
    console.error('[loaf-digest] no Notion page id — skipping Supabase write (story has no stable identity to key on)')
    return
  }

  // Update previous "this week" entries to is_this_week = false
  await supabase().from('loaf_stories').update({ is_this_week: false }).eq('is_this_week', true)

  const { error } = await supabase().from('loaf_stories').upsert({
    notion_page_id: notionPageId,
    headline:       story.headline,
    location:       story.location,
    summary:        story.summary,
    story:          story.story,
    reading_link:   story.reading_link,
    tags:           story.tags,
    why_interesting: story.why_interesting,
    source:         'CQ LOAF',
    is_this_week:   true,
    date_featured:  today,
    updated_at:     new Date().toISOString(),
  }, { onConflict: 'notion_page_id' })

  if (error) console.error('[loaf-digest] Supabase upsert error:', error.message)
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // Auth: accept ADMIN_PASSWORD (from sync UI) or CRON_SECRET (from scheduler)
    const body = await request.json().catch(() => ({})) as Record<string, string>
    if (!isAdminOrCronRequest(request, body)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const pageId = process.env.NOTION_LOAF_PAGE_ID
    if (!pageId) {
      return NextResponse.json({ success: false, error: 'NOTION_LOAF_PAGE_ID not set' }, { status: 500 })
    }

    // 1. Fetch raw blocks from the CQ LOAF Notion page
    console.log('[loaf-digest] fetching blocks from page', pageId)
    const blocks = await fetchPageBlocks(pageId)
    const rawText = blocksToText(blocks)

    if (!rawText.trim()) {
      return NextResponse.json({ success: false, error: 'No "This Week" content found on the LOAF page' }, { status: 422 })
    }

    // 2. Claude extracts and structures the story
    console.log('[loaf-digest] sending to Claude for extraction...')
    const story = await extractStoryWithClaude(rawText)

    const today = new Date().toISOString().slice(0, 10)

    // 3. Write to Notion LOAF DB (creates the past-issues archive entry)
    console.log('[loaf-digest] writing to Notion LOAF DB...')
    const notionPageId = await writeToNotionLoafDb(story, today)

    // 4. Write to Supabase (updates is_this_week + archives)
    console.log('[loaf-digest] writing to Supabase...')
    await writeToSupabase(story, notionPageId, today)

    // 5. Trigger full sync so the dossier reflects latest loaf_stories
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const syncRes = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
    })
    const syncData = await syncRes.json() as { success: boolean; results?: Record<string, number> }

    return NextResponse.json({
      success: true,
      digested_at: new Date().toISOString(),
      story: {
        headline:        story.headline,
        location:        story.location,
        tags:            story.tags,
        why_interesting: story.why_interesting,
        has_link:        !!story.reading_link,
      },
      notion_page_id: notionPageId,
      sync: { success: syncData.success, loaf: syncData.results?.loaf },
    })
  } catch (error) {
    console.error('[loaf-digest] error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ message: 'POST to /api/ai/loaf-digest to run the AI digest.' }, { status: 405 })
}
