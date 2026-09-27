'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Props {
  tripName: string
  destination: string | null
  stateCounty?: string | null
  townsCities?: string | null
  dateRange: string
  imageUrl: string | null
  isLive?: boolean
  clientName?: string | null
  travelerCount?: number
}

// Shown only when a trip has no photograph yet. It used to colour-code the
// country — crimson for Japan, gold for Africa, teal for the Maldives — which
// is the travel-poster shorthand the brand book rules out. It is now one quiet
// wash drawn from the palette; the destination shifts only the light's angle,
// so no two trips read identically and no invented hue enters the system.
function destinationGradient(dest: string | null): string {
  const d = dest ?? ''
  let hash = 0
  for (let i = 0; i < d.length; i++) hash = (hash * 31 + d.charCodeAt(i)) | 0
  const angle = 120 + (Math.abs(hash) % 90) // 120°–210°

  return `linear-gradient(${angle}deg,
    var(--night) 0%,
    rgb(var(--night-rgb) / 0.94) 38%,
    rgb(var(--borges-rgb) / 0.72) 74%,
    rgb(var(--night-rgb) / 0.97) 100%)`
}

export default function HeroBanner({
  tripName, destination, stateCounty, dateRange, imageUrl, isLive = false,
  travelerCount,
}: Props) {
  // Only the cover image chosen in Notion. There is no generated fallback:
  // a keyword-matched stock photo is precisely the advertisement energy the
  // brand book rules out, and it produced pictures with no relation to the
  // place. With no cover set, the gradient wash carries the hero alone.
  const imgSrc = imageUrl
  const [imgFailed, setImgFailed] = useState(false)

  // The reader is already inside their own dossier, so the hero does not
  // repeat their name back to them. It names the journey instead.
  const specificPlace = stateCounty ?? destination
  const headingText   = specificPlace ? `Into ${specificPlace}` : tripName

  const partySize = travelerCount && travelerCount > 0
    ? `${travelerCount} ${travelerCount === 1 ? 'traveller' : 'travellers'}`
    : null

  return (
    <div
      data-trip-hero
      className="relative w-full overflow-hidden"
      style={{
        aspectRatio: 'var(--hero-aspect)',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      {/* Gradient fallback — always behind, visible if image fails */}
      <div className="absolute inset-0" style={{ background: destinationGradient(destination) }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: 0.07,
            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
            backgroundSize: '160px 160px',
          }}
        />
      </div>
      {imgSrc && !imgFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc}
          alt={tripName}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'brightness(0.80)' }}
          onError={() => setImgFailed(true)}
        />
      )}

      {/* Cinematic gradient — bottom heavy */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to top, rgb(var(--night-rgb) / 0.92) 0%, rgb(var(--night-rgb) / 0.42) 38%, rgb(var(--night-rgb) / 0.08) 65%, transparent 100%)',
        }}
      />
      {/* Sides vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to right, rgb(var(--night-rgb) / 0.22) 0%, transparent 28%, transparent 72%, rgb(var(--night-rgb) / 0.22) 100%)',
        }}
      />

      {/* Back arrow */}
      <Link
        href="/dashboard"
        className="absolute transition-opacity hover:opacity-100 flex items-center justify-center"
        style={{
          // The arrow is drawn at the same size as before; the link around it
          // is 44px square. It was 20x20 — the smallest target in the dossier,
          // sitting over a photograph, and the way back out of every trip.
          top: '12px',
          left: '12px',
          width: '44px',
          height: '44px',
          color: 'rgb(var(--mist-rgb) / 0.6)',
          fontSize: 'var(--text-subhead)',
          lineHeight: 1,
          textDecoration: 'none',
          fontFamily: "'The Seasons', Georgia, serif",
        }}
        aria-label="Back to dashboard"
      >
        ←
      </Link>

      {/* Live badge */}
      {isLive && (
        <div
          className="absolute flex items-center gap-2"
          style={{ top: '24px', right: '24px' }}
        >
          <span className="relative flex" style={{ width: '7px', height: '7px' }}>
            <span
              className="absolute inline-flex rounded-full"
              style={{
                width: '100%', height: '100%',
                backgroundColor: 'var(--color-text-accent)', opacity: 0.5,
                animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
              }}
            />
            <span
              className="relative inline-flex rounded-full"
              style={{ width: '100%', height: '100%', backgroundColor: 'var(--color-text-accent)' }}
            />
          </span>
          <span
            className="font-optima"
            style={{
              fontSize: 'var(--text-caption)',
              letterSpacing: '0.01em',
              color: 'var(--color-text-secondary)',
            }}
          >
            Live Now
          </span>
        </div>
      )}

      {/* Text — bottom left */}
      <div
        className="absolute"
        style={{
          bottom: 'var(--hero-inset)',
          left: 'var(--hero-inset)',
          right: 'var(--hero-inset)',
        }}
      >
        {/* The country is dropped when the title already contains it: "Bosnia
            and Herzegovina" sat 32px above "Into Bosnia and Herzegovina". */}
        {destination && !headingText.toLowerCase().includes(destination.toLowerCase()) && (
          <p
            className="font-optima text-ink-inverse"
            style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', opacity: 0.72, marginBottom: '12px' }}
          >
            {destination}
          </p>
        )}
        {/* Tier 1. This carries the destination and the client's name, which
            makes it a critical informational header — the one thing Mon Cheri
            must never be asked to do. */}
        <h1
          className="cq-t1"
          style={{
            color: 'var(--color-text-inverse)',
            textShadow: '0 2px 32px rgb(var(--night-rgb) / 0.4)',
            marginBottom: '14px',
          }}
        >
          {headingText}
        </h1>
        {(dateRange || partySize) && (
          <p
            className="font-optima text-ink-inverse"
            style={{ fontSize: 'var(--text-caption)', opacity: 0.78 }}
          >
            {[dateRange, partySize].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </div>
  )
}
