import type { ParsedBlock } from '@/app/api/sync-content-pages/route'

/**
 * Reading photographs and prose out of a synced Notion page.
 *
 * These were exported from ExperiencesStructured and GalleryCard, both of which
 * are client components. Next marks every export of a 'use client' module as a
 * client reference, so a server component calling one fails at runtime even
 * though the function itself is pure — which is exactly what happened when Your
 * Days started resolving today's photographs on the server.
 *
 * They live here now, in a module with no directive, so either side may call
 * them. The original modules re-export them so existing imports keep working.
 */

/** Notion file images are signed and expire — proxy them through our API route. */
export function imageSrc(block: ParsedBlock): string | null {
  if (block.imageType === 'file' && block.blockId) {
    return `/api/notion-image?blockId=${encodeURIComponent(block.blockId)}`
  }
  return block.url ?? null
}

/** Collect every image inside a block tree, in document order. */
export function collectImages(blocks: ParsedBlock[]): ParsedBlock[] {
  const out: ParsedBlock[] = []
  const walk = (b: ParsedBlock | ParsedBlock[] | undefined) => {
    if (!b) return
    if (Array.isArray(b)) return b.forEach(walk)
    if (b.type === 'image') out.push(b)
    ;(b.children ?? []).forEach(walk)
  }
  blocks.forEach(walk)
  return out
}

const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Do two place or title strings refer to the same thing? */
export function alike(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  const x = norm(a), y = norm(b)
  if (!x || !y) return false
  return x === y || x.includes(y) || y.includes(x)
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december']

/** "May 9" / "9 May" / "13 May" → "05-09". Ranges and routes return null. */
function dayKeyFromHeading(label: string): string | null {
  const s = label.trim().toLowerCase()
  if (/\bto\b|→|–|—/.test(s)) return null
  const month = MONTHS.findIndex(m => s.includes(m.slice(0, 3)))
  const day = s.match(/\b(\d{1,2})\b/)
  if (month === -1 || !day) return null
  return `${String(month + 1).padStart(2, '0')}-${day[1].padStart(2, '0')}`
}

/** "2026-05-09" → "05-09" */

export const txt = (b: ParsedBlock): string =>
  (b.richText ?? []).map(r => r.text ?? '').join('') || (b.text ?? '')

export function harvestPage(blocks: ParsedBlock[]) {
  const byTitle = new Map<string, { images: ParsedBlock[]; prose: string[] }>()
  const byDay = new Map<string, ParsedBlock[]>()
  let day: string | null = null
  let title: string | null = null

  const bucket = (t: string) => {
    if (!byTitle.has(t)) byTitle.set(t, { images: [], prose: [] })
    return byTitle.get(t)!
  }
  const pushDay = (imgs: ParsedBlock[]) => {
    if (!day || imgs.length === 0) return
    byDay.set(day, [...(byDay.get(day) ?? []), ...imgs])
  }

  for (const b of blocks) {
    if (b.type === 'heading' && b.level === 1) {
      const key = dayKeyFromHeading(txt(b))
      if (key) day = key
      title = null
      continue
    }
    if (b.type === 'heading' && b.level === 2) {
      title = txt(b).trim() || null
      continue
    }
    const imgs = b.type === 'image' ? [b]
      : (b.type === 'column_list' || b.type === 'column') ? collectImages([b])
      : []
    if (imgs.length > 0) {
      if (title) bucket(title).images.push(...imgs)
      pushDay(imgs)
      continue
    }
    if (title && b.type === 'paragraph') {
      const t = txt(b).trim()
      if (t) bucket(title).prose.push(t)
    }
  }
  return { byTitle, byDay }
}
