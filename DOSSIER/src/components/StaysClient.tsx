'use client'

import { useState, useMemo } from 'react'
import type { Stay, Document } from '@/lib/types'
import StayCard from '@/components/StayCard'
import ScrollReveal from '@/components/ScrollReveal'

function fmtShort(d: string | null) {
  if (!d) return null
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  } catch { return null }
}

interface Props {
  stays: Stay[]
  docsMap: Record<string, Document[]>
}

export default function StaysClient({ stays, docsMap }: Props) {
  const [query, setQuery]     = useState('')
  const [activeDest, setDest] = useState<string | null>(null)

  const destinations = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const s of stays) {
      const d = s.destination ?? 'Other'
      if (!seen.has(d)) { seen.add(d); out.push(d) }
    }
    return out
  }, [stays])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return stays.filter(s => {
      if (activeDest && (s.destination ?? 'Other') !== activeDest) return false
      if (!q) return true
      return (
        s.property_name.toLowerCase().includes(q) ||
        (s.destination ?? '').toLowerCase().includes(q) ||
        (s.room_type ?? '').toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [stays, query, activeDest])

  // Group by destination
  const byDest: Record<string, Stay[]> = {}
  for (const stay of filtered) {
    const dest = stay.destination ?? 'Other'
    if (!byDest[dest]) byDest[dest] = []
    byDest[dest].push(stay)
  }

  const showSearch = stays.length > 2

  return (
    <>
      {/* ── Search / Filter ── */}
      {showSearch && (
        <div style={{ marginBottom: '36px' }}>
          {/* Search input */}
          <div className="relative" style={{ marginBottom: destinations.length > 1 ? '14px' : '0' }}>
            <svg
              width="13" height="13" viewBox="0 0 14 14" fill="none"
              className="absolute pointer-events-none"
              style={{ left: '0', top: '50%', transform: 'translateY(-50%)' }}
            >
              <circle cx="6" cy="6" r="4.5" stroke="#6B696C" strokeWidth="1.2"/>
              <path d="M9.5 9.5L12 12" stroke="#6B696C" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="Search accommodations…" aria-label="Search accommodations"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full font-optima bg-transparent outline-none"
              style={{
                paddingLeft: '22px',
                paddingBottom: '10px',
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text)',
                borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
                caretColor: 'var(--color-text-accent)',
              }}
            />
          </div>

          {/* Destination filter pills */}
          {destinations.length > 1 && (
            <div className="flex flex-wrap gap-2" style={{ paddingTop: '4px' }}>
              {destinations.map(dest => (
                <button
                  key={dest}
                  onClick={() => setDest(activeDest === dest ? null : dest)}
                  className="font-optima transition-all"
                  style={{
                    fontSize: 'var(--text-caption)',
                    letterSpacing: '0.01em',
                    padding: '4px 12px',
                    borderRadius: '999px',
                    border: activeDest === dest ? 'none' : '0.5px solid rgb(var(--borges-rgb) / 0.13)',
                    backgroundColor: activeDest === dest ? 'var(--color-text-accent)' : 'transparent',
                    color: activeDest === dest ? 'var(--color-surface-sunken)' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {dest}
                </button>
              ))}
              {activeDest && (
                <button
                  onClick={() => setDest(null)}
                  className="font-optima transition-opacity hover:opacity-60"
                  style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', marginBottom: '6px', color: 'var(--color-text-muted)' }}>No results</p>
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>Try adjusting your search.</p>
        </div>
      )}

      {/* ── Destination groups ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '56px' }}>
        {Object.entries(byDest).map(([destination, destStays]) => {
          const allDates = destStays.flatMap(s => [s.check_in, s.check_out].filter(Boolean)).sort()
          const groupIn  = allDates[0] ?? null
          const groupOut = allDates[allDates.length - 1] ?? null
          const totalNights = destStays.reduce((n, s) => n + (s.nights ?? 0), 0)

          return (
            <section key={destination}>
              {/* Destination header */}
              <div style={{ marginBottom: '24px' }}>
                <h3 className="cq-t1" style={{ fontSize: 'var(--text-t1)', lineHeight: 1.1, color: 'var(--color-text)' }}>
                  {destination}
                </h3>
                {(groupIn || groupOut) && (
                  <p className="font-optima" style={{ fontSize: 'var(--text-caption)', marginTop: '4px', color: 'var(--color-text-muted)' }}>
                    {fmtShort(groupIn)}{groupOut && groupOut !== groupIn ? ` – ${fmtShort(groupOut)}` : ''}
                    {totalNights > 0 && ` · ${totalNights} night${totalNights !== 1 ? 's' : ''}`}
                  </p>
                )}
                <div style={{ width: '32px', height: '1.5px', backgroundColor: 'var(--color-text-accent)', marginTop: '8px' }} />
              </div>

              {/* Stay cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {destStays.map((stay, stayIdx) => (
                  <ScrollReveal key={stay.id} delay={stayIdx * 80}>
                    <StayCard stay={stay} docs={docsMap[stay.id] ?? []} />
                  </ScrollReveal>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}
