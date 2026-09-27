'use client'

import { useState, useMemo, useEffect } from 'react'
import { SubSectionOpen } from '@/components/PageSection'
import type { ParsedBlock } from '@/app/api/sync-content-pages/route'
import { collectImages, imageSrc } from '@/components/GalleryCard'

const CARD_SHADOW = '0 2px 4px rgb(var(--night-rgb) / 0.05), 0 12px 32px rgb(var(--night-rgb) / 0.09)'

const txt = (b: ParsedBlock): string =>
  (b.richText ?? []).map(r => r.text ?? '').join('') || (b.text ?? '')

const flatten = (b: ParsedBlock): ParsedBlock[] => {
  const out: ParsedBlock[] = []
  const walk = (n: ParsedBlock | ParsedBlock[] | undefined) => {
    if (!n) return
    if (Array.isArray(n)) return n.forEach(walk)
    out.push(n)
    ;(n.children ?? []).forEach(walk)
  }
  ;(b.children ?? []).forEach(walk)
  return out
}

interface Place {
  date: string | null
  name: string
  duration: string | null
  summary: string | null
  detail: string[]
  bullets: string[]
  images: ParsedBlock[]
}

function parse(blocks: ParsedBlock[]) {
  const firstH1 = blocks.findIndex(b => b.type === 'heading' && b.level === 1)
  const leading = firstH1 === -1 ? blocks : blocks.slice(0, firstH1)

  // The route map the team uploads sits among the leading blocks
  const mapImage = leading.find(b => b.type === 'image') ?? null

  // Overview cards: date + "Place | duration" + blurb
  const overview: Place[] = []
  for (const cl of leading.filter(b => b.type === 'column_list')) {
    const flat = flatten(cl)
    const heads = flat.filter(b => b.type === 'heading').map(txt).map(s => s.trim()).filter(Boolean)
    const paras = flat.filter(b => b.type === 'paragraph').map(txt).map(s => s.trim()).filter(Boolean)
    if (heads.length < 2) continue
    const [name, duration] = heads[1].split('|').map(s => s.trim())
    overview.push({
      date: heads[0] || null,
      name: name || heads[1],
      duration: duration || null,
      summary: paras[0] ?? null,
      detail: [],
      bullets: [],
      images: [],
    })
  }

  // Per-destination sections carry the full writing and imagery
  const sections: { title: string; content: ParsedBlock[] }[] = []
  let current: { title: string; content: ParsedBlock[] } | null = null
  for (const b of (firstH1 === -1 ? [] : blocks.slice(firstH1))) {
    if (b.type === 'heading' && b.level === 1) {
      if (current) sections.push(current)
      current = { title: txt(b).trim(), content: [] }
    } else if (current) current.content.push(b)
  }
  if (current) sections.push(current)

  // Merge section detail into the matching overview card
  for (const place of overview) {
    const match = sections.find(s => s.title.toLowerCase() === place.name.toLowerCase())
    if (!match) continue
    place.detail = match.content
      .filter(b => b.type === 'paragraph')
      .map(txt).map(s => s.trim()).filter(Boolean)
    // Notion writes the destination notes as bullets
    place.bullets = match.content
      .filter(b => b.type === 'bullet' || b.type === 'bulleted_list_item')
      .map(txt).map(s => s.trim()).filter(Boolean)
    place.images = collectImages(match.content)
  }

  // Anything that isn't a destination — Summary, closing note
  const placeNames = new Set(overview.map(p => p.name.toLowerCase()))
  const others = sections.filter(s => !placeNames.has(s.title.toLowerCase()))

  // The Summary section is the journey itself: from → to, duration, mode
  const summarySection = others.find(s => /^summary$/i.test(s.title))
  const legs: { from: string; to: string; detail: string | null }[] = []
  if (summarySection) {
    for (const cl of summarySection.content.filter(b => b.type === 'column_list')) {
      const flat = flatten(cl)
      const heads = flat.filter(b => b.type === 'heading').map(txt).map(s => s.trim()).filter(Boolean)
      const paras = flat.filter(b => b.type === 'paragraph').map(txt).map(s => s.trim()).filter(Boolean)
      if (heads.length < 2) continue
      legs.push({ from: heads[0], to: heads[1], detail: paras[0] ?? null })
    }
  }

  const extras = others.filter(s => s !== summarySection)
  return { mapImage, overview, legs, extras }
}

