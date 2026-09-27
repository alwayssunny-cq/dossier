import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link    from 'next/link'
import { Suspense } from 'react'
import type { Trip, Iteration, Experience, Stay, Transfer, Document } from '@/lib/types'
import { getTripPhase } from '@/lib/tripPhase'
import IterationDropdown from '@/components/itinerary/IterationDropdown'
import ItinerarySubTabs, { type SubTabSlug } from '@/components/itinerary/ItinerarySubTabs'
import ItineraryClient,  { type ItineraryDay } from '@/components/itinerary/ItineraryClient'
import JourneyHeroMap, { type GeoExperience, type GeoStay, type GeoTransfer } from '@/components/itinerary/JourneyHeroMap'
import JourneyStrip, { type JourneyStop } from '@/components/itinerary/JourneyStrip'
import { geocodeCities } from '@/lib/geocode'
import ExperiencesList from '@/components/ExperiencesList'
import StaysClient    from '@/components/StaysClient'
import TransfersClient from '@/components/TransfersClient'
import { requireTripAccess } from '@/lib/tripAccess'

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_SUB_TABS: SubTabSlug[] = ['day-by-day', 'experiences', 'stay', 'transfers']

// ── Date helpers ──────────────────────────────────────────────────────────────

function formatDayLabel(date: string): string {
  try {
    const d = new Date(date + 'T00:00:00')
    return d.toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return date }
}

function fmtSyncedAt(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return dateStr }
}

// ── groupByDay ────────────────────────────────────────────────────────────────

function groupByDay(
  experiences: Experience[],
  stays:       Stay[],
  transfers:   Transfer[],
  trip:        Trip,
): ItineraryDay[] {
  const dateSet = new Set<string>()
  for (const e of experiences) if (e.date) dateSet.add(e.date)
  for (const t of transfers)   if (t.date) dateSet.add(t.date)
  for (const s of stays)       if (s.check_in) dateSet.add(s.check_in)

  // Fallback: derive dates from day_number + trip.start_date
  if (dateSet.size === 0 && experiences.length > 0 && trip.start_date) {
    for (const e of experiences) {
      if (e.day_number != null) {
        const d = new Date(trip.start_date + 'T00:00:00')
        d.setDate(d.getDate() + e.day_number - 1)
        dateSet.add(d.toISOString().slice(0, 10))
      }
    }
  }

  const dates = Array.from(dateSet).sort()

  return dates.map((date, idx) => {
    const dayExps = experiences
      .filter(e => e.date === date || (!e.date && e.day_number === idx + 1))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

    const dayTransfers = transfers
      .filter(t => t.date === date)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

    const stay = stays.find(s => s.check_in === date) ?? null

    const city =
      dayExps[0]?.location ??
      dayTransfers[0]?.to_location ??
      stay?.destination ??
      null

    return {
      dayNumber: idx + 1,
      date,
      dayLabel: formatDayLabel(date),
      city,
      experiences: dayExps,
      stay,
      transfers: dayTransfers,
    }
  })
}

// ── Journey stops builder ─────────────────────────────────────────────────────

function buildJourneyStops(days: ItineraryDay[]): JourneyStop[] {
  const stops: JourneyStop[] = []
  for (const day of days) {
    const loc = day.city
    if (!loc) continue
    const last = stops[stops.length - 1]
    if (last && last.location === loc) {
      last.endDate = day.date
      last.dayNumbers.push(day.dayNumber)
    } else {
      stops.push({
        location:   loc,
        startDate:  day.date,
        endDate:    day.date,
        dayNumbers: [day.dayNumber],
        stopIndex:  stops.length + 1,
      })
    }
  }
  return stops
}

// ── Archived banner ───────────────────────────────────────────────────────────

