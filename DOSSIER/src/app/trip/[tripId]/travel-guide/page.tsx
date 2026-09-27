import { createAdminClient } from '@/lib/supabase/admin'
import { SubSectionOpen } from '@/components/PageSection'
import { notFound } from 'next/navigation'
import type { Trip, DestinationInfo } from '@/lib/types'
import { DESTINATION_DATA, fetchWeather } from '@/lib/destinationData'
import type { WeatherSummary } from '@/lib/destinationData'
import AboutDestinationCard from '@/components/AboutDestinationCard'

// ── Packing data ──────────────────────────────────────────────────────────────

const ADAPTER_INFO: Record<string, string> = {
  'Type A/B': 'US two/three-pin — standard American plug',
  'Type C/E': 'European two-pin round',
  'Type C/F': 'European two-pin round (Schuko)',
  'Type G':   'UK three-pin rectangular',
  'Type I':   'Australian/NZ diagonal flat-pin',
  'Type D/G': 'Indian three-pin / UK',
  'Type C/D': 'European two-pin / Indian three-pin',
}

function packingAdviceFromWeather(w: WeatherSummary): string[] {
  const advice: string[] = []
  const avg = (w.avgMaxC + w.avgMinC) / 2
  if (avg < 10) {
    advice.push('Heavy coat and thermal underlayers')
    advice.push('Warm hat, scarf, and gloves')
    advice.push('Waterproof winter boots')
  } else if (avg < 18) {
    advice.push('Light jacket or warm layer')
    advice.push('Mix of short and long-sleeve tops')
    advice.push('Comfortable walking shoes')
  } else if (avg < 25) {
    advice.push('Light layers for evenings')
    advice.push('Breathable fabrics for daytime')
    advice.push('Comfortable walking shoes or sandals')
  } else {
    advice.push('Light summer clothes — linen or breathable cotton')
    advice.push('Sun hat and UV-protection sunglasses')
    advice.push('Light sandals for day, sneakers for evenings')
  }
  if (w.maxRainProb > 40) {
    advice.push('Packable rain jacket or compact umbrella')
  }
  return advice
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <SubSectionOpen title={children} />
  )
}

function Divider() {
  return <div style={{ height: '0.5px', backgroundColor: 'rgb(var(--borges-rgb) / 0.10)', margin: '36px 0' }} />
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-surface-sunken)',
      border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
      borderRadius: '12px',
      padding: '24px 28px',
      ...style,
    }}>
      {children}
    </div>
  )
}


// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TravelGuidePage({
  params,
}: {
  params: Promise<{ tripId: string }>
}) {
  const { tripId } = await params
  const db = createAdminClient()

  const { data: trip } = await db
    .from('trips').select('*').eq('trip_id', tripId).maybeSingle() as { data: Trip | null }
  if (!trip) notFound()

  const dest    = trip.destination_country ?? ''
  const info    = DESTINATION_DATA[dest] ?? null

  // Countdown
  const todayMs    = new Date().setHours(0, 0, 0, 0)
  const startMs    = trip.start_date ? new Date(trip.start_date).getTime() : null
  const endMs      = trip.end_date   ? new Date(trip.end_date).getTime()   : null
  const daysToGo   = startMs ? Math.ceil((startMs - todayMs) / 86400000) : null
  const isLive     = !!(startMs && endMs && startMs <= todayMs && todayMs <= endMs)
  const isPast     = !!(endMs && endMs < todayMs)
  const isCompleted = (trip.status ?? '').toLowerCase() === 'completed'

  const startLabel = trip.start_date
    ? new Date(trip.start_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const endLabel   = trip.end_date
    ? new Date(trip.end_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const travelDateLabel = startLabel

  // Weather
  const weather = info && trip.start_date && trip.end_date
    ? await fetchWeather(info.coords, trip.start_date, trip.end_date)
    : null
  const weatherPackingItems = weather ? packingAdviceFromWeather(weather) : []

  // Destination info — same source as First Steps / Reservations
  let destinationInfo: DestinationInfo | null = null
  if (trip.destination_info_id) {
    const { data } = await db
      .from('destination_info').select('*').eq('id', trip.destination_info_id).maybeSingle()
    destinationInfo = data as DestinationInfo | null
  }


  const generalPacking = [
    'Passport (valid for ≥ 6 months beyond return date)',
    'Travel insurance documentation',
    'Any prescription medications — 10% extra supply',
    'Phone charger and universal adapter',
    'Copies of key bookings (offline-accessible)',
    'Small first aid kit: pain relief, antihistamine, plasters',
    'Reusable water bottle',
  ]

  return (
    <div style={{ paddingBottom: 'var(--pad-40)' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 'var(--pad-40)' }}>
        <p className="font-optima"
          style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-accent)', marginBottom: '10px' }}>
          {dest || 'Your Journey'}
        </p>
        <h2 className="cq-t1"
          style={{ fontSize: 'var(--text-t1)', lineHeight: 1.05, color: 'var(--color-text)' }}>
          Need to Know
        </h2>
        <div style={{ width: '36px', height: '1.5px', backgroundColor: 'var(--color-text-accent)', marginTop: '14px' }} />
      </div>


      {/* ══════════════════════════════════════════
          Countdown — only shown while there's something to count toward
          (upcoming, live, or formally marked Completed). A trip whose dates
          have simply passed but hasn't been marked Completed shows nothing
          here — the Daily Brief section below covers that with the last day.
      ══════════════════════════════════════════ */}
      {(isLive || isCompleted || (!isPast && daysToGo != null)) && (
        <div style={{
          backgroundColor: 'rgb(var(--borges-rgb) / 0.06)',
          border: '0.5px solid rgb(var(--borges-rgb) / 0.18)',
          borderRadius: '16px',
          padding: '32px 28px',
          marginBottom: 'var(--pad-48)',
          textAlign: 'center',
        }}>
          {isLive ? (
            <>
              {/* Tier 1 — a full sentence never takes Mon Cheri. */}
              <p className="cq-t1" style={{ color: 'var(--color-text-accent)', marginBottom: '8px' }}>
                You&rsquo;re on your way.
              </p>
              <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)' }}>
                {dest && `Your ${dest} journey is live.`}
                {startLabel && endLabel && ` ${startLabel} – ${endLabel}`}
              </p>
            </>
          ) : isCompleted ? (
            <>
              <p className="cq-t1" style={{ color: 'var(--color-text)', marginBottom: '8px' }}>
                What a journey.
              </p>
              <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)' }}>
                {startLabel && endLabel && `${startLabel} – ${endLabel}`}
              </p>
            </>
          ) : daysToGo != null && daysToGo >= 0 ? (
            <>
              <p className="font-tan-mon-cheri" style={{ fontSize: 'clamp(64px, 14vw, 104px)', color: 'var(--color-text-accent)', lineHeight: 1, marginBottom: '8px' }}>
                {daysToGo}
              </p>
              <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                {daysToGo === 1 ? 'day to go' : 'days to go'}
              </p>
              {startLabel && (
                <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)' }}>
                  {dest && `${dest} · `}{startLabel}{endLabel && ` – ${endLabel}`}
                </p>
              )}
            </>
          ) : (
            <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)' }}>
              {dest && `${dest} awaits.`}
            </p>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          About the destination
      ══════════════════════════════════════════ */}
      <SectionLabel>About {dest || 'Your Destination'}</SectionLabel>
      <AboutDestinationCard
        weather={weather} travelDateLabel={travelDateLabel} destinationTz={info?.tz ?? null}
        currency={info?.currency ?? null} destinationInfo={destinationInfo}
      />

      <Divider />


      {/* ══════════════════════════════════════════
          What to Pack
      ══════════════════════════════════════════ */}
      <SectionLabel>What to Pack</SectionLabel>

      {weather ? (
        <div style={{
          backgroundColor: 'rgb(var(--borges-rgb) / 0.06)',
          border: '0.5px solid rgb(var(--borges-rgb) / 0.18)',
          borderRadius: '12px',
          padding: '18px 24px',
          marginBottom: '14px',
          display: 'flex', alignItems: 'center', gap: '20px',
        }}>
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <p className="cq-t1" style={{ fontSize: 'var(--text-t1)', color: 'var(--color-text-accent)', lineHeight: 1 }}>
              {weather.avgMaxC}°
            </p>
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', letterSpacing: '0.01em' }}>
              HIGH&nbsp; /&nbsp; {weather.avgMinC}° LOW
            </p>
          </div>
          <div style={{ flex: 1 }}>
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              Expected weather during your journey · {weather.days} day{weather.days !== 1 ? 's' : ''} of forecast data.
              {weather.maxRainProb > 40 && ` Rain likely (up to ${weather.maxRainProb}% chance).`}
            </p>
          </div>
        </div>
      ) : (
        <div style={{
          backgroundColor: 'rgb(var(--borges-rgb) / 0.05)',
          border: '0.5px solid rgb(var(--borges-rgb) / 0.08)',
          borderRadius: '10px',
          padding: '12px 16px',
          marginBottom: '14px',
        }}>
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)' }}>
            Weather data unavailable — trip dates may be outside the forecast window.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {weatherPackingItems.length > 0 && (
          <Card style={{ gridColumn: '1 / -1' }}>
            <p className="font-optima"
              style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-accent)', marginBottom: '12px' }}>
              Climate-based suggestions
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {weatherPackingItems.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--color-text-accent)', flexShrink: 0, marginTop: '6px' }} />
                  <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{item}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
        <Card style={{ gridColumn: '1 / -1' }}>
          <p className="font-optima"
            style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
            Always carry
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {generalPacking.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgb(var(--borges-rgb) / 0.4)', flexShrink: 0, marginTop: '6px' }} />
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{item}</p>
              </div>
            ))}
            {info?.adapter && (
              <div className="flex items-start gap-3">
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgb(var(--borges-rgb) / 0.4)', flexShrink: 0, marginTop: '6px' }} />
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  Power adapter — {ADAPTER_INFO[info.adapter] ?? info.adapter}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Divider />

      {/* ══════════════════════════════════════════
          Emergency Docket
      ══════════════════════════════════════════ */}
      <div id="emergency" style={{ scrollMarginTop: '100px' }}>
        <SectionLabel>Emergency Docket</SectionLabel>

        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* CQ WhatsApp */}
            <a
              href="https://wa.me/919884256431"
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderRadius: '8px',
                backgroundColor: 'rgb(var(--borges-rgb) / 0.08)',
                border: '0.5px solid rgb(var(--borges-rgb) / 0.2)',
              }}>
                <div>
                  <p className="font-optima"
                    style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-accent)', marginBottom: '2px' }}>
                    Your Curator
                  </p>
                  <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
                    Closequarters — WhatsApp
                  </p>
                </div>
                <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                  <path d="M16 3C9.373 3 4 8.373 4 15c0 2.385.668 4.61 1.822 6.505L4 29l7.697-1.807A11.94 11.94 0 0016 27c6.627 0 12-5.373 12-12S22.627 3 16 3z" fill="#706E56"/>
                </svg>
              </div>
            </a>

            {/* Local emergency */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: '8px',
              backgroundColor: 'rgb(var(--night-rgb) / 0.15)',
              border: '0.5px solid rgb(var(--night-rgb) / 0.2)',
            }}>
              <div>
                <p className="font-optima"
                  style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                  {dest} Local Emergency
                </p>
                <p className="cq-subhead" style={{ fontSize: 'var(--text-subhead)', color: 'var(--color-text)' }}>
                  {info?.emergency ?? '112'}
                </p>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.63a19.79 19.79 0 01-3.07-8.64A2 2 0 012 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="#4D4C50" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            {/* Embassy */}
            <div style={{
              padding: '12px 16px', borderRadius: '8px',
              backgroundColor: 'rgb(var(--borges-rgb) / 0.05)',
              border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
            }}>
              <p className="font-optima"
                style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                Embassy / Consulate
              </p>
              <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                Your home country&rsquo;s embassy contact for {dest || 'your destination'} is available via your government&rsquo;s foreign travel portal. Save the number before you depart.
              </p>
            </div>
          </div>
        </Card>
      </div>

    </div>
  )
}
