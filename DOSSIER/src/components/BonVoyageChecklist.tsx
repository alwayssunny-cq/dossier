'use client'

import Link from 'next/link'
import { useState } from 'react'

interface CheckItem {
  label: string
  sub: string
  href?: string
}

export default function BonVoyageChecklist({
  tripId,
}: {
  tripId: string
}) {
  const items: CheckItem[] = [
    { label: 'Review your itinerary',    sub: 'Check experiences, stays, and transfers', href: `/trip/${tripId}/experiences` },
    { label: 'Check passport validity',  sub: 'Valid for ≥ 6 months past return date',  href: undefined },
    { label: 'Download travel documents', sub: 'Boarding passes, confirmations, visas',  href: `/trip/${tripId}/documents` },
    { label: 'Pack your bags',           sub: 'See the packing guide in Travel Guide',   href: `/trip/${tripId}/travel-guide` },
    { label: 'Set up currency converter', sub: 'Use the converter button on any page',   href: undefined },
    { label: 'Read the travel guide',    sub: 'Language, culture, movies, and more',    href: `/trip/${tripId}/travel-guide` },
  ]

  const [checked, setChecked] = useState<Set<number>>(new Set())

  const toggle = (i: number) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  const done = checked.size
  const pct  = Math.round((done / items.length) * 100)

  return (
    <div>
      {/* Progress bar */}
      <div style={{ marginBottom: '16px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
            {done} of {items.length} complete
          </p>
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: done === items.length ? 'var(--color-text-accent)' : 'var(--color-text-accent)' }}>
            {pct}%
          </p>
        </div>
        <div style={{ height: '2px', backgroundColor: 'rgb(var(--borges-rgb) / 0.14)', borderRadius: '999px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              backgroundColor: done === items.length ? 'var(--color-text-accent)' : 'var(--color-text-accent)',
              borderRadius: '999px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((item, i) => {
          const isChecked = checked.has(i)
          const content = (
            <div
              key={i}
              onClick={() => toggle(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '14px 18px',
                borderRadius: '10px',
                backgroundColor: isChecked ? 'rgb(var(--borges-rgb) / 0.06)' : 'var(--color-surface-sunken)',
                border: `0.5px solid ${isChecked ? 'rgb(var(--borges-rgb) / 0.2)' : 'rgb(var(--borges-rgb) / 0.10)'}`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                userSelect: 'none',
              }}
            >
              {/* Checkbox */}
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: isChecked ? 'var(--color-text-accent)' : 'transparent',
                border: `1.5px solid ${isChecked ? 'var(--color-text-accent)' : 'rgb(var(--fade-rgb) / 0.2)'}`,
                transition: 'all 0.2s ease',
              }}>
                {isChecked && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5L8 3" stroke="#F3EFE9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="font-optima" style={{
                  fontSize: 'var(--text-body)',
                  color: isChecked ? 'rgb(var(--night-rgb) / 0.35)' : 'var(--color-text)',
                  textDecoration: isChecked ? 'line-through' : 'none',
                  transition: 'all 0.2s ease',
                }}>
                  {item.label}
                </p>
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {item.sub}
                </p>
              </div>
              {item.href && !isChecked && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M2 8L8 2M8 2H3M8 2v5" stroke="#6B696C" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          )

          if (item.href && !isChecked) {
            return (
              <Link key={i} href={item.href} style={{ textDecoration: 'none' }}>
                {content}
              </Link>
            )
          }
          return <div key={i}>{content}</div>
        })}
      </div>

      {done === items.length && (
        <div style={{
          marginTop: '16px', padding: '14px 18px', borderRadius: '10px', textAlign: 'center',
          backgroundColor: 'rgb(var(--borges-rgb) / 0.08)',
          border: '0.5px solid rgb(var(--borges-rgb) / 0.25)',
        }}>
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)' }}>
            You&rsquo;re ready. Have an extraordinary journey.
          </p>
        </div>
      )}
    </div>
  )
}
