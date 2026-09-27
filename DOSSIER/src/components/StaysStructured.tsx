'use client'

import { useState, useEffect, useMemo } from 'react'
import type { Stay } from '@/lib/types'
import DestinationChapter from '@/components/DestinationChapter'
import MetaList from '@/components/MetaList'
import { stayImageUrl } from '@/lib/unsplash'
import { withoutEchoedTitle } from '@/lib/text'

const CARD_SHADOW = '0 2px 4px rgb(var(--night-rgb) / 0.05), 0 12px 32px rgb(var(--night-rgb) / 0.09)'

function fmtDay(d: string | null): string | null {
  if (!d) return null
  try {
    return new Date(d + (d.length === 10 ? 'T00:00:00' : ''))
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
  } catch { return null }
}

/** "9 – 12 May" from a check-in/check-out pair. */
function stayDates(stay: Stay): string | null {
  const inD = fmtDay(stay.check_in)
  const outD = fmtDay(stay.check_out)
  if (inD && outD) {
    const [inDay, inMonth] = inD.split(' ')
    const [, outMonth] = outD.split(' ')
    // Collapse the month when both ends share it: "9 – 12 May"
    return inMonth === outMonth ? `${inDay} – ${outD}` : `${inD} – ${outD}`
  }
  return inD ?? outD
}

function Gallery({ stay }: { stay: Stay }) {
  const srcs = useMemo(() => {
    const list = (stay.image_urls ?? []).filter(Boolean)
    if (list.length > 0) return list
    return [stayImageUrl(stay.image_url, stay.image_urls, stay.property_name, stay.destination)]
  }, [stay])

  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState<Record<number, boolean>>({})
  const i = srcs.length > 0 ? Math.min(index, srcs.length - 1) : 0

  useEffect(() => {
    if (srcs.length < 2) return
    const near = [(i + 1) % srcs.length, (i - 1 + srcs.length) % srcs.length]
    const warm = near.map(n => { const img = new window.Image(); img.src = srcs[n]; return img })
    return () => warm.forEach(img => { img.src = '' })
  }, [i, srcs])

  if (srcs.length === 0) return null
  const go = (d: number) => setIndex((i + d + srcs.length) % srcs.length)

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
            src={srcs[i]}
            alt={stay.property_name}
            decoding="async"
            onError={() => setFailed(f => ({ ...f, [i]: true }))}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
      </div>

      {srcs.length > 1 && (
        <>
          <button onClick={() => go(-1)} aria-label="Previous image" style={{
            position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
            width: '34px', height: '34px', borderRadius: '50%', border: 'none', cursor: 'pointer',
            backgroundColor: 'rgb(var(--night-rgb) / 0.55)', color: 'var(--color-surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button onClick={() => go(1)} aria-label="Next image" style={{
            position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
            width: '34px', height: '34px', borderRadius: '50%', border: 'none', cursor: 'pointer',
            backgroundColor: 'rgb(var(--night-rgb) / 0.55)', color: 'var(--color-surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div style={{
            position: 'absolute', top: '14px', right: '14px', padding: '3px 10px',
            borderRadius: '999px', backgroundColor: 'rgb(var(--night-rgb) / 0.55)',
          }}>
            <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-surface)', letterSpacing: '0.08em' }}>
              {i + 1} / {srcs.length}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * One stay: the dates and place it covers, the property, and the writing —
 * everything the CQ Stays record carries, in the dossier's card language.
 */
function StayCard({ stay, order, total }: { stay: Stay; order: number; total: number }) {
  const dates = stayDates(stay)
  const nights = stay.nights
  // meals arrives as a comma-joined string; room_features as an array
  const meals = (stay.meals ?? '').split(',').map(m => m.trim()).filter(Boolean)
  const features = (stay.room_features ?? []).filter(Boolean)

  return (
    <DestinationChapter
      index={order}
      total={total}
      place={stay.property_name}
      dates={stay.destination}
      nights={nights}
      detail={
        <div style={{
          borderRadius: '12px', overflow: 'hidden', marginBottom: 'var(--space-8)',
          border: '1px solid var(--color-rule)', boxShadow: CARD_SHADOW,
        }}>
          <Gallery stay={stay} />
        </div>
      }
    >
      {/* Prose left, the booking facts right, divided by a hairline. Nothing
          from the old card is dropped — the dateline, room, bed and meals all
          moved into the column instead of being run together into one line. */}
      <div
        style={{ display: 'grid', gap: 'var(--space-8)', marginBottom: 'var(--space-6)' }}
        className="md:grid-cols-[minmax(0,1fr)_260px]"
      >
        <div>
          {withoutEchoedTitle(stay.description, stay.property_name) ? (
            <p className="cq-body" style={{ margin: 0 }}>
              {withoutEchoedTitle(stay.description, stay.property_name)}
            </p>
          ) : null}
        </div>

        <MetaList
          rows={[
            dates ? { label: 'Dates', value: dates } : null,
            nights != null ? { label: 'Nights', value: `${nights} night${nights === 1 ? '' : 's'}` } : null,
            stay.destination ? { label: 'Where', value: stay.destination } : null,
            stay.room_type ? { label: 'Room', value: stay.room_type } : null,
            stay.bed_type ? { label: 'Bed', value: stay.bed_type } : null,
            meals.length > 0 ? { label: 'Meals', value: meals.join(', ') } : null,
          ]}
        />
      </div>

      {features.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '6px',
          paddingTop: 'var(--space-5)', borderTop: '1px solid var(--color-rule)',
        }}>
          {features.map((f, n) => (
            <span key={n} className="font-optima" style={{
              fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-accent)',
              padding: '4px 11px', borderRadius: '999px',
              backgroundColor: 'rgb(var(--borges-rgb) / 0.09)', border: '1px solid rgb(var(--borges-rgb) / 0.18)',
            }}>
              {f}
            </span>
          ))}
        </div>
      )}
    </DestinationChapter>
  )
}

