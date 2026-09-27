/**
 * GET /api/photo?url=<encoded image url>
 *
 * Fetches an external photo once, caches it, and serves it from here.
 *
 * Three reasons this exists rather than pointing <img> straight at the source:
 *  · Wikimedia rate-limits hotlinking and asks for a descriptive User-Agent —
 *    proxying means one fetch per image per day instead of one per viewer.
 *  · The browser gets long-lived cache headers even though the upstream sets none.
 *  · Hosts are allowlisted, so this can't be turned into an open proxy.
 *
 * Note on size: Commons serves only the thumb renditions it has already stored,
 * and rejects arbitrary widths, so images arrive at whatever width the source
 * offers (often ~0.8MB). Replacing these with optimised uploads is the way to
 * make the gallery lighter.
 */

import { NextResponse } from 'next/server'

const TTL_MS = 24 * 60 * 60 * 1000
const MAX_BYTES = 8 * 1024 * 1024

const ALLOWED_HOSTS = new Set([
  'upload.wikimedia.org',
  'commons.wikimedia.org',
  'images.unsplash.com',
  'images.pexels.com',
])

const UA = 'CQ-Client-Portal/1.0 (+https://closequarters.club; contact: hello@closequarters.club)'

const cache = new Map<string, { body: ArrayBuffer; type: string; expires: number }>()

/** The imageinfo API appends analytics params; they aren't needed upstream. */
function clean(u: URL): string {
  for (const k of ['utm_source', 'utm_campaign', 'utm_content']) u.searchParams.delete(k)
  return u.toString()
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('url')
  if (!raw) return NextResponse.json({ error: 'url required' }, { status: 400 })

  let target: URL
  try { target = new URL(raw) } catch { return NextResponse.json({ error: 'bad url' }, { status: 400 }) }
  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: 'host not allowed' }, { status: 403 })
  }

  const fetchUrl = clean(target)
  const hit = cache.get(fetchUrl)
  if (hit && hit.expires > Date.now()) {
    return new NextResponse(hit.body, {
      headers: { 'Content-Type': hit.type, 'Cache-Control': 'public, max-age=604800, immutable' },
    })
  }

  try {
    const res = await fetch(fetchUrl, {
      headers: { 'User-Agent': UA, Accept: 'image/*' },
      redirect: 'follow',
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn('[photo] upstream', res.status, fetchUrl.slice(0, 120))
      return NextResponse.json({ error: 'image unavailable', status: res.status }, { status: 502 })
    }
    const type = res.headers.get('content-type') ?? 'image/jpeg'
    if (!type.startsWith('image/')) {
      return NextResponse.json({ error: 'not an image' }, { status: 415 })
    }
    const body = await res.arrayBuffer()
    if (body.byteLength <= MAX_BYTES) {
      cache.set(fetchUrl, { body, type, expires: Date.now() + TTL_MS })
    }
    return new NextResponse(body, {
      headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=604800, immutable' },
    })
  } catch (err) {
    console.error('[photo] fetch failed', err)
    return NextResponse.json({ error: 'image unavailable' }, { status: 502 })
  }
}
