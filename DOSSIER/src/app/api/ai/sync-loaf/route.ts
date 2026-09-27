import { NextResponse } from 'next/server'
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExtractedStory {
  headline: string
  location: string | null
  date: string | null
  summary: string
  story: string
  tags: string[]
  why_interesting: string
  is_this_week: boolean
  reading_link: string | null
}

interface NotionDbEntry {
  notion_page_id: string
  headline: string
  location: string | null
  summary: string | null
  story: string | null
  reading_link: string | null
  tags: string[]
  why_interesting: string | null
  date_featured: string | null
  cover_url: string | null
  source: string | null
}

// ── Read all blocks from a Notion page into plain text ────────────────────────

async function fetchAllPageBlocks(pageId: string): Promise<string> {
  let cursor: string | undefined
  const lines: string[] = []

  do {
    const url = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`
    const res = await fetch(url, { headers: NOTION_HEADERS })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Failed to read CQ LOAF page: ${res.status} ${err}`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as { results: any[]; has_more: boolean; next_cursor: string | null }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getText = (richText: any[]): string => (richText ?? []).map((t: any) => t.plain_text).join('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getLink = (richText: any[]): string | null => {
      for (const t of richText ?? []) if (t.href) return t.href
      return null
    }

    for (const block of data.results) {
      const type = block.type as string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content = (block as any)[type]
      if (type === 'heading_1')           lines.push(`\n# ${getText(content.rich_text)}`)
      else if (type === 'heading_2')      lines.push(`\n## ${getText(content.rich_text)}`)
      else if (type === 'heading_3')      lines.push(`\n### ${getText(content.rich_text)}`)
      else if (type === 'paragraph')      {
        const t = getText(content.rich_text)
        const link = getLink(content.rich_text)
        if (t.trim()) lines.push(link ? `${t} [link: ${link}]` : t)
      }
      else if (type === 'bulleted_list_item') lines.push(`• ${getText(content.rich_text)}`)
      else if (type === 'numbered_list_item') lines.push(`- ${getText(content.rich_text)}`)
      else if (type === 'callout')        lines.push(`[${getText(content.rich_text)}]`)
      else if (type === 'divider')        lines.push('---')
    }

    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined
  } while (cursor)

  return lines.join('\n')
}

// ── Get existing headlines from Notion LOAF DB ────────────────────────────────

async function fetchExistingHeadlines(): Promise<string[]> {
  const dbId = process.env.NOTION_LOAF_DB
  if (!dbId) throw new Error('NOTION_LOAF_DB not set')

  const headlines: string[] = []
  let cursor: string | undefined

  do {
    const body: Record<string, unknown> = { page_size: 100 }
    if (cursor) body.start_cursor = cursor

    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: NOTION_HEADERS,
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error(`LOAF DB query failed: ${res.status}`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as { results: any[]; has_more: boolean; next_cursor: string | null }

    for (const page of data.results) {
      if (page.archived) continue
      const props = page.properties
      const titleProp = props['Headline'] ?? props['Name']
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const headline = titleProp?.title?.map((t: any) => t.plain_text).join('') ?? ''
      if (headline) headlines.push(headline)
    }

    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined
  } while (cursor)

  return headlines
}

// ── Claude: extract new stories from page text ────────────────────────────────

async function extractStoriesWithClaude(
  pageText: string,
  existingHeadlines: string[],
): Promise<ExtractedStory[]> {
  const stream = await anthropic.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    messages: [{
      role: 'user',
      content: `You are the editor of CQ (Closequarters), a studio that designs narrative-led journeys. The CQ LOAF is a weekly digest. Your job is to read the page content below and extract all travel stories.

STORIES ALREADY IN THE DATABASE (skip these — exact match by headline):
${existingHeadlines.length > 0 ? existingHeadlines.map(h => `- ${h}`).join('\n') : '(none — add everything you find)'}

CQ LOAF PAGE:
${pageText}

Return ONLY valid JSON (no markdown, no fences) — an array of story objects:
[
  {
    "headline": "Exact story title",
    "location": "City/Region, Country (or null)",
    "date": "YYYY-MM-DD extracted from page (or null)",
    "summary": "1-2 sentences for a discerning reader",
    "story": "Full story text from the page (200–600 words, preserve richness)",
    "tags": ["Tag1", "Tag2"],
    "why_interesting": "1-2 sentences: why a CQ traveler would care",
    "is_this_week": true,
    "reading_link": "The URL from any [link: ...] marker near this story in the page content, or null if none"
  }
]

Tags must be from: Adventure, Culture, Food, Wellness, Design, Nature, Urban, Hidden Gem, Seasonal, Restrained, Family, Solo, Wildlife, Architecture

Rules:
- Only include stories NOT already in the database list above (case-insensitive match)
- Mark is_this_week: true for the story under "This Week" (or the most recent)
- If all stories are already in the database, return []
- Extract the full story narrative — don't truncate`,
    }],
  })

  const msg = await stream.finalMessage()
  const textBlock = msg.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') return []

  const raw = textBlock.text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
  try {
    return JSON.parse(raw) as ExtractedStory[]
  } catch {
    console.error('[sync-loaf] Claude returned invalid JSON:', raw.slice(0, 300))
    return []
  }
}

