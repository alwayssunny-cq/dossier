'use client'

import { useState, useRef } from 'react'
import type { Stay, Document } from '@/lib/types'
import ExpandableDescription from '@/components/ExpandableDescription'
import { cleanDescription, cleanPrice as cleanPriceUtil } from '@/lib/cleanText'
import { destinationImageUrl } from '@/lib/unsplash'


function fmtDate(d: string | null) {
  if (!d) return null
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return null }
}

// Local alias — delegates to shared helper but also hides property-name repeats
function cleanStayDescription(desc: string | null, propName: string, roomType: string | null): string | null {
  const cleaned = cleanDescription(desc, propName)
  if (!cleaned) return null
  const propLower = propName.toLowerCase()
  const roomLower = (roomType ?? '').toLowerCase()
  const cleanedLower = cleaned.toLowerCase()
  // Hide if it's just a repeat of the property name (+ room type)
  if (
    (cleanedLower.includes(propLower) && propLower.length > 4) &&
    cleaned.length < propName.length + (roomType?.length ?? 0) + 40
  ) return null
  if (cleanedLower.startsWith(propLower) && cleaned.length < 80) return null
  if (roomLower && cleanedLower === roomLower) return null
  return cleaned.length > 15 ? cleaned : null
}

// Alias for local use
const cleanPrice = cleanPriceUtil

function unsplashStay(name: string, dest: string | null) {
  return destinationImageUrl(dest, null, null, name + (dest ?? ''), 800, 600)
}

function docTypeLabel(type: string | null) {
  const t = (type ?? '').toLowerCase()
  if (t.includes('hotel') || t.includes('confirmation')) return 'Confirmation'
  if (t.includes('voucher')) return 'Voucher'
  if (t.includes('boarding')) return 'Boarding Pass'
  return type ?? 'Document'
}

// ── Carousel ──────────────────────────────────────────────────────────────────

