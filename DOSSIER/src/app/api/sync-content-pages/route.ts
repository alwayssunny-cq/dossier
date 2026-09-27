/**
 * POST /api/sync-content-pages
 * Body: { password, tripId, type }
 *
 * Supported types:
 *   'dates_destinations' — reads trip.dates_destinations_link
 *   'stay'              — reads trip.stay_link_url
 *   'experiences'       — reads trip.experience_link
 *
 * Flow:
 *   1. Resolve Notion page URL from the trip row
 *   2. Extract Notion page ID from URL
 *   3. Fetch page metadata + all blocks recursively
 *   4. Parse blocks into ParsedBlock[]
 *   5. Upsert into trip_content_pages (conflict on trip_id, type)
 */

import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminAuth'
import { Client } from '@notionhq/client'
import { createAdminClient } from '@/lib/supabase/admin'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

// ── URL field map ─────────────────────────────────────────────────────────────

const CONTENT_TYPE_URL_FIELD: Record<string, string> = {
  dates_destinations: 'dates_destinations_link',
  stay:               'stay_link_url',
  experiences:        'experience_link',
}

const VALID_TYPES = Object.keys(CONTENT_TYPE_URL_FIELD)

// ── Notion page ID extraction ─────────────────────────────────────────────────

function extractPageId(input: string): string | null {
  if (!input) return null
  const clean = input.split('?')[0].split('#')[0]
  const uuidMatch = clean.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
  if (uuidMatch) return uuidMatch[1].replace(/-/g, '')
  const hashMatch = clean.match(/([0-9a-f]{32})(?:[/?#]|$)/i)
  if (hashMatch) return hashMatch[1]
  return null
}

// ── Block fetcher ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchBlocks(blockId: string): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any[] = []
  let cursor: string | undefined

  do {
    const resp = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    })
    for (const b of resp.results) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block = b as any
      if (block.has_children) {
        block._children = await fetchBlocks(block.id)
      }
      result.push(block)
    }
    cursor = resp.has_more ? (resp.next_cursor ?? undefined) : undefined
  } while (cursor)

  return result
}

// ── Rich text helpers ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function plainText(richText: any[]): string {
  return (richText ?? []).map((t: { plain_text: string }) => t.plain_text).join('')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function richItems(richText: any[]) {
  return (richText ?? []).map((t: { plain_text: string; href: string | null; annotations: Record<string, boolean> }) => ({
    text: t.plain_text,
    href: t.href ?? null,
    bold:          t.annotations?.bold          ?? false,
    italic:        t.annotations?.italic        ?? false,
    underline:     t.annotations?.underline     ?? false,
    strikethrough: t.annotations?.strikethrough ?? false,
    code:          t.annotations?.code          ?? false,
  }))
}

// ── ParsedBlock type ──────────────────────────────────────────────────────────

export interface ParsedBlock {
  type: string
  text?: string
  richText?: ReturnType<typeof richItems>
  level?: number
  url?: string
  caption?: string
  emoji?: string
  checked?: boolean
  language?: string
  children?: ParsedBlock[]
  rows?: string[][]
  imageType?: 'file' | 'external'
  blockId?: string
}

