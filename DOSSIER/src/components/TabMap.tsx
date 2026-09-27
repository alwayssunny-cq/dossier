'use client'

import { useEffect, useState } from 'react'

export interface MapPoint {
  label: string     // 1-3 chars — shown inside the pin marker
  location: string  // geocoded to coords
}

interface Props {
  points: MapPoint[]
  title: string
  height?: number
  showPath?: boolean
  googleMapsQuery?: string // if set, whole map links here
  locationContext?: string  // e.g. "Nagaland, India" — appended to every geocoded location
}

interface Coords { lat: number; lon: number }

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''
const GEO_CACHE: Record<string, Coords> = {}
const STORAGE_KEY = 'cq_geocache_mb_v2'

function loadCache(): Record<string, Coords> {
  try { const r = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null; return r ? JSON.parse(r) : {} } catch { return {} }
}
function saveCache(c: Record<string, Coords>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)) } catch {}
}

async function geocode(location: string): Promise<Coords | null> {
  const key = location.toLowerCase().trim()
  if (GEO_CACHE[key]) return GEO_CACHE[key]
  const stored = loadCache()
  if (stored[key]) { GEO_CACHE[key] = stored[key]; return stored[key] }
  try {
    const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${TOKEN}&limit=1`)
    const d = await r.json() as { features?: { center: [number, number] }[] }
    if (!d.features?.length) return null
    const [lon, lat] = d.features[0].center
    const coords: Coords = { lat, lon }
    GEO_CACHE[key] = coords; stored[key] = coords; saveCache(stored)
    return coords
  } catch { return null }
}

function encodePolylineVal(v: number): string {
  v = v < 0 ? ~(v << 1) : v << 1
  let r = ''
  while (v >= 0x20) { r += String.fromCharCode((v & 0x1f | 0x20) + 63); v >>= 5 }
  return r + String.fromCharCode(v + 63)
}
function encodePolyline(coords: Coords[]): string {
  let r = '', pLat = 0, pLon = 0
  for (const { lat, lon } of coords) {
    r += encodePolylineVal(Math.round((lat - pLat) * 1e5))
    r += encodePolylineVal(Math.round((lon - pLon) * 1e5))
    pLat = lat; pLon = lon
  }
  return r
}

function buildMapUrl(resolved: { point: MapPoint; coords: Coords }[], h: number, showPath: boolean): string {
  const pins = resolved
    .map(({ point, coords }) => {
      // pin-s-{label}+{color}({lon},{lat}) — label up to 3 chars, lowercase
      const lbl = point.label.toLowerCase().slice(0, 3).replace(/[^a-z0-9]/g, '')
      const color = 'b8956a'
      return lbl
        ? `pin-s-${lbl}+${color}(${coords.lon.toFixed(5)},${coords.lat.toFixed(5)})`
        : `pin-s+${color}(${coords.lon.toFixed(5)},${coords.lat.toFixed(5)})`
    })
    .join(',')

  const pathStr = (showPath && resolved.length >= 2)
    ? `,path-2+b8956a-0.8(${encodeURIComponent(encodePolyline(resolved.map(r => r.coords)))})`
    : ''

  const style = 'mapbox/dark-v11'
  const w = 680

  if (resolved.length === 1) {
    const { lon, lat } = resolved[0].coords
    return `https://api.mapbox.com/styles/v1/${style}/static/${pins}/${lon},${lat},10,0/${w}x${h}?access_token=${TOKEN}&attribution=false&logo=false`
  }

  return `https://api.mapbox.com/styles/v1/${style}/static/${pins}${pathStr}/auto/${w}x${h}?padding=50,40,50,40&access_token=${TOKEN}&attribution=false&logo=false`
}

export default function TabMap({ points, title, height = 240, showPath = true, googleMapsQuery, locationContext }: Props) {
  const [mapUrl, setMapUrl]   = useState<string | null>(null)
  const [failed, setFailed]   = useState(false)
  const [imgErr, setImgErr]   = useState(false)

  // Append country/region context to each location for accurate geocoding
  const enriched = locationContext
    ? points.map(p => ({ ...p, location: `${p.location}, ${locationContext}` }))
    : points

  const key = enriched.map(p => `${p.label}:${p.location}`).join('|')

  useEffect(() => {
    if (!TOKEN || !enriched.length) { setFailed(true); return }
    setMapUrl(null); setFailed(false); setImgErr(false)

    Promise.all(enriched.map(p => geocode(p.location).then(coords => coords ? { point: p, coords } : null)))
      .then(results => {
        const resolved = results.filter((r): r is { point: MapPoint; coords: Coords } => r !== null)
        if (!resolved.length) { setFailed(true); return }
        setMapUrl(buildMapUrl(resolved, height, showPath))
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (failed || imgErr) return null

  const mapsHref = googleMapsQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(googleMapsQuery)}`
    : `https://www.google.com/maps/dir/${points.map(p => encodeURIComponent(p.location)).join('/')}`

  const mapEl = (
    <div
      className="relative overflow-hidden"
      style={{ height, borderRadius: '12px', border: '0.5px solid var(--fade)' }}
    >
      {mapUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mapUrl}
            alt={title}
            className="w-full h-full object-cover"
            onError={() => setImgErr(true)}
          />
          {/* Label pill — bottom right */}
          <div
            className="absolute font-optima pointer-events-none"
            style={{
              bottom: '10px', right: '10px',
              fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
              color: 'rgba(245,243,238,0.7)',
              backgroundColor: 'rgba(28,28,26,0.75)',
              padding: '4px 10px', borderRadius: '999px',
              backdropFilter: 'blur(6px)',
            }}
          >
            {title}
          </div>
        </>
      ) : (
        <div
          className="w-full h-full"
          style={{
            backgroundColor: 'var(--color-surface-sunken)',
            animation: 'skeletonPulse 1.8s ease-in-out infinite',
          }}
        />
      )}
    </div>
  )

  return (
    <a
      href={mapsHref}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: 'block', textDecoration: 'none' }}
    >
      {mapEl}
    </a>
  )
}
