'use client'

import { useEffect, useState } from 'react'

function utcOffsetMinutes(tz: string, date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date)
  const map: Record<string, string> = {}
  for (const p of parts) map[p.type] = p.value
  const asUTC = Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour, +map.minute, +map.second)
  return (asUTC - date.getTime()) / 60000
}

/** Renders the live time difference between the viewer's browser timezone and
 *  a destination's IANA timezone — e.g. "10h 30m ahead of you". */
export default function TimeDifference({ destinationTz }: { destinationTz: string }) {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    const compute = () => {
      const now       = new Date()
      const viewerTz   = Intl.DateTimeFormat().resolvedOptions().timeZone
      const diffMinutes = utcOffsetMinutes(destinationTz, now) - utcOffsetMinutes(viewerTz, now)

      if (Math.abs(diffMinutes) < 1) { setLabel('Same time as you'); return }

      const hours = Math.floor(Math.abs(diffMinutes) / 60)
      const mins  = Math.round(Math.abs(diffMinutes) % 60)
      const magnitude = [hours > 0 ? `${hours}h` : null, mins > 0 ? `${mins}m` : null].filter(Boolean).join(' ')
      setLabel(`${magnitude} ${diffMinutes > 0 ? 'ahead of' : 'behind'} you`)
    }
    compute()
    const id = setInterval(compute, 60_000)
    return () => clearInterval(id)
  }, [destinationTz])

  return <>{label ?? '—'}</>
}
