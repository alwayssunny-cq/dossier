'use client'

import { useRef, useEffect, useState } from 'react'
import Link from 'next/link'
import type { Trip } from '@/lib/types'
import { destinationImageUrl } from '@/lib/unsplash'

function photoFor(trip: Trip, w: number, h = 700): string {
  return destinationImageUrl(trip.destination_country, trip.state_county, trip.towns_cities, trip.id, w, h)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateRange(start: string | null, end: string | null) {
  if (!start) return ''
  const s = new Date(start)
  const e = end ? new Date(end) : null
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const yearOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  if (!e) return s.toLocaleDateString('en-IN', yearOpts)
  if (s.getFullYear() === e.getFullYear())
    return `${s.toLocaleDateString('en-IN', opts)} – ${e.toLocaleDateString('en-IN', yearOpts)}`
  return `${s.toLocaleDateString('en-IN', yearOpts)} – ${e.toLocaleDateString('en-IN', yearOpts)}`
}

function statusLabel(status: string | null): string {
  const map: Record<string, string> = {
    'first steps': 'First Steps', 'first-steps': 'First Steps',
    'the crafting': 'Crafting', crafting: 'Crafting',
    reservations: 'Reservations', 'bon voyage': 'Bon Voyage',
    active: 'Active', planning: 'Planning', confirmed: 'Confirmed',
    completed: 'Completed', cancelled: 'Cancelled',
  }
  return map[status?.toLowerCase() ?? ''] ?? (status ?? 'In Progress')
}

function defaultSegment(status: string | null, live: boolean): string {
  if (live) return 'today'
  const norm = (status ?? '').toLowerCase()
  if (norm.includes('bon') || norm.includes('voyage')) return 'your-trip'
  if (norm.includes('first')) return 'brief'
  return 'experiences'
}

function isLiveTrip(trip: Trip): boolean {
  if (!trip.start_date || !trip.end_date) return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return new Date(trip.start_date) <= today && today <= new Date(trip.end_date)
}

// ── ActiveTripCard ─────────────────────────────────────────────────────────────

export function ActiveTripCard({ trip }: { trip: Trip }) {
  const [loaded, setLoaded] = useState(false)
  const imgRef  = useRef<HTMLImageElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const live    = isLiveTrip(trip)
  const segment = defaultSegment(trip.status, live)
  // Use cover_image_url if present, else a stable curated fallback
  const src     = trip.cover_image_url ?? photoFor(trip, 1400)

  // If image already cached on mount, onLoad won't fire — detect it here
  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true)
  }, [])

  // Parallax scroll effect
  useEffect(() => {
    function handleScroll() {
      const img  = imgRef.current
      const card = cardRef.current
      if (!img || !card) return
      const rect     = card.getBoundingClientRect()
      const viewH    = window.innerHeight
      const progress = 1 - (rect.top + rect.height) / (viewH + rect.height)
      img.style.transform = `scale(1.12) translateY(${(progress - 0.5) * 60}px)`
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <Link href={`/trip/${trip.trip_id}/${segment}`} className="block" style={{ textDecoration: 'none' }}>
      <div
        ref={cardRef}
        className="trip-card relative w-full overflow-hidden"
        style={{
          aspectRatio: 'var(--trip-card-aspect)', borderRadius: '5px', cursor: 'pointer', backgroundColor: 'var(--color-surface)',
          boxShadow: '0 6px 14px rgb(var(--night-rgb) / 0.16), 0 22px 48px rgb(var(--night-rgb) / 0.24), 0 44px 90px rgb(var(--night-rgb) / 0.18)',
        }}
      >
        {/* Shimmer while loading */}
        {!loaded && <div className="skeleton absolute inset-0" style={{ borderRadius: 0 }} />}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={trip.trip_name}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            filter: 'brightness(0.82)',
            transformOrigin: 'center center',
            transition: 'transform 0.05s linear, opacity 0.7s ease',
            willChange: 'transform, opacity',
            opacity: loaded ? 1 : 0,
          }}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />

        {/* Deep cinematic gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: [
              'linear-gradient(to top,',
              '  rgb(var(--night-rgb) / 0.98) 0%,',
              '  rgb(var(--night-rgb) / 0.55) 32%,',
              '  rgb(var(--night-rgb) / 0.12) 58%,',
              '  transparent 100%)',
            ].join(' '),
          }}
        />
        {/* Vignette edges */}
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgb(var(--night-rgb) / 0.35) 100%)' }}
        />

        {/* Status — plain floating text, no pill */}
        <div className="absolute flex items-center gap-2" style={{ top: '20px', right: '22px' }}>
          {live && (
            <span className="relative flex items-center justify-center" style={{ width: '6px', height: '6px' }}>
              <span className="absolute inline-flex rounded-full" style={{ width: '100%', height: '100%', backgroundColor: 'var(--color-text-accent)', opacity: 0.5, animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite' }} />
              <span className="relative inline-flex rounded-full" style={{ width: '6px', height: '6px', backgroundColor: 'var(--color-text-accent)' }} />
            </span>
          )}
          <span
            className="font-optima"
            style={{
              fontSize: 'var(--text-caption)',
              letterSpacing: '0.01em',
              color: live ? 'rgb(var(--borges-rgb) / 0.95)' : 'rgb(var(--mist-rgb) / 0.88)',
              textShadow: '0 1px 12px rgb(var(--night-rgb) / 0.65)',
            }}
          >
            {live ? 'Live Now' : statusLabel(trip.status)}
          </span>
        </div>

        {/* Bottom content */}
        <div className="absolute" style={{ bottom: 0, left: 0, right: 0, padding: '40px 36px 36px' }}>
          {trip.destination_country && (
            <p
              className="font-optima"
              style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'rgb(var(--mist-rgb) / 0.75)', textShadow: '0 1px 12px rgb(var(--night-rgb) / 0.6)', marginBottom: '10px' }}
            >
              {trip.destination_country}
            </p>
          )}
          <div className="flex items-center gap-2" style={{ marginBottom: '14px' }}>
            <h3
              className="cq-t1"
              style={{
                fontSize: 'var(--text-t1)',
                lineHeight: 1.0,
                color: 'rgb(var(--mist-rgb) / 0.97)',
                textShadow: '0 2px 32px rgb(var(--night-rgb) / 0.5)',
              }}
            >
              {trip.trip_name}
            </h3>
            {live && (
              <span className="relative flex-shrink-0 self-center" style={{ width: '7px', height: '7px', marginLeft: '6px', marginTop: '4px' }}>
                <span className="absolute rounded-full" style={{ width: '100%', height: '100%', backgroundColor: 'var(--color-text-accent)', opacity: 0.4, animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite' }} />
                <span className="relative inline-flex rounded-full" style={{ width: '100%', height: '100%', backgroundColor: 'var(--color-text-accent)' }} />
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'rgb(var(--fade-rgb) / 0.78)' }}>
              {formatDateRange(trip.start_date, trip.end_date)}
            </p>
            <div style={{ height: '1px', width: '28px', backgroundColor: 'var(--color-text-accent)', opacity: 0.65 }} />
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── PastTripCard ───────────────────────────────────────────────────────────────

export function PastTripCard({ trip }: { trip: Trip }) {
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const src = trip.cover_image_url ?? photoFor(trip, 600, 400)

  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true)
  }, [])

  return (
    <Link href={`/trip/${trip.trip_id}/experiences`} className="block" style={{ textDecoration: 'none' }}>
      <div
        className="trip-card card-lift relative overflow-hidden"
        style={{
          aspectRatio: '16 / 9', borderRadius: '5px', cursor: 'pointer', backgroundColor: 'var(--color-surface)',
          boxShadow: '0 3px 6px rgb(var(--night-rgb) / 0.08), 0 14px 36px rgb(var(--night-rgb) / 0.14)',
        }}
      >
        {/* Shimmer placeholder */}
        {!loaded && <div className="skeleton absolute inset-0" style={{ borderRadius: 0 }} />}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={trip.trip_name}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            filter: 'saturate(0.45) brightness(0.88)',
            transition: 'opacity 0.6s ease',
            opacity: loaded ? 1 : 0,
          }}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgb(var(--night-rgb) / 0.88) 0%, rgb(var(--night-rgb) / 0.08) 55%, transparent 100%)' }}
        />
        <div className="absolute" style={{ bottom: 0, left: 0, right: 0, padding: '16px 18px' }}>
          <h4
            className="cq-subhead"
            style={{ fontSize: 'var(--text-subhead)', lineHeight: 1.1, color: 'rgb(var(--mist-rgb) / 0.92)', marginBottom: '4px' }}
          >
            {trip.trip_name}
          </h4>
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'rgb(var(--mist-rgb) / 0.45)' }}>
            {formatDateRange(trip.start_date, trip.end_date)}
          </p>
        </div>
      </div>
    </Link>
  )
}
