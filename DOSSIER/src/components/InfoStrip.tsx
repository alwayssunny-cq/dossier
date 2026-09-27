'use client'

import { useEffect, useState } from 'react'
import { useCurrency } from '@/components/CurrencyContext'

const DEST_TZ: Record<string, { tz: string; label: string }> = {
  'united states': { tz: 'America/New_York',            label: 'New York'    },
  'usa':           { tz: 'America/Los_Angeles',          label: 'Los Angeles' },
  'los angeles':   { tz: 'America/Los_Angeles',          label: 'Los Angeles' },
  'las vegas':     { tz: 'America/Los_Angeles',          label: 'Las Vegas'   },
  'new york':      { tz: 'America/New_York',             label: 'New York'    },
  'miami':         { tz: 'America/New_York',             label: 'Miami'       },
  'chicago':       { tz: 'America/Chicago',              label: 'Chicago'     },
  'san francisco': { tz: 'America/Los_Angeles',          label: 'San Francisco'},
  'hawaii':        { tz: 'Pacific/Honolulu',             label: 'Hawaii'      },
  'australia':     { tz: 'Australia/Sydney',             label: 'Sydney'      },
  'sydney':        { tz: 'Australia/Sydney',             label: 'Sydney'      },
  'melbourne':     { tz: 'Australia/Melbourne',          label: 'Melbourne'   },
  'brisbane':      { tz: 'Australia/Brisbane',           label: 'Brisbane'    },
  'perth':         { tz: 'Australia/Perth',              label: 'Perth'       },
  'uk':            { tz: 'Europe/London',                label: 'London'      },
  'united kingdom':{ tz: 'Europe/London',                label: 'London'      },
  'london':        { tz: 'Europe/London',                label: 'London'      },
  'france':        { tz: 'Europe/Paris',                 label: 'Paris'       },
  'paris':         { tz: 'Europe/Paris',                 label: 'Paris'       },
  'italy':         { tz: 'Europe/Rome',                  label: 'Rome'        },
  'rome':          { tz: 'Europe/Rome',                  label: 'Rome'        },
  'spain':         { tz: 'Europe/Madrid',                label: 'Madrid'      },
  'germany':       { tz: 'Europe/Berlin',                label: 'Berlin'      },
  'japan':         { tz: 'Asia/Tokyo',                   label: 'Tokyo'       },
  'tokyo':         { tz: 'Asia/Tokyo',                   label: 'Tokyo'       },
  'thailand':      { tz: 'Asia/Bangkok',                 label: 'Bangkok'     },
  'bali':          { tz: 'Asia/Makassar',                label: 'Bali'        },
  'indonesia':     { tz: 'Asia/Jakarta',                 label: 'Jakarta'     },
  'singapore':     { tz: 'Asia/Singapore',               label: 'Singapore'   },
  'dubai':         { tz: 'Asia/Dubai',                   label: 'Dubai'       },
  'uae':           { tz: 'Asia/Dubai',                   label: 'Dubai'       },
  'maldives':      { tz: 'Indian/Maldives',              label: 'Maldives'    },
  'india':         { tz: 'Asia/Kolkata',                 label: 'India'       },
  'new zealand':   { tz: 'Pacific/Auckland',             label: 'Auckland'    },
  'south africa':  { tz: 'Africa/Johannesburg',          label: 'Johannesburg'},
  'kenya':         { tz: 'Africa/Nairobi',               label: 'Nairobi'     },
}

function detectTz(dest: string | null): { tz: string; label: string } | null {
  if (!dest) return null
  const lower = dest.toLowerCase()
  for (const [key, val] of Object.entries(DEST_TZ)) {
    if (lower.includes(key)) return val
  }
  return null
}

function fmtRate(n: number, code: string): string {
  if (['JPY', 'IDR', 'KRW', 'INR'].includes(code)) return Math.round(n).toLocaleString()
  return n >= 100 ? Math.round(n).toLocaleString() : n.toFixed(2)
}

const SYMBOLS: Record<string, string> = {
  USD: '$', INR: '₹', EUR: '€', GBP: '£', AUD: 'A$', JPY: '¥',
  THB: '฿', AED: 'د.إ', SGD: 'S$', CHF: 'Fr', CAD: 'C$', NZD: 'NZ$',
}

export default function InfoStrip({ destination }: { destination: string | null }) {
  const { fromCode, toCode, rates } = useCurrency()
  const [time, setTime] = useState('')
  const tzInfo = detectTz(destination)

  useEffect(() => {
    if (!tzInfo) return
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', {
      timeZone: tzInfo.tz,
      hour: 'numeric', minute: '2-digit', hour12: true,
    }))
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [tzInfo?.tz])

  const rate    = rates ? (rates[toCode] ?? 1) / (rates[fromCode] ?? 1) : null
  const toSym   = SYMBOLS[toCode] ?? toCode
  const rateStr = rate ? `1 ${fromCode} = ${toSym}${fmtRate(rate, toCode)}` : null

  const parts = [
    rateStr,
    tzInfo && time ? `${tzInfo.label} ${time}` : null,
  ].filter(Boolean)

  if (parts.length === 0) return null

  return (
    <p className="font-optima text-accent" style={{ fontSize: 'var(--text-caption)' }}>
      {parts.join(' · ')}
    </p>
  )
}
