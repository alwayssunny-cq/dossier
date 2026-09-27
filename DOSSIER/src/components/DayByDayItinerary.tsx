'use client'

import { useState, useEffect, useMemo } from 'react'
import type { Experience, Stay, Transfer } from '@/lib/types'
import { experienceImageUrl, stayImageUrl } from '@/lib/unsplash'
import { imageSrc } from '@/components/GalleryCard'
import { harvestPage, alike } from '@/components/ExperiencesStructured'
import type { ParsedBlock } from '@/app/api/sync-content-pages/route'
import DestinationChapter from '@/components/DestinationChapter'
import MetaList from '@/components/MetaList'
import { withoutEchoedTitle } from '@/lib/text'

const CARD_SHADOW = '0 2px 4px rgb(var(--night-rgb) / 0.05), 0 12px 32px rgb(var(--night-rgb) / 0.09)'

export interface ItineraryDay {
  dayNumber: number
  date: string
  dayLabel: string
  city: string | null
  experiences: Experience[]
  stay: Stay | null
  transfers: Transfer[]
}

const norm = (s: string | null) => (s ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

/** Do two place names refer to the same spot? "Dimapur" vs "Dimapur Airport". */
function samePlace(a: string | null, b: string | null): boolean {
  const x = norm(a), y = norm(b)
  if (!x || !y) return false
  return x === y || x.includes(y) || y.includes(x)
}

/**
 * Transfers arrive with their own sort_order sequence, independent of
 * experiences — and legs of the same day often share a number. Chain them by
 * route instead (one leg's arrival is the next leg's departure), so a flight
 * lands before the car that leaves the airport. Falls back to sort_order when
 * the route can't be chained unambiguously.
 */
function orderTransfers(transfers: Transfer[]): Transfer[] {
  const bySort = [...transfers].sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99))
  if (bySort.length < 2) return bySort

  // A leg starts the chain when nothing else arrives where it departs from
  const starts = bySort.filter(t => !bySort.some(o => o !== t && samePlace(o.to_location, t.from_location)))
  if (starts.length !== 1) return bySort

  const chain: Transfer[] = []
  const remaining = new Set(bySort)
  let current: Transfer | undefined = starts[0]
  while (current) {
    chain.push(current)
    remaining.delete(current)
    const from: Transfer = current
    current = [...remaining].find(t => samePlace(from.to_location, t.from_location))
  }
  // Only trust the chain if it consumed every leg
  return chain.length === bySort.length ? chain : bySort
}

/** Photos for the day: its experiences first, then the stay. */

type Harvest = ReturnType<typeof harvestPage>

export interface DaySlide { src: string; kicker: string | null; title: string }

/**
 * One slide per thing that happens, rather than a flat run of photographs.
 *
 * The rail beneath the gallery names each slide, so paging forward literally
 * shows what is next in the day. A flat image list could not do that: two
 * photos of the same experience produced two indistinguishable rail entries.
 *
 * `resolve` is handed in by the page so the images come from the same synced
 * Notion content the rest of the dossier draws on, falling back to the
 * experience's own image column and only then to a generated one.
 */
function daySlides(
  day: ItineraryDay,
  fallbackCity: string | null,
  harvest?: Harvest,
): DaySlide[] {
  // Headings on the Notion page are written for a reader — "Into the Green
  // Heart of Khonoma" — while the database holds operational titles like
  // "Charaideo Moidams Visit". They rarely correspond, so a title match alone
  // finds almost nothing. The page does group its photography under day
  // headings, and that is reliable: try the title first, then draw from the
  // day's own pool.
  //
  // Images are handed out one per entry and not reused, so a day with three
  // experiences gets three different photographs instead of the same one
  // three times — which would make the rail beneath the gallery meaningless.
  const dayKey = day.date && day.date.length >= 10 ? day.date.slice(5, 10) : ''
  const pool = harvest?.byDay.get(dayKey) ?? []
  const used = new Set<ParsedBlock>()

  const fromPage = (title: string): string | null => {
    if (!harvest) return null
    for (const [heading, v] of harvest.byTitle) {
      if (v.images.length === 0 || !alike(heading, title)) continue
      const img = v.images.find(im => !used.has(im))
      if (img) { used.add(img); return imageSrc(img) }
    }
    const next = pool.find(im => !used.has(im))
    if (next) { used.add(next); return imageSrc(next) }
    return null
  }

  const out: DaySlide[] = []

  for (const e of day.experiences) {
    const src = fromPage(e.title)
      ?? experienceImageUrl(e.image_url, e.image_urls, e.title, e.location, fallbackCity)
    if (src) out.push({ src, kicker: e.time_of_day || 'Experience', title: e.title })
  }

  if (day.stay) {
    const src = fromPage(day.stay.property_name)
      ?? stayImageUrl(day.stay.image_url, day.stay.image_urls, day.stay.property_name, day.stay.destination)
    if (src) out.push({ src, kicker: 'Where you stay', title: day.stay.property_name })
  }

  return out
}

