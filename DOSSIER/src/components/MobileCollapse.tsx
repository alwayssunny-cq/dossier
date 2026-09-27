'use client'

import { useEffect, useState } from 'react'

/**
 * A section the reader opens.
 *
 * Your Days stacks the daily brief, the vouchers, the concierge and the
 * recommendations under whatever is happening today. On a phone that measured
 * six screens of scrolling; on a laptop it is fewer screens but the same
 * problem — everything is present, so everything must be travelled past to
 * reach the journey itself.
 *
 * It used to be a door on a phone and always open from 768px up, on the
 * assumption that a wide screen has room for everything. It has the room; the
 * reader still has to do the walking. So it is a door at every size, drawn
 * larger on a wide screen: from 768px the title is the Tier 1 section title it
 * replaces, so opening one loses none of the page's typographic order.
 *
 * Today stays open — it is what the reader came for — and everything else
 * states what it holds and waits.
 *
 * The panel stays in the DOM when shut, so in-page links keep working and the
 * browser can still find text on the page; a link to a shut section opens it
 * on arrival.
 */
export default function MobileCollapse({
  id,
  eyebrow,
  title,
  /** Shown beside the title when shut — "4 briefings", "9 places". */
  summary,
  defaultOpen = false,
  children,
}: {
  id: string
  eyebrow?: string
  title: string
  summary?: string | null
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  // Arriving from the section index, or from a shared link, opens the door.
  useEffect(() => {
    const openIfMine = () => {
      if (window.location.hash === `#${id}`) setOpen(true)
    }
    openIfMine()
    window.addEventListener('hashchange', openIfMine)
    return () => window.removeEventListener('hashchange', openIfMine)
  }, [id])

  return (
    <section id={id}>
      {/* The disclosure pattern: the control is the heading, so a screen
          reader announces the section and its state together. */}
      <h2 style={{ margin: 0 }}>
        <button
          type="button"
          className="cq-door"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            {eyebrow && (
              <span className="cq-label" style={{ display: 'block', color: 'var(--color-text-muted)' }}>
                {eyebrow}
              </span>
            )}
            <span className="cq-door-title">{title}</span>
          </span>

          {summary && !open && (
            <span className="cq-label" style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
              {summary}
            </span>
          )}

          {/* A rotating rule rather than a chevron: the dossier draws with
              lines, and this is the same hairline its section openers use. */}
          <span
            aria-hidden
            style={{ flexShrink: 0, width: '13px', height: '13px', position: 'relative', alignSelf: 'center' }}
          >
            <span style={{
              position: 'absolute', top: '6px', left: 0, width: '13px', height: '1px',
              backgroundColor: 'var(--color-text)',
            }} />
            <span style={{
              position: 'absolute', top: '6px', left: 0, width: '13px', height: '1px',
              backgroundColor: 'var(--color-text)',
              transform: open ? 'rotate(0deg)' : 'rotate(90deg)',
              transition: 'transform var(--duration-fast) var(--ease-out)',
            }} />
          </span>
        </button>
      </h2>

      <div id={`${id}-panel`} className={open ? undefined : 'cq-shut'}>
        <div className="cq-collapse-body">{children}</div>
      </div>
    </section>
  )
}
