'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Trip, Experience, Stay, Transfer } from '@/lib/types'
import { experienceImageUrl, stayImageUrl } from '@/lib/unsplash'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ItineraryDay {
  dayNumber:   number
  date:        string        // YYYY-MM-DD
  dayLabel:    string        // "Saturday, 9 May 2026"
  city:        string | null
  experiences: Experience[]
  stay:        Stay | null
  transfers:   Transfer[]
}

interface Props {
  trip:    Trip
  days:    ItineraryDay[]
  isEmpty: boolean
  tripId:  string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nightsCount(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const d = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000)
  return d > 0 ? d : null
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return ''
  try {
    const s = new Date(start + 'T00:00:00')
    const e = end ? new Date(end + 'T00:00:00') : null
    const sd = s.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
    if (!e) return sd
    const ed = e.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    return `${sd} – ${ed}`
  } catch { return '' }
}

const TIME_ORDER: Record<string, number> = {
  morning: 0, 'mid-morning': 1, afternoon: 2, evening: 3, night: 4, 'full day': 5,
}

function timeOrder(t: string | null): number {
  return TIME_ORDER[(t ?? '').toLowerCase()] ?? 99
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function transferSummary(t: Transfer): string {
  const parts: string[] = []
  if (t.duration)       parts.push(t.duration)
  if (t.transfer_mode)  parts.push(t.transfer_mode)
  if (t.carrier)        parts.push(t.carrier)
  return parts.join(' · ') || 'Transfer'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyState({ tripId }: { tripId: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ minHeight: '60vh', padding: '60px 24px' }}
    >
      <div
        style={{
          width: '40px', height: '1px',
          backgroundColor: 'rgb(var(--borges-rgb) / 0.35)',
          marginBottom: 'var(--pad-40)',
        }}
      />
      <h2
        className="cq-t1"
        style={{
          fontSize: 'var(--text-t1)',
          fontWeight: 400,
          color: 'var(--color-text)',
          letterSpacing: '0.01em',
          marginBottom: '16px',
          lineHeight: 1.3,
        }}
      >
        Your itinerary is being finalized
      </h2>
      <p
        className="font-optima"
        style={{
          fontSize: 'var(--text-body)',
          color: 'var(--color-text-accent)',
          lineHeight: 1.7,
          maxWidth: '340px',
          marginBottom: 'var(--pad-40)',
        }}
      >
        Your curator is putting the final touches on your day-by-day journey.
        We&apos;ll update this as soon as it&apos;s ready.
      </p>
      <a
        href="https://wa.me/919884256431"
        target="_blank"
        rel="noopener noreferrer"
        className="font-optima"
        style={{
          display: 'inline-block',
          padding: '12px 28px',
          border: '1px solid rgb(var(--borges-rgb) / 0.6)',
          color: 'var(--color-text-accent)',
          fontSize: 'var(--text-caption)',
          letterSpacing: '0.01em',
          textDecoration: 'none',
          borderRadius: '2px',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          el.style.backgroundColor = 'rgb(var(--borges-rgb) / 0.1)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          el.style.backgroundColor = 'transparent'
        }}
      >
        Message Us
      </a>
    </div>
  )
}

// ── Transfer pill ─────────────────────────────────────────────────────────────