function DayCarousel({
  images, i, setI,
}: {
  images: DaySlide[]
  i: number
  setI: (n: number) => void
}) {
  const [failed, setFailed] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (images.length < 2) return
    const neighbours = [(i + 1) % images.length, (i - 1 + images.length) % images.length]
    const warm = neighbours.map(n => { const img = new window.Image(); img.src = images[n].src; return img })
    return () => warm.forEach(img => { img.src = '' })
  }, [i, images])

  if (images.length === 0) return null
  const go = (d: number) => setI((i + d + images.length) % images.length)

  return (
    <div style={{ position: 'relative', backgroundColor: 'var(--color-surface-sunken)' }}>
      <div className="cq-frame" style={{ overflow: 'hidden' }}>
        {failed[i] ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>Image unavailable</span>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={images[i].src}
            alt={images[i].title}
            decoding="async"
            onError={() => setFailed(f => ({ ...f, [i]: true }))}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
      </div>

      {/* No caption.
      
          This picture used to be captioned with the name of what it shows —
          and the rail directly beneath it names every slide, marking this one,
          and the timeline under that names them all a third time. One day's
          screen printed "Stop at Heirloom Naga Center" three times within
          184px. The rail is the caption; it is also the control. */}

      {images.length > 1 && (
        <>
          <button onClick={() => go(-1)} aria-label="Previous image" style={{
            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
            width: '32px', height: '32px', borderRadius: '50%', border: 'none', cursor: 'pointer',
            backgroundColor: 'rgb(var(--night-rgb) / 0.55)', color: 'var(--color-surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button onClick={() => go(1)} aria-label="Next image" style={{
            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
            width: '32px', height: '32px', borderRadius: '50%', border: 'none', cursor: 'pointer',
            backgroundColor: 'rgb(var(--night-rgb) / 0.55)', color: 'var(--color-surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div style={{
            position: 'absolute', top: '12px', right: '12px', padding: '3px 10px',
            borderRadius: '999px', backgroundColor: 'rgb(var(--night-rgb) / 0.55)',
          }}>
            <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-surface)', letterSpacing: '0.08em' }}>
              {i + 1} / {images.length}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

/** One entry in the day's running order. */
function Entry({
  kicker, title, meta, body, last,
}: {
  kicker: string
  title: string
  meta?: (string | null)[]
  body?: string | null
  last: boolean
}) {
  const metaLine = (meta ?? []).filter(Boolean).join(' · ')
  return (
    <div style={{ display: 'flex', gap: '18px' }}>
      {/* Spine */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: '5px' }}>
        <div style={{
          width: '7px', height: '7px', borderRadius: '50%',
          backgroundColor: 'var(--color-text-accent)', flexShrink: 0,
        }} />
        {!last && <div style={{ flex: 1, width: '0.5px', backgroundColor: 'rgb(var(--borges-rgb) / 0.25)', marginTop: '6px' }} />}
      </div>

      <div style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : '26px' }}>
        <p className="font-optima" style={{
          fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '6px',
        }}>
          {kicker}
        </p>
        <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.5, color: 'var(--color-text)', marginBottom: metaLine ? '5px' : 0 }}>
          {title}
        </p>
        {metaLine && (
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
            {metaLine}
          </p>
        )}
        {body && (
          <p className="font-optima cq-measure" style={{ fontSize: 'var(--text-body)', lineHeight: 1.75, color: 'var(--color-text-secondary)', marginTop: '8px' }}>
            {body}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * A day of the journey, told in full.
 *
 * This was a dropdown: every day collapsed behind an Open/Close control, so
 * reading the trip end to end meant clicking through it. The dossier is
 * something you read, not something you operate — the days are now always
 * open and carry the same chapter language as Dates & Destinations and
 * Experiences: a numbered landmark, a spine holding the day's contents, and
 * hierarchy from size and colour rather than from capitals.
 */
function DayChapter({
  day, fallbackCity, total, harvest,
}: {
  day: ItineraryDay
  fallbackCity: string | null
  total: number
  harvest?: Harvest
}) {
  const slides = useMemo(() => daySlides(day, fallbackCity, harvest), [day, fallbackCity, harvest])
  const [slide, setSlide] = useState(0)
  const at = slides.length > 0 ? Math.min(slide, slides.length - 1) : 0

  // Experiences first, then the journey between places, and the stay closes
  // it — the order the dossier reads in.
  const timeline = useMemo(() => [
    ...[...day.experiences]
      .sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99))
      .map(e => ({ kind: 'exp' as const, data: e })),
    ...orderTransfers(day.transfers).map(t => ({ kind: 'trf' as const, data: t })),
  ], [day])

  const count = timeline.length + (day.stay ? 1 : 0)

  return (
    <DestinationChapter
      index={day.dayNumber}
      total={total}
      place={day.dayLabel}
      dates={day.city}
      nights={null}
      detail={
        slides.length > 0 ? (
          <div style={{
            borderRadius: '12px', overflow: 'hidden', marginBottom: 'var(--space-8)',
            border: '1px solid var(--color-rule)', boxShadow: CARD_SHADOW,
            backgroundColor: 'var(--color-surface-sunken)',
          }}>
            <DayCarousel images={slides} i={at} setI={setSlide} />
            {/* No named strip here.
            
                The rail names every slide — "Morning · Stop at Heirloom Naga
                Center" — and the timeline directly beneath it names the same
                things again, in full, with their places, times and prose. The
                rail earns its place on Dates & Destinations, where it is the
                only index of the pictures; here the day itself is the index,
                and the carousel keeps its arrows and its counter for anyone
                who just wants to look. */}
          </div>
        ) : null
      }
    >
      {count === 0 ? (
        <p className="cq-body" style={{ margin: 0 }}>
          Nothing scheduled — the day is yours.
        </p>
      ) : (
        <div
          style={{ display: 'grid', gap: 'var(--space-8)', marginBottom: 'var(--space-6)' }}
          className="lg:grid-cols-[minmax(0,1fr)_240px]"
        >
        <div>
          {timeline.map((item, i) => {
            const isLast = i === timeline.length - 1 && !day.stay
            if (item.kind === 'exp') {
              const e = item.data
              return (
                <Entry
                  key={`e-${e.id}`}
                  kicker={e.time_of_day || 'Experience'}
                  title={e.title}
                  meta={[e.location, e.duration, e.meeting_point ? `Meet at ${e.meeting_point}` : null]}
                  body={withoutEchoedTitle(e.description, e.title)}
                  last={isLast}
                />
              )
            }
            const t = item.data
            const route = [t.from_location, t.to_location].filter(Boolean).join(' → ')
            return (
              <Entry
                key={`t-${t.id}`}
                kicker={t.transfer_mode || 'Transfer'}
                title={route || 'Transfer'}
                meta={[t.carrier, t.duration]}
                body={t.notes}
                last={isLast}
              />
            )
          })}

          {day.stay && (
            <Entry
              kicker="Where you stay"
              title={day.stay.property_name}
              meta={[day.stay.destination, day.stay.room_type]}
              body={day.stay.description}
              last
            />
          )}
        </div>

        {/* The day at a glance, against a hairline, so the wide right-hand
            margin carries something instead of sitting blank. */}
        {/* Counts only.
        
            This carried "Where: Kohima" while the day's own heading said
            Kohima, and "Stay: Niraamaya Retreats" while the timeline below
            listed that stay in full — so a glance at the day repeated two
            things the reader could already see. What it can say that nothing
            else does is how much the day holds. */}
        <MetaList
          rows={[
            day.experiences.length > 0
              ? { label: 'Experiences', value: `${day.experiences.length}` } : null,
            day.transfers.length > 0
              ? { label: 'Transfers', value: `${day.transfers.length}` } : null,
          ]}
        />
        </div>
      )}
    </DestinationChapter>
  )
}

export default function DayByDayItinerary({
  days, fallbackCity, blocks = [],
}: {
  days: ItineraryDay[]
  fallbackCity: string | null
  /**
   * Parsed blocks from the trip's synced Notion pages. The in-full journey is
   * the current iteration seen whole, so it should show the same photographs
   * the reader already met in Experiences and Stays rather than generating its
   * own — generated images made the same trip look like two different trips.
   */
  blocks?: ParsedBlock[]
}) {
  // Harvest once for the whole journey rather than per day.
  const harvest = useMemo<Harvest | undefined>(() => {
    if (blocks.length === 0) return undefined
    const h = harvestPage(blocks)
    return h.byTitle.size > 0 || h.byDay.size > 0 ? h : undefined
  }, [blocks])

  if (days.length === 0) return null
  return (
    <div>
      {days.map(day => (
        <DayChapter
          key={day.date}
          day={day}
          fallbackCity={fallbackCity}
          total={days.length}
          harvest={harvest}
        />
      ))}
    </div>
  )
}