function Carousel({ images, name }: { images: string[]; name: string }) {
  const [idx, setIdx]         = useState(0)
  const [hovered, setHovered] = useState(false)
  const [failed, setFailed]   = useState<Set<number>>(new Set())
  const trackRef              = useRef<HTMLDivElement>(null)

  if (!images.length) return null
  const validCount = images.filter((_, i) => !failed.has(i)).length
  if (validCount === 0) return null

  function scrollToIdx(i: number) {
    const t = trackRef.current
    if (!t) return
    t.scrollTo({ left: i * t.clientWidth, behavior: 'smooth' })
  }

  function onScroll() {
    const t = trackRef.current
    if (!t || !t.clientWidth) return
    setIdx(Math.round(t.scrollLeft / t.clientWidth))
  }

  function prev(e: React.MouseEvent) {
    e.preventDefault()
    const next = (idx - 1 + images.length) % images.length
    setIdx(next); scrollToIdx(next)
  }

  function next(e: React.MouseEvent) {
    e.preventDefault()
    const next = (idx + 1) % images.length
    setIdx(next); scrollToIdx(next)
  }

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        ref={trackRef}
        onScroll={onScroll}
        style={{
          display: 'flex',
          height: '100%',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        } as React.CSSProperties}
      >
        {images.map((src, i) => (
          <div
            key={i}
            style={{ flexShrink: 0, width: '100%', height: '100%', scrollSnapAlign: 'start', position: 'relative' }}
          >
            {!failed.has(i) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={`${name} ${i + 1}`}
                className="absolute inset-0 w-full h-full object-cover"
                onError={() => setFailed(f => new Set([...f, i]))}
              />
            )}
          </div>
        ))}
      </div>

      {/* Arrows — on hover */}
      {images.length > 1 && hovered && (
        <>
          <button
            onClick={prev}
            className="absolute flex items-center justify-center transition-opacity"
            style={{
              left: '8px', top: '50%', transform: 'translateY(-50%)',
              width: '28px', height: '28px', borderRadius: '50%',
              backgroundColor: 'rgb(var(--mist-rgb) / 0.85)',
              border: 'none', cursor: 'pointer',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <path d="M6 2L3 5l3 3" stroke="#4D4C50" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            onClick={next}
            className="absolute flex items-center justify-center transition-opacity"
            style={{
              right: '8px', top: '50%', transform: 'translateY(-50%)',
              width: '28px', height: '28px', borderRadius: '50%',
              backgroundColor: 'rgb(var(--mist-rgb) / 0.85)',
              border: 'none', cursor: 'pointer',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <path d="M4 2l3 3-3 3" stroke="#4D4C50" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </>
      )}

      {/* Dots */}
      {images.length > 1 && (
        <div className="absolute flex justify-center gap-1.5" style={{ bottom: '10px', left: 0, right: 0, pointerEvents: 'none' }}>
          {images.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.preventDefault(); setIdx(i); scrollToIdx(i) }}
              style={{
                width: '5px', height: '5px', borderRadius: '50%', border: 'none',
                cursor: 'pointer', padding: 0, pointerEvents: 'auto',
                backgroundColor: i === idx ? 'var(--color-text-accent)' : 'rgb(var(--mist-rgb) / 0.5)',
                transition: 'background-color 0.2s ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── StayCard ──────────────────────────────────────────────────────────────────

export default function StayCard({ stay, docs = [] }: { stay: Stay; docs?: Document[] }) {
  const multi    = (stay.image_urls ?? []).filter(Boolean)
  const fallback = unsplashStay(stay.property_name, stay.destination)
  const [imgSrc, setImgSrc] = useState(stay.image_url || fallback)

  function handleImgError() {
    if (imgSrc !== fallback) setImgSrc(fallback)
  }

  const checkIn   = fmtDate(stay.check_in)
  const checkOut  = fmtDate(stay.check_out)
  const price     = cleanPrice(stay.property_price)
  const initial   = stay.property_name.trim()[0]?.toUpperCase() ?? '?'
  const useMulti  = multi.length > 0
  const cleanedDesc = cleanStayDescription(stay.description, stay.property_name, stay.room_type)

  return (
    <div
      className="overflow-hidden"
      style={{
        backgroundColor: 'var(--color-surface-sunken)',
        border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
        borderRadius: '12px',
        display: 'flex',
        minHeight: '300px',
        boxShadow: '0 2px 12px rgb(var(--night-rgb) / 0.3)',
      }}
    >
      {/* ── Left: image ── */}
      <div
        className="flex-shrink-0 relative overflow-hidden"
        style={{
          width: '250px',
          borderRadius: '11px 0 0 11px',
          backgroundColor: 'var(--color-surface-sunken)',
        }}
      >
        {/* Letter placeholder always present */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface-sunken)' }}>
          <span className="cq-t1" style={{ fontSize: 'var(--text-t1)', lineHeight: 1, color: 'var(--color-text-muted)' }}>
            {initial}
          </span>
        </div>
        {useMulti ? (
          <Carousel images={multi} name={stay.property_name} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={stay.property_name}
            className="absolute inset-0 w-full h-full object-cover"
            onError={handleImgError}
          />
        )}
      </div>

      {/* ── Right: details ── */}
      <div
        className="flex flex-col flex-1 min-w-0"
        style={{ padding: '28px' }}
      >
        {/* Property name */}
        <h4 className="cq-subhead" style={{ fontSize: 'var(--text-subhead)', lineHeight: 1.2, marginBottom: '2px', color: 'var(--color-text)' }}>
          {stay.property_name}
        </h4>
        {/* Subtitle / destination */}
        {stay.destination && (
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', marginBottom: '18px', color: 'var(--color-text-muted)' }}>
            {stay.destination}
          </p>
        )}

        {/* Room details grid */}
        {(stay.room_type || stay.bed_type || (stay.meals && stay.meals !== 'No meal')) && (
          <div className="flex gap-6" style={{ marginBottom: '14px' }}>
            {stay.room_type && (
              <div>
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', marginBottom: '3px', color: 'var(--color-text-muted)' }}>Room</p>
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>{stay.room_type}</p>
              </div>
            )}
            {stay.bed_type && (
              <div>
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', marginBottom: '3px', color: 'var(--color-text-muted)' }}>Bed</p>
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>{stay.bed_type}</p>
              </div>
            )}
            {stay.meals && stay.meals !== 'No meal' && (
              <div>
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', marginBottom: '3px', color: 'var(--color-text-muted)' }}>Meals</p>
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>{stay.meals}</p>
              </div>
            )}
          </div>
        )}

        {/* Room features */}
        {stay.room_features && stay.room_features.length > 0 && (
          <div className="flex flex-wrap gap-1" style={{ marginBottom: '14px' }}>
            {stay.room_features.map(feat => (
              <span key={feat} className="font-optima" style={{
                fontSize: 'var(--text-caption)', letterSpacing: '0.01em', padding: '3px 8px', borderRadius: '999px',
                backgroundColor: 'rgb(var(--borges-rgb) / 0.10)', color: 'var(--color-text-muted)',
                border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
              }}>{feat}</span>
            ))}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Check-in / Check-out */}
        {(checkIn || checkOut) && (
          <div
            className="flex gap-6"
            style={{ paddingTop: '14px', paddingBottom: '14px', borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.10)' }}
          >
            <div>
              <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', marginBottom: '3px', color: 'var(--color-text-muted)' }}>Check-in</p>
              <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>{checkIn ?? '—'}</p>
            </div>
            <div style={{ width: '0.5px', backgroundColor: 'rgb(var(--borges-rgb) / 0.10)', alignSelf: 'stretch' }} />
            <div>
              <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', marginBottom: '3px', color: 'var(--color-text-muted)' }}>Check-out</p>
              <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>{checkOut ?? '—'}</p>
            </div>
          </div>
        )}

        {/* Price */}
        {price && (
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)', marginBottom: '10px' }}>{price}</p>
        )}

        {/* Description */}
        {cleanedDesc && (
          <div style={{ marginBottom: '12px' }}>
            <ExpandableDescription text={cleanedDesc} maxLines={2} />
          </div>
        )}



        {/* Docs */}
        {docs.length > 0 && (
          <div className="flex flex-wrap gap-1.5" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.10)' }}>
            {docs.map(doc => (
              <a key={doc.id} href={doc.file_url ?? '#'} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 font-optima transition-opacity hover:opacity-70"
                style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', backgroundColor: 'rgb(var(--borges-rgb) / 0.10)', borderRadius: '6px', padding: '4px 10px', textDecoration: 'none', border: '0.5px solid rgb(var(--borges-rgb) / 0.14)' }}>
                <svg width="9" height="11" viewBox="0 0 10 12" fill="none"><path d="M2 1h4.5L9 3.5V11H2V1z" stroke="#08070E" strokeWidth="1.1" strokeLinejoin="round"/><path d="M6 1v3h3" stroke="#08070E" strokeWidth="1.1" strokeLinejoin="round"/></svg>
                {doc.document_name}
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>{docTypeLabel(doc.document_type)}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
