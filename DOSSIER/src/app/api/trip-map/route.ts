/**
 * GET /api/trip-map?places=Kohima, India|Mohbondha, India|...
 *
 * Draws the journey as a static terrain map with the driving route along real
 * roads, and streams the image back so no map token reaches the browser.
 *
 * Mapbox is the provider because its Static Images API supports
 * `attribution=false&logo=false` as documented parameters — Google's terms
 * require its attribution and logo to remain visible, so a clean map can't be
 * produced there without breaching the licence. Geocoding, directions and
 * rendering all run on Mapbox so the data and the basemap stay under one licence.
 *
 * Google is kept only as a fallback for when no Mapbox token is configured, and
 * in that path its attribution is left intact.
 *
 * Geocoding, routes and rendered images are each cached for a day.
 */

import { NextResponse } from 'next/server'

const MAPBOX = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''
const GOOGLE = process.env.GOOGLE_MAPS_API_KEY ?? ''
const TTL_MS = 24 * 60 * 60 * 1000

const imageCache = new Map<string, { body: ArrayBuffer; type: string; expires: number }>()
const geoCache = new Map<string, [number, number] | null>()
const routeCache = new Map<string, string | null>()

/**
 * Place name to [lon, lat] via Mapbox geocoding.
 *
 * Takes several candidates and prefers one whose full place name actually ends
 * in the country asked for. Without that check a small village the geocoder
 * doesn't know gets matched on the country word alone — "Mohbondha, India"
 * silently returns Indiana, United States, which throws the route across the
 * planet. Comparing against the requested country catches it without needing a
 * hardcoded country list.
 */
async function geocode(place: string): Promise<[number, number] | null> {
  const key = place.toLowerCase().trim()
  if (geoCache.has(key)) return geoCache.get(key) ?? null

  const parts = place.split(',').map(s => s.trim()).filter(Boolean)
  const country = parts.length > 1 ? parts[parts.length - 1] : null

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(place)}.json`
      + `?access_token=${MAPBOX}&limit=5`
    const res = await fetch(url)
    const body = await res.json() as { features?: { center: [number, number]; place_name?: string }[] }
    const features = body.features ?? []

    let chosen = features[0] ?? null
    if (country) {
      const needle = country.toLowerCase()
      const inCountry = features.find(f => (f.place_name ?? '').toLowerCase().trim().endsWith(needle))
      if (inCountry) chosen = inCountry
      else if (features.length > 0) {
        console.warn(`[trip-map] no ${country} match for "${place}" — using ${features[0].place_name}`)
      }
    }

    const c = chosen?.center ?? null
    geoCache.set(key, c)
    return c
  } catch {
    geoCache.set(key, null)
    return null
  }
}

/**
 * Drop any point that sits absurdly far from the rest — a second guard against a
 * mis-geocode dragging the viewport (and the route) off the map.
 */
function withoutOutliers(coords: [number, number][]): [number, number][] {
  if (coords.length < 3) return coords
  const mid = (vals: number[]) => [...vals].sort((a, b) => a - b)[Math.floor(vals.length / 2)]
  const cLon = mid(coords.map(c => c[0])), cLat = mid(coords.map(c => c[1]))
  // ~15 degrees is generous for one itinerary but far short of a continent hop
  const kept = coords.filter(c => Math.abs(c[0] - cLon) < 15 && Math.abs(c[1] - cLat) < 15)
  return kept.length >= 2 ? kept : coords
}

/** Driving route through the stops in order, as an encoded polyline. */
async function drivingRoute(coords: [number, number][]): Promise<string | null> {
  if (coords.length < 2) return null
  const key = coords.map(c => c.join(',')).join(';')
  if (routeCache.has(key)) return routeCache.get(key) ?? null
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${key}`
      // 'full' returns ~24k characters, which overflows the static-image URL
      // (HTTP 414). 'simplified' is a few hundred and still follows the roads.
      + `?geometries=polyline&overview=simplified&access_token=${MAPBOX}`
    const res = await fetch(url)
    const body = await res.json() as { code?: string; routes?: { geometry?: string }[] }
    const geom = body.code === 'Ok' ? (body.routes?.[0]?.geometry ?? null) : null
    if (!geom) console.warn('[trip-map] mapbox directions:', body.code)
    routeCache.set(key, geom)
    return geom
  } catch (err) {
    console.error('[trip-map] directions failed', err)
    routeCache.set(key, null)
    return null
  }
}