// ── Create a new page in the Notion LOAF Database ─────────────────────────────

// Notion rich_text fields have a 2000-char limit per block
function toRichText(text: string): { text: { content: string } }[] {
  const chunks: { text: { content: string } }[] = []
  for (let i = 0; i < text.length; i += 1990) {
    chunks.push({ text: { content: text.slice(i, i + 1990) } })
  }
  return chunks.length > 0 ? chunks : [{ text: { content: '' } }]
}

async function createNotionDbPage(story: ExtractedStory): Promise<string | null> {
  const dbId = process.env.NOTION_LOAF_DB
  const properties: Record<string, unknown> = {
    'Headline': { title: [{ text: { content: story.headline } }] },
    'Source': { select: { name: 'CQ LOAF Page' } },
  }

  if (story.location)        properties['Location']             = { rich_text: toRichText(story.location) }
  if (story.summary)         properties['Summary']              = { rich_text: toRichText(story.summary) }
  if (story.story)           properties['Story']                = { rich_text: toRichText(story.story) }
  if (story.why_interesting) properties["Why It's Interesting"] = { rich_text: toRichText(story.why_interesting) }
  if (story.date)            properties['Date Featured']        = { date: { start: story.date } }
  if (story.tags.length > 0) properties['Tags']                 = { multi_select: story.tags.map(t => ({ name: t })) }
  if (story.reading_link)    properties['Reading Link']         = { url: story.reading_link }

  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: NOTION_HEADERS,
    body: JSON.stringify({ parent: { database_id: dbId }, properties }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[sync-loaf] Notion page create failed:', res.status, err.slice(0, 200))
    return null
  }

  const page = await res.json() as { id: string }
  return page.id
}

// ── Fetch the full Notion LOAF DB for Supabase sync ──────────────────────────

async function fetchFullNotionLoafDb(): Promise<NotionDbEntry[]> {
  const dbId = process.env.NOTION_LOAF_DB
  if (!dbId) throw new Error('NOTION_LOAF_DB not set')

  const entries: NotionDbEntry[] = []
  let cursor: string | undefined

  do {
    const body: Record<string, unknown> = {
      page_size: 100,
      sorts: [{ property: 'Date Featured', direction: 'descending' }],
    }
    if (cursor) body.start_cursor = cursor

    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: NOTION_HEADERS,
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error(`LOAF DB query failed: ${res.status}`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as { results: any[]; has_more: boolean; next_cursor: string | null }

    for (const page of data.results) {
      if (page.archived) continue
      const props = page.properties
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cover = page.cover as any
      const coverUrl: string | null =
        cover?.type === 'external' ? (cover.external?.url ?? null) :
        cover?.type === 'file'     ? (cover.file?.url ?? null) : null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getText = (prop: unknown): string | null => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = prop as any
        if (!p) return null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (p.type === 'title')     return p.title?.map((t: any) => t.plain_text).join('') || null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (p.type === 'rich_text') return p.rich_text?.map((t: any) => t.plain_text).join('') || null
        if (p.type === 'url')       return p.url ?? null
        return null
      }

      const headline = getText(props['Headline']) ?? getText(props['Name'])
      if (!headline) continue

      entries.push({
        notion_page_id:  page.id,
        headline,
        location:        getText(props['Location']),
        summary:         getText(props['Summary']),
        story:           getText(props['Story']),
        reading_link:    getText(props['Reading Link']),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tags:            (props['Tags']?.multi_select ?? []).map((t: any) => t.name),
        why_interesting: getText(props["Why It's Interesting"]),
        date_featured:   props['Date Featured']?.date?.start ?? null,
        cover_url:       coverUrl ?? getText(props['Cover URL']),
        source:          props['Source']?.select?.name ?? null,
      })
    }

    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined
  } while (cursor)

  return entries
}

// ── Upsert to Supabase, setting is_this_week correctly ───────────────────────

