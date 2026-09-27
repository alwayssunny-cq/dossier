'use client'

import { useEffect, useState } from 'react'
import { detectTz } from '@/components/LocalTimeWidget'

/**
 * The date, and the two clocks that matter: where the reader is, and where
 * they are going.
 *
 * The date beside it used to be rendered on the server, which meant it showed
 * the server's day rather than the reader's — wrong for anyone far enough east
 * or west, and wrong for exactly the audience this is built for. Everything
 * here is computed in the browser.
 *
 * When both zones are the same — a client in India travelling to Nagaland —
 * showing the same time twice under two labels is noise, so it collapses to a
 * single clock.
 */
export default function DualClock({ destination }: { destination: string | null }) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    // The first read is scheduled rather than run in the effect body: a
    // synchronous setState there triggers a second render pass before paint.
    const tick = () => setNow(new Date())
    const first = requestAnimationFrame(tick)
    const id = setInterval(tick, 30_000)
    return () => { cancelAnimationFrame(first); clearInterval(id) }
  }, [])

  // Nothing until mounted: the server has no way to know the reader's zone,
  // so rendering a guess only to correct it would flash the wrong time.
  if (!now) return null

  const here = Intl.DateTimeFormat().resolvedOptions().timeZone
  const there = detectTz(destination)

  const fmtTime = (tz: string) =>
    now.toLocaleTimeString('en-GB', {
      timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true,
    }).toLowerCase()

  const date = now.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const sameZone = !there || there.tz === here
  const parts = sameZone
    ? [date, fmtTime(here)]
    : [date, `Your time ${fmtTime(here)}`, `${there.label} ${fmtTime(there.tz)}`]

  return (
    <p
      className="font-optima"
      style={{
        fontSize: 'var(--text-caption)',
        letterSpacing: '0.01em',
        color: 'var(--color-text-muted)',
        fontVariantNumeric: 'tabular-nums',
        textAlign: 'right',
      }}
    >
      {parts.join('  ·  ')}
    </p>
  )
}
