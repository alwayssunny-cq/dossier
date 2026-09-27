import type { ItineraryDay } from '@/components/DayByDayItinerary'

/**
 * Today, given the page.
 *
 * The version this replaces was all type: a date, two headings, and prose
 * squeezed into half the width while a tall column of label/value pairs held
 * the other half. It read as a document rather than a dossier — the brand book
 * asks for concise *and* atmospheric, and it had gone austere.
 *
 * Three things carry it now:
 *
 *   1. A photograph. The one page a traveller opens every morning had no
 *      picture on it, while the trip's own photography sat unused a click
 *      away.
 *   2. One entry point. The day is a quiet line; the thing happening is the
 *      largest type on the page. Before, the date was set bigger than the
 *      experience it contained.
 *   3. The particulars as a line, not a column. When, how long, where and the
 *      meeting point are four short facts. Standing them in a 45%-wide column
 *      wasted the width and left the prose cramped beside it.
 */

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function longDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return `${ordinal(d.getDate())} ${d.toLocaleDateString('en-GB', { month: 'long' })}`
}

export default function TodayInFull({
  day,
  city,
  /** Resolves an experience's photograph. Absent is fine. */
  imageFor,
}: {
  day: ItineraryDay | null
  city: string | null
  imageFor?: (title: string) => string | null
}) {
  if (!day) return null

  const experiences = [...day.experiences].sort(
    (a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99),
  )
  const hasAnything = experiences.length > 0 || day.stay || day.transfers.length > 0

  return (
    <section
      style={{ marginBottom: 'var(--gap-section)' }}
      aria-label={`Today — ${day.dayLabel}`}
    >
      {/* The day, stated once and quietly. It frames what follows; it is not
          the thing itself. */}
      <p className="cq-label">
        <span className="cq-mark" aria-hidden="true">✧</span>
        Today
      </p>
      <p
        className="font-optima"
        style={{
          margin: 'var(--space-2) 0 0',
          fontSize: 'var(--text-subhead)',
          color: 'var(--color-text)',
        }}
      >
        {[longDate(day.date), city].filter(Boolean).join('  ·  ')}
      </p>

      {!hasAnything && (
        <p className="cq-body cq-measure" style={{ marginTop: 'var(--gap-opening)' }}>
          Nothing scheduled — the day is yours.
        </p>
      )}

      {experiences.map((e, i) => {
        // Four short facts belong on one line, not in a column of their own.
        const facts = [e.time_of_day, e.duration, e.location].filter(Boolean).join('  ·  ')
        const shot = imageFor?.(e.title) ?? e.image_url ?? null
        // Sides alternate so two experiences in a day do not read as a form.
        const imageFirst = i % 2 === 0

        return (
          <article
            key={e.id}
            className="cq-split"
            style={{
              marginTop: i === 0 ? 'var(--gap-opening)' : 'var(--gap-chapter)',
              // Centred against the photograph: short prose top-aligned to a
              // tall image reads as dropped rather than composed.
              alignItems: 'center',
            }}
          >
            {shot && (
              <div
                style={{
                  order: imageFirst ? 0 : 1,
                  aspectRatio: '4 / 3',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  background: 'var(--color-panel)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shot}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
            )}

            <div style={{ order: imageFirst ? 1 : 0, minWidth: 0 }}>
              <p className="cq-label" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {experiences.length > 1 && `${String(i + 1).padStart(2, '0')}   `}
                {facts}
              </p>

              <h3
                className="cq-t1"
                style={{ margin: 'var(--space-3) 0 0', color: 'var(--color-text)' }}
              >
                {e.title}
              </h3>

              {e.description && (
                <p
                  className="cq-body"
                  style={{ marginTop: 'var(--space-5)', marginBottom: 0, whiteSpace: 'pre-line' }}
                >
                  {e.description}
                </p>
              )}

              {e.meeting_point && (
                <p className="cq-label" style={{ marginTop: 'var(--space-5)' }}>
                  Meet at {e.meeting_point}
                </p>
              )}
            </div>
          </article>
        )
      })}

      {/* Where you sleep and how you move — the day's closing facts, set as a
          single quiet row rather than a stack of headed pairs. */}
      {(day.stay || day.transfers.length > 0) && (
        <p
          className="cq-label"
          style={{
            marginTop: 'var(--gap-opening)',
            paddingTop: 'var(--space-6)',
            borderTop: '1px solid var(--color-rule)',
          }}
        >
          {[
            day.stay ? `Tonight, ${day.stay.property_name}` : null,
            ...day.transfers.map(t =>
              [t.from_location, t.to_location].filter(Boolean).join(' → ') || null,
            ),
          ].filter(Boolean).join('     ·     ')}
        </p>
      )}
    </section>
  )
}
