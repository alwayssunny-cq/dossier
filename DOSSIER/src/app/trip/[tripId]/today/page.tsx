import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import type { Trip, Experience, Stay, Transfer } from '@/lib/types'
import { requireTripAccess } from '@/lib/tripAccess'

// ── Coordinates for weather fetch ─────────────────────────────────────────────
const COORDS: Record<string, [number, number]> = {
  'United States':          [ 40.71,  -74.01],
  'Australia':              [-33.87,  151.21],
  'Japan':                  [ 35.68,  139.69],
  'France':                 [ 48.86,    2.35],
  'Italy':                  [ 41.90,   12.50],
  'Spain':                  [ 40.42,   -3.70],
  'United Kingdom':         [ 51.51,   -0.13],
  'Germany':                [ 52.52,   13.41],
  'India':                  [ 28.61,   77.21],
  'Thailand':               [ 13.76,  100.50],
  'Greece':                 [ 37.98,   23.73],
  'UAE':                    [ 25.20,   55.27],
  'Singapore':              [  1.35,  103.82],
  'Portugal':               [ 38.72,   -9.14],
  'Mexico':                 [ 19.43,  -99.13],
  'Turkey':                 [ 41.01,   28.98],
  'Bosnia and Herzegovina': [ 43.86,   18.41],
  'Morocco':                [ 33.99,   -6.85],
  'Indonesia':              [ -6.21,  106.85],
  'Sri Lanka':              [  6.93,   79.85],
}

// ── IANA timezones for server-side greeting ───────────────────────────────────
const IANA_TZ: Record<string, string> = {
  'United States':          'America/New_York',
  'Australia':              'Australia/Sydney',
  'Japan':                  'Asia/Tokyo',
  'France':                 'Europe/Paris',
  'Italy':                  'Europe/Rome',
  'Spain':                  'Europe/Madrid',
  'United Kingdom':         'Europe/London',
  'Germany':                'Europe/Berlin',
  'India':                  'Asia/Kolkata',
  'Thailand':               'Asia/Bangkok',
  'Greece':                 'Europe/Athens',
  'UAE':                    'Asia/Dubai',
  'Singapore':              'Asia/Singapore',
  'Portugal':               'Europe/Lisbon',
  'Mexico':                 'America/Mexico_City',
  'Turkey':                 'Europe/Istanbul',
  'Bosnia and Herzegovina': 'Europe/Sarajevo',
  'Morocco':                'Africa/Casablanca',
  'Indonesia':              'Asia/Jakarta',
  'Sri Lanka':              'Asia/Colombo',
}

// ── Emergency numbers ─────────────────────────────────────────────────────────
const EMERGENCY: Record<string, string> = {
  'United States': '911', 'Australia': '000', 'Japan': '110',
  'France': '112',        'Italy': '112',     'Spain': '112',
  'United Kingdom': '999','Germany': '112',   'India': '112',
  'Thailand': '191',      'Greece': '112',    'UAE': '999',
  'Singapore': '999',     'Portugal': '112',  'Mexico': '911',
  'Turkey': '112',        'Bosnia and Herzegovina': '112',
  'Morocco': '190',       'Indonesia': '112', 'Sri Lanka': '119',
}

// ── Day matching helper ───────────────────────────────────────────────────────
// Converts a trip day_number + start_date into a YYYY-MM-DD calendar date.
// Day 1 = start_date, Day 2 = start_date + 1 day, etc.
function getTripDateForDay(startDate: string, dayNumber: number): string {
  const d = new Date(startDate + 'T00:00:00')
  d.setDate(d.getDate() + (dayNumber - 1))
  return d.toISOString().split('T')[0]
}

// ── Weather fetch ─────────────────────────────────────────────────────────────
interface Weather { temp: number; code: number }

