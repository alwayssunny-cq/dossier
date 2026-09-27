'use client'

import { useEffect, useState } from 'react'

interface Props {
  location: string
  height?: number
}

interface Coords { lat: number; lon: number }

// Module-level cache — persists across re-renders, cleared on page refresh
const GEO_CACHE: Record<string, Coords> = {}
const STORAGE_KEY = 'cq_geocache_mb'

function loadStorageCache(): Record<string, Coords> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveStorageCache(cache: Record<string, Coords>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cache)) } catch {}
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

async function geocode(location: string): Promise<Coords | null> {
  const key = location.toLowerCase().trim()

  // 1. Module cache (fastest)
  if (GEO_CACHE[key]) return GEO_CACHE[key]

  // 2. localStorage cache
  const stored = loadStorageCache()
  if (stored[key]) { GEO_CACHE[key] = stored[key]; return stored[key] }

  // 3. Mapbox Geocoding API
  try {
    const encoded = encodeURIComponent(location)
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${TOKEN}&limit=1`
    const r = await fetch(url)
    const d = await r.json() as { features?: { center: [number, number] }[] }
    if (!d.features?.length) return null
    const [lon, lat] = d.features[0].center
    const coords: Coords = { lat, lon }
    GEO_CACHE[key] = coords
    stored[key] = coords
    saveStorageCache(stored)
    return coords
  } catch { return null }
}

function mapboxStaticUrl(coords: Coords, width = 600, height = 200): string {
  const { lat, lon } = coords
  const pin = `pin-s+b8956a(${lon},${lat})`
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${pin}/${lon},${lat},12,0/${width}x${height}?access_token=${TOKEN}&attribution=false&logo=false`
}

function googleMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
}

export default function MapEmbed({ location, height = 200 }: Props) {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setCoords(null)
    setFailed(false)
    if (!TOKEN) { setFailed(true); return }
    geocode(location).then(c => {
      if (c) setCoords(c)
      else setFailed(true)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location])

  if (failed) {
    return (
      <a
        href={googleMapsUrl(location)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 font-optima transition-colors hover:opacity-80"
        style={{
          height,
          borderRadius: '12px',
          border: '0.5px solid rgba(112,110,86,0.14)',
          backgroundColor: 'var(--color-surface-sunken)',
          display: 'flex',
          fontSize: 'var(--text-caption)',
          color: 'var(--color-text-accent)',
          textDecoration: 'none',
        }}
      >
        View {location} on map →
      </a>
    )
  }

  if (!coords) {
    return (
      <div
        className="w-full"
        style={{
          height,
          borderRadius: '12px',
          border: '0.5px solid rgba(112,110,86,0.10)',
          backgroundColor: 'var(--color-surface-sunken)',
          animation: 'skeletonPulse 1.8s ease-in-out infinite',
        }}
      />
    )
  }

  const imgSrc = mapboxStaticUrl(coords, 680, height)

  return (
    <a
      href={googleMapsUrl(location)}
      target="_blank"
      rel="noopener noreferrer"
      className="block relative overflow-hidden"
      style={{ height, borderRadius: '12px', border: '0.5px solid rgba(112,110,86,0.10)' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgSrc}
        alt={`Map of ${location}`}
        className="w-full h-full object-cover"
        style={{ display: 'block' }}
        onError={() => setFailed(true)}
      />
      <div
        className="absolute font-optima"
        style={{
          bottom: '8px',
          right: '8px',
          fontSize: 'var(--text-caption)',
          letterSpacing: '0.01em',
          color: 'rgba(245,243,238,0.7)',
          backgroundColor: 'rgba(28,28,26,0.75)',
          padding: '3px 8px',
          borderRadius: '999px',
          backdropFilter: 'blur(6px)',
        }}
      >
        Open in Maps ↗
      </div>
    </a>
  )
}
