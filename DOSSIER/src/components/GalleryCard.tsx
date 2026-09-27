'use client'

import { useState, useEffect, useMemo } from 'react'
import type { ParsedBlock } from '@/app/api/sync-content-pages/route'
import { imageSrc } from '@/lib/notionImages'

const CARD_SHADOW = '0 2px 4px rgb(var(--night-rgb) / 0.05), 0 12px 32px rgb(var(--night-rgb) / 0.09)'

// Both live in lib now so server components can use them too; re-exported
// here because a good deal of the app already imports them from this file.
export { imageSrc, collectImages } from '@/lib/notionImages'

function Carousel({ images, alt }: { images: ParsedBlock[]; alt: string }) {
  const [i, setI] = useState(0)
  const [failed, setFailed] = useState<Record<number, boolean>>({})

  const usable = useMemo(
    () => images.map(imageSrc).filter((s): s is string => !!s),
    [images],
  )

  // Warm the neighbours so stepping through the carousel is instant rather
  // than waiting on a fresh signed-URL lookup at click time.
  useEffect(() => {
    if (usable.length < 2) return
    const neighbours = [(i + 1) % usable.length, (i - 1 + usable.length) % usable.length]
    const preloaded = neighbours.map(n => {
      const img = new window.Image()
      img.src = usable[n]
      return img
    })
    return () => preloaded.forEach(img => { img.src = '' })
  }, [i, usable])

  if (usable.length === 0) return null

  const go = (d: number) => setI(prev => (prev + d + usable.length) % usable.length)

  return (
    <div style={{ position: 'relative', backgroundColor: 'var(--color-surface-sunken)' }}>
      <div className="cq-frame" style={{ overflow: 'hidden' }}>
        {failed[i] ? (
          <div style={{
            width: '100%', height: '100%', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
              Image unavailable
            </span>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={usable[i]}
            alt={alt}
            decoding="async"
            fetchPriority={i === 0 ? 'high' : 'auto'}
            onError={() => setFailed(f => ({ ...f, [i]: true }))}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
      </div>

      {usable.length > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            aria-label="Previous image"
            style={{
              position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
              width: '44px', height: '44px', borderRadius: '50%', border: 'none', cursor: 'pointer',
              backgroundColor: 'rgb(var(--night-rgb) / 0.55)', color: 'var(--color-surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Next image"
            style={{
              position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
              width: '44px', height: '44px', borderRadius: '50%', border: 'none', cursor: 'pointer',
              backgroundColor: 'rgb(var(--night-rgb) / 0.55)', color: 'var(--color-surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Position dots */}
          <div style={{
            position: 'absolute', bottom: '12px', left: 0, right: 0,
            display: 'flex', justifyContent: 'center', gap: 0,
          }}>
            {usable.map((_, n) => (
              <button
                key={n}
                onClick={() => setI(n)}
                aria-label={`Image ${n + 1}`}
                style={{
                  width: n === i ? '18px' : '6px', height: '6px', borderRadius: '999px',
                  border: 'none', cursor: 'pointer',
                  // The padding is the target; background-clip keeps the ink
                  // inside the content box so the dot is drawn at 6px as
                  // before. 9px either side clears the 24px floor.
                  padding: '19px 9px',
                  backgroundClip: 'content-box',
                  boxSizing: 'content-box',
                  backgroundColor: n === i ? 'rgb(var(--mist-rgb) / 0.95)' : 'rgb(var(--mist-rgb) / 0.5)',
                  transition: 'width 0.2s ease',
                }}
              />
            ))}
          </div>

          <div style={{
            position: 'absolute', top: '12px', right: '12px',
            padding: '3px 10px', borderRadius: '999px',
            backgroundColor: 'rgb(var(--night-rgb) / 0.55)',
          }}>
            <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-surface)', letterSpacing: '0.08em' }}>
              {i + 1} / {usable.length}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Editorial gallery card — carousel on top, then title + meta on the left
 * and the description on the right.
 */
export default function GalleryCard({
  title,
  dateline,
  meta,
  description,
  bullets,
  images,
}: {
  title: string
  /** When and where, set above the heading as its own strip. */
  dateline?: (string | null)[]
  meta?: (string | null)[]
  description?: string[]
  bullets?: string[]
  images: ParsedBlock[]
}) {
  const metaItems = (meta ?? []).filter(Boolean) as string[]
  const dateItems = (dateline ?? []).filter(Boolean) as string[]

  return (
    <div style={{
      backgroundColor: 'var(--color-surface-sunken)',
      border: '0.5px solid rgb(var(--borges-rgb) / 0.12)',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: CARD_SHADOW,
    }}>
      <Carousel images={images} alt={title} />

      {dateItems.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
          padding: '14px 26px',
          borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.12)',
          backgroundColor: 'rgb(var(--borges-rgb) / 0.04)',
        }}>
          {dateItems.map((d, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {i > 0 && <span style={{ width: '1px', height: '11px', backgroundColor: 'rgb(var(--borges-rgb) / 0.28)' }} />}
              <span className="font-optima" style={{
                fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: i === 0 ? 'var(--color-text)' : 'var(--color-text-accent)',
              }}>
                {d}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]" style={{ gap: '24px', padding: '24px 26px' }}>
        {/* Left — identity */}
        <div>
          <p className="cq-subhead" style={{ fontSize: 'var(--text-subhead)', lineHeight: 1.2, color: 'var(--color-text)', marginBottom: metaItems.length ? '12px' : 0 }}>
            {title}
          </p>
          {metaItems.map((m, i) => (
            <p key={i} className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
              {m}
            </p>
          ))}
        </div>

        {/* Right — the writing */}
        {((description && description.length > 0) || (bullets && bullets.length > 0)) && (
          <div>
            {(description ?? []).map((p, i) => (
              <p key={'p'+i} className="font-optima cq-measure" style={{
                fontSize: 'var(--text-caption)', lineHeight: 1.8, color: 'var(--color-text-accent)',
                marginBottom: i < (description ?? []).length - 1 ? '12px' : 0,
              }}>
                {p}
              </p>
            ))}
            {(bullets ?? []).map((b, i) => (
              <div key={'b'+i} style={{ display: 'flex', gap: '11px', alignItems: 'flex-start', marginTop: i === 0 && (description ?? []).length > 0 ? '12px' : 0, marginBottom: '9px' }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgb(var(--borges-rgb) / 0.45)', flexShrink: 0, marginTop: '9px' }} />
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', lineHeight: 1.8, color: 'var(--color-text-muted)' }}>{b}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
