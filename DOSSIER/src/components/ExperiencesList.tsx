'use client'

import { useState, useMemo } from 'react'
import type { Experience, Document } from '@/lib/types'
import ExpandableDescription from '@/components/ExpandableDescription'
import { WeatherBadge } from '@/components/WeatherStrip'
import TabMap, { type MapPoint } from '@/components/TabMap'
import ScrollReveal from '@/components/ScrollReveal'
import { cleanDescription, cleanPrice } from '@/lib/cleanText'
import { destinationImageUrl } from '@/lib/unsplash'

// ── Image helpers ──────────────────────────────────────────────────────────────

function unsplashExp(title: string, location: string | null): string {
  return destinationImageUrl(location, null, title, title + (location ?? ''), 800, 500)
}

// cleanDescription and cleanPrice are imported from @/lib/cleanText
// keeping formatCost as an alias for backwards compatibility within this file
const formatCost = cleanPrice

// ── Time badge ─────────────────────────────────────────────────────────────────

// The palette holds no hues to spend on time of day, so the badge carries it
// as tone instead: the ladder darkens as the day does. Every step below keeps
// Milky Mist text at 5:1 or better.
function timeBadgeStyle(time: string | null): { bg: string } | null {
  if (!time) return null
  const l = time.toLowerCase()
  if (l.includes('mid-morning')) return { bg: 'var(--color-text-accent)' }
  if (l.includes('morning'))     return { bg: 'var(--color-text-accent)' }
  if (l.includes('full day'))    return { bg: 'rgb(var(--night-rgb) / 0.64)' }
  if (l.includes('afternoon'))   return { bg: 'rgb(var(--night-rgb) / 0.72)' }
  if (l.includes('evening'))     return { bg: 'rgb(var(--night-rgb) / 0.84)' }
  if (l.includes('night'))       return { bg: 'var(--color-text)' }
  return { bg: 'var(--color-text)' }
}

function docTypeLabel(type: string | null): string {
  const t = (type ?? '').toLowerCase()
  if (t.includes('boarding')) return 'Boarding Pass'
  if (t.includes('flight') || (t.includes('ticket') && !t.includes('entry'))) return 'Boarding Pass'
  if (t.includes('hotel') || t.includes('confirmation')) return 'Confirmation'
  if (t.includes('voucher')) return 'Voucher'
  if (t.includes('visa')) return 'Visa'
  return type ?? 'Document'
}

function DocPills({ docs }: { docs: Document[] }) {
  if (!docs.length) return null
  return (
    <div className="flex flex-wrap gap-1.5" style={{ marginTop: '12px' }}>
      {docs.map(doc => (
        <a
          key={doc.id}
          href={doc.file_url ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 font-optima transition-opacity hover:opacity-70"
          style={{
            fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)',
            backgroundColor: 'rgb(var(--borges-rgb) / 0.10)', border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
            borderRadius: '999px', padding: '4px 10px', textDecoration: 'none',
          }}
        >
          <svg width="9" height="11" viewBox="0 0 10 12" fill="none" className="flex-shrink-0">
            <path d="M2 1h4.5L9 3.5V11H2V1z" stroke="#6B696C" strokeWidth="1.1" strokeLinejoin="round"/>
            <path d="M6 1v3h3" stroke="#6B696C" strokeWidth="1.1" strokeLinejoin="round"/>
          </svg>
          {doc.document_name}
          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-caption)' }}>{docTypeLabel(doc.document_type)}</span>
        </a>
      ))}
    </div>
  )
}

// ── Experience Card ────────────────────────────────────────────────────────────

