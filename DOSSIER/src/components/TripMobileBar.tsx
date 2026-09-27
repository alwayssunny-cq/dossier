'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * The bar that tells you where you are and how to get out.
 *
 * On a phone the only way back was an arrow drawn over the hero photograph,
 * which is gone the moment you scroll. From then on the screen carried no
 * trip name, no stage and no way back — you could be three screens into any
 * of four journeys with nothing on screen saying which.
 *
 * This appears as soon as the hero leaves, and carries the three things that
 * were missing: out, which trip, and which stage of it. It hides again at the
 * top of the page, where the hero already says all three, so the photograph is
 * never covered by a duplicate of itself.
 */
export default function TripMobileBar({
  title,
  stage,
}: {
  title: string
  stage?: string | null
}) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    // Tied to the hero's height rather than a fixed number, so it appears the
    // moment the hero's own title is gone rather than at a guessed offset.
    const hero = document.querySelector('[data-trip-hero]') as HTMLElement | null
    const trigger = () => {
      const past = hero ? hero.offsetHeight - 56 : 200
      setShown(window.scrollY > past)
    }
    trigger()
    window.addEventListener('scroll', trigger, { passive: true })
    window.addEventListener('resize', trigger)
    return () => {
      window.removeEventListener('scroll', trigger)
      window.removeEventListener('resize', trigger)
    }
  }, [])

  return (
    <div
      className="md:hidden fixed top-0 left-0 right-0 z-40"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        height: 'var(--tripbar-h)',
        paddingInline: 'var(--space-2) var(--space-5)',
        backgroundColor: 'var(--color-surface)',
        borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.18)',
        // Slides out of the way rather than blinking, and is inert while away
        // so it cannot take a tap meant for the hero underneath.
        transform: shown ? 'translateY(0)' : 'translateY(-100%)',
        opacity: shown ? 1 : 0,
        pointerEvents: shown ? 'auto' : 'none',
        transition: 'transform var(--duration-fast) var(--ease-out), opacity var(--duration-fast) var(--ease-out)',
      }}
      aria-hidden={!shown}
    >
      <Link
        href="/dashboard"
        aria-label="Back to your dossier"
        style={{
          flexShrink: 0,
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text)',
          textDecoration: 'none',
          fontFamily: "'The Seasons', Georgia, serif",
          fontSize: 'var(--text-subhead)',
          lineHeight: 1,
        }}
        tabIndex={shown ? undefined : -1}
      >
        ←
      </Link>

      <span style={{ minWidth: 0, flex: 1 }}>
        <span
          className="font-optima"
          style={{
            display: 'block',
            fontSize: 'var(--text-body)',
            color: 'var(--color-text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.2,
          }}
        >
          {title}
        </span>
        {stage && (
          <span
            className="cq-label"
            style={{
              display: 'block',
              color: 'var(--color-text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {stage}
          </span>
        )}
      </span>
    </div>
  )
}
