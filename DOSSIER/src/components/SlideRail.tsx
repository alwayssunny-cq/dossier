'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The named strip beneath a gallery — every slide listed, the current one
 * marked, each one telling you what comes next.
 *
 * The interesting case is what happens past four or five entries. The rail
 * this replaces was `overflow-x: auto` with no affordance at all: with eight
 * or ten stops, entries five onward simply sat off the edge with nothing to
 * suggest they existed. Three things fix that, in order of how much they
 * matter:
 *
 *   1. Below the threshold the entries share the width evenly, so a short
 *      journey looks composed rather than crammed to one side.
 *   2. Above it the rail scrolls, and the active entry is scrolled into view
 *      whenever it changes — so paging with the arrows always keeps the
 *      current stop visible without the reader having to chase it.
 *   3. A fade at whichever edge has more content behind it. This is the part
 *      that was missing: an edge that dissolves reads as "keeps going",
 *      where a hard cut reads as "ends here".
 *
 * The counter above the rail carries the total, so the scale of the journey
 * is known before any scrolling happens.
 */

export interface RailItem {
  /** Small line above the title — a date, a time of day, a leg number. */
  kicker?: string | null
  title: string
}

/** A stop's name needs about this much width to survive two lines. */
const MIN_ENTRY = 140

export default function SlideRail({
  items,
  active,
  onSelect,
}: {
  items: RailItem[]
  active: number
  onSelect: (index: number) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: false, end: false })

  // Whether the rail scrolls is a question about width, not about how many
  // entries there are. Four stops divided across a 350px phone gave each 87px,
  // and every name came out as "Charaid eo…" — the rail stopped naming things
  // while still reporting that it fitted. Entries now claim a readable width
  // and the rail scrolls when they no longer fit, at any screen size.
  const [scrolls, setScrolls] = useState(false)
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const measure = () => setScrolls(items.length * MIN_ENTRY > el.clientWidth + 1)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [items.length])

  // Keep the current entry in view when the image is paged from elsewhere.
  useEffect(() => {
    if (!scrolls) return
    const el = scroller.current?.children[active] as HTMLElement | undefined
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [active, scrolls])

  // Which edges still have content behind them.
  useEffect(() => {
    const el = scroller.current
    if (!el || !scrolls) return
    const read = () => {
      const max = el.scrollWidth - el.clientWidth
      setEdges({ start: el.scrollLeft > 4, end: el.scrollLeft < max - 4 })
    }
    read()
    el.addEventListener('scroll', read, { passive: true })
    window.addEventListener('resize', read)
    return () => {
      el.removeEventListener('scroll', read)
      window.removeEventListener('resize', read)
    }
  }, [scrolls, items.length])

  if (items.length < 2) return null

  // A fade on the side that has more to show. Both sides can be lit at once.
  const mask = !scrolls || (!edges.start && !edges.end)
    ? undefined
    : `linear-gradient(to right, ${
        edges.start ? 'transparent, black 48px' : 'black 0'
      }, ${
        edges.end ? 'black calc(100% - 48px), transparent' : 'black 100%'
      })`

  return (
    <div style={{ borderTop: '1px solid var(--color-rule)' }}>
      <div
        ref={scroller}
        className="scrollbar-hide"
        style={{
          display: 'flex',
          overflowX: scrolls ? 'auto' : 'hidden',
          scrollSnapType: scrolls ? 'x proximity' : undefined,
          WebkitMaskImage: mask,
          maskImage: mask,
        }}
      >
        {items.map((item, n) => {
          const current = n === active
          return (
            <button
              key={n}
              onClick={() => onSelect(n)}
              aria-current={current ? 'true' : undefined}
              aria-label={`Show ${item.title}`}
              style={{
                // Divide the width when short; keep a readable width when long.
                flex: scrolls ? `0 0 ${MIN_ENTRY}px` : '1 1 0',
                minWidth: scrolls ? `${MIN_ENTRY}px` : 0,
                scrollSnapAlign: 'start',
                textAlign: 'left',
                cursor: 'pointer',
                padding: 'var(--space-4) var(--space-5)',
                border: 'none',
                borderRight: n < items.length - 1 ? '1px solid var(--color-rule)' : 'none',
                // The marker sits on top, where it reads as a tab rather than
                // as an underline belonging to the row beneath.
                borderTop: `2px solid ${current ? 'var(--color-text)' : 'transparent'}`,
                backgroundColor: current ? 'rgb(var(--borges-rgb) / 0.07)' : 'transparent',
                transition: 'background-color var(--duration-fast) var(--ease-out)',
              }}
            >
              {item.kicker && (
                <span className="cq-label" style={{ display: 'block', marginBottom: '2px' }}>
                  {item.kicker}
                </span>
              )}
              <span
                className="font-optima"
                style={{
                  fontSize: 'var(--text-caption)',
                  lineHeight: 1.4,
                  color: current ? 'var(--color-text)' : 'var(--color-text-accent)',
                  fontWeight: current ? 700 : 400,
                  // Two lines, not one with an ellipsis. Sharing a 350px card
                  // between two stops gives each about 170px, and at caption
                  // size "Stop at Heirloom Naga Center" needs more than that —
                  // so every entry was cut to "Stop at Heirloom…" and the rail
                  // stopped naming the thing it exists to name.
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                }}
              >
                {item.title}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