/** Google fallback — attribution stays, as the licence requires. */
function googleUrl(places: string[], size: string): string {
  const STYLE = [
    'feature:all|element:labels.text.fill|color:0x5c5a48',
    'feature:all|element:labels.text.stroke|color:0xfaf6f1|weight:2',
    'feature:all|element:labels.icon|visibility:off',
    'feature:landscape|element:geometry|color:0xf2ece4',
    'feature:poi|element:all|visibility:off',
    'feature:road|element:geometry|color:0xe6ded4',
    'feature:road|element:labels|visibility:off',
    'feature:transit|element:all|visibility:off',
    'feature:water|element:geometry|color:0xd6d0c4',
  ]
  const p = new URLSearchParams()
  p.set('size', size); p.set('scale', '2'); p.set('maptype', 'terrain'); p.set('key', GOOGLE)
  for (const s of STYLE) p.append('style', s)
  places.forEach((place, i) => p.append('markers', `size:mid|color:0x706E56|label:${i + 1}|${place}`))
  if (places.length > 1) p.append('path', `color:0x706E56aa|weight:3|${places.join('|')}`)
  return `https://maps.googleapis.com/maps/api/staticmap?${p.toString()}`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('places') ?? ''

  // Both providers cap a dimension at 640 on their standard tiers and clamp
  // silently, which distorts the ratio and crops the route. Stay inside it and
  // let @2x supply the pixels: 640x280 -> 1280x560, the 16:7 .cq-frame-map wants.
  const requested = searchParams.get('size') ?? '640x280'
  const [rw, rh] = requested.split('x').map(v => parseInt(v, 10) || 0)
  const clamp = (v: number, fallback: number) => Math.min(Math.max(v || fallback, 60), 640)
  const w = clamp(rw, 640), h = clamp(rh, 280)
  const size = `${w}x${h}`

  const places = raw.split('|').map(s => s.trim()).filter(Boolean).slice(0, 12)
  if (places.length === 0) return NextResponse.json({ error: 'places required' }, { status: 400 })
  if (!MAPBOX && !GOOGLE) return NextResponse.json({ error: 'no map provider configured' }, { status: 501 })

  const cacheKey = `${size}::${places.join('|')}`
  const hit = imageCache.get(cacheKey)
  if (hit && hit.expires > Date.now()) {
    return new NextResponse(hit.body, {
      headers: { 'Content-Type': hit.type, 'Cache-Control': 'public, max-age=86400' },
    })
  }

  let url: string | null = null

  if (MAPBOX) {
    const geocoded = (await Promise.all(places.map(geocode)))
      .filter((c): c is [number, number] => Array.isArray(c))
    const coords = withoutOutliers(geocoded)
    if (coords.length > 0) {
      const overlays: string[] = []
      const route = await drivingRoute(coords)
      // Guard the URL length even so — overlays share one request line
      if (route && encodeURIComponent(route).length < 3000) {
        overlays.push(`path-4+706E56-0.9(${encodeURIComponent(route)})`)
      } else if (route) {
        console.warn('[trip-map] route polyline too long for a static URL, showing pins only')
      }
      coords.forEach((c, i) => {
        overlays.push(`pin-l-${i + 1}+706E56(${c[0].toFixed(5)},${c[1].toFixed(5)})`)
      })
      // light-v11 is the desaturated basemap — closest of the built-in styles to
      // the Milky Mist / Borges palette. outdoors-v12 carries more hillshade
      // relief, but its greens and oranges fight the brand.
      url = `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${overlays.join(',')}`
        + `/auto/${w}x${h}@2x`
        + `?access_token=${MAPBOX}&padding=70,60,70,60&attribution=false&logo=false`
    }
  }

  if (!url && GOOGLE) url = googleUrl(places, size)
  if (!url) return NextResponse.json({ error: 'could not resolve route' }, { status: 502 })

  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      console.error('[trip-map] provider returned', res.status, (await res.text()).slice(0, 200))
      return NextResponse.json({ error: 'Map unavailable' }, { status: 502 })
    }
    const body = await res.arrayBuffer()
    const type = res.headers.get('content-type') ?? 'image/png'
    imageCache.set(cacheKey, { body, type, expires: Date.now() + TTL_MS })
    return new NextResponse(body, {
      headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' },
    })
  } catch (err) {
    console.error('[trip-map] fetch failed', err)
    return NextResponse.json({ error: 'Map unavailable' }, { status: 502 })
  }
}
