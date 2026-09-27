/**
 * GET /api/inspect-iteration?password=...&pageId=...
 *
 * Diagnostic endpoint — does NOT write anything.
 * Fetches the iteration page structure from Notion and returns:
 *   - page metadata (object type, parent type, title)
 *   - all child block types
 *   - for the first table found: row count, header row, first data row (raw cells)
 *   - for any toggle/column_list blocks: their children types (common nesting patterns)
 *
 * Use this to confirm what Notion actually has at the given page ID before
 * running a full sync.
 */

import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

function cellText(cell: Array<{ plain_text?: string }>): string {
  return cell.map(t => t.plain_text ?? '').join('').trim()
}

async function listChildren(blockId: string) {
  const results: unknown[] = []
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
  return results as Array<Record<string, unknown>>
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const password = searchParams.get('password')
  const pageId   = searchParams.get('pageId')

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!pageId) {
    return NextResponse.json({ error: 'Missing pageId' }, { status: 400 })
  }

  try {
    // ── 1. Page metadata ─────────────────────────────────────────────────────
    const page = await notion.pages.retrieve({ page_id: pageId }) as Record<string, unknown>
    const parentType = (page.parent as Record<string, unknown> | undefined)?.type ?? 'unknown'

    // Extract title property
    const props = (page.properties ?? {}) as Record<string, Record<string, unknown>>
    let titleText = ''
    for (const prop of Object.values(props)) {
      if (prop.type === 'title') {
        const titleArr = (prop.title ?? []) as Array<{ plain_text?: string }>
        titleText = titleArr.map(t => t.plain_text ?? '').join('').trim()
        break
      }
    }

    // ── 2. Top-level children ─────────────────────────────────────────────────
    const children = await listChildren(pageId)
    const topLevelTypes = children.map(b => b.type as string)

    // ── 3. First table at top level ──────────────────────────────────────────
    let firstTable: {
      blockId: string
      rowCount: number
      headers: string[]
      firstDataRow: string[]
      allDataRows: string[][]
    } | null = null

    const tableBlock = children.find(b => b.type === 'table')
    if (tableBlock) {
      const tableRows = await listChildren(tableBlock.id as string)
      const rowBlocks = tableRows.filter(b => b.type === 'table_row')

      const parseRow = (row: Record<string, unknown>): string[] => {
        const cells = ((row.table_row as Record<string, unknown>)?.cells ?? []) as Array<Array<{ plain_text?: string }>>
        return cells.map(c => cellText(c))
      }

      const headers = rowBlocks.length > 0 ? parseRow(rowBlocks[0]) : []
      const dataRows = rowBlocks.slice(1).map(r => parseRow(r))

      firstTable = {
        blockId: tableBlock.id as string,
        rowCount: rowBlocks.length,
        headers,
        firstDataRow: dataRows[0] ?? [],
        allDataRows: dataRows,
      }
    }

    // ── 4. If no top-level table, look one level deeper ──────────────────────
    // Common pattern: table lives inside a toggle, column_list, or child_page block
    const nestedTables: Array<{
      parentType: string
      parentId: string
      blockId: string
      rowCount: number
      headers: string[]
      firstDataRow: string[]
    }> = []

    if (!tableBlock) {
      const containers = children.filter(b =>
        ['toggle', 'column_list', 'column', 'bulleted_list_item', 'numbered_list_item', 'quote', 'callout'].includes(b.type as string)
      )

      for (const container of containers.slice(0, 5)) {
        try {
          const containerChildren = await listChildren(container.id as string)
          const nestedTable = containerChildren.find(b => b.type === 'table')
          if (nestedTable) {
            const tableRows = await listChildren(nestedTable.id as string)
            const rowBlocks = tableRows.filter(b => b.type === 'table_row')
            const parseRow = (row: Record<string, unknown>): string[] => {
              const cells = ((row.table_row as Record<string, unknown>)?.cells ?? []) as Array<Array<{ plain_text?: string }>>
              return cells.map(c => cellText(c))
            }
            const headers = rowBlocks.length > 0 ? parseRow(rowBlocks[0]) : []
            nestedTables.push({
              parentType: container.type as string,
              parentId: container.id as string,
              blockId: nestedTable.id as string,
              rowCount: rowBlocks.length,
              headers,
              firstDataRow: rowBlocks.length > 1 ? parseRow(rowBlocks[1]) : [],
            })
          }
        } catch {
          // skip inaccessible blocks
        }
      }
    }

    return NextResponse.json({
      page: {
        id: pageId,
        parentType,
        title: titleText,
        object: page.object,
      },
      children: {
        count: children.length,
        types: topLevelTypes,
      },
      firstTable,
      nestedTables,
      diagnosis: firstTable
        ? firstTable.rowCount < 2
          ? `Table found but has only ${firstTable.rowCount} row(s) — need at least 2 (header + data)`
          : `Table OK — ${firstTable.rowCount} rows (${firstTable.rowCount - 1} data rows). Headers: [${firstTable.headers.join(', ')}]`
        : nestedTables.length > 0
          ? `No top-level table. Found ${nestedTables.length} nested table(s) inside ${nestedTables.map(t => t.parentType).join(', ')} blocks. The sync route only looks at top-level blocks — pass the nested table's parent block ID instead.`
          : children.length === 0
            ? 'Page has 0 child blocks — either wrong page ID, or Notion integration lacks access to this page.'
            : `Page has ${children.length} child blocks [${topLevelTypes.join(', ')}] but NO table found at any level checked.`,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
