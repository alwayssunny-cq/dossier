/**
 * Server-side Notion page + blocks fetcher.
 * Used by the Stay tab and PDF export.
 */
import { Client } from '@notionhq/client'

// We use a loose interface rather than extending the SDK union type,
// so TypeScript can access .id, .type, .has_children reliably.
export interface BlockWithChildren {
  id: string
  type: string
  has_children: boolean
  children: BlockWithChildren[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

// Re-export RichTextItemResponse for convenience
export type { RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints'

export interface NotionPageData {
  id: string
  title: string
  coverUrl: string | null
  iconEmoji: string | null
  blocks: BlockWithChildren[]
}

function makeClient() {
  return new Client({ auth: process.env.NOTION_TOKEN! })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTitle(page: any): string {
  for (const [, prop] of Object.entries(page.properties ?? {})) {
    const p = prop as { type: string; title?: { plain_text: string }[] }
    if (p.type === 'title' && (p.title?.length ?? 0) > 0) {
      return (p.title ?? []).map((t: { plain_text: string }) => t.plain_text).join('')
    }
  }
  return 'Untitled'
}

async function fetchBlocksRecursively(
  notion: Client,
  blockId: string,
): Promise<BlockWithChildren[]> {
  const result: BlockWithChildren[] = []
  let cursor: string | undefined

  do {
    const resp = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    })

    for (const raw of resp.results) {
      // Cast to access common fields — all block responses have id/type/has_children
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = raw as any
      const entry: BlockWithChildren = {
        ...b,
        id:           b.id   as string,
        type:         b.type as string,
        has_children: !!b.has_children,
        children:     [],
      }
      if (entry.has_children) {
        entry.children = await fetchBlocksRecursively(notion, entry.id)
      }
      result.push(entry)
    }

    cursor = resp.has_more ? (resp.next_cursor ?? undefined) : undefined
  } while (cursor)

  return result
}

export async function fetchNotionPage(pageId: string): Promise<NotionPageData> {
  const notion = makeClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const page = (await notion.pages.retrieve({ page_id: pageId })) as any

  let coverUrl: string | null = null
  if (page.cover?.type === 'external') coverUrl = page.cover.external.url
  else if (page.cover?.type === 'file') coverUrl = page.cover.file.url

  let iconEmoji: string | null = null
  if (page.icon?.type === 'emoji') iconEmoji = page.icon.emoji

  const blocks = await fetchBlocksRecursively(notion, pageId)

  return {
    id: pageId,
    title: extractTitle(page),
    coverUrl,
    iconEmoji,
    blocks,
  }
}
