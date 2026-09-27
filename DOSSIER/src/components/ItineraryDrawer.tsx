'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ExpRow {
  id: string; title: string; time_of_day: string | null
  description: string | null; location: string | null
  duration: string | null; status: string | null; sort_order: number | null
}
interface StayRow {
  property_name: string; destination: string | null; room_type: string | null
  meals: string | null; nights: number | null; check_in: string | null
  check_out: string | null; description: string | null
  image_url: string | null; image_urls: string[] | null; status: string | null
}
interface TrfRow {
  id: string; from_location: string | null; to_location: string | null
  transfer_mode: string | null; carrier: string | null
  duration: string | null; sort_order: number | null
}
interface Day {
  dayNumber: number; date: string; dayLabel: string; city: string | null
  experiences: ExpRow[]; stay: StayRow | null; transfers: TrfRow[]
}
interface ItineraryData { tripName: string; destLabel: string; days: Day[] }

function fmtDate(d: string | null): string {
  if (!d) return ''
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return d }
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ItineraryDrawer({
  tripId, label = 'View your itinerary →',
}: { tripId: string; label?: string }) {
  const [open,    setOpen]    = useState(false)
  const [data,    setData]    = useState<ItineraryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const openDrawer = useCallback(() => {
    setOpen(true)
    if (!data && !loading) {
      setLoading(true); setError(false)
      fetch(`/api/trip/${tripId}/itinerary`)
        .then(r => r.json())
        .then(d => { setData(d); setLoading(false) })
        .catch(() => { setError(true); setLoading(false) })
    }
  }, [tripId, data, loading])

  // Lock body scroll; reset panel scroll to top each time it opens
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0
      })
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Also reset to top whenever data arrives (covers first-open race)
  useEffect(() => {
    if (data && scrollRef.current) scrollRef.current.scrollTop = 0
  }, [data])

  // Escape key to close
  useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open])

  // ── Modal markup ────────────────────────────────────────────────────────────

  const modal = open ? (
    <>
      <style>{`
        @keyframes cq-fade-in  { from{opacity:0} to{opacity:1} }
        @keyframes cq-rise-in  { from{opacity:0;transform:scale(.96) translateY(14px)} to{opacity:1;transform:scale(1) translateY(0)} }
      `}</style>

      {/* Full-viewport overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
        animation: 'cq-fade-in 0.22s ease forwards',
      }}>

        {/* Backdrop — click to close */}
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'absolute', inset: 0,
            backgroundColor: 'rgb(var(--night-rgb) / 0.50)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          } as React.CSSProperties}
        />

        {/* Modal card — centered */}
        <div style={{
          position: 'relative', zIndex: 1,
          width: '100%', maxWidth: '680px',
          height: 'calc(100dvh - 40px)',
          backgroundColor: 'var(--color-surface)',
          borderRadius: '14px',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 80px rgb(var(--night-rgb) / 0.24), 0 0 0 0.5px rgb(var(--borges-rgb) / 0.14)',
          overflow: 'hidden',
          textAlign: 'left',
          animation: 'cq-rise-in 0.35s cubic-bezier(0.22,1,0.36,1) forwards',
        }}>

          {/* ── Sticky header ── */}
          <div style={{
            flexShrink: 0,
            padding: '20px 24px 18px',
            borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.12)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px',
          }}>
            <div>
              <p className="font-optima"
                style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '5px' }}>
                Full Itinerary
              </p>
              <p className="font-optima" style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.5 }}>
                {data?.tripName ?? '·  ·  ·'}
              </p>
              {data?.destLabel && (
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', marginTop: '3px' }}>
                  {data.destLabel}
                </p>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{
                flexShrink: 0, marginTop: '2px',
                background: 'none', border: 'none', cursor: 'pointer',
                width: '32px', height: '32px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgb(var(--borges-rgb) / 0.08)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="#706E56" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* ── Scrollable content ── */}
          <div
            ref={scrollRef}
            style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}
          >
            {/* Loading */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60%' }}>
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>
                  Loading your itinerary…
                </p>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: '8px' }}>
                <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)' }}>Could not load itinerary</p>
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>Please close and try again.</p>
              </div>
            )}

            {/* Empty */}
            {data && data.days.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: '10px' }}>
                <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)' }}>Your itinerary is being finalised</p>
                <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)' }}>The day-by-day view will appear here once confirmed.</p>
              </div>
            )}

            {/* Days */}
            {data && data.days.length > 0 && (
              <article style={{ padding: '40px 32px 80px' }}>
                {data.days.map((day, dayIdx) => {
                  type Item = { kind: 'exp'; d: ExpRow } | { kind: 'trf'; d: TrfRow }
                  const items: Item[] = [
                    ...day.experiences.map(e => ({ kind: 'exp' as const, d: e })),
                    ...day.transfers.map(t => ({ kind: 'trf' as const, d: t })),
                  ].sort((a, b) => ((a.d.sort_order ?? 99) - (b.d.sort_order ?? 99)))

                  return (
                    <section key={day.date} style={{ marginBottom: dayIdx < data.days.length - 1 ? '64px' : 0 }}>

                      {/* Day heading */}
                      <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: '16px',
                        marginBottom: '28px', paddingBottom: '16px',
                        borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.13)',
                      }}>
                        <span className="cq-t1" style={{
                          fontSize: 'var(--text-t1)', color: 'var(--color-text-muted)',
                          lineHeight: 0.9, fontWeight: 400, flexShrink: 0, minWidth: '52px',
                        }}>
                          {String(day.dayNumber).padStart(2, '0')}
                        </span>
                        <div style={{ paddingTop: '3px' }}>
                          <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', lineHeight: 1.5 }}>
                            {day.dayLabel}
                          </p>
                          {day.city && (
                            <p className="font-optima" style={{
                              fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
                              color: 'var(--color-text-muted)', marginTop: '4px',
                            }}>
                              {day.city}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Experiences + transfers (timeline) */}
                      {items.length > 0 && (
                        <div style={{
                          paddingLeft: '20px',
                          borderLeft: '1px solid rgb(var(--borges-rgb) / 0.10)',
                          marginBottom: day.stay ? '28px' : 0,
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {items.map(item => {
                              if (item.kind === 'exp') {
                                const e = item.d
                                return (
                                  <div key={e.id} style={{ position: 'relative' }}>
                                    <div style={{
                                      position: 'absolute', left: '-26px', top: '5px',
                                      width: '6px', height: '6px', borderRadius: '50%',
                                      backgroundColor: 'var(--color-surface)',
                                      border: '1px solid rgb(var(--borges-rgb) / 0.38)',
                                    }} />
                                    {e.time_of_day && (
                                      <p className="font-optima" style={{
                                        fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
                                        color: 'var(--color-text-muted)', marginBottom: '4px',
                                      }}>
                                        {e.time_of_day}
                                      </p>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                                      <h3 className="cq-subhead" style={{
                                        fontSize: 'var(--text-subhead)', color: 'var(--color-text)',
                                        lineHeight: 1.25, fontWeight: 400,
                                      }}>
                                        {e.title}
                                      </h3>
                                      {e.status === 'Done' && (
                                        <span className="font-optima" style={{
                                          flexShrink: 0, fontSize: 'var(--text-caption)', letterSpacing: '0.01em',

                                          color: 'var(--color-text-muted)',
                                          border: '0.5px solid rgb(var(--borges-rgb) / 0.28)',
                                          padding: '2px 7px', borderRadius: '2px', marginTop: '2px',
                                        }}>Confirmed</span>
                                      )}
                                    </div>
                                    {(e.duration || (e.location && e.location !== day.city)) && (
                                      <p className="font-optima" style={{
                                        fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', marginTop: '4px',
                                      }}>
                                        {[e.duration, e.location !== day.city ? e.location : null].filter(Boolean).join('  ·  ')}
                                      </p>
                                    )}
                                    {e.description && (
                                      <p className="font-optima" style={{
                                        fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)',
                                        lineHeight: 1.75, marginTop: '7px',
                                      }}>
                                        {e.description}
                                      </p>
                                    )}
                                  </div>
                                )
                              } else {
                                const t = item.d
                                const route = t.from_location && t.to_location
                                  ? `${t.from_location} → ${t.to_location}`
                                  : t.to_location ?? t.from_location ?? 'Transfer'
                                const meta = [t.transfer_mode, t.carrier, t.duration].filter(Boolean).join('  ·  ')
                                return (
                                  <div key={t.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                      position: 'absolute', left: '-26px',
                                      width: '5px', height: '5px',
                                      backgroundColor: 'rgb(var(--borges-rgb) / 0.22)', transform: 'rotate(45deg)',
                                    }} />
                                    <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
                                      {route}{meta && <span style={{ color: 'var(--color-text-muted)' }}>  ·  {meta}</span>}
                                    </p>
                                  </div>
                                )
                              }
                            })}
                          </div>
                        </div>
                      )}

                      {/* Tonight stay */}
                      {day.stay && (() => {
                        const s = day.stay!
                        const img = s.image_url ?? (Array.isArray(s.image_urls) ? s.image_urls[0] : null) ?? null
                        return (
                          <div style={{
                            paddingTop: items.length > 0 ? '24px' : 0,
                            borderTop: items.length > 0 ? '0.5px solid rgb(var(--borges-rgb) / 0.09)' : 'none',
                          }}>
                            <p className="font-optima" style={{
                              fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
                              color: 'var(--color-text-muted)', marginBottom: '12px',
                            }}>Tonight</p>
                            {img && (
                              <div style={{
                                width: '100%', aspectRatio: '3/1', borderRadius: '6px',
                                overflow: 'hidden', marginBottom: '14px', backgroundColor: 'var(--color-surface-sunken)',
                              }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img} alt={s.property_name} style={{
                                  width: '100%', height: '100%', objectFit: 'cover',
                                  filter: 'brightness(0.85) saturate(0.85)',
                                }} />
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '5px' }}>
                              <h3 className="cq-subhead" style={{ fontSize: 'var(--text-subhead)', color: 'var(--color-text)', fontWeight: 400, lineHeight: 1.2 }}>
                                {s.property_name}
                              </h3>
                              {s.status === 'Done' && (
                                <span className="font-optima" style={{
                                  flexShrink: 0, fontSize: 'var(--text-caption)', letterSpacing: '0.01em',

                                  color: 'var(--color-text-muted)',
                                  border: '0.5px solid rgb(var(--borges-rgb) / 0.28)',
                                  padding: '2px 7px', borderRadius: '2px', marginTop: '3px',
                                }}>Confirmed</span>
                              )}
                            </div>
                            {(s.destination || s.room_type || s.meals || s.nights) && (
                              <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
                                {[s.destination, s.room_type, s.meals, s.nights ? `${s.nights} night${s.nights !== 1 ? 's' : ''}` : null].filter(Boolean).join('  ·  ')}
                              </p>
                            )}
                            {s.check_in && (
                              <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                {fmtDate(s.check_in)}{s.check_out ? ` – ${fmtDate(s.check_out)}` : ''}
                              </p>
                            )}
                            {s.description && (
                              <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.75, marginTop: '8px' }}>
                                {s.description}
                              </p>
                            )}
                          </div>
                        )
                      })()}

                      {/* Day separator */}
                      {dayIdx < data.days.length - 1 && (
                        <div style={{ marginTop: 'var(--pad-48)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{ flex: 1, height: '0.5px', backgroundColor: 'rgb(var(--borges-rgb) / 0.08)' }} />
                          <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', letterSpacing: '4px' }}>· · ·</span>
                          <div style={{ flex: 1, height: '0.5px', backgroundColor: 'rgb(var(--borges-rgb) / 0.08)' }} />
                        </div>
                      )}
                    </section>
                  )
                })}

                <div style={{ marginTop: 'var(--pad-72)', paddingTop: '24px', borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.08)' }}>
                  <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
                    Closequarters · Private dossier · {data.tripName}
                  </p>
                </div>
              </article>
            )}
          </div>
        </div>
      </div>
    </>
  ) : null

  return (
    <>
      <button
        onClick={openDrawer}
        className="font-optima transition-opacity hover:opacity-70"
        style={{
          background: 'none', border: 'none', padding: 0,
          fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', cursor: 'pointer',
          letterSpacing: '0.03em',
        }}
      >
        {label}
      </button>

      {/* Portal — renders directly on document.body, bypasses all parent CSS */}
      {typeof document !== 'undefined' && modal
        ? createPortal(modal, document.body)
        : null}
    </>
  )
}
