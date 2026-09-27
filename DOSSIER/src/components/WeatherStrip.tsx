'use client'

import { useEffect, useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface WeatherDay { date: string; maxC: number; minC: number; code: number }
interface CachedWeather { data: Record<string, WeatherDay>; ts: number }

const CACHE_TTL = 60 * 60 * 1000

// ── Geocoding (Mapbox, shared localStorage cache with MapEmbed) ───────────────

const GEO_CACHE_KEY = 'cq_geocache_mb'
const GEO_MEM: Record<string, { lat: number; lon: number }> = {}
const TOKEN = typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '') : ''

function loadGeoCache(): Record<string, { lat: number; lon: number }> {
  try { return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) ?? '{}') } catch { return {} }
}

async function geocode(location: string): Promise<{ lat: number; lon: number } | null> {
  const key = location.toLowerCase().trim()
  if (GEO_MEM[key]) return GEO_MEM[key]
  const stored = loadGeoCache()
  if (stored[key]) { GEO_MEM[key] = stored[key]; return stored[key] }
  if (!TOKEN) return null
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${TOKEN}&limit=1`
    const d = await fetch(url).then(r => r.json()) as { features?: { center: [number, number] }[] }
    if (!d.features?.length) return null
    const [lon, lat] = d.features[0].center
    const coords = { lat, lon }
    GEO_MEM[key] = coords
    stored[key] = coords
    try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(stored)) } catch {}
    return coords
  } catch { return null }
}

// ── Weather fetch ──────────────────────────────────────────────────────────────

function wxCacheKey(location: string) {
  return `wx2_${location.toLowerCase().replace(/\W+/g, '_')}`
}

async function fetchWeather(location: string, date: string): Promise<WeatherDay | null> {
  // 1. localStorage cache
  const key = wxCacheKey(location)
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const c = JSON.parse(raw) as CachedWeather
      if (Date.now() - c.ts < CACHE_TTL && c.data[date]) return c.data[date]
    }
  } catch {}

  // 2. Geocode
  const coords = await geocode(location)
  if (!coords) return null
  const { lat, lon } = coords

  // 3. Pick endpoint based on date
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dateObj = new Date(date + 'T00:00:00')
  const daysAhead = Math.round((dateObj.getTime() - today.getTime()) / 86_400_000)

  let fetchDate = date
  let base: string
  if (daysAhead <= 0) {
    // Past: archive API
    base = 'https://archive-api.open-meteo.com/v1/archive'
  } else if (daysAhead <= 14) {
    // Near future: forecast API
    base = 'https://api.open-meteo.com/v1/forecast'
  } else {
    // Far future: archive same date 1 year ago as approximation
    const lastYear = new Date(dateObj)
    lastYear.setFullYear(lastYear.getFullYear() - 1)
    fetchDate = lastYear.toISOString().slice(0, 10)
    base = 'https://archive-api.open-meteo.com/v1/archive'
  }

  try {
    const url = `${base}?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weathercode,weather_code&start_date=${fetchDate}&end_date=${fetchDate}&timezone=auto`
    const d = await fetch(url).then(r => r.json()) as {
      daily?: {
        time: string[]
        temperature_2m_max: (number | null)[]
        temperature_2m_min: (number | null)[]
        weathercode?: (number | null)[]
        weather_code?: (number | null)[]
      }
    }
    if (!d.daily?.time.length) return null

    const rawMax = d.daily.temperature_2m_max[0]
    const rawMin = d.daily.temperature_2m_min[0]
    // Guard against null/NaN from the API
    if (rawMax == null || rawMin == null || !isFinite(rawMax) || !isFinite(rawMin)) return null

    const rawCode = (d.daily.weathercode ?? d.daily.weather_code ?? [])[0] ?? 0

    const result: WeatherDay = {
      date,
      maxC: Math.round(rawMax),
      minC: Math.round(rawMin),
      code: rawCode ?? 0,
    }

    // Write to cache
    try {
      const raw = localStorage.getItem(key)
      const existing: CachedWeather = raw ? JSON.parse(raw) : { data: {}, ts: Date.now() }
      if (Date.now() - existing.ts > CACHE_TTL) existing.data = {}
      existing.data[date] = result
      existing.ts = Date.now()
      localStorage.setItem(key, JSON.stringify(existing))
    } catch {}

    return result
  } catch { return null }
}

// ── WMO code → style ───────────────────────────────────────────────────────────

function wmoInfo(code: number): { label: string; bucket: 'sunny' | 'cloudy' | 'rain' | 'snow' | 'storm' } {
  if (code === 0)         return { label: 'Clear sky',     bucket: 'sunny' }
  if (code <= 2)          return { label: 'Partly cloudy', bucket: 'cloudy' }
  if (code <= 3)          return { label: 'Overcast',      bucket: 'cloudy' }
  if (code <= 48)         return { label: 'Foggy',         bucket: 'cloudy' }
  if (code <= 57)         return { label: 'Drizzle',       bucket: 'rain' }
  if (code <= 67)         return { label: 'Rain',          bucket: 'rain' }
  if (code <= 77)         return { label: 'Snow',          bucket: 'snow' }
  if (code <= 82)         return { label: 'Rain showers',  bucket: 'rain' }
  if (code <= 86)         return { label: 'Snow showers',  bucket: 'snow' }
  return                         { label: 'Thunderstorm',  bucket: 'storm' }
}

// Weather used to be hue-coded — amber sun, blue rain, violet storm — none of
// which exist in the palette. The icon already says which weather it is, so
// the buckets now share one surface and separate by tone: clear weather sits
// light, the storm sits at full ink.
const BUCKET_STYLE = {
  sunny:  { bg: 'var(--color-surface-sunken)', border: 'var(--color-rule)', text: 'var(--color-text-secondary)', accent: 'var(--color-text-accent)' },
  cloudy: { bg: 'var(--color-surface-sunken)', border: 'var(--color-rule)', text: 'var(--color-text-secondary)', accent: 'var(--color-text-muted)' },
  rain:   { bg: 'var(--color-surface-sunken)', border: 'var(--color-rule)', text: 'var(--color-text-secondary)', accent: 'var(--color-text-secondary)' },
  snow:   { bg: 'var(--color-surface-sunken)', border: 'var(--color-rule)', text: 'var(--color-text-secondary)', accent: 'var(--color-text-muted)' },
  storm:  { bg: 'var(--color-surface-sunken)', border: 'var(--color-rule)', text: 'var(--color-text)',           accent: 'var(--color-text)' },
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

function WeatherIcon({ bucket, size = 22 }: { bucket: keyof typeof BUCKET_STYLE; size?: number }) {
  // Icons inherit their colour so the tokens resolve as CSS, not as SVG
  // presentation attributes, where var() is unreliable.
  const c = 'currentColor'
  const tone = BUCKET_STYLE[bucket].accent
  const s = size
  if (bucket === 'sunny') return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none" style={{ color: tone }}>
      <circle cx="14" cy="14" r="5.5" fill={c}/>
      {[0,45,90,135,180,225,270,315].map(deg => {
        const r = (deg * Math.PI) / 180
        return <line key={deg} x1={14+8*Math.cos(r)} y1={14+8*Math.sin(r)} x2={14+11*Math.cos(r)} y2={14+11*Math.sin(r)} stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      })}
    </svg>
  )
  if (bucket === 'cloudy') return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none" style={{ color: tone }}>
      <circle cx="11" cy="14" r="5" fill={c} opacity="0.5"/>
      <circle cx="17" cy="13" r="6" fill={c} opacity="0.7"/>
      <rect x="6" y="16" width="16" height="6" rx="3" fill={c}/>
    </svg>
  )
  if (bucket === 'rain') return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none" style={{ color: tone }}>
      <circle cx="10" cy="12" r="4" fill={c} opacity="0.6"/>
      <circle cx="16" cy="11" r="5.5" fill={c} opacity="0.8"/>
      <rect x="5" y="14" width="18" height="5" rx="2.5" fill={c}/>
      <line x1="9" y1="21" x2="8" y2="24" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="14" y1="21" x2="13" y2="24" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="19" y1="21" x2="18" y2="24" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
  if (bucket === 'snow') return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none" style={{ color: tone }}>
      <circle cx="10" cy="12" r="4" fill={c} opacity="0.6"/>
      <circle cx="16" cy="11" r="5.5" fill={c} opacity="0.8"/>
      <rect x="5" y="14" width="18" height="5" rx="2.5" fill={c}/>
      {[9,14,19].map(x => <circle key={x} cx={x} cy="23" r="1.2" fill={c} opacity="0.7"/>)}
    </svg>
  )
  return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none" style={{ color: tone }}>
      <circle cx="10" cy="11" r="4.5" fill={c} opacity="0.6"/>
      <circle cx="17" cy="10" r="6" fill={c} opacity="0.8"/>
      <rect x="5" y="13" width="18" height="5" rx="2.5" fill={c}/>
      <path d="M15 19l-3 5h3l-2 4" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ── Timezone mapping ───────────────────────────────────────────────────────────

const TZ_MAP: Record<string, string> = {
  // USA
  'las vegas': 'America/Los_Angeles', 'los angeles': 'America/Los_Angeles',
  'san francisco': 'America/Los_Angeles', 'seattle': 'America/Los_Angeles',
  'new york': 'America/New_York', 'miami': 'America/New_York',
  'boston': 'America/New_York', 'washington': 'America/New_York',
  'chicago': 'America/Chicago', 'denver': 'America/Denver',
  'phoenix': 'America/Phoenix', 'hawaii': 'Pacific/Honolulu',
  // Canada
  'toronto': 'America/Toronto', 'vancouver': 'America/Vancouver',
  'montreal': 'America/Toronto',
  // Europe
  'london': 'Europe/London', 'edinburgh': 'Europe/London', 'dublin': 'Europe/Dublin',
  'paris': 'Europe/Paris', 'lyon': 'Europe/Paris',
  'rome': 'Europe/Rome', 'milan': 'Europe/Rome', 'venice': 'Europe/Rome', 'florence': 'Europe/Rome',
  'amsterdam': 'Europe/Amsterdam', 'brussels': 'Europe/Brussels',
  'barcelona': 'Europe/Madrid', 'madrid': 'Europe/Madrid',
  'berlin': 'Europe/Berlin', 'munich': 'Europe/Berlin', 'hamburg': 'Europe/Berlin',
  'vienna': 'Europe/Vienna', 'salzburg': 'Europe/Vienna',
  'prague': 'Europe/Prague', 'budapest': 'Europe/Budapest',
  'zurich': 'Europe/Zurich', 'geneva': 'Europe/Zurich',
  'athens': 'Europe/Athens', 'santorini': 'Europe/Athens', 'mykonos': 'Europe/Athens',
  'istanbul': 'Europe/Istanbul',
  'stockholm': 'Europe/Stockholm', 'oslo': 'Europe/Oslo', 'copenhagen': 'Europe/Copenhagen',
  // Middle East
  'dubai': 'Asia/Dubai', 'abu dhabi': 'Asia/Dubai', 'sharjah': 'Asia/Dubai',
  'doha': 'Asia/Qatar', 'riyadh': 'Asia/Riyadh', 'kuwait': 'Asia/Kuwait',
  'amman': 'Asia/Amman', 'petra': 'Asia/Amman', 'beirut': 'Asia/Beirut',
  // Asia
  'tokyo': 'Asia/Tokyo', 'osaka': 'Asia/Tokyo', 'kyoto': 'Asia/Tokyo',
  'singapore': 'Asia/Singapore',
  'bangkok': 'Asia/Bangkok', 'phuket': 'Asia/Bangkok', 'chiang mai': 'Asia/Bangkok',
  'bali': 'Asia/Makassar', 'jakarta': 'Asia/Jakarta',
  'ho chi minh': 'Asia/Ho_Chi_Minh', 'hanoi': 'Asia/Bangkok',
  'kuala lumpur': 'Asia/Kuala_Lumpur',
  'hong kong': 'Asia/Hong_Kong',
  'beijing': 'Asia/Shanghai', 'shanghai': 'Asia/Shanghai',
  'seoul': 'Asia/Seoul', 'busan': 'Asia/Seoul',
  'taipei': 'Asia/Taipei',
  // India
  'mumbai': 'Asia/Kolkata', 'delhi': 'Asia/Kolkata', 'new delhi': 'Asia/Kolkata',
  'bangalore': 'Asia/Kolkata', 'bengaluru': 'Asia/Kolkata',
  'chennai': 'Asia/Kolkata', 'hyderabad': 'Asia/Kolkata',
  'kolkata': 'Asia/Kolkata', 'goa': 'Asia/Kolkata',
  'jaipur': 'Asia/Kolkata', 'agra': 'Asia/Kolkata', 'udaipur': 'Asia/Kolkata',
  // Oceania
  'sydney': 'Australia/Sydney', 'melbourne': 'Australia/Melbourne',
  'brisbane': 'Australia/Brisbane', 'perth': 'Australia/Perth',
  'auckland': 'Pacific/Auckland', 'queenstown': 'Pacific/Auckland',
  // Africa
  'cape town': 'Africa/Johannesburg', 'johannesburg': 'Africa/Johannesburg',
  'nairobi': 'Africa/Nairobi', 'cairo': 'Africa/Cairo',
  'marrakech': 'Africa/Casablanca', 'casablanca': 'Africa/Casablanca',
  // South America
  'sao paulo': 'America/Sao_Paulo', 'rio de janeiro': 'America/Sao_Paulo',
  'buenos aires': 'America/Argentina/Buenos_Aires',
  'lima': 'America/Lima', 'bogota': 'America/Bogota',
  // Other
  'maldives': 'Indian/Maldives', 'male': 'Indian/Maldives',
  'colombo': 'Asia/Colombo', 'kathmandu': 'Asia/Kathmandu',
  'cancun': 'America/Cancun', 'mexico city': 'America/Mexico_City',
}

export function getTimezone(location: string): string | null {
  const lower = location.toLowerCase().trim()
  if (TZ_MAP[lower]) return TZ_MAP[lower]
  for (const [key, tz] of Object.entries(TZ_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return tz
  }
  return null
}

// ── WeatherBadge ──────────────────────────────────────────────────────────────

export function WeatherBadge({ location, date }: { location: string; date: string }) {
  const [wx, setWx] = useState<WeatherDay | null>(null)

  useEffect(() => {
    setWx(null)
    fetchWeather(location, date).then(setWx)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, date])

  if (!wx) return null

  const { label } = wmoInfo(wx.code)

  // Minimal inline: "22° Overcast" — no card, no icon
  return (
    <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
      {wx.maxC}° {label}
    </span>
  )
}

// ── LocalTimeBadge ────────────────────────────────────────────────────────────

export function LocalTimeBadge({ location }: { location: string }) {
  const tz = getTimezone(location)
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
    if (!tz) return
    function tick() {
      try {
        setTime(new Intl.DateTimeFormat('en-US', {
          timeZone: tz!,
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).format(new Date()))
      } catch {}
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [tz])

  if (!time) return null

  return (
    <span className="inline-flex items-center gap-1 font-optima ml-2 mt-1.5" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', letterSpacing: '0.01em' }}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <circle cx="5" cy="5" r="4" stroke="#6B696C" strokeWidth="1"/>
        <path d="M5 2.5V5l1.5 1" stroke="#6B696C" strokeWidth="0.9" strokeLinecap="round"/>
      </svg>
      {time}
    </span>
  )
}
