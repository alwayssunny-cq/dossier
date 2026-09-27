/**
 * A section opener — the one the whole dossier uses.
 *
 * Sections and the places inside them were both set at Tier 1, so a heading
 * like "Where You're Going" and the place directly beneath it rendered at the
 * same size and the page lost its ladder. The opener takes the top of the
 * Seasons band and the places take the bottom, and the opener carries a
 * full-width rule that the places do not — so the eye can tell a section from
 * a thing inside a section without measuring type.
 *
 * There were four of these: this one, ZoneHeader on the dashboard, SectionTitle
 * on Your Days, and a bare h2 with a hand-drawn rule in a handful of other
 * files. Four expressions of one idea is most of why the dossier read as a
 * stack of pages rather than one document, so the others now delegate here.
 *
 * On eyebrows: an editorial one is welcome — "In motion", "The road ahead" —
 * because it frames what follows. An instructional one is not. "Swipe through
 * each place" tells the reader how to operate the page, and the dossier does
 * not explain itself.
 */

/**
 * The opener alone, for callers whose content follows as a sibling rather than
 * as children. Same markup, same rhythm — it simply does not wrap what comes
 * after it, so the gap beneath stays the opening gap and not the section gap.
 */
export function SectionOpen({
  index,
  eyebrow,
  title,
  aside,
  lead,
  mark = true,
}: {
  /** Rendered zero-padded when present. */
  index?: number
  /** Editorial framing, never an instruction. */
  eyebrow?: string
  title: React.ReactNode
  /** A quiet fact that belongs to the section, set to the right of the rule. */
  aside?: React.ReactNode
  /** One quiet line beneath the title, when the section genuinely needs it. */
  lead?: React.ReactNode
  /** The ✧. On by default; off where a section wants no ornament at all. */
  mark?: boolean
}) {
  const marker = [
    index != null ? String(index).padStart(2, '0') : null,
    eyebrow,
  ].filter(Boolean).join('   ')

  return (
    <header className="cq-section-open">
        {(marker || aside) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 'var(--space-4)',
              marginBottom: 'var(--space-3)',
            }}
          >
            <p className="cq-label" style={{ fontVariantNumeric: 'tabular-nums', margin: 0 }}>
              {mark && <span className="cq-mark" aria-hidden="true">✧</span>}
              {marker}
            </p>
            {aside && (
              <>
                <span style={{ flex: 1 }} />
                <span className="cq-label" style={{ flexShrink: 0 }}>{aside}</span>
              </>
            )}
          </div>
        )}

        {/* One rung below the page's own title, which is Tier 1 proper. When
            both sat at --text-t1 the dashboard showed seven headings at the
            same size and nothing said which was the page and which were its
            parts. */}
        <h2 className="cq-t1-sm" style={{ margin: 0, color: 'var(--color-text)' }}>
          {title}
        </h2>

        {lead && (
          <p
            className="cq-body cq-measure"
            style={{ marginTop: 'var(--space-4)', marginBottom: 0 }}
          >
            {lead}
          </p>
        )}

      {/* The rule and the opening gap come from .cq-section-open, so every
          section in the dossier resolves to the same rhythm. */}
    </header>
  )
}

export default function PageSection({
  id,
  children,
  ...open
}: React.ComponentProps<typeof SectionOpen> & {
  id?: string
  children?: React.ReactNode
}) {
  return (
    <section
      id={id}
      style={{
        marginBottom: 'var(--gap-section)',
        scrollMarginTop: 'calc(var(--header-h) * 2 + var(--space-8))',
      }}
    >
      <SectionOpen {...open} />
      {children}
    </section>
  )
}

/**
 * A sub-section opener — one rung down.
 *
 * Nine places drew the same thing by hand: a subhead with a hairline trailing
 * off to the right. It is a legitimate level of the ladder, below the Tier 1
 * section opener and above a plain heading, so it gets a component rather than
 * being promoted into something it is not.
 */
export function SubSectionOpen({
  title,
  aside,
}: {
  title: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}
    >
      <h3 className="cq-subhead" style={{ margin: 0, flexShrink: 0 }}>{title}</h3>
      <span style={{ flex: 1, height: '1px', background: 'var(--color-rule)' }} />
      {aside && <span className="cq-label" style={{ flexShrink: 0 }}>{aside}</span>}
    </div>
  )
}
