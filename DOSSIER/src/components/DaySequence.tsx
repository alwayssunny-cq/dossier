/**
 * One day inside a destination chapter.
 *
 * Answers the "what if a day has more than one thing on it" case directly:
 * a single event renders as a plain card, and the moment there are two or
 * more the day becomes an ordered sequence — each entry marked with when it
 * happens, joined by a connector so the order is visible rather than implied
 * by stacking.
 *
 * Events are sorted by time of day, not by the order they came out of the
 * database, so morning genuinely precedes evening.
 *
 * On a phone the day closes. A destination of eight days, each carrying a
 * photograph, ran past seven screens on its own, and the collapse one level
 * up could not help because the chapter the reader had opened was the long
 * one. The day heading keeps its label and its count, so the shape of the
 * destination is still readable while closed. Unchanged from 768px up.
 */
'use client'

import { useState } from 'react'

export interface DayItem {
  key: string
  /** "Morning", "Afternoon", "Full day" — whatever the trip data holds. */
  time: string | null
  node: React.ReactNode
}

/** Ordering for the times of day the trip data actually uses. */
const TIME_ORDER = [
  'morning', 'mid-morning', 'noon', 'afternoon', 'evening', 'night', 'full day',
]

function timeRank(t: string | null): number {
  if (!t) return TIME_ORDER.length + 1
  const l = t.toLowerCase()
  // Longest match first, so "mid-morning" is not caught by "morning".
  const hit = [...TIME_ORDER]
    .sort((a, b) => b.length - a.length)
    .find(k => l.includes(k))
  return hit ? TIME_ORDER.indexOf(hit) : TIME_ORDER.length
}

export function sortByTime<T>(items: T[], time: (x: T) => string | null): T[] {
  return [...items].sort((a, b) => timeRank(time(a)) - timeRank(time(b)))
}

export default function DaySequence({
  label,
  items,
  defaultOpen = false,
}: {
  label: string
  items: DayItem[]
  /** The first day of the opening chapter starts open. */
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  const ordered = sortByTime(items, i => i.time)
  const many = ordered.length > 1

  if (items.length === 0) return null

  const heading = (
    <>
      <h3
        className="cq-subhead"
        style={{ margin: 0, flexShrink: 0, color: 'var(--color-text)' }}
      >
        {label}
      </h3>
      <div style={{ flex: 1, height: '1px', background: 'var(--color-rule)' }} />
      {many && (
        <span className="cq-label" style={{ flexShrink: 0 }}>
          {ordered.length} experiences
        </span>
      )}
    </>
  )

  return (
    <div style={{ marginBottom: 'var(--space-10)' }}>
      {/* Day heading. Subordinate to the chapter title above it — the day is
          a subdivision, so it must not compete with the destination name. */}
      <button
        type="button"
        className="flex md:hidden"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%',
          alignItems: 'baseline',
          gap: 'var(--space-4)',
          minHeight: '44px',
          marginBottom: open ? 'var(--space-5)' : 0,
          padding: 0,
          background: 'none',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {heading}
        <span aria-hidden style={{ flexShrink: 0, width: '11px', height: '11px', position: 'relative', alignSelf: 'center' }}>
          <span style={{ position: 'absolute', top: '5px', left: 0, width: '11px', height: '1px', backgroundColor: 'var(--color-text-muted)' }} />
          <span style={{
            position: 'absolute', top: '5px', left: 0, width: '11px', height: '1px',
            backgroundColor: 'var(--color-text-muted)',
            transform: open ? 'rotate(0deg)' : 'rotate(90deg)',
            transition: 'transform var(--duration-fast) var(--ease-out)',
          }} />
        </span>
      </button>

      <div
        className="hidden md:flex"
        style={{
          alignItems: 'baseline',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-5)',
        }}
      >
        {heading}
      </div>

      {/* A single event needs no scaffolding; more than one becomes a
          sequence with its order made explicit. */}
      <div
        className={open ? undefined : 'cq-collapsed'}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}
      >
        {ordered.map((item, i) => (
          <div key={item.key}>
            {many && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  marginBottom: 'var(--space-2)',
                }}
              >
                <span
                  className="cq-label"
                  style={{
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--color-text-accent)',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                {item.time && (
                  <>
                    <span aria-hidden="true" style={{ color: 'var(--color-rule-strong)' }}>·</span>
                    <span className="cq-label">{item.time}</span>
                  </>
                )}
              </div>
            )}
            {item.node}
          </div>
        ))}
      </div>
    </div>
  )
}