function ArchivedBanner({
  syncedAt,
  tripId,
  currentIterName,
}: {
  iterName:        string
  syncedAt:        string
  tripId:          string
  currentIterName: string | null
}) {
  return (
    <div
      style={{
        borderTop:       '1px solid rgb(var(--borges-rgb) / 0.2)',
        borderBottom:    '1px solid rgb(var(--borges-rgb) / 0.2)',
        backgroundColor: 'var(--color-surface-sunken)',
      }}
    >
      <div
        className="mx-auto flex items-center justify-between"
        style={{ width: '100%', padding: '8px 20px' }}
      >
        <div className="flex items-center" style={{ gap: '8px', minWidth: 0 }}>
          <span
            className="font-optima whitespace-nowrap"
            style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text)', letterSpacing: '0.04em' }}
          >
            Viewing archived iteration · {fmtSyncedAt(syncedAt)}
          </span>
          {currentIterName && (
            <>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-caption)' }}>·</span>
              <span
                className="font-optima whitespace-nowrap"
                style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', letterSpacing: '0.04em' }}
              >
                Current: {currentIterName}
              </span>
            </>
          )}
        </div>
        <Link
          href={`/trip/${tripId}/itinerary`}
          className="font-optima whitespace-nowrap"
          style={{
            fontSize: 'var(--text-caption)',
            color:               'var(--color-text-accent)',
            letterSpacing:       '0.08em',
            textDecoration:      'underline',
            textUnderlineOffset: '3px',
            textDecorationColor: 'rgb(var(--borges-rgb) / 0.4)',
            marginLeft:          '16px',
            flexShrink:          0,
          }}
        >
          Return to current
        </Link>
      </div>
    </div>
  )
}

// ── No-data empty states ──────────────────────────────────────────────────────

function SubTabEmpty({ label }: { label: string }) {
  return (
    <div
      className="flex flex-col items-center text-center"
      style={{ padding: '64px 24px' }}
    >
      <p
        className="font-optima"
        style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)', marginBottom: '8px' }}
      >
        No {label} for this iteration
      </p>
      <p
        className="font-optima"
        style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}
      >
        Content will appear here once the Drawing Board is synced.
      </p>
    </div>
  )
}