export default function StaysStructured({ stays }: { stays: Stay[] }) {
  const [query, setQuery] = useState('')

  const ordered = useMemo(
    () => [...stays].sort((a, b) => {
      const ax = a.check_in ?? '', bx = b.check_in ?? ''
      if (ax !== bx) return ax.localeCompare(bx)
      return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    }),
    [stays],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ordered
    return ordered.filter(s =>
      s.property_name.toLowerCase().includes(q) ||
      (s.destination ?? '').toLowerCase().includes(q) ||
      (s.description ?? '').toLowerCase().includes(q) ||
      (stayDates(s) ?? '').toLowerCase().includes(q)
    )
  }, [ordered, query])

  if (ordered.length === 0) return null

  return (
    <div>
      <div style={{ marginBottom: '30px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          backgroundColor: 'var(--color-surface-sunken)', border: '0.5px solid rgb(var(--borges-rgb) / 0.16)',
          borderRadius: '999px', padding: '0 18px', maxWidth: '380px',
        }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
            <circle cx="6" cy="6" r="4.5" stroke="#706E56" strokeWidth="1.3"/>
            <path d="M9.5 9.5L13 13" stroke="#706E56" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <input
            aria-label="Search accommodations"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${ordered.length} accommodation${ordered.length === 1 ? '' : 's'}`}
            className="font-optima"
            style={{ flex: 1, minWidth: 0, alignSelf: 'stretch', minHeight: '44px', background: 'transparent', border: 'none', outline: 'none', fontSize: 'var(--text-caption)', color: 'var(--color-text)' }}
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 0 }}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
          Nothing matches &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <header className="cq-section-open">
            <h2 className="cq-t1" style={{ margin: 0, color: 'var(--color-text)' }}>Where You Stay</h2>
          </header>

          {filtered.map((stay, n) => (
            <StayCard key={stay.id} stay={stay} order={n + 1} total={filtered.length} />
          ))}
        </div>
      )}
    </div>
  )
}