function TransferPill({ transfer }: { transfer: Transfer }) {
  const [showNote, setShowNote] = useState(false)
  const summary = transferSummary(transfer)
  const from = transfer.from_location
  const to   = transfer.to_location
  const route = from && to ? `${from} → ${to}` : (from ?? to ?? null)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 0',
      }}
    >
      {/* Connector line */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ width: '1px', height: '12px', backgroundColor: 'rgb(var(--borges-rgb) / 0.25)' }} />
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%',
          border: '1px solid rgb(var(--borges-rgb) / 0.5)',
          backgroundColor: 'var(--color-surface)',
        }} />
        <div style={{ width: '1px', height: '12px', backgroundColor: 'rgb(var(--borges-rgb) / 0.25)' }} />
      </div>

      <div style={{ flex: 1 }}>
        <span
          className="font-optima"
          style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', letterSpacing: '0.03em' }}
        >
          {route && <span style={{ color: 'var(--color-text-accent)' }}>{route}</span>}
          {route && ' · '}
          {summary}
        </span>
        {transfer.notes && (
          <button
            onClick={() => setShowNote(v => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              marginLeft: '8px', fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)',
              padding: 0,
            }}
            aria-label="Show transfer notes"
          >
            ⓘ
          </button>
        )}
        {showNote && transfer.notes && (
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            {transfer.notes}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Experience card ───────────────────────────────────────────────────────────

function ExperienceCard({ experience: exp, city }: { experience: Experience; city: string | null }) {
  const [expanded, setExpanded] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)

  const imgSrc = experienceImageUrl(exp.image_url, exp.image_urls, exp.title, exp.location, city)
  const hasMeetingPoint = !!exp.meeting_point

  return (
    <article style={{ marginBottom: '32px' }}>

      {/* Image */}
      <div
        style={{
          position: 'relative',
          borderRadius: '5px',
          overflow: 'hidden',
          border: '0.5px solid rgb(var(--borges-rgb) / 0.15)',
          backgroundColor: 'var(--color-surface-sunken)',
          aspectRatio: '16/9',
          marginBottom: '16px',
        }}
      >
        {!imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={exp.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          /* CSS gradient fallback */
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(135deg, var(--color-surface-sunken) 0%, var(--color-surface-sunken) 50%, var(--color-surface) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', letterSpacing: '0.01em' }}>
              {exp.title.toUpperCase()}
            </span>
          </div>
        )}

        {/* Time of day overlay */}
        {exp.time_of_day && (
          <div
            className="font-optima"
            style={{
              position: 'absolute',
              top: '12px', left: '12px',
              fontSize: 'var(--text-caption)',
              letterSpacing: '0.01em',
              color: 'rgb(var(--fade-rgb) / 0.75)',
              backgroundColor: 'rgb(var(--night-rgb) / 0.45)',
              backdropFilter: 'blur(4px)',
              padding: '4px 8px',
              borderRadius: '2px',
            }}
          >
            {exp.time_of_day}
          </div>
        )}
      </div>

      {/* Title */}
      <h3
        className="cq-subhead"
        style={{
          fontSize: 'var(--text-subhead)',
          fontWeight: 400,
          color: 'var(--color-text)',
          marginBottom: '6px',
          lineHeight: 1.3,
        }}
      >
        {exp.title}
      </h3>

      {/* Meta line */}
      {(exp.duration || exp.location) && (
        <p
          className="font-optima"
          style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', letterSpacing: '0.06em', marginBottom: '10px' }}
        >
          {[exp.duration, exp.location ?? city].filter(Boolean).join('  ·  ')}
        </p>
      )}

      {/* Description */}
      {exp.description && (
        <p
          className="font-optima"
          style={{
            fontSize: 'var(--text-caption)',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.75,
            marginBottom: hasMeetingPoint ? '12px' : '0',
          }}
        >
          {exp.description}
        </p>
      )}

      {/* Expandable details */}
      {hasMeetingPoint && (
        <div>
          <button
            onClick={() => setExpanded(v => !v)}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setExpanded(v => !v)}
            aria-expanded={expanded}
            className="font-optima"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 'var(--text-caption)',
              letterSpacing: '0.01em',
              color: expanded ? 'var(--color-text-accent)' : 'rgb(var(--borges-rgb) / 0.6)',
              padding: '6px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'color 0.2s',
            }}
          >
            <span style={{
              display: 'inline-block',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
              fontSize: 'var(--text-caption)',
            }}>›</span>
            {expanded ? 'Hide Details' : 'Details'}
          </button>

          {expanded && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'rgb(var(--night-rgb) / 0.6)',
                borderLeft: '2px solid rgb(var(--borges-rgb) / 0.3)',
                borderRadius: '0 4px 4px 0',
                marginTop: '4px',
              }}
            >
              {exp.meeting_point && (
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                  <span style={{ color: 'var(--color-text-accent)', letterSpacing: '0.01em', fontSize: 'var(--text-caption)' }}>MEETING POINT</span>
                  <br />
                  {exp.meeting_point}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

// ── Stay card ─────────────────────────────────────────────────────────────────

function StayCard({ stay, night, tripId }: { stay: Stay; night: number; tripId: string }) {
  const [imgFailed, setImgFailed] = useState(false)
  const imgSrc = stayImageUrl(stay.image_url, stay.image_urls, stay.property_name, stay.destination)

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-sunken)',
        borderRadius: '5px',
        overflow: 'hidden',
        border: '0.5px solid rgb(var(--borges-rgb) / 0.12)',
        marginTop: '8px',
        marginBottom: '8px',
      }}
    >
      {/* Image */}
      <div style={{ position: 'relative', aspectRatio: '16/7', backgroundColor: 'var(--color-surface-sunken)' }}>
        {!imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={stay.property_name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(135deg, var(--color-surface-sunken) 0%, var(--color-surface-sunken) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', letterSpacing: '0.01em' }}>
              {stay.property_name.toUpperCase()}
            </span>
          </div>
        )}
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgb(var(--night-rgb) / 0.85) 0%, transparent 55%)',
          }}
        />
        {/* Night badge */}
        <div
          className="font-optima absolute"
          style={{
            top: '12px', right: '12px',
            fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
            color: 'var(--color-text-accent)',
            backgroundColor: 'rgb(var(--night-rgb) / 0.7)',
            backdropFilter: 'blur(4px)',
            padding: '4px 10px',
            borderRadius: '2px',
            border: '0.5px solid rgb(var(--borges-rgb) / 0.3)',
          }}
        >
          Night {night}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px 20px 18px' }}>
        <h4
          className="cq-subhead"
          style={{ fontSize: 'var(--text-subhead)', fontWeight: 400, color: 'var(--color-text)', marginBottom: '6px' }}
        >
          {stay.property_name}
        </h4>

        {(stay.room_type || stay.meals) && (
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', marginBottom: '8px', letterSpacing: '0.04em' }}>
            {[stay.room_type, stay.meals].filter(Boolean).join('  ·  ')}
          </p>
        )}

        {stay.description && (
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.65, marginBottom: '12px' }}>
            {stay.description}
          </p>
        )}

      </div>
    </div>
  )
}

