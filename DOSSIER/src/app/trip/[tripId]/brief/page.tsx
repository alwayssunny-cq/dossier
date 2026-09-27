import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { Trip, Traveler, DestinationInfo } from '@/lib/types'
import { getTripPhase } from '@/lib/tripPhase'
import { DESTINATION_DATA, PHRASES, fetchWeather } from '@/lib/destinationData'
import type { WeatherSummary } from '@/lib/destinationData'
import QuickLinkCard from '@/components/QuickLinkCard'
import BonVoyageChecklist from '@/components/BonVoyageChecklist'
import ItineraryDrawer from '@/components/ItineraryDrawer'
import AboutDestinationCard from '@/components/AboutDestinationCard'
import ResfeberEngine from '@/components/ResfeberEngine'
import SectionIndex from '@/components/SectionIndex'

// ── Shared helpers ─────────────────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return null
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return null }
}

function nightsCount(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const d = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000)
  return d > 0 ? d : null
}

function statusLabel(status: string | null): string {
  const map: Record<string, string> = {
    'first steps': 'First Steps', 'first-steps': 'First Steps',
    crafting: 'Crafting', 'the crafting': 'Crafting',
    reservations: 'Reservations', 'bon voyage': 'Bon Voyage',
  }
  return map[(status ?? '').toLowerCase()] ?? (status ?? 'In Progress')
}

const CARD_SHADOW = '0 2px 4px rgb(var(--night-rgb) / 0.05), 0 12px 32px rgb(var(--night-rgb) / 0.09)'

function Divider() {
  return <div style={{ height: '0.5px', backgroundColor: 'rgb(var(--borges-rgb) / 0.14)', margin: '48px 0' }} />
}

function SectionLabel({ n, children }: { n?: number; children: React.ReactNode }) {
  return <SectionIndex index={n} title={children} />
}

