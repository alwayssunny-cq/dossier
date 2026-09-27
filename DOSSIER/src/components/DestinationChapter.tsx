/**
 * A destination reads as a chapter, not as another card in a stream.
 *
 * The problem this solves: destination blocks, day headings and experience
 * cards all carried similar visual weight, so a reader scrolling the page had
 * no way to tell where one destination ended and the next began — everything
 * flowed at the same pitch.
 *
 * Three things create the separation:
 *
 *   1. A chapter opener with the number set large enough to be a landmark, so
 *      the eye can find "where does 2 start" while scrolling fast.
 *   2. A spine — a hairline running down the left of everything belonging to
 *      the chapter. Containment is shown, not implied. It stops at the last
 *      day, which is what makes the chapter's end legible.
 *   3. Asymmetric spacing. Days inside a chapter sit close together; the gap
 *      between chapters is far larger. Proximity does the grouping work before
 *      any border is noticed — but only if the two gaps actually differ. This
 *      used --gap-chapter, the SMALLEST step in the scale, to separate one
 *      chapter from the next, so on a phone consecutive destinations sat 24px
 *      apart: closer together than the days inside them. Everything ran into
 *      everything, which is exactly what it looked like.
 *
 *   4. On a phone the chapter head pins under the top bar while you are inside
 *      that chapter, the way a section header behaves in a native list. Scroll
 *      through eight days of Charaideo and the screen keeps saying Charaideo.
 *
 * No capitals anywhere. Hierarchy comes from size, weight and colour.
 *
 * On a phone the chapter also closes. Eight destinations of days and galleries
 * measured almost nine screens of scrolling, and a reader looking for the last
 * one had to travel through the other seven. Below 768px every chapter after
 * the first is a door: the number, the place and the dates stay visible, so
 * the shape of the whole journey is readable in a screen or two, and the one
 * you want opens where you are. The spine, the gutter and the spacing are
 * untouched from 768px up.
 */
'use client'

import { useState } from 'react'

interface Props {
  index: number
  total: number
  place: string
  dates: string | null
  nights: number | null
  /** The chapter head's right column — description, transfers, whatever fits. */
  detail?: React.ReactNode
  /** Days and their cards, rendered on the spine. */
  children: React.ReactNode
}

export default function DestinationChapter({
  index, total, place, dates, nights, detail, children,
}: Props) {
  const meta = [
    dates,
    nights != null ? `${nights} night${nights === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join('  ·  ')

  // The first chapter is where the journey starts, so it is already open.
  const [open, setOpen] = useState(index === 1)

  // One definition, rendered by both the phone's button and the desktop's
  // header, so the two can never drift apart.
  const opener = (
    <>
      <div
        style={{
          width: 'var(--chapter-gutter)',
          textAlign: 'right',
          fontFamily: 'var(--font-header)',
          fontWeight: 700,
          fontSize: 'var(--text-t1)',
          lineHeight: 1,
          color: 'var(--color-rule-strong)',
          fontVariantNumeric: 'tabular-nums',
        }}
        aria-hidden="true"
      >
        {String(index).padStart(2, '0')}
      </div>
      <div style={{ minWidth: 0 }}>
        <h2 className="cq-t2" style={{ color: 'var(--color-text)', margin: 0 }}>
          {place}
        </h2>
        {meta && (
          <p className="cq-label" style={{ marginTop: 'var(--space-2)' }}>
            {meta}
          </p>
        )}
      </div>
    </>
  )

  return (
    <section
      style={{
        // The gap that separates one chapter from the next. Deliberately far
        // larger than the spacing between days inside a chapter.
        // The largest step in the scale, not the smallest: this is the seam
        // between two destinations and must read as wider than anything inside
        // either of them.
        marginBottom: 'var(--gap-section)',
        // Space alone was not reading as a seam. Between one destination's
        // slide rail and the next destination's number there was a gap and
        // nothing else, so the two ran together — a reader scrolling past had
        // no mark saying "that chapter ended, this one begins". Every chapter
        // after the first opens on a rule that spans the column, with the gap
        // above it, so the boundary is drawn rather than implied.
        ...(index > 1 ? {
          borderTop: '1px solid var(--color-rule-strong)',
          paddingTop: 'var(--gap-section)',
          marginTop: 'var(--gap-section)',
        } : null),
        scrollMarginTop: 'calc(var(--header-h) + var(--space-8))',
      }}
      aria-label={`Destination ${index} of ${total}: ${place}`}
    >
      {/* ── Chapter opener, phone: the header opens the chapter ────────── */}
      <button
        type="button"
        className="grid md:hidden"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={`chapter-${index}-body`}
        style={{
          width: '100%',
          position: 'sticky',
          top: 'var(--tripbar-h)',
          zIndex: 15,
          gridTemplateColumns: 'auto 1fr auto',
          columnGap: 'var(--space-5)',
          alignItems: 'start',
          textAlign: 'left',
          backgroundColor: 'var(--color-surface)',
          border: 'none',
          padding: 'var(--space-4) 0 var(--space-4)',
          borderBottom: '1px solid var(--color-rule-strong)',
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {opener}
        <span aria-hidden style={{ width: '13px', height: '13px', position: 'relative', marginTop: '8px' }}>
          <span style={{ position: 'absolute', top: '6px', left: 0, width: '13px', height: '1px', backgroundColor: 'var(--color-text)' }} />
          <span style={{
            position: 'absolute', top: '6px', left: 0, width: '13px', height: '1px',
            backgroundColor: 'var(--color-text)',
            transform: open ? 'rotate(0deg)' : 'rotate(90deg)',
            transition: 'transform var(--duration-fast) var(--ease-out)',
          }} />
        </span>
      </button>

      {/* ── Chapter opener, tablet and up ──────────────────────────────── */}
      <header
        className="hidden md:grid"
        style={{
          gridTemplateColumns: 'auto 1fr',
          columnGap: 'var(--space-6)',
          alignItems: 'start',
          paddingBottom: 'var(--space-6)',
          borderBottom: '1px solid var(--color-rule-strong)',
        }}
      >
        {/* The number is the landmark, aligned to the spine that runs beneath
            it so the two read as one structure. Tier 1's lower step carries
            the place: same face as the section above, one size down. */}
        {opener}
      </header>

      {/* ── Chapter body, held by the spine ────────────────────────────── */}
      <div
        id={`chapter-${index}-body`}
        className={open ? undefined : 'cq-collapsed'}
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          columnGap: 'var(--space-6)',
        }}
      >
        {/* The spine. Sits under the number, runs the height of the chapter. */}
        <div style={{ width: 'var(--chapter-gutter)', display: 'flex', justifyContent: 'flex-end' }} aria-hidden="true">
          <div style={{ width: '1px', height: '100%', background: 'var(--color-rule)' }} />
        </div>

        <div style={{ minWidth: 0, paddingTop: 'var(--space-6)' }}>
          {detail}
          {children}
        </div>
      </div>
    </section>
  )
}