// ── Day header ────────────────────────────────────────────────────────────────

function DayHeader({ day }: { day: ItineraryDay }) {
  return (
    <header
      className="sticky z-20"
      style={{
        top: '58px',
        backgroundColor: 'var(--color-surface)',
        borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.15)',
        padding: '14px 0 12px',
        marginBottom: '24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
        {/* Day number */}
        <span
          className="cq-t1"
          style={{ fontSize: 'var(--text-t1)', color: 'var(--color-text-accent)', fontWeight: 400, lineHeight: 1, flexShrink: 0 }}
        >
          {pad2(day.dayNumber)}
        </span>

        {/* Date */}
        <time
          dateTime={day.date}
          className="font-optima"
          style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', letterSpacing: '0.06em', flex: 1, minWidth: 0 }}
        >
          {day.dayLabel}
        </time>

        {/* City */}
        {day.city && (
          <span
            className="font-optima whitespace-nowrap"
            style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', flexShrink: 0 }}
          >
            {day.city}
          </span>
        )}
      </div>
    </header>
  )
}

// ── Top hero ──────────────────────────────────────────────────────────────────

function ItineraryHero({ trip }: { trip: Trip }) {
  const nights  = nightsCount(trip.start_date, trip.end_date)
  const range   = formatDateRange(trip.start_date, trip.end_date)

  // Destination line
  const destParts: string[] = []
  if (trip.state_county)       destParts.push(trip.state_county)
  if (trip.destination_country) destParts.push(trip.destination_country)
  const destination = destParts.join(', ') || trip.destination_country || null

  return (
    <section style={{ marginBottom: 'var(--pad-40)', paddingBottom: '32px', borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.12)' }}>

      {/* Destination */}
      {destination && (
        <h2
          className="cq-t1"
          style={{
            fontSize: 'var(--text-t1)',
            fontWeight: 400,
            color: 'var(--color-text)',
            lineHeight: 1.15,
            marginBottom: '12px',
          }}
        >
          {destination}
        </h2>
      )}

      {/* Date range */}
      {range && (
        <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
          {range}
        </p>
      )}

      {/* Nights count */}
      {nights != null && (
        <p
          className="font-optima"
          style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)' }}
        >
          {nights} night{nights !== 1 ? 's' : ''}
          {trip.state_county ? ` across ${trip.state_county}` : ''}
        </p>
      )}
    </section>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ItineraryClient({ trip, days, isEmpty, tripId }: Props) {
  if (isEmpty) return <EmptyState tripId={tripId} />

  return (
    <div>
      <ItineraryHero trip={trip} />

      {days.map(day => {
        // Sort experiences within each day by time_of_day then sort_order
        const orderedExps = [...day.experiences].sort((a, b) => {
          const td = timeOrder(a.time_of_day) - timeOrder(b.time_of_day)
          if (td !== 0) return td
          return (a.sort_order ?? 0) - (b.sort_order ?? 0)
        })

        // Build interleaved timeline: transfers + experiences sorted by sort_order
        type Item = { kind: 'experience'; data: Experience } | { kind: 'transfer'; data: Transfer }
        const timeline: Item[] = [
          ...orderedExps.map(e => ({ kind: 'experience' as const, data: e })),
          ...day.transfers.map(t => ({ kind: 'transfer' as const, data: t })),
        ].sort((a, b) => (a.data.sort_order ?? 99) - (b.data.sort_order ?? 99))

        return (
          <section key={day.date} id={`day-${day.date}`} aria-label={`Day ${day.dayNumber}: ${day.dayLabel}`}>
            <DayHeader day={day} />

            {/* Timeline items */}
            {timeline.map((item, idx) =>
              item.kind === 'experience' ? (
                <ExperienceCard
                  key={`exp-${item.data.id}`}
                  experience={item.data}
                  city={day.city}
                />
              ) : (
                <TransferPill
                  key={`trf-${item.data.id}`}
                  transfer={item.data}
                />
              )
            )}

            {/* End-of-day stay */}
            {day.stay && (
              <StayCard
                stay={day.stay}
                night={day.dayNumber}
                tripId={tripId}
              />
            )}

            {/* Day spacer */}
            <div style={{ height: '48px' }} />
          </section>
        )
      })}
    </div>
  )
}