/** Narrative sentence + town route dots/lines */
function DestinationNarrative({ trip }: { trip: Trip }) {
  const towns = trip.towns_cities
    ? trip.towns_cities.split(',').map(t => t.trim()).filter(Boolean)
    : []

  const hasNarrative = trip.state_county || trip.destination_country || towns.length > 0
  if (!hasNarrative) return null

  // Narrative text
  const headingParts: string[] = []
  if (trip.state_county && trip.destination_country)
    headingParts.push(`${trip.state_county}, ${trip.destination_country}`)
  else if (trip.state_county)
    headingParts.push(trip.state_county)
  else if (trip.destination_country)
    headingParts.push(trip.destination_country)

  const narrativeLine = headingParts.length > 0
    ? `You're heading to ${headingParts.join('')}`
    : null

  const exploringLine = towns.length > 0
    ? `Exploring ${towns.slice(0, 4).join(', ')}${towns.length > 4 ? ` +${towns.length - 4} more` : ''}`
    : null

  return (
    <div style={{ marginBottom: '28px' }}>
      {/* Narrative text */}
      {narrativeLine && (
        <p className="font-optima"
          style={{ fontSize: 'var(--text-body)', lineHeight: 1.5, color: 'var(--color-text)', marginBottom: exploringLine ? '6px' : '0' }}>
          {narrativeLine}.
        </p>
      )}
      {exploringLine && (
        <p className="font-optima"
          style={{ fontSize: 'var(--text-caption)', lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
          {exploringLine}.
        </p>
      )}

      {/* Route dots/lines visual */}
      {towns.length >= 2 && (
        <div
          className="flex items-center flex-wrap"
          style={{ marginTop: '16px', gap: '0' }}
        >
          {towns.slice(0, 5).map((town, i) => (
            <div key={town} className="flex items-center">
              {/* Dot + town label */}
              <div className="flex flex-col items-center" style={{ gap: '5px' }}>
                <div style={{
                  width: i === 0 || i === Math.min(towns.length, 5) - 1 ? '8px' : '6px',
                  height: i === 0 || i === Math.min(towns.length, 5) - 1 ? '8px' : '6px',
                  borderRadius: '50%',
                  backgroundColor: i === 0 || i === Math.min(towns.length, 5) - 1
                    ? 'var(--color-text-accent)'
                    : 'rgb(var(--borges-rgb) / 0.45)',
                  border: '0.5px solid rgb(var(--borges-rgb) / 0.5)',
                  flexShrink: 0,
                }} />
                <p className="font-optima text-center"
                  style={{
                    fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
                    color: i === 0 || i === Math.min(towns.length, 5) - 1 ? 'var(--color-text-accent)' : 'var(--color-text-muted)',
                    whiteSpace: 'nowrap',
                    maxWidth: '64px', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                  {town}
                </p>
              </div>
              {/* Connector line */}
              {i < Math.min(towns.length, 5) - 1 && (
                <div style={{
                  height: '1px',
                  width: '28px',
                  backgroundColor: 'rgb(var(--borges-rgb) / 0.25)',
                  marginBottom: '14px',
                  flexShrink: 0,
                }} />
              )}
            </div>
          ))}
          {towns.length > 5 && (
            <div className="flex items-center">
              <div style={{
                height: '1px', width: '16px',
                backgroundColor: 'rgb(var(--borges-rgb) / 0.15)',
                marginBottom: '14px',
              }} />
              <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
                +{towns.length - 5}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


function JourneyGrid({ trip, travelerCount, hideDestination = false }: { trip: Trip; travelerCount: number; hideDestination?: boolean }) {
  const nights   = nightsCount(trip.start_date, trip.end_date)
  const startFmt = formatDate(trip.start_date)
  const endFmt   = formatDate(trip.end_date)

  // Build a specific destination label: "Nagaland, India" or just "India"
  const destLabel = trip.state_county && trip.destination_country
    ? `${trip.state_county}, ${trip.destination_country}`
    : trip.state_county ?? trip.destination_country

  const rows = [
    !hideDestination ? { label: 'Destination', value: destLabel } : null,
    { label: 'Departs',     value: startFmt },
    { label: 'Returns',     value: endFmt },
    { label: 'Duration',    value: nights ? `${nights} night${nights !== 1 ? 's' : ''}` : null },
    { label: 'Travellers',  value: travelerCount > 0 ? `${travelerCount} ${travelerCount === 1 ? 'person' : 'people'}` : null },
  ].filter((r): r is { label: string; value: string } => !!r && !!r.value)

  return (
    <div style={{
      backgroundColor: 'var(--color-surface-sunken)',
      border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
      borderRadius: '12px',
      padding: '28px 32px',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '24px',
      boxShadow: CARD_SHADOW,
    }}>
      {rows.map(row => (
        <div key={row.label}>
          <p className="font-optima"
            style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
            {row.label}
          </p>
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
            {row.value}
          </p>
        </div>
      ))}
    </div>
  )
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function TravelerCards({ travelers }: { travelers: Traveler[] }) {
  if (!travelers.length) return null

  return (
    <div style={{
      marginTop: '32px',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      gap: '12px',
    }}>
      {travelers.map(t => {
        const isPrimary = !!t.is_primary
        const dietChips = [...(t.diet_type ?? []), ...(t.restrictions ?? [])].filter(Boolean)
        const allergyChips = (t.allergies ?? []).filter(Boolean)
        const hasDetails = allergyChips.length > 0 || dietChips.length > 0 || !!t.notes

        return (
          <div key={t.id} style={{
            backgroundColor: 'rgb(var(--borges-rgb) / 0.04)', border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
            borderRadius: '10px', padding: '24px 26px', boxShadow: CARD_SHADOW,
          }}>
            <div className="flex items-center" style={{ gap: '10px', marginBottom: hasDetails ? '16px' : 0 }}>
              <div style={{
                flexShrink: 0, width: '30px', height: '30px', borderRadius: '50%',
                backgroundColor: 'rgb(var(--borges-rgb) / 0.18)', border: '0.5px solid rgb(var(--borges-rgb) / 0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', }}>
                  {initials(t.full_name)}
                </span>
              </div>
              <div>
                <p className="font-optima" style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.5 }}>
                  {t.full_name}
                </p>
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)' }}>
                  {isPrimary ? 'Primary' : (t.relationship || 'Companion')}
                </p>
              </div>
            </div>

            {allergyChips.length > 0 && (
              <div style={{ marginBottom: (dietChips.length > 0 || t.notes) ? '10px' : 0 }}>
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                  Allergies
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {allergyChips.map((item, i) => (
                    <span key={i} className="inline-block font-optima" style={{
                      fontSize: 'var(--text-caption)', letterSpacing: '0.01em', padding: '3px 10px', borderRadius: '999px',
                      backgroundColor: 'rgb(var(--borges-rgb) / 0.08)', border: '0.5px solid rgb(var(--borges-rgb) / 0.2)', color: 'var(--color-text-accent)',
                    }}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {dietChips.length > 0 && (
              <div style={{ marginBottom: t.notes ? '10px' : 0 }}>
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                  Dietary
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {dietChips.map((item, i) => (
                    <span key={i} className="inline-block font-optima" style={{
                      fontSize: 'var(--text-caption)', letterSpacing: '0.01em', padding: '3px 10px', borderRadius: '999px',
                      backgroundColor: 'rgb(var(--borges-rgb) / 0.08)', border: '0.5px solid rgb(var(--borges-rgb) / 0.2)', color: 'var(--color-text-accent)',
                    }}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {t.notes && (
              <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.65 }}>
                {t.notes}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── First Steps content ────────────────────────────────────────────────────────

const CQ_STEPS = [
  { n: 1, title: 'First Steps',  body: 'We study your details and begin to understand your vision.' },
  { n: 2, title: 'Crafting',     body: 'Your itinerary takes shape — destinations, stays, and experiences.' },
  { n: 3, title: 'Reservations', body: 'Everything is booked and confirmed, ready for departure.' },
  { n: 4, title: 'Bon Voyage',   body: 'Your journey begins.' },
]

// Renders a single insight line, turning ==phrase== into highlighted spans
function InsightLine({ text, isLast }: { text: string; isLast: boolean }) {
  const parts = text.split(/(==.+?==)/)
  return (
    <p className="font-optima" style={{
      fontSize: 'var(--text-body)',
      lineHeight: 1.9,
      color: 'var(--color-text-secondary)',
      marginBottom: isLast ? 0 : '18px',
      letterSpacing: '0.01em',
    }}>
      {parts.map((part, i) => {
        if (part.startsWith('==') && part.endsWith('==')) {
          return (
            <mark key={i} style={{
              background: 'linear-gradient(120deg, rgb(var(--borges-rgb) / 0) 0%, rgb(var(--borges-rgb) / 0.15) 15%, rgb(var(--borges-rgb) / 0.15) 85%, rgb(var(--borges-rgb) / 0) 100%)',
              color: 'var(--color-text)',
              borderRadius: '2px',
              padding: '1px 3px',
              fontStyle: 'italic',
            }}>
              {part.slice(2, -2)}
            </mark>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </p>
  )
}

function ReadingInsightsBlock({ insights }: { insights: string }) {
  const lines = insights.split(/\n+/).filter(Boolean)
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{
        borderLeft: '1.5px solid rgb(var(--borges-rgb) / 0.3)',
        paddingLeft: '28px',
      }}>
        {lines.map((line, i) => (
          <InsightLine key={i} text={line} isLast={i === lines.length - 1} />
        ))}
      </div>
    </div>
  )
}

// ── Glimpse ─────────────────────────────────────────────────────────────────────

function GlimpseSection({ link }: { link: string | null }) {
  if (link) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block', marginBottom: 'var(--pad-40)' }}>
        <div style={{
          backgroundColor: 'var(--color-text)', borderRadius: '12px', padding: '28px 30px',
          boxShadow: '0 3px 6px rgb(var(--night-rgb) / 0.10), 0 16px 40px rgb(var(--night-rgb) / 0.16)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
        }}>
          <div>
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'rgb(var(--fade-rgb) / 0.78)', marginBottom: '6px' }}>
              A first hint
            </p>
            <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-surface)' }}>
              View your Glimpse
            </p>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <path d="M3 8h10M9 4l4 4-4 4" stroke="#FFFCF8" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </a>
    )
  }
  return (
    <div style={{
      backgroundColor: 'rgb(var(--borges-rgb) / 0.04)', border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
      borderRadius: '12px', padding: '28px 30px', marginBottom: 'var(--pad-40)', boxShadow: CARD_SHADOW,
    }}>
      <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
        A first hint
      </p>
      <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)' }}>
        Your Glimpse is being prepared
      </p>
    </div>
  )
}

// ── About Destination ────────────────────────────────────────────────────────

function FirstStepsBrief({
  trip,
  travelers,
  tripId,
  destinationInfo,
  weather,
  travelDateLabel,
  destinationTz,
  currency,
  phrases,
  languageLabel,
}: {
  trip: Trip
  travelers: Traveler[]
  tripId: string
  destinationInfo: DestinationInfo | null
  weather: WeatherSummary | null
  travelDateLabel: string | null
  destinationTz: string | null
  currency: string | null
  phrases: { en: string; local: string; pronunciation?: string }[] | null
  languageLabel: string | null
}) {
  // This view only renders while the trip is in the First Steps phase — step 1 of the journey.
  const currentStep = 1

  return (
    <>
      {/* Section 1 — Your Journey Begins */}
      <div style={{
        backgroundColor: 'rgb(var(--borges-rgb) / 0.05)',
        border: '0.5px solid rgb(var(--borges-rgb) / 0.15)',
        borderRadius: '12px',
        padding: '26px 30px',
        marginBottom: 'var(--pad-40)',
        boxShadow: CARD_SHADOW,
      }}>
        <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.75, color: 'var(--color-text-secondary)' }}>
          We&rsquo;re excited to start designing your experience. Over the coming days, we&rsquo;ll be in touch to begin the journey together.
        </p>
      </div>

      <GlimpseSection link={trip.glimpse_link} />

      <SectionLabel n={1}>Your Journey</SectionLabel>
      <JourneyGrid trip={trip} travelerCount={travelers.length} hideDestination />
      <TravelerCards travelers={travelers} />

      <Divider />

      {/* Section 2 — The Reading */}
      <SectionLabel n={2}>The Reading</SectionLabel>

      {trip.reading_insights ? (
        <ReadingInsightsBlock insights={trip.reading_insights} />
      ) : (
        <div style={{
          backgroundColor: 'rgb(var(--borges-rgb) / 0.04)',
          border: '0.5px solid rgb(var(--borges-rgb) / 0.12)',
          borderRadius: '12px',
          padding: '28px',
          marginBottom: '8px',
        }}>
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
            Your Reading insights will appear here once your session is complete.
          </p>
        </div>
      )}

      <Divider />

      {/* Section 3 — Know the destination: essentials, language, and local media as one chapter */}
      <SectionLabel n={3}>Know {trip.destination_country ?? 'Your Destination'}</SectionLabel>
      <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.75, color: 'var(--color-text-secondary)', marginBottom: '28px' }}>
        The essentials before you go — climate, currency, and time, then the language and what locals watch and listen to.
      </p>

      <p className="font-optima" style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--color-text)', marginBottom: '14px' }}>
        The Essentials
      </p>
      <AboutDestinationCard
        weather={weather} travelDateLabel={travelDateLabel} destinationTz={destinationTz}
        currency={currency} destinationInfo={destinationInfo}
      />

      <div style={{ marginTop: '28px' }}>
        <ResfeberEngine
          phrases={phrases} languageLabel={languageLabel}
          localMedia={destinationInfo?.local_media ?? null}
        />
      </div>

      <Divider />

      {/* Section 5 — Process Explained */}
      <SectionLabel n={4}>Process Explained</SectionLabel>
      <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.75, color: 'var(--color-text-secondary)', marginBottom: '28px' }}>
        Every CQ journey moves through the same four phases, from first contact to departure. Here&rsquo;s where you are.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {CQ_STEPS.map((step) => {
          const isCurrent = step.n === currentStep
          const isDone    = step.n < currentStep

          return (
            <div key={step.n} style={{
              backgroundColor: isCurrent ? 'rgb(var(--borges-rgb) / 0.10)' : 'var(--color-surface-sunken)',
              border: isCurrent
                ? '0.5px solid rgb(var(--borges-rgb) / 0.45)'
                : '0.5px solid rgb(var(--borges-rgb) / 0.10)',
              borderRadius: '12px',
              padding: '24px 24px',
              boxShadow: CARD_SHADOW,
            }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span className="font-optima" style={{
                  fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
                  color: isCurrent ? 'var(--color-text-accent)' : 'var(--color-text-muted)',
                }}>
                  0{step.n}
                </span>
                {isDone ? (
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '50%',
                    backgroundColor: 'rgb(var(--borges-rgb) / 0.15)',
                    border: '0.5px solid rgb(var(--borges-rgb) / 0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4l2 2L6.5 2" stroke="#706E56" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                ) : isCurrent ? (
                  <span className="font-optima" style={{
                    fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
                    padding: '2px 8px', borderRadius: '999px',
                    backgroundColor: 'var(--color-text-accent)', color: 'var(--color-text-inverse)',
                  }}>
                    Now
                  </span>
                ) : null}
              </div>

              <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.5, color: 'var(--color-text)', marginBottom: '7px' }}>
                {step.title}
              </p>
              <p className="font-optima" style={{ fontSize: 'var(--text-caption)', lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
                {step.body}
              </p>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ── Bon Voyage Brief ───────────────────────────────────────────────────────────

const BON_VOYAGE_LINKS = [
  { segment: 'travel-guide', label: 'Travel Guide', desc: 'Language, culture, movies, and packing' },
  { segment: 'experiences',  label: 'Experiences',  desc: 'Every moment of your itinerary'         },
  { segment: 'stays',        label: 'Stay',          desc: 'Your accommodations, confirmed'         },
  { segment: 'documents',    label: 'Documents',     desc: 'Boarding passes, tickets, vouchers'     },
]

function BonVoyageBrief({
  trip, travelers, tripId,
  isLivePage, todayStr,
  todayExps, todayTransfers, todayStay, nextExps,
}: {
  trip: Trip
  travelers: Traveler[]
  tripId: string
  isLivePage: boolean
  todayStr: string
  todayExps: { title: string; location: string | null; time_of_day: string | null }[]
  todayTransfers: { from_location: string | null; to_location: string | null; transfer_mode: string | null; carrier: string | null }[]
  todayStay: { property_name: string; destination: string | null; check_in: string | null; check_out: string | null } | null
  nextExps: { title: string; location: string | null; time_of_day: string | null; date: string | null }[]
}) {
  const todayMs  = new Date(todayStr + 'T00:00:00').getTime()
  const startMs  = trip.start_date ? new Date(trip.start_date + 'T00:00:00').getTime() : null
  const endMs    = trip.end_date   ? new Date(trip.end_date   + 'T00:00:00').getTime() : null
  const isPast   = endMs !== null && endMs < todayMs
  const daysToGo = startMs ? Math.ceil((startMs - todayMs) / 86400000) : null

  const startLabel = trip.start_date
    ? new Date(trip.start_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const endLabel = trip.end_date
    ? new Date(trip.end_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  // For "next coming" — find the earliest date in nextExps and group by it
  const nextDate = nextExps.length > 0 ? nextExps[0].date : null
  const nextDateExps = nextDate ? nextExps.filter(e => e.date === nextDate) : []
  const nextDateLabel = nextDate
    ? new Date(nextDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    : null

  const todayLabel = new Date(todayStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const hasActivityToday = todayExps.length > 0 || todayTransfers.length > 0 || !!todayStay

  return (
    <>
      {/* ── Section 1: Readiness — countdown / live status first ───────────────────────────────── */}
      <div style={{
        backgroundColor: 'rgb(var(--borges-rgb) / 0.06)', border: '0.5px solid rgb(var(--borges-rgb) / 0.18)',
        borderRadius: '16px', padding: '28px 24px', textAlign: 'center', marginBottom: '32px',
      }}>
        {isLivePage ? (
          <>
            {/* Tier 1, not Tier 0 — Mon Cheri is never set in full sentences. */}
            <p className="cq-t1" style={{ color: 'var(--color-text-accent)', marginBottom: '8px' }}>
              Your journey has begun.
            </p>
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
              {trip.destination_country && `${trip.destination_country} · `}
              {startLabel && endLabel && `${startLabel} – ${endLabel}`}
            </p>
          </>
        ) : isPast ? (
          <>
            <p className="cq-t1" style={{ color: 'var(--color-text-accent)', marginBottom: '8px' }}>
              What a journey.
            </p>
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
              {trip.destination_country && `${trip.destination_country} · `}
              {startLabel && endLabel && `${startLabel} – ${endLabel}`}
            </p>
          </>
        ) : daysToGo != null && daysToGo >= 0 ? (
          <>
            {/* A bare numeral is exactly what Tier 0 is for. Floor raised to
                the book's 64px, and the next line skips to Optima rather than
                stacking a Seasons header underneath. */}
            <p className="font-tan-mon-cheri"
              style={{ fontSize: 'clamp(64px, 13vw, 96px)', color: 'var(--color-text-accent)', lineHeight: 1, marginBottom: '8px' }}>
              {daysToGo}
            </p>
            <p className="cq-micro" style={{ letterSpacing: '0.01em', marginBottom: '12px' }}>
              {daysToGo === 1 ? 'day until your journey' : 'days until your journey'}
            </p>
            {trip.destination_country && (
              <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)' }}>
                {trip.destination_country}{startLabel && ` · ${startLabel}`}
              </p>
            )}
          </>
        ) : (
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)' }}>
            {trip.destination_country ? `${trip.destination_country} awaits.` : 'Your adventure awaits.'}
          </p>
        )}
      </div>

      {/* ── Section 2: Activity Focus ─────────────────────────────────────────── */}
      {isLivePage ? (
        /* TODAY'S ACTIVITY */
        <div style={{ marginBottom: '32px' }}>
          <div className="flex items-center gap-3" style={{ marginBottom: '16px' }}>
            <span className="relative flex" style={{ width: '7px', height: '7px' }}>
              <span className="absolute inline-flex rounded-full" style={{
                width: '100%', height: '100%', backgroundColor: 'var(--color-text-accent)', opacity: 0.4,
                animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
              }}/>
              <span className="relative inline-flex rounded-full" style={{ width: '100%', height: '100%', backgroundColor: 'var(--color-text-accent)' }}/>
            </span>
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)' }}>
              Today&rsquo;s Activity
            </p>
            <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>{todayLabel}</span>
          </div>

          {!hasActivityToday ? (
            <div style={{
              backgroundColor: 'var(--color-surface-sunken)', border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
              borderRadius: '12px', padding: '28px 20px', textAlign: 'center',
            }}>
              <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                A day to explore freely.
              </p>
              <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)' }}>
                No scheduled activities — enjoy at your own pace.
              </p>
            </div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: '22px' }}>
              <div style={{
                position: 'absolute', left: '4px', top: '12px', bottom: '12px', width: '1px',
                background: 'linear-gradient(to bottom, rgb(var(--borges-rgb) / 0.5), rgb(var(--borges-rgb) / 0.08))',
              }}/>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {todayExps.map((exp, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: '-22px', top: '13px', width: '6px', height: '6px',
                      borderRadius: '50%', backgroundColor: 'var(--color-text-accent)', border: '1.5px solid var(--color-surface-sunken)', zIndex: 1,
                    }}/>
                    <div style={{
                      backgroundColor: 'var(--color-surface-sunken)', border: '0.5px solid rgb(var(--borges-rgb) / 0.12)',
                      borderRadius: '10px', padding: '12px 15px',
                      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', marginBottom: '2px' }}>
                          {exp.title}
                        </p>
                        {exp.location && (
                          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>{exp.location}</p>
                        )}
                      </div>
                      {exp.time_of_day && (
                        <span className="font-optima" style={{
                          fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', flexShrink: 0,
                          padding: '2px 7px', borderRadius: '999px',
                          backgroundColor: 'rgb(var(--borges-rgb) / 0.1)', border: '0.5px solid rgb(var(--borges-rgb) / 0.2)',
                        }}>{exp.time_of_day}</span>
                      )}
                    </div>
                  </div>
                ))}
                {todayTransfers.map((t, i) => (
                  <div key={`tr-${i}`} style={{ position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: '-22px', top: '13px', width: '6px', height: '6px',
                      borderRadius: '50%', backgroundColor: 'var(--color-text-accent)', border: '1.5px solid var(--color-surface-sunken)', zIndex: 1,
                    }}/>
                    <div style={{
                      backgroundColor: 'rgb(var(--borges-rgb) / 0.06)', border: '0.5px solid rgb(var(--borges-rgb) / 0.15)',
                      borderRadius: '10px', padding: '11px 15px',
                    }}>
                      <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
                        {[t.from_location, t.to_location].filter(Boolean).join(' → ')}
                      </p>
                      {(t.transfer_mode || t.carrier) && (
                        <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          {[t.transfer_mode, t.carrier].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {todayStay && (
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: '-22px', top: '13px', width: '6px', height: '6px',
                      borderRadius: '50%', backgroundColor: 'var(--color-text-accent)', border: '1.5px solid var(--color-surface-sunken)', zIndex: 1,
                    }}/>
                    <div style={{
                      backgroundColor: 'rgb(var(--borges-rgb) / 0.06)', border: '0.5px solid rgb(var(--borges-rgb) / 0.18)',
                      borderRadius: '10px', padding: '12px 15px',
                      display: 'flex', alignItems: 'center', gap: '10px',
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.6 }}>
                        <path d="M2 20h20M2 20V8l10-6 10 6v12" stroke="#706E56" strokeWidth="1.6" strokeLinejoin="round"/>
                        <rect x="9" y="14" width="6" height="6" rx="0.5" stroke="#706E56" strokeWidth="1.2"/>
                      </svg>
                      <div>
                        <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>{todayStay.property_name}</p>
                        {todayStay.destination && (
                          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', marginTop: '1px' }}>Tonight&rsquo;s stay · {todayStay.destination}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: '14px', textAlign: 'right' }}>
            <Link href={`/trip/${tripId}/today`} className="font-optima transition-opacity hover:opacity-70"
              style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', textDecoration: 'none' }}>
              See full day →
            </Link>
          </div>
        </div>
      ) : isPast ? (
        /* The readiness block above already says the trip is over; saying it
           twice on one page was the duplication. Just the way back in. */
        <div style={{ marginBottom: '32px', textAlign: 'right' }}>
          <ItineraryDrawer tripId={tripId} label="View your itinerary →" />
        </div>
      ) : (
        /* NEXT COMING ACTIVITY (upcoming trip) */
        <div style={{ marginBottom: '32px' }}>
          <div className="flex items-center gap-3" style={{ marginBottom: '16px' }}>
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)' }}>
              Next Coming Activity
            </p>
            {nextDateLabel && (
              <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)' }}>{nextDateLabel}</span>
            )}
          </div>

          {nextDateExps.length === 0 ? (
            <div style={{
              backgroundColor: 'var(--color-surface-sunken)', border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
              borderRadius: '12px', padding: '28px 20px', textAlign: 'center',
            }}>
              <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                {trip.destination_country ? `${trip.destination_country} awaits.` : 'Your adventure awaits.'}
              </p>
              <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)' }}>
                Activities will appear here once the itinerary is synced.
              </p>
            </div>
          ) : (
            <div style={{
              backgroundColor: 'var(--color-surface-sunken)', border: '0.5px solid rgb(var(--borges-rgb) / 0.12)',
              borderRadius: '12px', overflow: 'hidden',
            }}>
              {nextDateExps.map((exp, i) => (
                <div key={i} style={{
                  padding: '12px 18px',
                  borderBottom: i < nextDateExps.length - 1 ? '0.5px solid rgb(var(--borges-rgb) / 0.08)' : 'none',
                  display: 'flex', alignItems: 'center', gap: '12px',
                }}>
                  <div style={{ width: '4px', height: '4px', borderRadius: '50%', flexShrink: 0, backgroundColor: 'rgb(var(--borges-rgb) / 0.4)' }}/>
                  <p className="font-optima" style={{ flex: 1, fontSize: 'var(--text-caption)', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {exp.title}
                  </p>
                  {exp.time_of_day && (
                    <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', flexShrink: 0 }}>{exp.time_of_day}</p>
                  )}
                </div>
              ))}
              {nextExps.length > nextDateExps.length && (
                <div style={{ padding: '10px 18px', borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.08)' }}>
                  <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
                    +{nextExps.length - nextDateExps.length} more on later days
                  </p>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: '14px', textAlign: 'right' }}>
            <ItineraryDrawer tripId={tripId} label="See full itinerary →" />
          </div>
        </div>
      )}

      {/* ── Section 3: Your Journey ───────────────────────────────────────────── */}
      <SectionLabel n={1}>Your Journey</SectionLabel>
      <DestinationNarrative trip={trip} />
      <JourneyGrid trip={trip} travelerCount={travelers.length} />
      {travelers.length > 0 && <TravelerCards travelers={travelers} />}

      <Divider />

      {/* ── Section 4: Before You Go ──────────────────────────────────────────── */}
      <SectionLabel n={2}>Before You Go</SectionLabel>
      <BonVoyageChecklist tripId={tripId} />

      <Divider />

      {/* ── Section 5: Quick Links ────────────────────────────────────────────── */}
      <SectionLabel n={3}>Quick Links</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {BON_VOYAGE_LINKS.map(link => (
          <QuickLinkCard key={link.segment} href={`/trip/${tripId}/${link.segment}`} label={link.label} desc={link.desc} />
        ))}
      </div>
    </>
  )
}

// ── Default Brief (unknown status) ────────────────────────────────────────────

function DefaultBrief({
  trip,
  travelers,
  tripId,
  latestVersion,
}: {
  trip: Trip
  travelers: Traveler[]
  tripId: string
  latestVersion: string | null
}) {
  return (
    <>
      <SectionLabel n={1}>Your Journey</SectionLabel>
      <DestinationNarrative trip={trip} />
      <JourneyGrid trip={trip} travelerCount={travelers.length} />
      <TravelerCards travelers={travelers} />

      <Divider />

      {/* Status */}
      <SectionLabel n={2}>Trip Status</SectionLabel>
      <div style={{
        backgroundColor: 'var(--color-surface-sunken)',
        border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
        borderRadius: '12px',
        padding: '24px 28px',
      }}>
        <div className="flex items-center gap-3" style={{ marginBottom: '14px' }}>
          <span className="font-optima" style={{
            fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
            padding: '5px 16px', borderRadius: '999px',
            backgroundColor: 'var(--color-text-accent)', color: 'var(--color-text-inverse)',
          }}>
            {statusLabel(trip.status)}
          </span>
        </div>
        <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.75, color: 'var(--color-text-secondary)' }}>
          {(trip.status ?? '').toLowerCase().includes('reserv')
            ? 'Your itinerary is confirmed. Reservations are being finalised.'
            : (trip.status ?? '').toLowerCase().includes('bon')
              ? 'Everything is ready. Your journey begins soon.'
              : 'Your journey is in progress.'}
        </p>
      </div>

      {latestVersion && (
        <div style={{
          marginTop: '14px',
          backgroundColor: 'rgb(var(--borges-rgb) / 0.06)',
          border: '0.5px solid rgb(var(--borges-rgb) / 0.2)',
          borderRadius: '10px',
          padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <p className="font-optima"
              style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-accent)', marginBottom: '3px' }}>
              Current Blueprint
            </p>
            <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
              {latestVersion}
            </p>
          </div>
          <Link href={`/trip/${tripId}/experiences`} className="font-optima transition-opacity hover:opacity-70"
            style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', textDecoration: 'none' }}>
            View →
          </Link>
        </div>
      )}

      <Divider />

      <SectionLabel n={3}>Your Designer</SectionLabel>
      <div style={{
        backgroundColor: 'var(--color-surface-sunken)',
        border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
        borderRadius: '12px',
        padding: '24px 28px',
      }}>
        <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.75, color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
          The Closequarters team is designing your experience. We&rsquo;re here for every question along the way.
        </p>
        <Link href={`/trip/${tripId}/log`}
          className="font-optima transition-opacity hover:opacity-80 inline-flex items-center gap-2"
          style={{
            fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
            padding: '10px 24px', borderRadius: '999px',
            backgroundColor: 'var(--color-text-accent)', color: 'var(--color-text-inverse)', textDecoration: 'none',
          }}>
          Message us
        </Link>
      </div>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function BriefPage({
  params,
  searchParams,
}: {
  params:       Promise<{ tripId: string }>
  searchParams: Promise<{ stage?: string; version?: string }>
}) {
  const { tripId }          = await params
  const { stage: stageOverride } = await searchParams
  const db = createAdminClient()

  const { data: trip } = await db
    .from('trips').select('*').eq('trip_id', tripId).maybeSingle() as { data: Trip | null }
  if (!trip) notFound()

  const todayMs = new Date().setHours(0, 0, 0, 0)
  const isLive  = !!(
    trip.start_date && trip.end_date &&
    new Date(trip.start_date).getTime() <= todayMs &&
    todayMs <= new Date(trip.end_date).getTime()
  )

  const { actualPhase } = getTripPhase(trip.status, isLive)

  // stageOverride maps to the phase whose brief we should render
  const overridePhaseMap: Record<string, typeof actualPhase> = {
    'first-steps':  'inquiry',
    'crafting':     'crafting',
    'reservations': 'reservations',
    'bon-voyage':   'completed',
  }
  const effectivePhase: typeof actualPhase =
    (stageOverride ? overridePhaseMap[stageOverride] : undefined) ?? actualPhase

  // Crafting and Reservations stages have no brief/overview page — go straight to the first tab
  if (effectivePhase === 'crafting') {
    const q = stageOverride ? new URLSearchParams({ stage: stageOverride }) : new URLSearchParams()
    const qs = q.toString()
    redirect(`/trip/${tripId}/dates-destinations${qs ? `?${qs}` : ''}`)
  }
  if (effectivePhase === 'reservations') {
    const q = stageOverride ? new URLSearchParams({ stage: stageOverride }) : new URLSearchParams()
    const qs = q.toString()
    redirect(`/trip/${tripId}/reservations-payments${qs ? `?${qs}` : ''}`)
  }

  // Travelers — needed by all views
  const { data: linkRows } = await db
    .from('trip_travelers').select('traveler_id').eq('trip_id', trip.id)
  const travelerIds = (linkRows ?? []).map((r: { traveler_id: string }) => r.traveler_id)
  let travelers: Traveler[] = []
  if (travelerIds.length > 0) {
    const { data } = await db
      .from('travelers').select('*').in('id', travelerIds)
      .order('is_primary', { ascending: false })
    travelers = (data as Traveler[]) ?? []
  }

  // ── First Steps ───────────────────────────────────────────────────────────────
  if (effectivePhase === 'inquiry') {
    let destinationInfo: DestinationInfo | null = null
    if (trip.destination_info_id) {
      const { data } = await db
        .from('destination_info').select('*').eq('id', trip.destination_info_id).maybeSingle()
      destinationInfo = data as DestinationInfo | null
    }

    const countryRef = trip.destination_country ? DESTINATION_DATA[trip.destination_country] : undefined
    const weather = countryRef && trip.start_date && trip.end_date
      ? await fetchWeather(countryRef.coords, trip.start_date, trip.end_date)
      : null
    const phrases = countryRef ? PHRASES[countryRef.languageCode] ?? null : null
    const travelDateLabel = formatDate(trip.start_date)

    return (
      <div style={{ paddingTop: '32px', paddingBottom: 'var(--pad-40)' }}>
        <FirstStepsBrief
          trip={trip} travelers={travelers} tripId={tripId}
          destinationInfo={destinationInfo} weather={weather} travelDateLabel={travelDateLabel}
          destinationTz={countryRef?.tz ?? null} currency={countryRef?.currency ?? null}
          phrases={phrases} languageLabel={countryRef?.language ?? null}
        />
      </div>
    )
  }

  // ── Bon Voyage / Live ─────────────────────────────────────────────────────────
  if (effectivePhase === 'completed' || effectivePhase === 'live') {
    const nowMs    = new Date().setHours(0, 0, 0, 0)
    const todayStr = new Date(nowMs).toISOString().split('T')[0]
    const isLivePage = !!(
      trip.start_date && trip.end_date &&
      new Date(trip.start_date).getTime() <= nowMs &&
      nowMs <= new Date(trip.end_date).getTime()
    )

    const [
      { data: rawTodayExps },
      { data: rawTodayTransfers },
      { data: rawTodayStays },
      { data: rawNextExps },
    ] = await Promise.all([
      isLivePage
        ? db.from('experiences').select('title,location,time_of_day').eq('trip_id', trip.id).eq('date', todayStr).eq('is_current', true).order('sort_order', { ascending: true })
        : Promise.resolve({ data: [] }),
      isLivePage
        ? db.from('transfers').select('from_location,to_location,transfer_mode,carrier').eq('trip_id', trip.id).eq('date', todayStr).order('sort_order', { ascending: true })
        : Promise.resolve({ data: [] }),
      isLivePage
        ? db.from('stays').select('property_name,destination,check_in,check_out').eq('trip_id', trip.id).lte('check_in', todayStr).gte('check_out', todayStr).eq('is_current', true)
        : Promise.resolve({ data: [] }),
      !isLivePage
        ? db.from('experiences').select('title,location,time_of_day,date').eq('trip_id', trip.id).eq('is_current', true).gt('date', todayStr).order('date', { ascending: true }).order('sort_order', { ascending: true }).limit(12)
        : Promise.resolve({ data: [] }),
    ])

    const todayExps      = (rawTodayExps      as { title: string; location: string | null; time_of_day: string | null }[])      ?? []
    const todayTransfers = (rawTodayTransfers  as { from_location: string | null; to_location: string | null; transfer_mode: string | null; carrier: string | null }[]) ?? []
    const todayStay      = ((rawTodayStays     as { property_name: string; destination: string | null; check_in: string | null; check_out: string | null }[]) ?? [])[0] ?? null
    const nextExps       = (rawNextExps        as { title: string; location: string | null; time_of_day: string | null; date: string | null }[])              ?? []

    return (
      <div style={{ paddingTop: '32px', paddingBottom: 'var(--pad-40)' }}>
        <BonVoyageBrief
          trip={trip} travelers={travelers} tripId={tripId}
          isLivePage={isLivePage} todayStr={todayStr}
          todayExps={todayExps} todayTransfers={todayTransfers} todayStay={todayStay} nextExps={nextExps}
        />
      </div>
    )
  }

  // ── Default fallback (unknown status) ─────────────────────────────────────────
  const { data: latestIter } = await db
    .from('iterations').select('name').eq('trip_id', trip.id).eq('is_current', true).maybeSingle()
  const latestVersion = (latestIter as { name: string } | null)?.name ?? null
  return (
    <div style={{ paddingTop: '32px', paddingBottom: 'var(--pad-40)' }}>
      <DefaultBrief trip={trip} travelers={travelers} tripId={tripId} latestVersion={latestVersion} />
    </div>
  )
}
