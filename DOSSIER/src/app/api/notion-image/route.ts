/**
 * GET /api/notion-image?blockId=XXX
 * GET /api/notion-image?pageId=XXX&prop=Cover%20Image
 *
 * Notion's file URLs are signed and expire in ~1 hour, so the portal can't
 * store them — it has to ask Notion for a fresh one. That call costs
 * 200–800ms and Notion rate-limits to roughly 3 requests/second, which is
 * what made carousels crawl: every image, every viewer, every click paid it.
 *
 * The signed URL is now cached in memory for 45 minutes (safely inside the
 * ~60 minute expiry), so only the first request for an image pays that cost.
 * In-flight requests for the same block share one lookup, so a carousel
 * preloading ten images issues one Notion call per image, not ten each.
 */

import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

const TTL_MS = 45 * 60 * 1000

const urlCache = new Map<string, { url: string; expires: number }>()
const inFlight = new Map<string, Promise<string | null>>()

/**
 * A file uploaded into a page property, rather than an image block.
 *
 * Covers in CQ Loaf and CQ Trips may be pasted as a link or uploaded as a
 * file. An uploaded file's URL is signed and expires, so the sync stores a
 * path to this route instead of the URL itself, and the signed URL is
 * resolved fresh — and cached — at request time.
 */
async function resolvePropUrl(pageId: string, prop: string): Promise<string | null> {
  const key = `${pageId}:${prop}`
  const hit = urlCache.get(key)
  if (hit && hit.expires > Date.now()) return hit.url

  const pending = inFlight.get(key)
  if (pending) return pending

  const lookup = (async (): Promise<string | null> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const page: any = await notion.pages.retrieve({ page_id: pageId })
      // Matched loosely: several of these property names carry a trailing
      // space in Notion, which is invisible in the UI and would otherwise
      // make the lookup miss for a reason nobody could see.
      const props = page?.properties ?? {}
      const propKey = Object.keys(props).find(
        k => k.trim().toLowerCase() === prop.trim().toLowerCase(),
      )
      const files = (propKey ? props[propKey]?.files : undefined) ?? []
      const first = files[0]
      const url: string | null = first?.file?.url ?? first?.external?.url ?? null
      if (url) urlCache.set(key, { url, expires: Date.now() + TTL_MS })
      return url
    } catch (err) {
      console.error(`[notion-image] property lookup failed pageId=${pageId} prop=${prop}`, err)
      return null
    } finally {
      inFlight.delete(key)
    }
  })()

  inFlight.set(key, lookup)
  return lookup
}

async function resolveUrl(blockId: string): Promise<string | null> {
  const hit = urlCache.get(blockId)
  if (hit && hit.expires > Date.now()) return hit.url

  const pending = inFlight.get(blockId)
  if (pending) return pending

  const lookup = (async (): Promise<string | null> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block: any = await notion.blocks.retrieve({ block_id: blockId })
      const url: string | null = block?.image?.file?.url ?? block?.image?.external?.url ?? null
      if (url) urlCache.set(blockId, { url, expires: Date.now() + TTL_MS })
      return url
    } catch (err) {
      console.error(`[notion-image] lookup failed blockId=${blockId}`, err)
      return null
    } finally {
      inFlight.delete(blockId)
    }
  })()

  inFlight.set(blockId, lookup)
  return lookup
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const blockId = searchParams.get('blockId')
  const pageId  = searchParams.get('pageId')
  const prop    = searchParams.get('prop')

  if (!blockId && !(pageId && prop)) {
    return NextResponse.json({ error: 'blockId, or pageId and prop, required' }, { status: 400 })
  }

  const freshUrl = blockId
    ? await resolveUrl(blockId)
    : await resolvePropUrl(pageId!, prop!)
  if (!freshUrl) {
    return NextResponse.json({ error: 'Image unavailable' }, { status: 404 })
  }

  return NextResponse.redirect(freshUrl, {
    status: 307,
    headers: {
      // Let the browser reuse the redirect for the rest of the signed window
      'Cache-Control': 'private, max-age=2400, stale-while-revalidate=600',
    },
  })
}