function EmptyItineraryState({ tripId }: { tripId: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ minHeight: '60vh', padding: '60px 24px' }}
    >
      <div
        style={{
          width:           '40px',
          height:          '1px',
          backgroundColor: 'rgb(var(--borges-rgb) / 0.35)',
          marginBottom: 'var(--pad-40)',
        }}
      />
      <p
        className="cq-subhead"
        style={{ fontSize: 'var(--text-subhead)', color: 'var(--color-text-accent)', letterSpacing: '0.01em', marginBottom: '12px' }}
      >
        Your experience blueprint is being finalised
      </p>
      <p
        className="font-optima"
        style={{
          fontSize: 'var(--text-body)',
          color:        'var(--color-text-muted)',
          lineHeight:   1.7,
          maxWidth:     '280px',
          marginBottom: '36px',
        }}
      >
        Our team is putting together your day-by-day experience. We&apos;ll notify you when it&apos;s ready.
      </p>
      <Link
        href={`/trip/${tripId}/log`}
        className="font-optima"
        style={{
          display:        'inline-flex',
          alignItems:     'center',
          gap:            '6px',
          border:         '0.5px solid rgb(var(--borges-rgb) / 0.3)',
          borderRadius:   '8px',
          padding:        '10px 20px',
          color:          'var(--color-text-accent)',
          textDecoration: 'none',
          fontSize: 'var(--text-caption)',
          letterSpacing:  '0.08em',
        }}
      >
        Message Us
      </Link>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ItineraryPage({
  params,
  searchParams,
}: {
  params:       Promise<{ tripId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { tripId }  = await params
  await requireTripAccess(tripId)
  const resolved    = await searchParams
  const iterParam   = typeof resolved.iter  === 'string' ? resolved.iter  : null
  const subParam    = typeof resolved.sub   === 'string' ? resolved.sub   : null
  const stageParam  = typeof resolved.stage === 'string' ? resolved.stage : null

  const db = createAdminClient()

  // ── Trip ────────────────────────────────────────────────────────────────────
  const { data: trip } = await db
    .from('trips').select('*').eq('trip_id', tripId).maybeSingle() as { data: Trip | null }
  if (!trip) notFound()

  const todayMs = new Date().setHours(0, 0, 0, 0)
  const isLive  = !!(
    trip.start_date && trip.end_date &&
    new Date(trip.start_date).getTime() <= todayMs &&
    todayMs <= new Date(trip.end_date).getTime()
  )

  // Guard: use stageOverride when present so past-stage navigation works (e.g. viewing Crafting from Reservations).
  // getTripPhase validates that the override is a genuinely accessible (past) stage, so no forward-bypass is possible.
  const { visibleTabs } = getTripPhase(trip.status, isLive, stageParam)
  if (!visibleTabs.includes('itinerary')) {
    redirect(`/trip/${tripId}/${visibleTabs[0] ?? 'log'}`)
  }

  // ── Iterations ─────────────────────────────────────────────────────────────
  const { data: rawIterations } = await db
    .from('iterations')
    .select('*')
    .eq('trip_id', trip.id)
    .order('synced_at', { ascending: false })

  const iterations = (rawIterations ?? []) as Iteration[]

  // ── Resolve selected iteration ──────────────────────────────────────────────
  let selectedIteration: Iteration | null = null
  if (iterParam) {
    selectedIteration = iterations.find(i => i.name === iterParam) ?? null
  }
  if (!selectedIteration) {
    selectedIteration = iterations.find(i => i.is_current) ?? iterations[0] ?? null
  }

  const currentIteration = iterations.find(i => i.is_current) ?? null
  const isArchived   = !!selectedIteration && !selectedIteration.is_current
  const iterHrefParam = isArchived ? (selectedIteration?.name ?? null) : null

  // ── Sub-tab ─────────────────────────────────────────────────────────────────
  const activeSub: SubTabSlug =
    subParam && VALID_SUB_TABS.includes(subParam as SubTabSlug)
      ? (subParam as SubTabSlug)
      : 'day-by-day'

  // ── No iterations → empty state ─────────────────────────────────────────────
  if (iterations.length === 0) {
    return <EmptyItineraryState tripId={tripId} />
  }

  const iterUuid = selectedIteration!.id

  // ── Always fetch all iteration data ─────────────────────────────────────────
  const [{ data: rawE }, { data: rawS }, { data: rawT }] = await Promise.all([
    db.from('experiences').select('*')
      .eq('trip_id', trip.id).eq('iteration_id', iterUuid)
      .order('date',       { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true }),
    db.from('stays').select('*')
      .eq('trip_id', trip.id).eq('iteration_id', iterUuid)
      .order('check_in',   { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true }),
    db.from('transfers').select('*')
      .eq('trip_id', trip.id).eq('iteration_id', iterUuid)
      .order('date',       { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true }),
  ])
  const allExps  = (rawE ?? []) as Experience[]
  const allStays = (rawS ?? []) as Stay[]
  const allTrfs  = (rawT ?? []) as Transfer[]

  // ── Geocode all unique locations ─────────────────────────────────────────────
  const seenLocs = new Set<string>()
  const locNames: string[] = []
  const addLoc = (l: string | null | undefined) => {
    if (l && !seenLocs.has(l)) { seenLocs.add(l); locNames.push(l) }
  }
  for (const e of allExps)  addLoc(e.location)
  for (const s of allStays) addLoc(s.destination)
  for (const t of allTrfs)  { addLoc(t.from_location); addLoc(t.to_location) }

  const geoCities  = locNames.length > 0 ? await geocodeCities(locNames) : []
  const coordsMap  = Object.fromEntries(geoCities.map(c => [c.name, { lat: c.lat, lng: c.lng }]))

  // ── Build geo arrays for hero map ────────────────────────────────────────────
  const geoExps: GeoExperience[] = allExps
    .filter(e => e.location && coordsMap[e.location])
    .map(e => ({
      id:         e.id,
      title:      e.title,
      location:   e.location,
      lat:        coordsMap[e.location!].lat,
      lng:        coordsMap[e.location!].lng,
      sort_order: e.sort_order ?? null,
      date:       e.date ?? null,
      day_number: e.day_number ?? null,
    }))

  const geoStays: GeoStay[] = allStays
    .filter(s => s.destination && coordsMap[s.destination])
    .map(s => ({
      id:            s.id,
      property_name: s.property_name,
      destination:   s.destination,
      lat:           coordsMap[s.destination!].lat,
      lng:           coordsMap[s.destination!].lng,
      check_in:      s.check_in ?? null,
    }))

  const geoTrfs: GeoTransfer[] = allTrfs
    .filter(t =>
      t.from_location && t.to_location &&
      coordsMap[t.from_location] && coordsMap[t.to_location]
    )
    .map(t => ({
      id:            t.id,
      from_location: t.from_location,
      to_location:   t.to_location,
      transfer_mode: t.transfer_mode ?? null,
      fromLat:       coordsMap[t.from_location!].lat,
      fromLng:       coordsMap[t.from_location!].lng,
      toLat:         coordsMap[t.to_location!].lat,
      toLng:         coordsMap[t.to_location!].lng,
    }))

  // ── Per-tab document fetching ────────────────────────────────────────────────
  let subExpDocsMap: Record<string, Document[]> = {}
  let subStayDocs:   Record<string, Document[]> = {}
  let subTrfDocs:    Record<string, Document[]> = {}

  if (activeSub === 'experiences' && allExps.length > 0) {
    const { data: docs } = await db.from('documents').select('*')
      .in('linked_experience_id', allExps.map(e => e.id))
    for (const doc of (docs ?? []) as Document[]) {
      const eid = doc.linked_experience_id!
      if (!subExpDocsMap[eid]) subExpDocsMap[eid] = []
      subExpDocsMap[eid].push(doc)
    }
  }

  if (activeSub === 'stay' && allStays.length > 0) {
    const { data: docs } = await db.from('documents').select('*')
      .in('linked_stay_id', allStays.map(s => s.id))
    for (const doc of (docs ?? []) as Document[]) {
      const sid = doc.linked_stay_id!
      if (!subStayDocs[sid]) subStayDocs[sid] = []
      subStayDocs[sid].push(doc)
    }
  }

  if (activeSub === 'transfers' && allTrfs.length > 0) {
    const { data: docs } = await db.from('documents').select('*')
      .in('linked_transfer_id', allTrfs.map(t => t.id))
    for (const doc of (docs ?? []) as Document[]) {
      const tid = doc.linked_transfer_id!
      if (!subTrfDocs[tid]) subTrfDocs[tid] = []
      subTrfDocs[tid].push(doc)
    }
  }

  // ── Day-by-day view ──────────────────────────────────────────────────────────
  const days = groupByDay(allExps, allStays, allTrfs, trip)
  const isDayByDayEmpty = activeSub === 'day-by-day' && days.length === 0

  // ── Journey strip ────────────────────────────────────────────────────────────
  const journeyStops = buildJourneyStops(days)
  const activeDate   = isLive ? new Date().toISOString().slice(0, 10) : null

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ margin: '0 -20px' }}>

      {/* Archived banner */}
      {isArchived && selectedIteration && (
        <ArchivedBanner
          iterName={selectedIteration.name}
          syncedAt={selectedIteration.synced_at}
          tripId={tripId}
          currentIterName={currentIteration?.name ?? null}
        />
      )}

      {/* Journey strip — primary route UI */}
      <JourneyStrip stops={journeyStops} activeDate={activeDate} />

      {/* Hero map — visual enhancement, secondary */}
      <JourneyHeroMap
        experiences={geoExps}
        stays={geoStays}
        transfers={geoTrfs}
        activeTab={activeSub}
      />

      {/* Iteration dropdown */}
      <div
        style={{
          display:        'flex',
          justifyContent: 'flex-end',
          alignItems:     'center',
          padding:        '16px 20px 12px',
        }}
      >
        <Suspense fallback={null}>
          <IterationDropdown
            iterations={iterations}
            selectedName={selectedIteration?.name ?? '—'}
          />
        </Suspense>
      </div>

      {/* Sub-tab navigation */}
      <Suspense fallback={<div style={{ height: '49px' }} />}>
        <ItinerarySubTabs
          tripId={tripId}
          activeSub={activeSub}
          iterName={iterHrefParam}
        />
      </Suspense>

      {/* ── Sub-tab content ── */}

      {/* DAY-BY-DAY */}
      {activeSub === 'day-by-day' && (
        <div style={{ padding: '32px 20px 80px' }}>
          <ItineraryClient
            trip={trip}
            days={days}
            isEmpty={isDayByDayEmpty}
            tripId={tripId}
          />
        </div>
      )}

      {/* EXPERIENCES */}
      {activeSub === 'experiences' && (
        <div style={{ padding: '32px 20px 80px' }}>
          {allExps.length === 0 ? (
            <SubTabEmpty label="experiences" />
          ) : (
            <ExperiencesList
              experiences={allExps}
              docsMap={subExpDocsMap}
              locationContext={[trip?.state_county, trip?.destination_country].filter(Boolean).join(', ') || undefined}
            />
          )}
        </div>
      )}

      {/* STAY */}
      {activeSub === 'stay' && (
        <div style={{ padding: '32px 20px 80px' }}>
          {allStays.length === 0 ? (
            <SubTabEmpty label="stays" />
          ) : (
            <StaysClient stays={allStays} docsMap={subStayDocs} />
          )}
        </div>
      )}

      {/* TRANSFERS */}
      {activeSub === 'transfers' && (
        <div style={{ padding: '32px 20px 80px' }}>
          {allTrfs.length === 0 ? (
            <SubTabEmpty label="transfers" />
          ) : (
            <TransfersClient transfers={allTrfs} docsMap={subTrfDocs} />
          )}
        </div>
      )}

    </div>
  )
}