async function upsertToSupabase(entries: NotionDbEntry[], thisWeekId: string | null): Promise<number> {
  if (thisWeekId) {
    await supabase().from('loaf_stories').update({ is_this_week: false }).eq('is_this_week', true)
  }

  let upserted = 0
  for (const entry of entries) {
    const isThisWeek = entry.notion_page_id === thisWeekId
    const record = {
      notion_page_id:  entry.notion_page_id,
      headline:        entry.headline,
      location:        entry.location,
      summary:         entry.summary,
      story:           entry.story,
      reading_link:    entry.reading_link,
      tags:            entry.tags,
      why_interesting: entry.why_interesting,
      source:          entry.source ?? 'CQ LOAF',
      cover_url:       entry.cover_url,
      is_this_week:    isThisWeek,
      date_featured:   entry.date_featured ?? new Date().toISOString().slice(0, 10),
      updated_at:      new Date().toISOString(),
    }

    const { error } = await supabase()
      .from('loaf_stories')
      .upsert(record, { onConflict: 'notion_page_id' })

    if (error) {
      console.error('[sync-loaf] upsert error:', error.message, 'for', entry.headline)
    } else {
      upserted++
    }
  }

  return upserted
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, string>
    const authHeader = request.headers.get('authorization')
    const isAdminAuth = body.password === process.env.ADMIN_PASSWORD
    const isCronAuth  = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`

    if (!isAdminAuth && !isCronAuth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const pageId = process.env.NOTION_LOAF_PAGE_ID
    if (!pageId) {
      return NextResponse.json({ success: false, error: 'NOTION_LOAF_PAGE_ID not set' }, { status: 500 })
    }

    // 1. Read the CQ LOAF page
    console.log('[sync-loaf] reading CQ LOAF page...')
    const pageText = await fetchAllPageBlocks(pageId)
    console.log(`[sync-loaf] page: ${pageText.length} chars`)

    // 2. Get existing Notion DB headlines (for dedup)
    console.log('[sync-loaf] fetching existing Notion DB headlines...')
    const existingHeadlines = await fetchExistingHeadlines()
    console.log(`[sync-loaf] ${existingHeadlines.length} stories already in Notion DB`)

    // 3. Claude reads page → extracts new stories not yet in DB
    console.log('[sync-loaf] Claude extracting new stories...')
    const newStories = await extractStoriesWithClaude(pageText, existingHeadlines)
    console.log(`[sync-loaf] Claude found ${newStories.length} new stories`)

    // 4. Create each new story as a page in the Notion LOAF DB
    const createdNotionIds: string[] = []
    for (const story of newStories) {
      console.log(`[sync-loaf] → creating Notion page: "${story.headline}"`)
      const id = await createNotionDbPage(story)
      if (id) createdNotionIds.push(id)
    }

    // 5. Fetch the full Notion DB (old + new) for Supabase
    console.log('[sync-loaf] fetching full Notion LOAF DB...')
    const allEntries = await fetchFullNotionLoafDb()
    console.log(`[sync-loaf] ${allEntries.length} total in Notion DB`)

    // 6. Determine this week's story:
    //    - prefer the one Claude flagged as is_this_week (and we just created)
    //    - fallback: most recent by date_featured
    let thisWeekId: string | null = null
    const thisWeekIdx = newStories.findIndex(s => s.is_this_week)
    if (thisWeekIdx !== -1 && createdNotionIds[thisWeekIdx]) {
      thisWeekId = createdNotionIds[thisWeekIdx]
    } else {
      // Keep existing is_this_week if we added nothing new
      const existing = allEntries.find(e =>
        existingHeadlines.some(h => h.toLowerCase() === e.headline.toLowerCase())
      )
      // Find the most recently dated entry as fallback
      const sorted = [...allEntries].sort((a, b) =>
        (b.date_featured ?? '').localeCompare(a.date_featured ?? '')
      )
      thisWeekId = sorted[0]?.notion_page_id ?? null
      void existing // suppress unused warning
    }

    // 7. Upsert everything to Supabase
    console.log(`[sync-loaf] upserting ${allEntries.length} stories to Supabase...`)
    await upsertToSupabase(allEntries, thisWeekId)

    const thisWeekHeadline =
      newStories.find(s => s.is_this_week)?.headline ??
      allEntries.find(e => e.notion_page_id === thisWeekId)?.headline ??
      null

    return NextResponse.json({
      success: true,
      synced_at:                new Date().toISOString(),
      stories_added:            newStories.length,
      stories_created_in_notion: createdNotionIds.length,
      total_in_db:              allEntries.length,
      this_week:                thisWeekHeadline,
      message: newStories.length > 0
        ? `Added ${newStories.length} new ${newStories.length === 1 ? 'story' : 'stories'} to the dossier.`
        : 'All stories are already up to date.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[sync-loaf] error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: 'POST to /api/ai/sync-loaf to sync the CQ LOAF.' }, { status: 405 })
}