// ── Block → ParsedBlock ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseBlock(b: any): ParsedBlock | null {
  switch (b.type) {
    case 'paragraph':
      return { type: 'paragraph', text: plainText(b.paragraph?.rich_text), richText: richItems(b.paragraph?.rich_text) }

    case 'heading_1':
      return { type: 'heading', level: 1, text: plainText(b.heading_1?.rich_text), richText: richItems(b.heading_1?.rich_text) }
    case 'heading_2':
      return { type: 'heading', level: 2, text: plainText(b.heading_2?.rich_text), richText: richItems(b.heading_2?.rich_text) }
    case 'heading_3':
      return { type: 'heading', level: 3, text: plainText(b.heading_3?.rich_text), richText: richItems(b.heading_3?.rich_text) }

    case 'bulleted_list_item':
      return {
        type: 'bullet',
        text: plainText(b.bulleted_list_item?.rich_text),
        richText: richItems(b.bulleted_list_item?.rich_text),
        children: (b._children ?? []).map(parseBlock).filter(Boolean),
      }

    case 'numbered_list_item':
      return {
        type: 'numbered',
        text: plainText(b.numbered_list_item?.rich_text),
        richText: richItems(b.numbered_list_item?.rich_text),
        children: (b._children ?? []).map(parseBlock).filter(Boolean),
      }

    case 'image': {
      const imgType: 'file' | 'external' = b.image?.type === 'file' ? 'file' : 'external'
      const url = imgType === 'external' ? (b.image?.external?.url ?? null) : (b.image?.file?.url ?? null)
      return { type: 'image', url, caption: plainText(b.image?.caption ?? []), imageType: imgType, blockId: b.id }
    }

    case 'divider':
      return { type: 'divider' }

    case 'callout':
      return {
        type: 'callout',
        emoji: b.callout?.icon?.emoji ?? '💡',
        text: plainText(b.callout?.rich_text),
        richText: richItems(b.callout?.rich_text),
      }

    case 'quote':
      return { type: 'quote', text: plainText(b.quote?.rich_text), richText: richItems(b.quote?.rich_text) }

    case 'to_do':
      return {
        type: 'todo',
        text: plainText(b.to_do?.rich_text),
        richText: richItems(b.to_do?.rich_text),
        checked: b.to_do?.checked ?? false,
      }

    case 'toggle':
      return {
        type: 'toggle',
        text: plainText(b.toggle?.rich_text),
        richText: richItems(b.toggle?.rich_text),
        children: (b._children ?? []).map(parseBlock).filter(Boolean),
      }

    case 'code':
      return {
        type: 'code',
        text: plainText(b.code?.rich_text),
        language: b.code?.language ?? 'plain text',
      }

    case 'table': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (b._children ?? []).map((r: any) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r.table_row?.cells ?? []).map((cell: any[]) => plainText(cell))
      )
      return { type: 'table', rows }
    }

    case 'column_list':
      return {
        type: 'column_list',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        children: (b._children ?? []).map((col: any) => ({
          type: 'column',
          children: (col._children ?? []).map(parseBlock).filter(Boolean),
        })),
      }

    default:
      return null
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    password?: string
    tripId?: string
    type?: string
  }

  if (!isAdminRequest(request, body)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tripId, type = 'dates_destinations' } = body

  if (!tripId) {
    return NextResponse.json({ error: 'tripId required' }, { status: 400 })
  }

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({
      error: `Invalid type "${type}". Valid types: ${VALID_TYPES.join(', ')}`,
    }, { status: 400 })
  }

  const urlField = CONTENT_TYPE_URL_FIELD[type]
  const supabase = createAdminClient()

  // Fetch trip — select all possible URL fields
  const { data: trip } = await supabase
    .from('trips')
    .select('id, trip_name, dates_destinations_link, stay_link_url, experience_link')
    .eq('trip_id', tripId)
    .maybeSingle()

  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notionUrl: string | null = (trip as any)[urlField] ?? null
  if (!notionUrl) {
    return NextResponse.json({
      error: `No Notion URL set for type "${type}". Field: trips.${urlField}. Sync trips from Notion first.`,
    }, { status: 400 })
  }

  const pageId = extractPageId(notionUrl)
  if (!pageId) {
    return NextResponse.json({
      error: `Cannot extract Notion page ID from URL: ${notionUrl}`,
    }, { status: 400 })
  }

  console.log(`[sync-content] trip=${tripId} type=${type} pageId=${pageId}`)

  // Fetch page metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let page: any
  try {
    page = await notion.pages.retrieve({ page_id: pageId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('not_found') || msg.includes('Could not find')) {
      return NextResponse.json({
        error: 'Notion page not found. Make sure the page is shared with your integration.',
        detail: msg,
      }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to fetch Notion page', detail: msg }, { status: 500 })
  }

  // Extract title and cover
  let pageTitle = 'Untitled'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const [, prop] of Object.entries((page as { properties: Record<string, any> }).properties ?? {})) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = prop as any
    if (p.type === 'title' && p.title?.length > 0) {
      pageTitle = p.title.map((t: { plain_text: string }) => t.plain_text).join('')
      break
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pg = page as any
  const coverUrl: string | null =
    pg.cover?.type === 'external' ? pg.cover.external.url :
    pg.cover?.type === 'file'     ? pg.cover.file.url :
    null
  const iconEmoji: string | null = pg.icon?.type === 'emoji' ? pg.icon.emoji : null

  // Fetch all blocks
  let rawBlocks: object[]
  try {
    rawBlocks = await fetchBlocks(pageId)
  } catch (err) {
    return NextResponse.json({
      error: 'Failed to fetch page blocks',
      detail: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }

  const parsedBlocks = rawBlocks.map(parseBlock).filter(Boolean)

  const imageBlocks   = parsedBlocks.filter(b => b?.type === 'image')
  const fileImages    = imageBlocks.filter(b => b?.imageType === 'file').length
  const externalImages = imageBlocks.filter(b => b?.imageType === 'external').length
  console.log(`[sync-content] trip=${tripId} type=${type} pageId=${pageId} rawBlocks=${rawBlocks.length} parsedBlocks=${parsedBlocks.length} imageBlocks=${imageBlocks.length} externalImages=${externalImages} fileImages=${fileImages}`)

  // Build parsed content
  const parsedContent = {
    title: pageTitle,
    coverUrl,
    iconEmoji,
    blocks: parsedBlocks,
  }

  const now = new Date().toISOString()

  // Upsert into trip_content_pages
  const { error: upsertError } = await supabase
    .from('trip_content_pages')
    .upsert({
      trip_id:          (trip as { id: string }).id,
      type,
      notion_page_url:  notionUrl,
      notion_page_id:   pageId,
      raw_blocks:       rawBlocks,
      parsed_content:   parsedContent,
      synced_at:        now,
      updated_at:       now,
    }, { onConflict: 'trip_id,type' })

  if (upsertError) {
    if (upsertError.message.includes('does not exist') || upsertError.code === '42P01') {
      return NextResponse.json({
        error: 'trip_content_pages table not found. Run the migration first via the Content tab in Admin.',
        migration_sql: `CREATE TABLE IF NOT EXISTS trip_content_pages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  type            TEXT        NOT NULL,
  notion_page_url TEXT,
  notion_page_id  TEXT,
  raw_blocks      JSONB,
  parsed_content  JSONB,
  synced_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, type)
);
CREATE INDEX IF NOT EXISTS idx_trip_content_pages_trip_id ON trip_content_pages(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_content_pages_type    ON trip_content_pages(type);`,
      }, { status: 500 })
    }
    console.error(`[sync-content] upsert error trip=${tripId} type=${type}:`, upsertError.message)
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  console.log(`[sync-content] ✓ upserted trip=${tripId} type=${type} pageId=${pageId}`)

  return NextResponse.json({
    ok:               true,
    trip:             (trip as { trip_name: string }).trip_name,
    tripId,
    type,
    pageId,
    pageTitle,
    blockCount:       rawBlocks.length,
    parsedBlockCount: parsedBlocks.length,
    synced_at:        now,
  })
}
