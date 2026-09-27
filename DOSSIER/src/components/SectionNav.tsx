'use client'

import { useEffect, useState } from 'react'

/**
 * A sticky index for a long page.
 *
 * Your Days stacks the daily brief, vouchers, concierge requests and
 * recommendations one after another. Everything was reachable and nothing was
 * findable — reaching the vouchers meant scrolling past the whole brief and
 * recognising it on the way past.
 *
 * This sits under the header and names the sections, marking whichever one you
 * are in. Entries whose section has no content are never rendered, so the nav
 * never offers a destination that turns out to be empty.
 */

export interface NavSection {
  id: string
  label: string
  /** Skipped entirely when false — an empty section is not worth a link. */
  present: boolean
}

export default function SectionNav({ sections }: { sections: NavSection[] }) {
  const live = sections.filter(s => s.present)
  const [active, setActive] = useState(live[0]?.id ?? '')

  useEffect(() => {
    if (live.length < 2) return
    const nodes = live
      .map(s => document.getElementById(s.id))
      .filter((n): n is HTMLElement => !!n)
    if (nodes.length === 0) return

    // Mark the heading nearest the top of the viewport rather than whatever
    // happens to be intersecting — with tall sections several qualify at once.
    const io = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-25% 0px -65% 0px', threshold: 0 },
    )
    nodes.forEach(n => io.observe(n))
    return () => io.disconnect()
  }, [live])

  if (live.length < 2) return null

  return (
    <nav
      aria-label="Sections on this page"
      // Hidden on phones. Every section below is a titled row you open, so
      // the page already has an index — this was a second, worse copy of it,
      // and the only element still running off the right edge.
      className="scrollbar-hide hidden md:flex"
      style={{
        position: 'sticky',
        // Clears the trip layout's sticky tab bar. At top:0 it sat behind the
        // bar (z-30 over z-20) and cut through the heading underneath.
        // --header-h is the trip layout's sticky tab bar, which on a phone is
        // no longer at the top of the screen — the variable resolves to 0
        // there, so this sits flush instead of floating below a gap.
        top: 'var(--header-h)',
        zIndex: 20,
        gap: 'var(--space-6)',
        overflowX: 'auto',
        padding: 'var(--space-4) 0',
        // Room at the end for the floating dock, which is fixed over this
        // corner: without it the last entry could never be tapped.
        scrollPaddingInlineEnd: 'var(--space-16)',
        paddingInlineEnd: 'var(--space-16)',
        marginBottom: 'var(--gap-opening)',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-rule)',
      }}
    >
      {live.map(s => {
        const current = s.id === active
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            aria-current={current ? 'true' : undefined}
            className="font-optima"
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              // The words are the same size; the link around them is now tall
              // enough to hit. These were 21px high on a phone.
              minHeight: '44px',
              fontSize: 'var(--text-caption)',
              lineHeight: 1.4,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              color: current ? 'var(--color-text)' : 'var(--color-text-muted)',
              transition: 'color var(--duration-fast) var(--ease-out)',
            }}
          >
            {/* The marker is a rule under the word, not a pill around it — the
                page already has enough enclosed shapes. It rides on the span
                so it stays tight to the text inside the taller target. */}
            <span
              style={{
                paddingBottom: '2px',
                borderBottom: `1px solid ${current ? 'var(--color-text)' : 'transparent'}`,
              }}
            >
              {s.label}
            </span>
          </a>
        )
      })}
    </nav>
  )
}
