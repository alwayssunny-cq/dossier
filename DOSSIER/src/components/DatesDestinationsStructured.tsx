'use client'

import { useState, useEffect, useMemo } from 'react'
import MetaList from '@/components/MetaList'
import SlideRail from '@/components/SlideRail'
import type { DatesDestination } from '@/lib/types'
import { destinationImageUrl } from '@/lib/unsplash'
import { withoutEchoedTitle } from '@/lib/text'

const CARD_SHADOW = '0 2px 4px rgb(var(--night-rgb) / 0.05), 0 12px 32px rgb(var(--night-rgb) / 0.09)'
const lines = (s: string | null) => (s ?? '').split(/\n+/).map(x => x.trim()).filter(Boolean)

/**
 * Wikimedia and Pexels are served through our own cache so viewers don't hammer
 * the source, and so long-lived cache headers can be set on delivery.
 */
function viaProxy(url: string): string {
  if (/^https:\/\/(upload\.wikimedia\.org|commons\.wikimedia\.org|images\.pexels\.com)\//.test(url)) {
    return `/api/photo?url=${encodeURIComponent(url)}`
  }
  return url
}

/** Every image a row carries: pasted/uploaded gallery first, curated fallback last. */
function imagesFor(row: DatesDestination, place: string, region: string | null): string[] {
  const gallery = (row.image_urls ?? []).filter(Boolean)
  if (gallery.length > 0) return gallery.map(viaProxy)
  if (row.image_url) return [viaProxy(row.image_url)]
  return [destinationImageUrl(region, place, row.place, row.place + place, 1680, 720)]
}

/* ── The opening: theme, quote, what to expect, what it means ─────────────── */