function ExperienceCard({ experience: exp, docs }: { experience: Experience; docs: Document[] }) {
  const fallback = unsplashExp(exp.title, exp.location)
  const [imgSrc, setImgSrc] = useState(exp.image_url || fallback)
  const tBadge = timeBadgeStyle(exp.time_of_day)
  const cost   = formatCost(exp.cost_indicator)

  function handleImgError() {
    if (imgSrc !== fallback) setImgSrc(fallback)
  }

  return (
    <div
      className="overflow-hidden"
      style={{
        backgroundColor: 'var(--color-surface-sunken)',
        border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
        borderRadius: '12px',
        boxShadow: '0 2px 12px rgb(var(--night-rgb) / 0.3)',
        transition: 'border-color 0.2s ease',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'rgb(var(--borges-rgb) / 0.17)'}
      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'rgb(var(--borges-rgb) / 0.10)'}
    >
      {/* Hero image — 16:9 */}
      <div className="relative overflow-hidden" style={{ aspectRatio: '16 / 9', backgroundColor: 'var(--color-surface-sunken)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={exp.title}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'saturate(1.1) contrast(1.02)' }}
          onError={handleImgError}
        />
        {/* Bottom shadow */}
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{ height: '40px', background: 'linear-gradient(to top, rgb(var(--night-rgb) / 0.08), transparent)' }}
        />
        {/* Time badge */}
        {tBadge && exp.time_of_day && (
          <span
            className="absolute cq-micro"
            style={{
              bottom: '14px', left: '14px',
              color: 'var(--color-text-inverse)',
              padding: '6px 16px', borderRadius: '999px',
              backgroundColor: tBadge.bg,
            }}
          >
            {exp.time_of_day}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '28px' }}>
        <h3 className="cq-subhead" style={{ fontSize: 'var(--text-subhead)', lineHeight: 1.2, marginBottom: '14px', color: 'var(--color-text)' }}>
          {exp.title}
        </h3>

        {(() => { const d = cleanDescription(exp.description, exp.title); return d ? (
          <div style={{ marginBottom: '20px' }}>
            <ExpandableDescription text={d} maxLines={3} />
          </div>
        ) : null })()}

        {exp.meeting_point && (
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', fontStyle: 'italic', marginBottom: '12px', color: 'var(--color-text-muted)' }}>
            Meet at {exp.meeting_point}
          </p>
        )}

        {(exp.duration || cost || (exp.tags?.filter(Boolean).length ?? 0) > 0) && (
          <div style={{ borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.10)', paddingTop: '16px' }}>
            {(exp.duration || cost) && (
              <div
                className="flex items-center justify-between"
                style={{ marginBottom: (exp.tags?.filter(Boolean).length ?? 0) > 0 ? '10px' : '0' }}
              >
                {exp.duration ? (
                  <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>{exp.duration}</span>
                ) : <span />}
                {cost && (
                  <span className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)' }}>{cost}</span>
                )}
              </div>
            )}
            {(exp.tags?.filter(Boolean).length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {exp.tags!.filter(Boolean).map(tag => (
                  <span key={tag} className="font-optima" style={{
                    fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
                    padding: '3px 12px', borderRadius: '999px',
                    backgroundColor: 'rgb(var(--borges-rgb) / 0.10)', border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
                    color: 'var(--color-text-muted)',
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <DocPills docs={docs} />
      </div>
    </div>
  )
}

// ── Day group ──────────────────────────────────────────────────────────────────

interface DayGroup {
  day: number
  date: string | null
  location: string | null
  experiences: Experience[]
}

function parseDateParts(d: string | null): { weekday: string; dayMonth: string } | null {
  if (!d) return null
  try {
    const dt = new Date(d + 'T00:00:00')
    return {
      weekday:  dt.toLocaleDateString('en-GB', { weekday: 'long' }),
      dayMonth: dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }),
    }
  } catch { return null }
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ExperiencesList({
  experiences,
  docsMap = {},
  locationContext,
}: {
  experiences: Experience[]
  docsMap?: Record<string, Document[]>
  locationContext?: string
}) {
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [searchQuery, setSearchQuery]           = useState('')

  const locationSet = new Set<string>()
  for (const exp of experiences) { if (exp.location) locationSet.add(exp.location) }
  const locations = Array.from(locationSet)

  // Search + location filter
  const filtered = useMemo(() => {
    return experiences.filter(exp => {
      const locOk = !selectedLocation || exp.location === selectedLocation
      if (!locOk) return false
      const q = searchQuery.trim().toLowerCase()
      if (!q) return true
      return (
        (exp.title?.toLowerCase().includes(q)) ||
        (exp.description?.toLowerCase().includes(q)) ||
        (exp.location?.toLowerCase().includes(q)) ||
        (exp.tags?.some(t => t?.toLowerCase().includes(q)) ?? false)
      )
    })
  }, [experiences, selectedLocation, searchQuery])

  const byDay = filtered.reduce<Record<number, Experience[]>>((acc, exp) => {
    const day = exp.day_number ?? 0
    if (!acc[day]) acc[day] = []
    acc[day].push(exp)
    return acc
  }, {})

  const dayGroups: DayGroup[] = Object.keys(byDay).map(Number).sort((a, b) => a - b).map(day => ({
    day,
    date:        byDay[day][0]?.date ?? null,
    location:    byDay[day][0]?.location ?? null,
    experiences: byDay[day],
  }))

  // Build map points: unique locations, labelled with first day number
  const mapPoints: MapPoint[] = useMemo(() => {
    const seen = new Set<string>()
    const pts: MapPoint[] = []
    for (const g of dayGroups) {
      if (g.location && !seen.has(g.location)) {
        seen.add(g.location)
        pts.push({ label: g.day !== 0 ? String(g.day) : g.location.trim()[0]?.toUpperCase() ?? '·', location: g.location })
      }
    }
    return pts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experiences])

  return (
    <div>

      {/* ── Search bar ── */}
      <div style={{ marginBottom: '28px' }}>
        <div
          className="flex items-center gap-3"
          style={{ borderBottom: '1px solid rgb(var(--borges-rgb) / 0.14)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
            <circle cx="6" cy="6" r="4.5" stroke="#6B696C" strokeWidth="1.2"/>
            <path d="M9.5 9.5l2.5 2.5" stroke="#6B696C" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search experiences, places, dates…" aria-label="Search experiences, places, dates"
            className="flex-1 font-optima bg-transparent outline-none"
            style={{ fontSize: 'var(--text-caption)', minHeight: '44px', border: 'none', caretColor: 'var(--color-text-accent)', color: 'var(--color-text)' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="font-optima transition-opacity hover:opacity-60"
              style={{ fontSize: 'var(--text-caption)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-text-muted)' }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Location filter pills ── */}
      {locations.length > 1 && (
        <div
          className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide"
          style={{ marginBottom: 'var(--pad-40)', marginLeft: '-20px', marginRight: '-20px', paddingLeft: '20px', paddingRight: '20px' }}
        >
          {['__all__', ...locations].map(loc => {
            const isAll  = loc === '__all__'
            const active = isAll ? !selectedLocation : selectedLocation === loc
            return (
              <button
                key={loc}
                onClick={() => setSelectedLocation(isAll ? null : (selectedLocation === loc ? null : loc))}
                className="flex-shrink-0 font-optima transition-colors"
                style={{
                  fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
                  padding: '6px 18px', borderRadius: '999px',
                  border: active ? 'none' : '0.5px solid rgb(var(--borges-rgb) / 0.14)',
                  backgroundColor: active ? 'var(--color-text-accent)' : 'transparent',
                  color: active ? 'var(--color-surface-sunken)' : 'var(--color-text-muted)',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {isAll ? 'All' : loc}
              </button>
            )
          })}
          {(selectedLocation || searchQuery) && (
            <button
              onClick={() => { setSelectedLocation(null); setSearchQuery('') }}
              className="flex-shrink-0 font-optima transition-opacity hover:opacity-70"
              style={{
                fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
                padding: '6px 18px', borderRadius: '999px',
                background: 'none', border: 'none',
                color: 'var(--color-text-accent)', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* ── Journey Map ── */}
      {mapPoints.length > 0 && (
        <div style={{ marginBottom: 'var(--pad-48)' }}>
          <TabMap
            points={mapPoints}
            title="Journey Map"
            height={240}
            showPath={mapPoints.length > 1}
            locationContext={locationContext}
          />
        </div>
      )}

      {/* ── Section separator ── */}
      {dayGroups.length > 0 && (
        <div className="flex justify-center" style={{ marginBottom: 'var(--pad-48)' }}>
          <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', letterSpacing: '6px' }}>· · ·</span>
        </div>
      )}

      {/* ── Day sections ── */}
      {dayGroups.map((group, dayIdx) => {
        const dateParts = parseDateParts(group.date)

        return (
          <div key={group.day} style={{ marginBottom: dayIdx < dayGroups.length - 1 ? '72px' : '0' }}>

            {/* Day header — number LEFT, info RIGHT */}
            <div className="flex items-start gap-5" style={{ marginBottom: '32px' }}>

              {/* Chapter number — Tan Mon Cheri, var(--fade), 64px */}
              {group.day !== 0 && (
                <span
                  className="font-tan-mon-cheri flex-shrink-0"
                  style={{
                    fontSize: '64px',
                    lineHeight: 1,
                    color: 'var(--color-text-muted)',
                    minWidth: '52px',
                    textAlign: 'right',
                    userSelect: 'none',
                  }}
                >
                  {group.day}
                </span>
              )}

              {/* Date + location */}
              <div style={{ paddingTop: group.day !== 0 ? '10px' : '0', flex: 1 }}>
                {dateParts && (
                  <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.5, color: 'var(--color-text)' }}>
                    {dateParts.weekday} {dateParts.dayMonth}
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: '4px' }}>
                  {group.location && (
                    <span className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)' }}>
                      {group.location}
                    </span>
                  )}
                  {group.date && group.location && (
                    <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>·</span>
                  )}
                  {group.date && group.location && (
                    <WeatherBadge location={group.location} date={group.date} />
                  )}
                  {group.location && (
                    <>

                    </>
                  )}
                </div>
                {/* Ochre rule */}
                <div style={{ width: '28px', height: '1.5px', backgroundColor: 'var(--color-text-accent)', marginTop: '10px' }} />
              </div>
            </div>

            {/* Experience cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {group.experiences.map((exp, expIdx) => (
                <ScrollReveal key={exp.id} delay={expIdx * 80}>
                  <ExperienceCard experience={exp} docs={docsMap[exp.id] ?? []} />
                </ScrollReveal>
              ))}
            </div>
          </div>
        )
      })}

      {filtered.length === 0 && (
        <div className="py-16 text-center">
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
            {searchQuery ? `No results for "${searchQuery}"` : `No experiences in ${selectedLocation}.`}
          </p>
          <button
            onClick={() => { setSearchQuery(''); setSelectedLocation(null) }}
            className="font-optima transition-opacity hover:opacity-70"
            style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', background: 'none', border: 'none', cursor: 'pointer', marginTop: '8px' }}
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  )
}
