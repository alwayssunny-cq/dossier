'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { getTripPhase } from '@/lib/tripPhase'

const TAB_LABELS: Record<string, string> = {
  today:                    'Today',
  brief:                    'First Steps',
  'dates-destinations':     'Dates & Destinations',
  itinerary:                'Experience Blueprint',
  experiences:              'Experiences',
  stays:                    'Stays',
  log:                      'Log',
  'your-trip':              'Your Days',
  'reservations-payments':  'Reservations',
}

const TAB_LABELS_CRAFTING: Record<string, string> = {
  'dates-destinations': 'Dates & Destinations',
  stays:                'Stay',
  experiences:          'Experiences',
  log:                  'Conversation Log',
}

const TAB_LABELS_BON_VOYAGE: Record<string, string> = {
  today:          'Today',
  brief:          'Overview',
  'your-trip':    'Your Days',
  'travel-guide': 'Need to Know',
  log:            'Log',
}

/**
 * Phones get about 90px per tab. "Dates & Destinations" does not fit in 90px
 * and never will, so the bottom bar uses a shorter name for the same place
 * rather than letting the full one run off the edge — which is what happened
 * before, with "Conversation Log" hanging 116px past the right of the screen.
 * Anything not listed here already fits.
 */
const SHORT_LABELS: Record<string, string> = {
  'dates-destinations':    'Dates',
  'reservations-payments': 'Reserve',
  'travel-guide':          'Know',
  itinerary:               'Blueprint',
  log:                     'Log',
}

export default function TripTabs({
  tripId,
  status,
  isLive = false,
  variant = 'top',
}: {
  tripId: string
  status: string | null
  isLive?: boolean
  /** 'top' is the inline row used from tablet up; 'bottom' is the phone bar. */
  variant?: 'top' | 'bottom'
}) {
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const version      = searchParams.get('version')
  const stageOverride = searchParams.get('stage')

  // Use mounted guard so SSR and client initial render agree (both use null override),
  // then after hydration switch to the real stageOverride for accurate tab filtering.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const { visibleTabs, actualPhase, viewingPhase } = getTripPhase(status, isLive, mounted ? stageOverride : null)
  const isBonVoyage = actualPhase === 'completed' || actualPhase === 'live'

  // The tabs come from the stage being VIEWED, so the names must too. Choosing
  // the map by the actual stage meant a Bon Voyage trip looking back at
  // Crafting asked the Bon Voyage map for 'stays' and 'experiences', got
  // nothing, and fell through to printing the raw route segment — which is why
  // the bar read "Dates  stays  experiences  Log", two of them lowercase.
  // Every map is consulted before giving up.
  const preferred =
    viewingPhase === 'crafting' ? TAB_LABELS_CRAFTING :
    isBonVoyage ? TAB_LABELS_BON_VOYAGE :
    TAB_LABELS
  const labelFor = (segment: string) =>
    preferred[segment]
    ?? TAB_LABELS_CRAFTING[segment]
    ?? TAB_LABELS_BON_VOYAGE[segment]
    ?? TAB_LABELS[segment]
    ?? segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  function tabHref(segment: string) {
    const base   = `/trip/${tripId}/${segment}`
    const params = new URLSearchParams()
    if (segment !== 'log' && version) params.set('version', version)
    if (stageOverride) params.set('stage', stageOverride)
    const q = params.toString()
    return q ? `${base}?${q}` : base
  }

  const isActive = (segment: string) => pathname.startsWith(`/trip/${tripId}/${segment}`)

  // The live-day marker, shared by both bars.
  const todayDot = (
    <span
      className="inline-block ml-1.5 align-middle rounded-full"
      style={{
        width: '5px', height: '5px',
        backgroundColor: 'var(--color-text-accent)',
        boxShadow: '0 0 0 2px rgb(var(--borges-rgb) / 0.25)',
        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }}
    />
  )

  // ── Phone: a fixed bar at the bottom of the screen ────────────────────────
  //
  // Two things drove this. The tab row used to sit at the top, under a hero, a
  // stage bar and an info strip — roughly 500px of furniture before a single
  // line of the trip appeared, on a screen 844px tall. And it scrolled
  // sideways, so the last tab was simply off the edge with no sign it was
  // there. Moving it to the bottom returns that height to the content and
  // puts the four destinations within reach of a thumb, which is where a
  // phone expects to find them.
  if (variant === 'bottom') {
    return (
      <nav
        className="flex md:hidden fixed left-0 right-0 bottom-0 z-40"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.18)',
          boxShadow: '0 -2px 20px rgb(var(--night-rgb) / 0.06)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        aria-label="Trip sections"
      >
        {visibleTabs.map(segment => {
          const active = isActive(segment)
          return (
            <Link
              key={segment}
              href={tabHref(segment)}
              aria-current={active ? 'page' : undefined}
              style={{
                // Equal columns: four of them always fill the width exactly,
                // so nothing can be pushed past the edge.
                flex: '1 1 0',
                minWidth: 0,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '60px',
                padding: '0 4px',
                textDecoration: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {active && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute', top: 0, left: '50%',
                    transform: 'translateX(-50%)',
                    width: '28px', height: '2px',
                    backgroundColor: 'var(--color-text)',
                  }}
                />
              )}
              <span
                className="font-optima"
                style={{
                  fontSize: 'var(--text-caption)',
                  color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {SHORT_LABELS[segment] ?? labelFor(segment)}
                {segment === 'today' && todayDot}
              </span>
            </Link>
          )
        })}
      </nav>
    )
  }

  // ── Tablet and up: the inline row, which has the width for full names ────
  return (
    // Pulled left by the tab's own padding so the first label starts on the
    // column, level with the section index and the headings beneath it. It
    // used to sit 14px inside, which read as a misalignment because it was one.
    <nav
      className="hidden md:flex overflow-x-auto scrollbar-hide"
      style={{ marginLeft: '-14px' }}
      aria-label="Trip sections"
    >
      {visibleTabs.map(segment => {
        const label  = labelFor(segment)
        const active = isActive(segment)
        return (
          <Link
            key={segment}
            href={tabHref(segment)}
            className="relative flex-shrink-0 text-center transition-colors"
            style={{ padding: '20px 14px 18px', textDecoration: 'none' }}
          >
            <span
              className={`font-optima text-body transition-colors duration-200 whitespace-nowrap ${
                active ? 'text-ink' : 'text-accent'
              }`}
            >
              {label}
              {segment === 'today' && todayDot}
            </span>
            {active && (
              <span
                className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-accent rounded-[1px]"
                style={{ width: '28px', height: '2px' }}
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
