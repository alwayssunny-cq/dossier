import { createAdminClient } from '@/lib/supabase/admin'

export interface GeoCity {
  name: string
  lat: number
  lng: number
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'cq-client-portal/1.0 (travel concierge app)'

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function nominatimLookup(name: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(name)}&format=json&limit=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate: 86400 }, // 24h Next.js fetch cache
    })
    if (!res.ok) return null
    const data = await res.json() as Array<{ lat: string; lon: string }>
    if (!data.length) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

async function getFromCache(name: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const db = createAdminClient()
    const { data } = await db
      .from('city_coordinates')
      .select('lat, lng')
      .eq('name', name.toLowerCase().trim())
      .maybeSingle()
    if (data) return { lat: data.lat as number, lng: data.lng as number }
    return null
  } catch {
    // Table may not exist yet — silent fail
    return null
  }
}

async function saveToCache(name: string, lat: number, lng: number): Promise<void> {
  try {
    const db = createAdminClient()
    await db.from('city_coordinates').upsert({
      name: name.toLowerCase().trim(),
      lat,
      lng,
      cached_at: new Date().toISOString(),
    })
  } catch {
    // Ignore — cache is best-effort
  }
}

/**
 * Geocode a single city name → { lat, lng }.
 * Checks Supabase cache first, falls back to Nominatim, stores result.
 * Returns null if the city cannot be found.
 */
export async function geocodeCity(name: string): Promise<{ lat: number; lng: number } | null> {
  const cached = await getFromCache(name)
  if (cached) return cached

  const result = await nominatimLookup(name)
  if (!result) return null

  await saveToCache(name, result.lat, result.lng)
  return result
}

/**
 * Geocode a list of city names.
 * Respects Nominatim's 1 req/s rate limit between cache misses.
 * Returns only cities that could be resolved.
 */
export async function geocodeCities(names: string[]): Promise<GeoCity[]> {
  const results: GeoCity[] = []
  let needsDelay = false

  for (const name of names) {
    // Check cache first — no delay needed for cache hits
    const cached = await getFromCache(name)
    if (cached) {
      results.push({ name, lat: cached.lat, lng: cached.lng })
      continue
    }

    // Cache miss — rate-limit Nominatim
    if (needsDelay) await sleep(1100)
    needsDelay = true

    const result = await nominatimLookup(name)
    if (result) {
      await saveToCache(name, result.lat, result.lng)
      results.push({ name, lat: result.lat, lng: result.lng })
    }
  }

  return results
}