function Overview({ row, mapImage, mapPlaces }: { row: DatesDestination; mapImage: string | null; mapPlaces: string[] }) {
  const expect = lines(row.what_to_expect)
  // An uploaded map always wins; otherwise draw the route ourselves
  const mapSrc = mapImage ?? (mapPlaces.length > 0
    ? `/api/trip-map?trip=${encodeURIComponent(row.trip_id)}&places=${encodeURIComponent(mapPlaces.join('|'))}`
    : null)
  return (
    <section style={{ marginBottom: 'var(--pad-96)' }}>
      {row.theme_intro && (
        <p className="font-optima cq-measure" style={{
          fontSize: 'var(--text-body)', lineHeight: 1.85, color: 'var(--color-text-secondary)', marginBottom: 'var(--pad-56)',
        }}>
          {row.theme_intro}
        </p>
      )}

      {/* .cq-quote carries a left rule for pull quotes set in a column. This
          one is centred and already announced by the quotation mark, so the
          rule is dropped — a centred block with a left border reads as a
          mistake. */}
      {row.pull_quote && (
        <figure style={{ margin: '0 0 var(--space-16)', textAlign: 'center' }}>
          <span
            aria-hidden="true"
            className="cq-t1"
            style={{
              color: 'var(--color-rule-strong)', lineHeight: 1,
              display: 'block', marginBottom: 'var(--space-1)',
            }}
          >
            &ldquo;
          </span>
          <blockquote
            className="cq-quote"
            style={{
              borderLeft: 'none', paddingLeft: 0,
              margin: '0 auto', maxWidth: '640px',
            }}
          >
            {row.pull_quote}
          </blockquote>
        </figure>
      )}

      {/* One system, not two.

          This was an open hairline list beside a filled, rounded, shadowed
          card — two different treatments in a single row, which is what made
          the section feel disturbed. The commentary now sits in the same quiet
          column the rest of the dossier uses: a hairline, not a container.

          The first lines of both columns also start on the same baseline now.
          Before, the card's 26px padding pushed its text below the list's
          first row, and the numerals were nudged down with a hardcoded 5px to
          fake alignment. The list is a grid aligned on the baseline instead,
          so it holds at any line-height. */}
      {(expect.length > 0 || row.what_it_means) && (
        <div
          className="grid gap-10 md:grid-cols-[minmax(0,1fr)_320px]"
          style={{ marginBottom: mapSrc ? 'var(--space-16)' : 0 }}
        >
          {expect.length > 0 && (
            <div>
              <p className="cq-label" style={{ marginBottom: 'var(--space-5)' }}>
                What to expect
              </p>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {expect.map((line, i) => (
                  <li
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2.25rem 1fr',
                      columnGap: 'var(--space-3)',
                      alignItems: 'baseline',
                      paddingTop: i === 0 ? 0 : 'var(--space-4)',
                      paddingBottom: 'var(--space-4)',
                      borderTop: i === 0 ? 'none' : '1px solid var(--color-rule)',
                    }}
                  >
                    <span className="cq-label" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="cq-body" style={{ margin: 0 }}>{line}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {row.what_it_means && (
            <aside className="cq-col-rule">
              <p className="cq-label" style={{ marginBottom: 'var(--space-5)' }}>
                What it means
              </p>
              <p className="cq-body" style={{ margin: 0 }}>{row.what_it_means}</p>
            </aside>
          )}
        </div>
      )}

      {mapSrc && (
        <figure style={{ margin: 0 }}>
          <div className="cq-frame-map" style={{
            borderRadius: '12px', overflow: 'hidden',
            border: '0.5px solid rgb(var(--borges-rgb) / 0.12)', boxShadow: CARD_SHADOW,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mapSrc} alt="Your route" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          </div>
          {mapPlaces.length > 0 && (
            <figcaption className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', marginTop: '12px' }}>
              {mapPlaces.map((p, i) => `${i + 1}. ${p.split(',')[0]}`).join('   ·   ')}
            </figcaption>
          )}
        </figure>
      )}
    </section>
  )
}

/* ── The journey, leg by leg ───────────────────────────────────────────────── */

function Journey({ legs }: { legs: DatesDestination[] }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-text)', borderRadius: '12px', overflow: 'hidden',
      boxShadow: '0 3px 8px rgb(var(--night-rgb) / 0.12), 0 18px 44px rgb(var(--night-rgb) / 0.20)',
    }}>
      {legs.map((leg, i) => (
        <div key={leg.id} style={{
          display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap',
          padding: '24px 32px',
          borderBottom: i < legs.length - 1 ? '0.5px solid rgb(var(--mist-rgb) / 0.12)' : 'none',
        }}>
          <span className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'rgb(var(--fade-rgb) / 0.78)', width: '24px', flexShrink: 0 }}>
            {String(i + 1).padStart(2, '0')}
          </span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-surface)' }}>{leg.from_location}</span>
            <svg width="22" height="8" viewBox="0 0 22 8" fill="none" style={{ flexShrink: 0 }}>
              <path d="M0 4h20M17 1l3 3-3 3" stroke="#DCD6CD" strokeOpacity="0.5" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-surface)' }}>{leg.to_location}</span>
          </div>
          {(leg.travel_time || leg.mode) && (
            <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'rgb(var(--fade-rgb) / 0.78)', flexShrink: 0 }}>
              {[leg.travel_time, leg.mode ? `by ${leg.mode.toLowerCase()}` : null].filter(Boolean).join(', ')}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── A place: heading, then its activities as a swipeable gallery ──────────── */

/** The section opener on its own — title at the top of the Seasons band, with
 *  the full-width rule that marks it as a section rather than a place. */
function PageSectionHead({ title }: { title: string }) {
  return (
    <header className="cq-section-open">
      <h2 className="cq-t1" style={{ margin: 0, color: 'var(--color-text)' }}>{title}</h2>
    </header>
  )
}

interface Slide { title: string; caption: string | null; date: string | null; src: string }

function PlaceGallery({ place, slides, order }: { place: DatesDestination; slides: Slide[]; order: number }) {
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState<Record<number, boolean>>({})

  // Clamp rather than correcting via state, so a changed slide set can't
  // trigger a second render pass.
  const i = slides.length > 0 ? Math.min(index, slides.length - 1) : 0

  useEffect(() => {
    if (slides.length < 2) return
    const near = [(i + 1) % slides.length, (i - 1 + slides.length) % slides.length]
    const warm = near.map(n => { const img = new window.Image(); img.src = slides[n].src; return img })
    return () => warm.forEach(img => { img.src = '' })
  }, [i, slides])

  if (slides.length === 0) return null
  const go = (d: number) => setIndex((i + d + slides.length) % slides.length)
  const setI = (n: number) => setIndex(n)
  const s = slides[i]
  const label = place.display_name || place.place

  return (
    <section
      style={{
        // --gap-chapter is the smallest step in the scale. Used here it put
        // two destinations 24px apart on a phone — closer together than the
        // days inside either of them — so one place's slide rail ran straight
        // into the next place's number with nothing between them. The seam
        // between destinations is the widest gap on the page, and after the
        // first it is drawn as well as spaced.
        marginBottom: 'var(--gap-section)',
        ...(order > 1 ? {
          borderTop: '1px solid var(--color-rule-strong)',
          paddingTop: 'var(--gap-section)',
          marginTop: 'var(--gap-section)',
        } : null),
      }}
    >
      {/* Place heading — one rung below the section opener above it. */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 'var(--space-6)',
        alignItems: 'start', marginBottom: 'var(--space-6)',
      }}>
        <div
          aria-hidden="true"
          style={{
            width: 'var(--chapter-gutter)', textAlign: 'right', fontFamily: 'var(--font-header)', fontWeight: 700,
            fontSize: 'var(--text-t1-sm)', lineHeight: 1.15, color: 'var(--color-rule-strong)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {String(order).padStart(2, '0')}
        </div>
        <h3 className="cq-t1-sm" style={{ margin: 0, color: 'var(--color-text)' }}>
          {label}
        </h3>
      </div>

      {/* Prose left, facts right, divided by a hairline so the blank half of
          the row reads as margin rather than as something missing. */}
      <div
        style={{ display: 'grid', gap: 'var(--space-8)', marginBottom: 'var(--space-8)' }}
        className="md:grid-cols-[minmax(0,1fr)_260px]"
      >
        <div>
          {place.description && (
            <p className="cq-body cq-measure" style={{ marginBottom: place.atmosphere ? 'var(--space-4)' : 0 }}>
              {place.description}
            </p>
          )}
          {place.atmosphere && (
            <p className="cq-body cq-measure" style={{ color: 'var(--color-text-muted)', margin: 0 }}>
              {place.atmosphere}
            </p>
          )}
        </div>

        <MetaList
          rows={[
            place.dates_label ? { label: 'Dates', value: place.dates_label } : null,
            place.duration ? { label: 'Duration', value: place.duration } : null,
            slides.length > 1 ? { label: 'Places', value: `${slides.length}` } : null,
          ]}
        />
      </div>

      {/* Gallery — one slide per activity */}
      <div style={{
        borderRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--color-surface-sunken)',
        border: '0.5px solid rgb(var(--borges-rgb) / 0.12)', boxShadow: CARD_SHADOW,
      }}>
        <div style={{ position: 'relative', backgroundColor: 'var(--color-surface-sunken)' }}>
          <div className="cq-frame" style={{ overflow: 'hidden', position: 'relative' }}>
            {failed[i] ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>Image unavailable</span>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={s.src}
                alt={s.title}
                decoding="async"
                onError={() => setFailed(f => ({ ...f, [i]: true }))}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )}
            {slides.length > 1 && (
              <>
                <button onClick={() => go(-1)} aria-label="Previous" style={{
                  position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
                  width: '44px', height: '44px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                  backgroundColor: 'rgb(var(--night-rgb) / 0.55)', color: 'var(--color-surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                    <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button onClick={() => go(1)} aria-label="Next" style={{
                  position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)',
                  width: '44px', height: '44px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                  backgroundColor: 'rgb(var(--night-rgb) / 0.55)', color: 'var(--color-surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div style={{
                  position: 'absolute', top: '16px', right: '16px', padding: '4px 11px',
                  borderRadius: '999px', backgroundColor: 'rgb(var(--night-rgb) / 0.55)',
                }}>
                  <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-surface)', letterSpacing: '0.08em' }}>
                    {i + 1} / {slides.length}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Caption — the activity, its date, its description */}
          <div className="cq-slide-caption">
            {s.date && (
              <p className="font-optima cq-slide-date" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', marginBottom: '8px' }}>
                {s.date}
              </p>
            )}
            <p className="cq-subhead cq-slide-title" style={{ fontSize: 'var(--text-subhead)', lineHeight: 1.25, marginBottom: withoutEchoedTitle(s.caption, s.title) ? '8px' : 0 }}>
              {s.title}
            </p>
            {withoutEchoedTitle(s.caption, s.title) && (
              <p className="font-optima cq-slide-text" style={{ fontSize: 'var(--text-body)', lineHeight: 1.7, maxWidth: '68ch' }}>
                {withoutEchoedTitle(s.caption, s.title)}
              </p>
            )}
          </div>

        </div>

        {/* Every stop named, the current one marked. Scrolls past five with
            an edge fade and auto-scrolls the active entry into view. */}
        <SlideRail
          items={slides.map((sl, n) => ({
            kicker: sl.date ?? `Stop ${n + 1}`,
            title: sl.title,
          }))}
          active={i}
          onSelect={setI}
        />
      </div>
    </section>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function DatesDestinationsStructured({
  rows, region,
}: {
  rows: DatesDestination[]
  region: string | null
}) {
  const { overview, destinations, activityMap, legs, mapImage, mapPlaces } = useMemo(() => {
    const overview = rows.find(r => r.row_type === 'Overview') ?? null
    const destinations = rows.filter(r => r.row_type === 'Destination')
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const legs = rows.filter(r => r.row_type === 'Transit')
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

    // The sync stores each activity at parentSort*100 + n, so an activity's
    // place is recoverable from its sort order alone.
    const activityMap = new Map<number, DatesDestination[]>()
    for (const a of rows.filter(r => r.row_type === 'Activity')) {
      const band = Math.floor((a.sort_order ?? 0) / 100)
      if (!band) continue
      const list = activityMap.get(band) ?? []
      list.push(a)
      activityMap.set(band, list)
    }
    for (const list of activityMap.values()) list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

    const mapImage = rows.find(r => r.map_image_url)?.map_image_url ?? null

    // Qualify each place with the COUNTRY only. Appending the trip's state is
    // wrong whenever an itinerary crosses a border — "Charaideo, Nagaland, India"
    // geocodes to the Nagaland centroid, while "Charaideo, India" finds the real
    // site in Assam.
    const country = (region ?? '').split(',').map(x => x.trim()).filter(Boolean).pop() ?? null
    const mapPlaces = destinations.map(d => [d.place, country].filter(Boolean).join(', '))

    return { overview, destinations, activityMap, legs, mapImage, mapPlaces }
  }, [rows, region])

  return (
    <div>
      {overview && <Overview row={overview} mapImage={mapImage} mapPlaces={mapPlaces} />}


      {destinations.length > 0 && (
        <>
          <PageSectionHead title="The Places" />

          {destinations.map((place, n) => {
            const acts = activityMap.get(place.sort_order ?? 0) ?? []
            const slides: Slide[] = acts.length > 0
              ? acts.map(a => ({
                  title: a.place,
                  caption: a.description,
                  date: a.dates_label,
                  src: imagesFor(a, place.place, region)[0],
                }))
              : imagesFor(place, place.place, region).map((src, n) => ({
                  title: place.display_name || place.place,
                  caption: n === 0 ? place.description : null,
                  date: place.dates_label,
                  src,
                }))
            return <PlaceGallery key={place.id} place={place} slides={slides} order={n + 1} />
          })}
        </>
      )}

      {legs.length > 0 && (
        <section style={{ marginBottom: 'var(--pad-96)' }}>
          <PageSectionHead title="The Route" />
          <Journey legs={legs} />
        </section>
      )}

      {(overview?.closing_note || overview?.sign_off) && (
        <section style={{ paddingTop: '16px', borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.18)' }}>
          {overview.closing_note && (
            <p className="font-optima cq-measure" style={{ fontSize: 'var(--text-body)', lineHeight: 1.8, color: 'var(--color-text-secondary)', marginTop: '32px' }}>
              {overview.closing_note}
            </p>
          )}
          {overview.sign_off && (
            <p className="cq-subhead" style={{ fontSize: 'var(--text-subhead)', color: 'var(--color-text)', marginTop: '28px' }}>
              {overview.sign_off}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