/**
 * The whole journey in one strip — every leg, in order.
 * Set in Night Sky against the cream page so transit reads as a different
 * kind of object from the places: a schedule, not a destination.
 */
function JourneySummary({ legs }: { legs: { from: string; to: string; detail: string | null }[] }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-text)',
      borderRadius: '12px', overflow: 'hidden',
      boxShadow: '0 3px 8px rgb(var(--night-rgb) / 0.12), 0 18px 44px rgb(var(--night-rgb) / 0.20)',
    }}>
      {legs.map((leg, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap',
          padding: '24px 32px',
          borderBottom: i < legs.length - 1 ? '0.5px solid rgb(var(--mist-rgb) / 0.12)' : 'none',
        }}>
          <span className="font-optima" style={{
            fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'rgb(var(--fade-rgb) / 0.78)',
            width: '24px', flexShrink: 0,
          }}>
            {String(i + 1).padStart(2, '0')}
          </span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-surface)' }}>{leg.from}</span>
            <svg width="22" height="8" viewBox="0 0 22 8" fill="none" style={{ flexShrink: 0 }}>
              <path d="M0 4h20M17 1l3 3-3 3" stroke="#DCD6CD" strokeOpacity="0.5" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-surface)' }}>{leg.to}</span>
          </div>
          {leg.detail && (
            <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'rgb(var(--fade-rgb) / 0.78)', flexShrink: 0 }}>
              {leg.detail}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function PlaceRow({ place }: { place: Place }) {
  const [open, setOpen] = useState(false)
  const [imgIdx, setImgIdx] = useState(0)
  const srcs = useMemo(() => place.images.map(imageSrc).filter((s): s is string => !!s), [place.images])
  const hasDetail = place.detail.length > 0 || place.bullets.length > 0 || srcs.length > 0

  // Warm neighbouring photos once the row is open so stepping is instant
  useEffect(() => {
    if (!open || srcs.length < 2) return
    const neighbours = [(imgIdx + 1) % srcs.length, (imgIdx - 1 + srcs.length) % srcs.length]
    const preloaded = neighbours.map(n => { const img = new window.Image(); img.src = srcs[n]; return img })
    return () => preloaded.forEach(img => { img.src = '' })
  }, [open, imgIdx, srcs])

  return (
    <div style={{
      backgroundColor: 'var(--color-surface-sunken)', border: '0.5px solid rgb(var(--borges-rgb) / 0.12)',
      borderRadius: '12px', overflow: 'hidden', boxShadow: CARD_SHADOW,
    }}>
      <button
        onClick={() => hasDetail && setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%', background: 'none', border: 'none', textAlign: 'left',
          cursor: hasDetail ? 'pointer' : 'default', padding: '26px 30px',
          display: 'flex', alignItems: 'center', gap: '18px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {place.date && (
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
              {place.date}
            </p>
          )}
          <div className="flex items-baseline gap-3 flex-wrap" style={{ marginBottom: place.summary ? '7px' : 0 }}>
            <span className="cq-subhead" style={{ fontSize: 'var(--text-subhead)', color: 'var(--color-text)' }}>{place.name}</span>
            {place.duration && (
              <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)' }}>{place.duration}</span>
            )}
          </div>
          {place.summary && (
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', lineHeight: 1.75, color: 'var(--color-text-muted)' }}>
              {place.summary}
            </p>
          )}
        </div>
        {hasDetail && (
          <div style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px',
            color: 'var(--color-text-accent)',
          }}>
            <span className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em' }}>
              {open ? 'Less' : srcs.length > 0 ? `${srcs.length} photos` : 'More'}
            </span>
            <span style={{ transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : 'none', display: 'flex' }}>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </div>
        )}
      </button>

      {open && hasDetail && (
        <div style={{ borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.12)' }}>
          {srcs.length > 0 && (
            <div style={{ position: 'relative', backgroundColor: 'var(--color-surface-sunken)' }}>
              <div className="cq-frame" style={{ overflow: 'hidden' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={srcs[imgIdx]} alt={place.name} decoding="async"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              {srcs.length > 1 && (
                <>
                  <button onClick={() => setImgIdx(i => (i - 1 + srcs.length) % srcs.length)} aria-label="Previous image"
                    style={{
                      position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                      width: '32px', height: '32px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                      backgroundColor: 'rgb(var(--night-rgb) / 0.55)', color: 'var(--color-surface)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button onClick={() => setImgIdx(i => (i + 1) % srcs.length)} aria-label="Next image"
                    style={{
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
                      {imgIdx + 1} / {srcs.length}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
          {(place.bullets.length > 0 || place.detail.length > 0) && (
            <div style={{ padding: '24px 26px' }}>
              {place.bullets.map((b, i) => (
                <div key={'b'+i} style={{ display: 'flex', gap: '11px', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgb(var(--borges-rgb) / 0.45)', flexShrink: 0, marginTop: '9px' }} />
                  <p className="font-optima cq-measure" style={{ fontSize: 'var(--text-caption)', lineHeight: 1.8, color: 'var(--color-text-muted)' }}>{b}</p>
                </div>
              ))}
              {place.detail.map((p, i) => (
                <p key={'p'+i} className="font-optima cq-measure" style={{
                  fontSize: 'var(--text-caption)', lineHeight: 1.8, color: 'var(--color-text-accent)',
                  marginTop: i === 0 && place.bullets.length > 0 ? '12px' : 0,
                  marginBottom: i < place.detail.length - 1 ? '12px' : 0,
                }}>
                  {p}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DatesDestinationsGallery({ blocks }: { blocks: ParsedBlock[] }) {
  const { mapImage, overview, legs, extras } = useMemo(() => parse(blocks), [blocks])
  const mapSrc = mapImage ? imageSrc(mapImage) : null

  return (
    <div>
      {/* The route map from Notion */}
      {mapSrc && (
        <div style={{
          marginBottom: 'var(--pad-56)', borderRadius: '12px', overflow: 'hidden',
          border: '0.5px solid rgb(var(--borges-rgb) / 0.12)', boxShadow: CARD_SHADOW,
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mapSrc} alt="Route map" style={{ width: '100%', display: 'block' }} />
        </div>
      )}

      {/* The journey, leg by leg — straight after the map */}
      {legs.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '26px' }}>
            <h3 className="cq-subhead" style={{ fontSize: 'var(--text-subhead)', color: 'var(--color-text)', flexShrink: 0 }}>
              The Journey
            </h3>
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', flexShrink: 0 }}>
              How you move
            </p>
            <div style={{ flex: 1, height: '0.5px', backgroundColor: 'rgb(var(--borges-rgb) / 0.18)' }} />
          </div>
          <JourneySummary legs={legs} />

          {/* Breathing room, then a rule — transit ends, places begin */}
          <div style={{ height: '72px' }} />
          <div style={{ height: '0.5px', backgroundColor: 'rgb(var(--borges-rgb) / 0.20)' }} />
          <div style={{ height: '72px' }} />
        </>
      )}

      {/* Closing notes */}
      {extras.map((section, i) => {
        const paras = section.content.filter(b => b.type === 'paragraph').map(txt).map(s => s.trim()).filter(Boolean)
        if (paras.length === 0) return null
        return (
          <div key={i} style={{ marginBottom: '36px' }}>
            <SubSectionOpen title={section.title} />
            {paras.map((p, pi) => (
              <p key={pi} className="font-optima cq-measure" style={{
                fontSize: 'var(--text-caption)', lineHeight: 1.8, color: 'var(--color-text-accent)',
                marginBottom: pi < paras.length - 1 ? '12px' : 0,
              }}>
                {p}
              </p>
            ))}
          </div>
        )
      })}

      {/* Places, by date — expand for the full writing and imagery */}
      {overview.length > 0 && (
        <>
          <header className="cq-section-open">
            <h2 className="cq-t1" style={{ margin: 0, color: 'var(--color-text)' }}>The Places</h2>
          </header>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {overview.map((place, i) => <PlaceRow key={i} place={place} />)}
          </div>
        </>
      )}
    </div>
  )
}
