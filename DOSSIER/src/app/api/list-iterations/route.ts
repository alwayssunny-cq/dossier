import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminAuth'
import { Client } from '@notionhq/client'
import type { BlockObjectResponse, PartialBlockObjectResponse } from '@notionhq/client/build/src/api-endpoints/blocks'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

type AnyBlock = BlockObjectResponse | PartialBlockObjectResponse

function blockText(block: AnyBlock): string {
  const b = block as Record<string, unknown>
  const type = b.type as string
  if (type === 'child_page') {
    return ((b.child_page as Record<string, unknown>)?.title as string) ?? ''
  }
  const content = b[type] as Record<string, unknown> | undefined
  if (!content) return ''
  const rt = (content.rich_text ?? content.text ?? []) as Array<{ plain_text?: string }>
  return rt.map(t => t.plain_text ?? '').join('').trim()
}

function hasKeyword(block: AnyBlock, keyword: string): boolean {
  return blockText(block).toLowerCase().includes(keyword.toLowerCase())
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

// Recursively search for the "Drawing board" section within a page.
// Returns child_page blocks (the iteration pages) once found.
async function findIterationPages(blockId: string, depth: number): Promise<AnyBlock[] | null> {
  if (depth > 4) return null

  let children: AnyBlock[]
  try {
    children = await listChildren(blockId)
  } catch {
    return null
  }

  // Check if any child directly IS the drawing board container
  for (const block of children) {
    const text = blockText(block).toLowerCase()
    if (text.includes('drawing board') || text.includes('drawing')) {
      const sub = await listChildren((block as Record<string, unknown>).id as string)
      const pages = sub.filter(b => (b as Record<string, unknown>).type === 'child_page')
      if (pages.length > 0) return pages
      // It's the container but pages are deeper
      const deeper = await findIterationPages((block as Record<string, unknown>).id as string, depth + 1)
      if (deeper && deeper.length > 0) return deeper
    }
  }

  // Recurse into toggles and crafting-related child pages
  for (const block of children) {
    const b = block as Record<string, unknown>
    const type = b.type as string
    const text = blockText(block).toLowerCase()
    const shouldRecurse =
      type === 'toggle' ||
      type === 'column_list' ||
      type === 'column' ||
      (type === 'child_page' && (text.includes('craft') || text.includes('board') || text.includes('activespace')))

    if (shouldRecurse) {
      const found = await findIterationPages(b.id as string, depth + 1)
      if (found && found.length > 0) return found
    }
  }

  return null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawPageId = searchParams.get('pageId') ?? ''

  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!rawPageId) {
    return NextResponse.json({ error: 'Missing pageId' }, { status: 400 })
  }

  try {
    const iterationBlocks = await findIterationPages(rawPageId, 0)

    if (!iterationBlocks || iterationBlocks.length === 0) {
      // Provide a diagnostic to help debug
      let topBlocks: AnyBlock[] = []
      try { topBlocks = await listChildren(rawPageId) } catch { /* ignore */ }
      return NextResponse.json({
        error: 'Could not find "Drawing board" section. Verify the page ID and that the integration has access.',
        diagnostic: topBlocks.slice(0, 15).map(b => ({
          type: (b as Record<string, unknown>).type,
          text: blockText(b).slice(0, 80),
        })),
      }, { status: 404 })
    }

    const iterations = iterationBlocks
      .map(b => {
        const block = b as Record<string, unknown>
        return {
          id: block.id as string,
          title: ((block.child_page as Record<string, unknown>)?.title as string) ?? 'Untitled',
          lastEdited: block.last_edited_time as string,
        }
      })
      .sort((a, b) => new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime())

    return NextResponse.json({ iterations })
  } catch (error) {
    console.error('list-iterations error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
