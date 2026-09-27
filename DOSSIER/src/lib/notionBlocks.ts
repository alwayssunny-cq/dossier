import type { ParsedBlock } from '@/app/api/sync-content-pages/route'

/** Plain text of a block, preferring rich text (keeps formatting-aware callers working). */
export function blockText(block: ParsedBlock): string {
  return block.richText?.map(r => r.text).join('') || block.text || ''
}

export interface H1Section {
  heading: ParsedBlock
  title: string
  content: ParsedBlock[]
}

/** Splits a flat block list into H1-delimited sections, plus whatever comes before the first H1. */
export function splitByH1(blocks: ParsedBlock[]): { leading: ParsedBlock[]; sections: H1Section[] } {
  const leading: ParsedBlock[] = []
  const sections: H1Section[] = []
  let current: H1Section | null = null

  for (const block of blocks) {
    if (block.type === 'heading' && block.level === 1) {
      current = { heading: block, title: blockText(block).trim(), content: [] }
      sections.push(current)
    } else if (current) {
      current.content.push(block)
    } else {
      leading.push(block)
    }
  }

  return { leading, sections }
}

/** Flattens a column_list's children (all columns, in order) into one block list —
 *  used when we just need the content regardless of visual column placement. */
export function flattenColumns(columnList: ParsedBlock): ParsedBlock[] {
  const out: ParsedBlock[] = []
  for (const col of columnList.children ?? []) {
    out.push(...(col.children ?? []))
  }
  return out
}

/** A column_list where every block is an image (or an image + a trailing callout) reads as a gallery. */
export function isGalleryColumnList(columnList: ParsedBlock): boolean {
  const flat = flattenColumns(columnList)
  const images = flat.filter(b => b.type === 'image')
  const nonImages = flat.filter(b => b.type !== 'image')
  return images.length >= 2 && nonImages.every(b => b.type === 'callout' || (b.type === 'paragraph' && !blockText(b).trim()))
}
