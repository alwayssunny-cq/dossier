'use client'

import { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JourneyStop {
  location:   string
  startDate:  string    // YYYY-MM-DD
  endDate:    string    // YYYY-MM-DD
  dayNumbers: number[]
  stopIndex:  number    // 1-based
}

interface Props {
  stops:      JourneyStop[]
  activeDate: string | null  // today's date if trip is live, else null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatStopDates(start: string, end: string): string {
  try {
    const s = new Date(start + 'T00:00:00')
    const e = new Date(end   + 'T00:00:00')
    if (start === end) {
      return s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    }
    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
      return `${s.getDate()}–${e.getDate()} ${s.toLocaleDateString('en-GB', { month: 'short' })}`
    }
    return `${s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  } catch { return '' }
}

function scrollToDay(date: string) {
  const el = document.getElementById(`day-${date}`)
  if (!el) return
  const stickyOffset = 58 + 49 + 12
  const top = el.getBoundingClientRect().top + window.scrollY - stickyOffset
  window.scrollTo({ top, behavior: 'smooth' })
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GOLD     = 'var(--color-text-accent)'
const GOLD_DIM = 'rgb(var(--borges-rgb) / 0.35)'
const GOLD_MID = 'rgb(var(--borges-rgb) / 0.6)'
const CREAM    = 'var(--color-text)'
const CREAM_MID = 'rgb(var(--night-rgb) / 0.45)'

// ── Component ──────────────────────────────────────────────────────────────────

export default function JourneyStrip({ stops, activeDate }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (stops.length < 2) return null

  const today = activeDate ?? ''
  const activeStopIdx = today
    ? stops.findIndex(s => s.startDate <= today && today <= s.endDate)
    : -1

  return (
    <div
      style={{
        position:    'relative',
        background:  'transparent',
        borderTop:   '0.5px solid rgb(var(--borges-rgb) / 0.14)',
        borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
        overflow:    'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '20px 28px 0',
        }}
      >
        <span
          className="font-optima"
          style={{
            fontSize: 'var(--text-caption)',
            letterSpacing: '0.01em',
            color:         GOLD_MID,

          }}
        >
          Journey Route
        </span>
        <span
          className="font-optima"
          style={{
            fontSize: 'var(--text-caption)',
            letterSpacing: '0.01em',
            color:         GOLD_DIM,
          }}
        >
          {stops.length} stops
        </span>
      </div>

      {/* Scrollable strip */}
      <div
        style={{
          display:                 'flex',
          alignItems:              'flex-start',
          overflowX:               'auto',
          padding:                 '22px 28px 28px',
          scrollbarWidth:          'none',
          msOverflowStyle:         'none',
          scrollSnapType:          'x proximity',
          WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}
      >
        {stops.map((stop, i) => {
          const isActive  = i === activeStopIdx
          const isPast    = activeStopIdx > -1 && i < activeStopIdx
          const isHovered = hoveredIdx === i
          const dateLabel = formatStopDates(stop.startDate, stop.endDate)

          // Circle appearance
          const circleBg     = isActive ? GOLD : isPast ? 'rgb(var(--borges-rgb) / 0.12)' : 'rgb(var(--borges-rgb) / 0.10)'
          const circleBorder = isActive
            ? `1.5px solid ${GOLD}`
            : isPast
            ? '1px solid rgb(var(--borges-rgb) / 0.3)'
            : '1px solid rgb(var(--borges-rgb) / 0.15)'
          const circleGlow   = isActive
            ? '0 2px 18px rgb(var(--borges-rgb) / 0.22), 0 0 0 3px rgb(var(--borges-rgb) / 0.1)'
            : isHovered
            ? '0 2px 12px rgb(var(--borges-rgb) / 0.1)'
            : 'none'

          // Text colors
          const numColor  = isActive ? 'var(--color-surface)' : isPast ? GOLD_DIM  : GOLD_MID
          const nameColor = isActive ? CREAM     : isPast ? CREAM_MID : CREAM_MID
          const dateColor = isActive ? GOLD_MID  : isPast ? GOLD_DIM  : GOLD_DIM

          // Connector
          const connectorBg = isPast
            ? `linear-gradient(90deg, ${GOLD_MID}, ${GOLD_DIM})`
            : 'rgb(var(--borges-rgb) / 0.2)'

          return (
            <div
              key={stop.stopIndex}
              style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}
            >
              {/* Stop node */}
              <button
                onClick={() => scrollToDay(stop.startDate)}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  display:         'flex',
                  flexDirection:   'column',
                  alignItems:      'center',
                  gap:             '11px',
                  background:      'none',
                  border:          'none',
                  cursor:          'pointer',
                  padding:         '0 4px',
                  width:           '116px',
                  flexShrink:      0,
                  scrollSnapAlign: 'start',
                  transform:       isHovered ? 'translateY(-2px) scale(1.03)' : 'translateY(0) scale(1)',
                  transition:      'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                } as React.CSSProperties}
              >
                {/* Circle */}
                <div
                  style={{
                    width:           '50px',
                    height:          '50px',
                    borderRadius:    '50%',
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    flexShrink:      0,
                    backgroundColor: circleBg,
                    border:          circleBorder,
                    boxShadow:       circleGlow,
                    transition:      'all 0.3s ease',
                  }}
                >
                  <span
                    className="font-optima"
                    style={{
                      fontSize:   '17px',
                      color:      numColor,
                      fontWeight: 400,
                      lineHeight: 1,
                      userSelect: 'none',
                      transition: 'color 0.3s ease',
                    }}
                  >
                    {stop.stopIndex}
                  </span>
                </div>

                {/* Location name */}
                <p
                  className="font-optima"
                  style={{
                    fontSize: 'var(--text-body)',
                    color:      nameColor,
                    lineHeight: 1.35,
                    textAlign:  'center',
                    margin:     0,
                    width:      '108px',
                    wordBreak:  'break-word',
                    whiteSpace: 'normal',
                    transition: 'color 0.3s ease',
                  }}
                >
                  {stop.location}
                </p>

                {/* Date range */}
                {dateLabel && (
                  <p
                    className="font-optima"
                    style={{
                      fontSize: 'var(--text-caption)',
                      letterSpacing: '0.07em',
                      color:         dateColor,
                      textAlign:     'center',
                      margin:        '-5px 0 0',
                      whiteSpace:    'nowrap',
                      transition:    'color 0.3s ease',
                    }}
                  >
                    {dateLabel}
                  </p>
                )}
              </button>

              {/* Connector line — aligns with circle center (50/2 = 25px) */}
              {i < stops.length - 1 && (
                <div
                  style={{
                    width:      '36px',
                    flexShrink: 0,
                    height:     '1px',
                    marginTop:  '25px',
                    background: connectorBg,
                    transition: 'background 0.4s ease',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Right fade — matches dark parent bg */}
      <div
        style={{
          position:      'absolute',
          right:         0,
          top:           0,
          bottom:        0,
          width:         '48px',
          background:    'linear-gradient(to right, rgb(var(--night-rgb) / 0), rgb(var(--night-rgb) / 0.95))',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
