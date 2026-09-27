'use client'

import { useEffect, useState } from 'react'

const DEST_TZ: Record<string, string> = {
  'united states': 'America/New_York',
  'usa':           'America/Los_Angeles',
  'las vegas':     'America/Los_Angeles',
  'los angeles':   'America/Los_Angeles',
  'new york':      'America/New_York',
  'miami':         'America/New_York',
  'chicago':       'America/Chicago',
  'san francisco': 'America/Los_Angeles',
  'hawaii':        'Pacific/Honolulu',
  'australia':     'Australia/Sydney',
  'sydney':        'Australia/Sydney',
  'melbourne':     'Australia/Melbourne',
  'brisbane':      'Australia/Brisbane',
  'uk':            'Europe/London',
  'united kingdom':'Europe/London',
  'france':        'Europe/Paris',
  'germany':       'Europe/Berlin',
  'italy':         'Europe/Rome',
  'spain':         'Europe/Madrid',
  'europe':        'Europe/Paris',
  'japan':         'Asia/Tokyo',
  'thailand':      'Asia/Bangkok',
  'bali':          'Asia/Makassar',
  'indonesia':     'Asia/Jakarta',
  'singapore':     'Asia/Singapore',
  'dubai':         'Asia/Dubai',
  'uae':           'Asia/Dubai',
  'maldives':      'Indian/Maldives',
  'india':         'Asia/Kolkata',
}

export function detectTz(dest: string | null): { tz: string; label: string } | null {
  if (!dest) return null
  const lower = dest.toLowerCase()
  for (const [key, tz] of Object.entries(DEST_TZ)) {
    if (lower.includes(key)) {
      // Get the city/region label
      const city = key.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
      return { tz, label: city }
    }
  }
  return null
}

export default function LocalTimeWidget({ destination }: { destination: string | null }) {
  const result = detectTz(destination)
  const [time, setTime] = useState('')

  const tz = result?.tz
  useEffect(() => {
    if (!tz) return
    const update = () => {
      setTime(new Date().toLocaleTimeString('en-US', {
        timeZone: tz,
        hour: 'numeric', minute: '2-digit', hour12: true,
      }))
    }
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [tz])

  if (!result || !time) return null

  // Inline text — no icons, no wrapper div — just a span for use in the strip
  return (
    <span className="font-optima text-caption text-ink-muted">
      {result.label} {time}
    </span>
  )
}
