'use client'

import { useEffect, useState } from 'react'

interface Coords { lat: number; lon: number }

const TOKEN      = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''
const GEO_CACHE: Record<string, Coords> = {}
const STORAGE_KEY = 'cq_geocache_mb'

function loadStorageCache(): Record<string, Coords> {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : {} } catch { return {} }
}
function saveStorageCache(c: Record<string, Coords>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)) } catch {}
}

async function geocode(location: string): Promise<Coords | null> {
  const key = location.toLowerCase().trim()
  if (GEO_CACHE[key]) return GEO_CACHE[key]
  const stored = loadStorageCache()
  if (stored[key]) { GEO_CACHE[key] = stored[key]; return stored[key] }
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${TOKEN}&limit=1`
    const r = await fetch(url)
    const d = await r.json() as { features?: { center: [number, number] }[] }
    if (!d.features?.length) return null
    const [lon, lat] = d.features[0].center
    const coords: Coords = { lat, lon }
    GEO_CACHE[key] = coords; stored[key] = coords; saveStorageCache(stored)
    return coords
  } catch { return null }
}

// Encodes a [lat, lon] sequence into a Google-style encoded polyline
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

function buildUrl(coords: Coords[]): string {
  const pins = coords
    .map(c => `pin-s+3b4a3a(${c.lon.toFixed(5)},${c.lat.toFixed(5)})`)
    .join(',')

  if (coords.length === 1) {
    const { lon, lat } = coords[0]
    return `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/${pins}/${lon},${lat},8,0/680x300?access_token=${TOKEN}&attribution=false&logo=false`
  }

  const polyline = encodeURIComponent(encodePolyline(coords))
  const path     = `path-1.5+b8956a-0.8(${polyline})`
  return `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/${pins},${path}/auto/680x300?padding=50,40,50,40&access_token=${TOKEN}&attribution=false&logo=false`
}

export default function TripOverviewMap({ locations }: { locations: string[] }) {
  const [mapUrl, setMapUrl]   = useState<string | null>(null)
  const [failed, setFailed]   = useState(false)
  const [imgError, setImgError] = useState(false)

  const key = locations.join('|')

  useEffect(() => {
    if (!TOKEN || !locations.length) { setFailed(true); return }
    setMapUrl(null); setFailed(false); setImgError(false)

    Promise.all(locations.map(geocode)).then(results => {
      const coords = results.filter((c): c is Coords => c !== null)
      if (!coords.length) { setFailed(true); return }
      setMapUrl(buildUrl(coords))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (failed || imgError) return null

  if (!mapUrl) {
    return (
      <div
        className="w-full"
        style={{
          height: '300px',
          borderRadius: '12px',
          border: '0.5px solid var(--fade)',
          backgroundColor: 'var(--color-surface-sunken)',
          animation: 'skeletonPulse 1.8s ease-in-out infinite',
        }}
      />
    )
  }

  return (
    <div
      className="overflow-hidden"
      style={{
        borderRadius: '12px',
        border: '0.5px solid var(--fade)',
        height: '300px',
        position: 'relative',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mapUrl}
        alt="Trip route overview"
        className="w-full h-full object-cover"
        onError={() => setImgError(true)}
      />
      {/* Subtle label */}
      <div
        className="absolute font-optima"
        style={{
          bottom: '10px',
          right: '10px',
          fontSize: 'var(--text-caption)',
          letterSpacing: '0.01em',
          color: 'rgba(8,7,14,0.55)',
          backgroundColor: 'rgba(255,255,255,0.82)',
          padding: '4px 10px',
          borderRadius: '999px',
        }}
      >
        Journey Overview
      </div>
    </div>
  )
}