async function fetchWeather(country: string | null): Promise<Weather | null> {
  if (!country) return null
  const coords = COORDS[country]
  if (!coords) return null
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords[0]}&longitude=${coords[1]}&current=temperature_2m,weather_code&timezone=auto`,
      { next: { revalidate: 1800 } }
    )
    if (!res.ok) return null
    const j = await res.json()
    return { temp: Math.round(j.current.temperature_2m), code: j.current.weather_code }
  } catch {
    return null
  }
}

function weatherLabel(code: number): string {
  if (code === 0)  return 'Clear sky'
  if (code <= 3)   return 'Partly cloudy'
  if (code <= 48)  return 'Foggy'
  if (code <= 57)  return 'Drizzle'
  if (code <= 67)  return 'Rain'
  if (code <= 77)  return 'Snow'
  if (code <= 82)  return 'Showers'
  return 'Thunderstorm'
}

// ── Greeting (server-side, in destination timezone) ───────────────────────────
function getGreeting(country: string | null): string {
  const tz = country ? IANA_TZ[country] : null
  if (!tz) return 'Good day'
  try {
    const h = parseInt(
      new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(new Date())
    )
    if (h >= 5  && h < 12) return 'Good morning'
    if (h >= 12 && h < 17) return 'Good afternoon'
    if (h >= 17 && h < 21) return 'Good evening'
    return 'Good night'
  } catch {
    return 'Good day'
  }
}

// ── Timeline sort key ─────────────────────────────────────────────────────────
function timeSortKey(time: string | null | undefined): number {
  if (!time) return 9000
  const t = time.toLowerCase().trim()
  if (t.startsWith('morning'))   return 900
  if (t.startsWith('afternoon')) return 1400
  if (t.startsWith('evening'))   return 1900
  if (t.startsWith('night'))     return 2100
  const m = t.match(/(\d{1,2})[h:.](\d{2})?/)
  if (m) return parseInt(m[1]) * 100 + parseInt(m[2] ?? '0')
  return 9000
}

// ── Transfer mode icon ────────────────────────────────────────────────────────
function TransferModeIcon({ mode }: { mode: string | null }) {
  const m = (mode ?? '').toLowerCase()
  if (m.includes('flight') || m.includes('air'))
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="#706E56"/>
      </svg>
    )
  if (m.includes('train') || m.includes('rail'))
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="3" width="16" height="13" rx="2" stroke="#706E56" strokeWidth="1.4"/>
        <path d="M4 10h16" stroke="#706E56" strokeWidth="1.2"/>
        <path d="M8 19l2-2M16 19l-2-2" stroke="#706E56" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    )
  // Car / default
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 12l2-5h10l2 5" stroke="#706E56" strokeWidth="1.4" strokeLinejoin="round"/>
      <rect x="2" y="12" width="20" height="6" rx="1.5" stroke="#706E56" strokeWidth="1.4"/>
      <circle cx="7" cy="18" r="2" stroke="#706E56" strokeWidth="1.2"/>
      <circle cx="17" cy="18" r="2" stroke="#706E56" strokeWidth="1.2"/>
    </svg>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function TodayPage({
  params,
}: {
  params: Promise<{ tripId: string }>
}) {
  const { tripId } = await params
  await requireTripAccess(tripId)
  const db = createAdminClient()

  const { data: trip } = await db
    .from('trips').select('*').eq('trip_id', tripId).maybeSingle() as { data: Trip | null }
  if (!trip) notFound()

  const now = new Date()
  const todayStr    = now.toISOString().split('T')[0]
  const tomorrowStr = new Date(now.getTime() + 86_400_000).toISOString().split('T')[0]

  // Day number for fallback queries when experiences lack a date field
  const currentDayNum = trip.start_date
    ? Math.floor(
        (now.setHours(0, 0, 0, 0) - new Date(trip.start_date + 'T00:00:00').getTime()) / 86_400_000
      ) + 1
    : null

  // Parallel data fetch
  const [
    { data: rawExps },
    { data: rawStays },
    { data: rawTransfers },
    { data: rawTomorrow },
  ] = await Promise.all([
    db.from('experiences').select('*')
      .eq('trip_id', trip.id).eq('date', todayStr).eq('is_current', true)
      .order('sort_order', { ascending: true }),
    db.from('stays').select('*')
      .eq('trip_id', trip.id).lte('check_in', todayStr).gte('check_out', todayStr)
      .eq('is_current', true),
    db.from('transfers').select('*')
      .eq('trip_id', trip.id).eq('date', todayStr)
      .order('sort_order', { ascending: true }),
    db.from('experiences').select('*')
      .eq('trip_id', trip.id).eq('date', tomorrowStr).eq('is_current', true)
      .order('sort_order', { ascending: true }),
  ])

  let exps: Experience[]        = (rawExps     as Experience[]) ?? []
  let tomorrowExps: Experience[] = (rawTomorrow as Experience[]) ?? []
  const stays: Stay[]           = (rawStays    as Stay[])       ?? []
  const transfers: Transfer[]   = (rawTransfers as Transfer[])  ?? []

  // Day-number fallback — if experiences have day_number but no date field
  if (exps.length === 0 && currentDayNum !== null && trip.start_date) {
    const fallbackDate = getTripDateForDay(trip.start_date, currentDayNum)
    const { data: dnExps } = await db.from('experiences').select('*')
      .eq('trip_id', trip.id).eq('day_number', currentDayNum).eq('is_current', true)
      .order('sort_order', { ascending: true })
    // Only use if the day_number maps to today
    if (dnExps && fallbackDate === todayStr) {
      exps = dnExps as Experience[]
    } else if (dnExps) {
      // Try directly by day_number regardless of date mismatch
      exps = dnExps as Experience[]
    }
  }
  if (tomorrowExps.length === 0 && currentDayNum !== null) {
    const { data: tmrExps } = await db.from('experiences').select('*')
      .eq('trip_id', trip.id).eq('day_number', currentDayNum + 1).eq('is_current', true)
      .order('sort_order', { ascending: true })
    if (tmrExps) tomorrowExps = tmrExps as Experience[]
  }

  const tonight = stays[0] ?? null

  // Build timeline — experiences sorted by time, transfers appended after
  type TlItem =
    | { kind: 'exp';      data: Experience; sortKey: number }
    | { kind: 'transfer'; data: Transfer;   sortKey: number }

  const timeline: TlItem[] = [
    ...exps.map((e, i) => ({
      kind: 'exp' as const, data: e,
      sortKey: timeSortKey(e.time_of_day) + i * 0.01,
    })),
    ...transfers.map((t, i) => ({
      kind: 'transfer' as const, data: t,
      sortKey: 9000 + (t.sort_order ?? i),
    })),
  ].sort((a, b) => a.sortKey - b.sortKey)

  const hasSchedule = timeline.length > 0 || !!tonight

  const country   = trip.destination_country
  const weather   = await fetchWeather(country)
  const greeting  = getGreeting(country)
  const emergency = country ? (EMERGENCY[country] ?? '112') : '112'
  const location  = exps[0]?.location ?? tonight?.destination ?? country ?? null

  const dateDisplay = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div style={{ paddingBottom: 'var(--pad-48)' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 'var(--pad-40)' }}>
        {/* Live pulse */}
        <div className="flex items-center gap-3" style={{ marginBottom: '12px' }}>
          <span className="relative flex" style={{ width: '8px', height: '8px' }}>
            <span
              className="absolute inline-flex rounded-full"
              style={{
                width: '100%', height: '100%',
                backgroundColor: 'var(--color-text-accent)', opacity: 0.4,
                animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
              }}
            />
            <span
              className="relative inline-flex rounded-full"
              style={{ width: '100%', height: '100%', backgroundColor: 'var(--color-text-accent)' }}
            />
          </span>
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)' }}>
            Live Trip
          </p>
        </div>

        <h2
          className="cq-t1"
          style={{ fontSize: 'var(--text-t1)', lineHeight: 1.05, color: 'var(--color-text)', marginBottom: '6px' }}
        >
          {greeting}
        </h2>
        <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
          {dateDisplay}
        </p>

        {/* Meta chips — location + weather */}
        <div className="flex flex-wrap items-center gap-2">
          {location && (
            <div
              className="flex items-center gap-2"
              style={{
                padding: '5px 12px', borderRadius: '999px',
                backgroundColor: 'rgb(var(--borges-rgb) / 0.08)',
                border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
              }}
            >
              <svg width="9" height="11" viewBox="0 0 10 13" fill="none">
                <path
                  d="M5 1C2.79 1 1 2.79 1 5c0 3 4 7 4 7s4-4 4-7c0-2.21-1.79-4-4-4z"
                  stroke="#706E56" strokeWidth="1.1"
                />
                <circle cx="5" cy="5" r="1.3" fill="#706E56"/>
              </svg>
              <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)' }}>
                {location}
              </span>
            </div>
          )}
          {weather && (
            <div
              className="flex items-center gap-2"
              style={{
                padding: '5px 12px', borderRadius: '999px',
                backgroundColor: 'rgb(var(--borges-rgb) / 0.08)',
                border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                {weather.code === 0 ? (
                  <>
                    <circle cx="12" cy="12" r="4" stroke="#706E56" strokeWidth="1.5"/>
                    <path
                      d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                      stroke="#706E56" strokeWidth="1.3" strokeLinecap="round"
                    />
                  </>
                ) : (
                  <path
                    d="M18 10h-1.26A8 8 0 104 15.25M16 14l2 2 4-4"
                    stroke="#6B696C" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
                  />
                )}
              </svg>
              <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text)' }}>
                {weather.temp}°C · {weatherLabel(weather.code)}
              </span>
            </div>
          )}
        </div>

        <div style={{ width: '36px', height: '1.5px', backgroundColor: 'var(--color-text-accent)', marginTop: '18px', opacity: 0.6 }}/>
      </div>

      {/* ── Today&rsquo;s Schedule — timeline ── */}
      <section style={{ marginBottom: '36px' }}>
        <div className="flex items-center gap-3" style={{ marginBottom: '16px' }}>
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)' }}>
            Today&rsquo;s Schedule
          </p>
          {timeline.length > 0 && (
            <span
              className="font-optima"
              style={{
                fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)',
                padding: '1px 8px', borderRadius: '999px',
                backgroundColor: 'rgb(var(--borges-rgb) / 0.1)',
                border: '0.5px solid rgb(var(--borges-rgb) / 0.25)',
              }}
            >
              {timeline.length + (tonight ? 1 : 0)} items
            </span>
          )}
        </div>

        {!hasSchedule ? (
          <div style={{
            backgroundColor: 'var(--color-surface-sunken)',
            border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
            borderRadius: '12px', padding: '36px 24px', textAlign: 'center',
          }}>
            <div
              className="mx-auto flex items-center justify-center"
              style={{
                width: '48px', height: '48px', borderRadius: '50%',
                border: '0.5px solid rgb(var(--borges-rgb) / 0.25)',
                backgroundColor: 'rgb(var(--borges-rgb) / 0.06)', marginBottom: '16px',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#706E56" strokeWidth="1.3"/>
                <path d="M12 7v5l3 3" stroke="#706E56" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', marginBottom: '8px' }}>
              You&rsquo;re travelling today
            </p>
            <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
              Your schedule appears here once the itinerary is synced.
            </p>
          </div>
        ) : (
          <div style={{ position: 'relative', paddingLeft: '24px' }}>
            {/* Spine */}
            <div style={{
              position: 'absolute', left: '5px', top: '14px', bottom: '14px',
              width: '1px',
              background: 'linear-gradient(to bottom, rgb(var(--borges-rgb) / 0.5), rgb(var(--borges-rgb) / 0.08))',
            }}/>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Experiences + transfers */}
              {timeline.map((item, idx) => (
                <div key={`${item.kind}-${idx}`} style={{ position: 'relative' }}>
                  {/* Dot */}
                  <div style={{
                    position: 'absolute', left: '-24px', top: '14px',
                    width: '7px', height: '7px', borderRadius: '50%',
                    backgroundColor: item.kind === 'exp' ? 'var(--color-text-accent)' : 'var(--color-text-accent)',
                    border: '1.5px solid var(--color-surface-sunken)', zIndex: 1,
                  }}/>

                  {item.kind === 'exp' ? (
                    <div style={{
                      backgroundColor: 'var(--color-surface-sunken)',
                      border: '0.5px solid rgb(var(--borges-rgb) / 0.12)',
                      borderRadius: '10px', padding: '13px 16px',
                    }}>
                      <div className="flex items-start justify-between gap-3">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', marginBottom: '3px' }}>
                            {item.data.title}
                          </p>
                          {item.data.location && (
                            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
                              {item.data.location}
                            </p>
                          )}
                        </div>
                        {item.data.time_of_day && (
                          <span className="font-optima" style={{
                            fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', flexShrink: 0,
                            padding: '2px 8px', borderRadius: '999px',
                            backgroundColor: 'rgb(var(--borges-rgb) / 0.1)',
                            border: '0.5px solid rgb(var(--borges-rgb) / 0.2)',
                          }}>
                            {item.data.time_of_day}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      backgroundColor: 'rgb(var(--borges-rgb) / 0.06)',
                      border: '0.5px solid rgb(var(--borges-rgb) / 0.15)',
                      borderRadius: '10px', padding: '11px 16px',
                      display: 'flex', alignItems: 'center', gap: '10px',
                    }}>
                      <TransferModeIcon mode={item.data.transfer_mode}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
                          {[item.data.from_location, item.data.to_location].filter(Boolean).join(' → ')}
                        </p>
                        {(item.data.transfer_mode || item.data.carrier) && (
                          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            {[item.data.transfer_mode, item.data.carrier].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Stay at bottom of timeline */}
              {tonight && (
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: '-24px', top: '14px',
                    width: '7px', height: '7px', borderRadius: '50%',
                    backgroundColor: 'var(--color-text-accent)', border: '1.5px solid var(--color-surface-sunken)', zIndex: 1,
                  }}/>
                  <div style={{
                    backgroundColor: 'rgb(var(--borges-rgb) / 0.06)',
                    border: '0.5px solid rgb(var(--borges-rgb) / 0.18)',
                    borderRadius: '10px', padding: '13px 16px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M2 20h20M2 20V8l10-6 10 6v12" stroke="#706E56" strokeWidth="1.5" strokeLinejoin="round"/>
                      <rect x="9" y="14" width="6" height="6" rx="0.5" stroke="#706E56" strokeWidth="1.2"/>
                    </svg>
                    <div>
                      <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
                        {tonight.property_name}
                      </p>
                      <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        Tonight&rsquo;s stay
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Stay Tonight — full card ── */}
      {tonight && (
        <section style={{ marginBottom: '32px' }}>
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
            Your Stay Tonight
          </p>
          <div style={{
            backgroundColor: 'var(--color-surface-sunken)',
            border: '0.5px solid rgb(var(--borges-rgb) / 0.2)',
            borderRadius: '12px', padding: '20px',
          }}>
            <div className="flex items-start gap-4">
              <div style={{
                width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
                backgroundColor: 'rgb(var(--borges-rgb) / 0.1)',
                border: '0.5px solid rgb(var(--borges-rgb) / 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M2 20h20M2 20V8l10-6 10 6v12" stroke="#706E56" strokeWidth="1.5" strokeLinejoin="round"/>
                  <rect x="9" y="14" width="6" height="6" rx="0.5" stroke="#706E56" strokeWidth="1.3"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', marginBottom: '4px' }}>
                  {tonight.property_name}
                </p>
                {tonight.destination && (
                  <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                    {tonight.destination}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {tonight.room_type && (
                    <span className="font-optima" style={{
                      fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)',
                      padding: '3px 10px', borderRadius: '999px',
                      backgroundColor: 'rgb(var(--borges-rgb) / 0.08)',
                      border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
                    }}>
                      {tonight.room_type}
                    </span>
                  )}
                  {tonight.meals && (
                    <span className="font-optima" style={{
                      fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)',
                      padding: '3px 10px', borderRadius: '999px',
                      backgroundColor: 'rgb(var(--borges-rgb) / 0.08)',
                      border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
                    }}>
                      {tonight.meals}
                    </span>
                  )}
                  {tonight.check_out && (
                    <span className="font-optima" style={{
                      fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)',
                      padding: '3px 10px', borderRadius: '999px',
                      backgroundColor: 'rgb(var(--borges-rgb) / 0.08)',
                      border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
                    }}>
                      Check-out {new Date(tonight.check_out + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Tomorrow Preview ── */}
      {tomorrowExps.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)' }}>
              Coming Up Tomorrow
            </p>
            <a
              href={`/trip/${tripId}/experiences`}
              className="font-optima"
              style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', textDecoration: 'none' }}
            >
              View all →
            </a>
          </div>
          <div style={{
            backgroundColor: 'var(--color-surface-sunken)',
            border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
            borderRadius: '12px', overflow: 'hidden',
          }}>
            {tomorrowExps.slice(0, 4).map((exp, i) => (
              <div
                key={exp.id}
                style={{
                  padding: '12px 18px',
                  borderBottom:
                    i < Math.min(tomorrowExps.length, 4) - 1
                      ? '0.5px solid rgb(var(--borges-rgb) / 0.08)'
                      : 'none',
                  display: 'flex', alignItems: 'center', gap: '12px',
                }}
              >
                <div style={{
                  width: '4px', height: '4px', borderRadius: '50%', flexShrink: 0,
                  backgroundColor: 'rgb(var(--borges-rgb) / 0.4)',
                }}/>
                <p
                  className="font-optima"
                  style={{
                    flex: 1, fontSize: 'var(--text-body)', color: 'var(--color-text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {exp.title}
                </p>
                {exp.time_of_day && (
                  <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                    {exp.time_of_day}
                  </p>
                )}
              </div>
            ))}
            {tomorrowExps.length > 4 && (
              <div style={{ padding: '10px 18px', borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.08)' }}>
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
                  +{tomorrowExps.length - 4} more
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Quick Actions ── */}
      <section style={{ marginBottom: '32px' }}>
        <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
          Quick Actions
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {(
            [
              {
                label: 'Message CQ',
                sub: 'Get instant support',
                href: 'https://wa.me/919884256431',
                external: true,
                iconPath: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="#706E56">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.522 5.848L.057 23.867l6.164-1.617A11.933 11.933 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.87 0-3.625-.48-5.15-1.322l-.368-.218-3.82 1.002 1.02-3.714-.239-.381A9.958 9.958 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                  </svg>
                ),
              },
              {
                label: 'All Experiences',
                sub: 'Full itinerary',
                href: `/trip/${tripId}/experiences`,
                external: false,
                iconPath: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M9 6h11M9 12h11M9 18h11M5 6v.01M5 12v.01M5 18v.01" stroke="#706E56" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                ),
              },
              {
                label: 'Documents',
                sub: 'Passes & confirmations',
                href: `/trip/${tripId}/documents`,
                external: false,
                iconPath: (
                  <svg width="13" height="15" viewBox="0 0 16 20" fill="none">
                    <path d="M3 1h6.5L14 5.5V19H3V1z" stroke="#706E56" strokeWidth="1.3" strokeLinejoin="round"/>
                    <path d="M9 1v5h5" stroke="#706E56" strokeWidth="1.3" strokeLinejoin="round"/>
                    <path d="M5 10h6M5 13h4" stroke="#706E56" strokeWidth="1.1" strokeLinecap="round"/>
                  </svg>
                ),
              },
              {
                label: 'Emergency',
                sub: `Call ${emergency}`,
                href: `tel:${emergency}`,
                external: false,
                iconPath: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M12 9v4M12 17h.01" stroke="#706E56" strokeWidth="1.8" strokeLinecap="round"/>
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#706E56" strokeWidth="1.4" strokeLinejoin="round"/>
                  </svg>
                ),
              },
            ] as const
          ).map(action => (
            <a
              key={action.label}
              href={action.href}
              {...(action.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <div style={{
                backgroundColor: 'var(--color-surface-sunken)',
                border: '0.5px solid rgb(var(--borges-rgb) / 0.12)',
                borderRadius: '10px', padding: '16px 14px',
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  backgroundColor: 'rgb(var(--borges-rgb) / 0.1)',
                  border: '0.5px solid rgb(var(--borges-rgb) / 0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '10px',
                }}>
                  {action.iconPath}
                </div>
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text)', marginBottom: '2px' }}>
                  {action.label}
                </p>
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
                  {action.sub}
                </p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ── Nearby Recommendations — placeholder ── */}
      <section>
        <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
          Nearby
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {[
            {
              label: 'Where to eat',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"
                    stroke="#6B696C" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ),
            },
            {
              label: 'Things to do',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                    stroke="#6B696C" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ),
            },
            {
              label: 'Shopping',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
                    stroke="#6B696C" strokeWidth="1.4" strokeLinejoin="round"/>
                  <line x1="3" y1="6" x2="21" y2="6" stroke="#6B696C" strokeWidth="1.4"/>
                  <path d="M16 10a4 4 0 01-8 0"
                    stroke="#6B696C" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ),
            },
          ].map(cat => (
            <div
              key={cat.label}
              style={{
                backgroundColor: 'var(--color-surface-sunken)',
                border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
                borderRadius: '10px', padding: '18px 12px', textAlign: 'center',
              }}
            >
              <div className="flex items-center justify-center" style={{ marginBottom: '8px', opacity: 0.45 }}>
                {cat.icon}
              </div>
              <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>{cat.label}</p>
              <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', marginTop: '3px' }}>
                Coming soon
              </p>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
