'use client'

import { useState, useMemo } from 'react'
import type { Recommendation } from '@/lib/types'
import { withoutEchoedTitle } from '@/lib/text'

const CATEGORIES = ['Food & Drinks', 'Shopping', 'Other']

/**
 * A recommendation, set open on the page.
 *
 * This was a filled panel with a border and a corner radius, run to the full
 * width of the shell to hold one line of description. Ninety-four of those
 * panels across the dossier is why it reads heavier than the references: a
 * filled surface is the loudest thing on a page of quiet type, and using one
 * as the default container means everything shouts equally.
 *
 * A place is a name, a sentence and two facts. It needs a hairline and some
 * air, not a container.
 */
function PlaceRow({ place, last }: { place: Recommendation; last: boolean }) {
  const facts = [place.timings].filter(Boolean) as string[]

  return (
    <li
      style={{
        // One column, not two.
        //
        // The particulars used to sit in a 7rem column at the right margin.
        // On a phone that put "Daytime" and "Map" level with the top of a
        // four-line description and hard against the opposite edge, so they
        // read as loose furniture rather than as facts about the place beside
        // them. They sit under the description now, where proximity does the
        // job the column was meant to do.
        listStyle: 'none',
        paddingBlock: 'var(--space-6)',
        borderBottom: last ? 'none' : '1px solid var(--color-rule-strong)',
      }}
    >
      <p
        className="font-optima"
        style={{ margin: 0, fontSize: 'var(--text-subhead)', color: 'var(--color-text)' }}
      >
        {place.name}
      </p>

      {(() => {
        // Descriptions from Notion often open by restating the name directly
        // above them. Printed as written that is the same words twice.
        const body = withoutEchoedTitle(place.description, place.name)
        return body ? (
          <p className="cq-body cq-measure" style={{ margin: 'var(--space-2) 0 0' }}>
            {body}
          </p>
        ) : null
      })()}

      {(facts.length > 0 || place.map_link) && (
        <p
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0 var(--space-4)',
            margin: 'var(--space-3) 0 0',
          }}
        >
          {facts.length > 0 && (
            <span className="cq-label" style={{ color: 'var(--color-text-muted)' }}>
              {facts.join('  ·  ')}
            </span>
          )}
          {place.map_link && (
            <a
              href={place.map_link}
              target="_blank"
              rel="noopener noreferrer"
              className="cq-label"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: '44px',
                color: 'var(--color-text-accent)',
                textDecoration: 'none',
              }}
            >
              <span style={{ borderBottom: '1px solid var(--color-rule-strong)' }}>
                Map
              </span>
            </a>
          )}
        </p>
      )}
    </li>
  )
}


export default function RecommendsSection({ places }: { places: Recommendation[] }) {
  const [filter, setFilter] = useState<string | null>(null)

  const presentCategories = useMemo(
    () => CATEGORIES.filter(c => places.some(p => (p.category ?? 'Other') === c)),
    [places],
  )

  const filtered = filter ? places.filter(p => (p.category ?? 'Other') === filter) : places

  const byCategory = useMemo(() => {
    const groups: Record<string, Record<string, Recommendation[]>> = {}
    for (const p of filtered) {
      const cat = p.category ?? 'Other'
      const dest = p.destination ?? 'Nearby'
      if (!groups[cat]) groups[cat] = {}
      if (!groups[cat][dest]) groups[cat][dest] = []
      groups[cat][dest].push(p)
    }
    return groups
  }, [filtered])

  if (places.length === 0) {
    return (
      <p className="cq-body cq-measure" style={{ margin: 0 }}>
        Your designer&rsquo;s picks for this destination are being prepared.
      </p>
    )
  }

  return (
    <div>
      {presentCategories.length > 1 && (
        <div style={{ display: 'flex', gap: 'var(--space-6)', marginBottom: 'var(--gap-opening)', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilter(null)}
            className="font-optima"
            style={{
              fontSize: 'var(--text-caption)', letterSpacing: '0.01em', cursor: 'pointer',
              // 16x23 before, which is smaller than the fingertip aiming at it.
              display: 'inline-flex', alignItems: 'center', minHeight: '44px',
              padding: '0 4px', background: 'none', border: 'none',
              color: filter === null ? 'var(--color-text)' : 'var(--color-text-muted)',
            }}
          >
            <span style={{ paddingBottom: '2px', borderBottom: `1px solid ${filter === null ? 'var(--color-text)' : 'transparent'}` }}>
              All
            </span>
          </button>
          {presentCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className="font-optima"
              style={{
                fontSize: 'var(--text-caption)', letterSpacing: '0.01em', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', minHeight: '44px',
                padding: '0 4px', background: 'none', border: 'none',
                color: filter === cat ? 'var(--color-text)' : 'var(--color-text-muted)',
              }}
            >
              <span style={{ paddingBottom: '2px', borderBottom: `1px solid ${filter === cat ? 'var(--color-text)' : 'transparent'}` }}>
                {cat}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Each category is a group, and a group needs an edge.
          
          The label used to float above its places with nothing under it, so
          "Food & Drinks" read as another line in the stream rather than as the
          head of everything beneath it — and where one category ended and the
          next began was left entirely to white space. The label now sits on a
          rule that spans the column, which is the same opener the rest of the
          dossier uses for a section, and carries how many places it holds. */}
      {Object.entries(byCategory).map(([cat, destinations], c) => {
        const count = Object.values(destinations).reduce((n, items) => n + items.length, 0)
        return (
          <section
            key={cat}
            style={{
              marginTop: c === 0 ? 0 : 'var(--gap-section)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 'var(--space-4)',
                paddingBottom: 'var(--space-3)',
                borderBottom: '1px solid var(--color-text)',
              }}
            >
              <p className="cq-label" style={{ margin: 0, color: 'var(--color-text)' }}>
                <span className="cq-mark" aria-hidden="true">✧</span>
                {cat}
              </p>
              <p className="cq-label" style={{ margin: 0, color: 'var(--color-text-muted)' }}>
                {count} {count === 1 ? 'place' : 'places'}
              </p>
            </div>

            {(() => {
              const groups = Object.entries(destinations)
              // The last row in the whole category, so the rules run
              // continuously between places and stop once, at the end.
              const lastId = groups.at(-1)?.[1].at(-1)?.id
              return groups.map(([dest, items]) => {
                // A destination heading that its only place already contains
                // is not a heading, it is the same words twice: "Dzukou
                // Valley" over "Dzukou Valley", "Kohima" over "Kohima War
                // Cemetery". Shown only where it tells the reader something
                // the names beneath it do not.
                const redundant = items.every(it =>
                  (it.name ?? '').toLowerCase().includes(dest.toLowerCase()))
                const showDest = groups.length > 1 && !redundant
                return (
                  <div key={dest} style={{ marginTop: showDest ? 'var(--space-6)' : 0 }}>
                    {showDest && (
                      <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                        {dest}
                      </p>
                    )}
                    <ul style={{ margin: 0, padding: 0 }}>
                      {items.map(place => (
                        <PlaceRow key={place.id} place={place} last={place.id === lastId} />
                      ))}
                    </ul>
                  </div>
                )
              })
            })()}
          </section>
        )
      })}
    </div>
  )
}
