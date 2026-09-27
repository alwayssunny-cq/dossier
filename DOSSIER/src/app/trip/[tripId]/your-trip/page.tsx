import { createAdminClient } from '@/lib/supabase/admin'
import MobileCollapse from '@/components/MobileCollapse'
import { notFound, redirect } from 'next/navigation'
import type { Trip, Iteration, Experience, Stay, Transfer, Document, Traveler, DailyBrief, Recommendation, ConciergeRequest } from '@/lib/types'
import DayByDayItinerary from '@/components/DayByDayItinerary'
import Link from 'next/link'
import SectionNav from '@/components/SectionNav'
import { SectionOpen } from '@/components/PageSection'
import TodayInFull from '@/components/TodayInFull'
import { harvestPage, alike, imageSrc } from '@/lib/notionImages'
import DailyBriefSection from '@/components/DailyBriefSection'
import RecommendsSection from '@/components/RecommendsSection'
import ConciergeRequestsSection from '@/components/ConciergeRequestsSection'
import VouchersSection, { isVoucher } from '@/components/VouchersSection'
import { getTripPhase } from '@/lib/tripPhase'

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDay(d: string): string {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
  } catch { return d }
}

function fmtDate(d: string | null): string {
  if (!d) return ''
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return d }
}

function fmtRange(start: string | null, end: string | null): string {
  if (!start) return ''
  const s = fmtDate(start)
  const e = end ? fmtDate(end) : null
  return e ? `${s} – ${e}` : s
}

function nightsCount(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const n = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000)
  return n > 0 ? n : null
}

/** Your Days' opener delegates like everything else now. */
function SectionTitle({ children, eyebrow, id }: { children: React.ReactNode; eyebrow?: string; id?: string }) {
  return (
    <div id={id} style={{ scrollMarginTop: 'calc(var(--header-h) * 2 + var(--space-8))' }}>
      <SectionOpen eyebrow={eyebrow} title={children} />
    </div>
  )
}

// ── day grouping ──────────────────────────────────────────────────────────────

interface Day {
  dayNumber:   number
  date:        string
  dayLabel:    string
  city:        string | null
  experiences: Experience[]
  stay:        Stay | null
  transfers:   Transfer[]
}

function groupByDay(exps: Experience[], stays: Stay[], transfers: Transfer[], trip: Trip): Day[] {
  const dateSet = new Set<string>()
  for (const e of exps)      if (e.date) dateSet.add(e.date)
  for (const t of transfers) if (t.date) dateSet.add(t.date)

  for (const s of stays) {
    if (!s.check_in) continue
    dateSet.add(s.check_in)
    if (s.check_out) {
      const end = new Date(s.check_out + 'T00:00:00')
      const cur = new Date(s.check_in  + 'T00:00:00')
      cur.setDate(cur.getDate() + 1)
      while (cur < end) {
        dateSet.add(cur.toISOString().slice(0, 10))
        cur.setDate(cur.getDate() + 1)
      }
    }
  }

  if (dateSet.size === 0 && exps.length > 0 && trip.start_date) {
    for (const e of exps) {
      if (e.day_number != null) {
        const d = new Date(trip.start_date + 'T00:00:00')
        d.setDate(d.getDate() + e.day_number - 1)
        dateSet.add(d.toISOString().slice(0, 10))
      }
    }
  }

  const dates = Array.from(dateSet).sort()
  return dates.map((date, idx) => {
    const dayExps = exps
      .filter(e => e.date === date || (!e.date && e.day_number === idx + 1))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const dayTrfs = transfers
      .filter(t => t.date === date)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const stay = stays.find(s => {
      if (!s.check_in) return false
      if (!s.check_out) return s.check_in === date
      return s.check_in <= date && date < s.check_out
    }) ?? null
    const city = dayExps[0]?.location ?? dayTrfs[0]?.to_location ?? stay?.destination ?? null
    return {
      dayNumber: idx + 1,
      date,
      dayLabel: fmtDay(date),
      city,
      experiences: dayExps,
      stay,
      transfers: dayTrfs,
    }
  })
}

// ── types ─────────────────────────────────────────────────────────────────────

// ── sub-components ────────────────────────────────────────────────────────────


// ── Page ──────────────────────────────────────────────────────────────────────

export default async function YourTripPage({
  params,
  searchParams,
}: {
  params:       Promise<{ tripId: string }>
  searchParams: Promise<{ stage?: string; view?: string }>
}) {
  const { tripId }              = await params
  const { stage: stageParam, view }   = await searchParams
  // ?view=journey opens the full itinerary on its own, without today above it.
  const journeyOnly = view === 'journey'
  const db = createAdminClient()

  const { data: trip } = await db
    .from('trips').select('*').eq('trip_id', tripId).maybeSingle() as { data: Trip | null }
  if (!trip) notFound()

  const todayMs  = new Date().setHours(0, 0, 0, 0)
  const isLive   = !!(
    trip.start_date && trip.end_date &&
    new Date(trip.start_date).getTime() <= todayMs &&
    todayMs <= new Date(trip.end_date).getTime()
  )

  const { visibleTabs, viewingPhase } = getTripPhase(trip.status, isLive, stageParam)
  if (!visibleTabs.includes('your-trip')) {
    redirect(`/trip/${tripId}/${visibleTabs[0] ?? 'log'}${stageParam ? `?stage=${stageParam}` : ''}`)
  }

  const isBonVoyage = viewingPhase === 'completed' || viewingPhase === 'live'

  // Travelers
  const { data: linkRows } = await db
    .from('trip_travelers').select('traveler_id').eq('trip_id', trip.id)
  const travelerIds = (linkRows ?? []).map((r: { traveler_id: string }) => r.traveler_id)
  let travelers: Traveler[] = []
  if (travelerIds.length > 0) {
    const { data } = await db.from('travelers').select('*').in('id', travelerIds)
      .order('is_primary', { ascending: false })
    travelers = (data as Traveler[]) ?? []
  }

  // Current iteration
  const { data: iterRows } = await db
    .from('iterations').select('*').eq('trip_id', trip.id)
    .order('synced_at', { ascending: false })
  const iterations = (iterRows ?? []) as Iteration[]
  const iteration  = iterations.find(i => i.is_current) ?? iterations[0] ?? null

  // Experiences / stays / transfers
  let exps:       Experience[] = []
  let stays:      Stay[]       = []
  let transfers:  Transfer[]   = []

  if (iteration) {
    const [{ data: eData }, { data: sData }, { data: tData }] = await Promise.all([
      db.from('experiences').select('*').eq('trip_id', trip.id).eq('iteration_id', iteration.id)
        .order('date', { ascending: true, nullsFirst: false })
        .order('sort_order', { ascending: true }),
      db.from('stays').select('*').eq('trip_id', trip.id).eq('iteration_id', iteration.id)
        .order('check_in', { ascending: true, nullsFirst: false }),
      db.from('transfers').select('*').eq('trip_id', trip.id).eq('iteration_id', iteration.id)
        .order('date', { ascending: true, nullsFirst: false })
        .order('sort_order', { ascending: true }),
    ])
    exps      = (eData ?? []) as Experience[]
    stays     = (sData ?? []) as Stay[]
    transfers = (tData ?? []) as Transfer[]
  }

  // Documents
  const allLinkedIds = [
    ...exps.map(e => e.id),
    ...stays.map(s => s.id),
    ...transfers.map(t => t.id),
  ]
  const docsMap: Record<string, Document[]> = {}
  if (allLinkedIds.length > 0) {
    const { data: docs } = await db.from('documents').select('*').or(
      `linked_experience_id.in.(${exps.map(e => e.id).join(',')}),` +
      `linked_stay_id.in.(${stays.map(s => s.id).join(',')}),` +
      `linked_transfer_id.in.(${transfers.map(t => t.id).join(',')})`
    )
    for (const doc of (docs ?? []) as Document[]) {
      const key = doc.linked_experience_id ?? doc.linked_stay_id ?? doc.linked_transfer_id ?? ''
      if (!docsMap[key]) docsMap[key] = []
      docsMap[key].push(doc)
    }
  }

  // On-the-ground content — briefs, vouchers, requests, recommendations
  const [{ data: briefRows }, { data: recRows }, { data: reqRows }, { data: allDocRows }] = await Promise.all([
    db.from('daily_briefs').select('*').eq('trip_id', trip.id),
    db.from('recommendations').select('*').eq('trip_id', trip.id),
    db.from('concierge_requests').select('*').eq('trip_id', trip.id).order('created_at', { ascending: false }),
    db.from('documents').select('*').eq('trip_id', trip.id),
  ])
  const dailyBriefs       = (briefRows ?? []) as DailyBrief[]
  const recommendations   = (recRows ?? []) as Recommendation[]
  const conciergeRequests = (reqRows ?? []) as ConciergeRequest[]
  const voucherDocs       = ((allDocRows ?? []) as Document[])
    .filter(d => d.file_url && isVoucher(d.document_type ?? d.category))

  // The in-full journey is this iteration seen whole, so it draws on the same
  // synced Notion pages as the Experiences and Stays tabs. Without this it
  // generated its own imagery and the trip looked like two different trips.
  const { data: contentPages } = await db
    .from('trip_content_pages')
    .select('parsed_content')
    .eq('trip_id', trip.id)
    .in('type', ['experiences', 'stay'])   // 'stay' is singular in the table

  const pageBlocks = (contentPages ?? []).flatMap(
    (p: { parsed_content: unknown }) =>
      ((p.parsed_content as { blocks?: unknown[] } | null)?.blocks ?? []) as never[],
  )

  const days = groupByDay(exps, stays, transfers, trip)

  // While they are travelling, one day matters and the rest is reference.
  const todayIso = new Date().toISOString().slice(0, 10)
  const today = days.find(d => d.date === todayIso) ?? null

  // Today's experiences take their photographs from the same synced pages the
  // full journey draws on, so the page a traveller opens each morning is not
  // the one page in the dossier without a picture on it.
  //
  // Assigned up front rather than resolved during render: handing them out
  // lazily meant mutating a set while rendering, which is exactly the kind of
  // thing that works until it is rendered twice.
  const todayImages: Record<string, string> = {}
  if (today) {
    const { byTitle, byDay } = harvestPage(pageBlocks)
    const pool = [...(byDay.get(today.date.slice(5, 10)) ?? [])]
    for (const e of today.experiences) {
      const titled = [...byTitle.entries()]
        .find(([heading, v]) => v.images.length > 0 && alike(heading, e.title))
      const block = titled ? titled[1].images[0] : pool.shift()
      const src = block ? imageSrc(block) : null
      if (src) todayImages[e.title] = src
    }
  }

  const destLabel   = [trip.state_county, trip.destination_country].filter(Boolean).join(', ')
  const nights      = nightsCount(trip.start_date, trip.end_date)
  const primaryName = travelers[0]?.full_name?.split(' ')[0] ?? null


  const OPTIMA: React.CSSProperties = { fontFamily: "'CQ Optima', 'Optima', 'Trebuchet MS', sans-serif" }
  const SEASONS: React.CSSProperties = { fontFamily: "'The Seasons', Georgia, serif" }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <article>

      {isBonVoyage ? (
        /* ── BON VOYAGE HEADER ────────────────────────────────────────────── */
        <>
          {/* The opening composition is narrow: a greeting and the facts of
              the journey, held to about seven columns so the page begins as a
              statement rather than as a full-width band. The doors beneath it
              run the whole shell, and the closing section sits between the
              two — three spans on one page, all on the same left edge. */}
          <header className="cq-span-7" style={{ marginBottom: 'var(--pad-72)', paddingBottom: 'var(--pad-48)', borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.12)' }}>
            {/* Neither the destination nor the trip name is repeated here.
                By the time a reader reaches this line the bar at the top of
                the screen says "Into Nagaland · Bon Voyage", the hero says
                "Into Nagaland", and the stage rail says "Bon Voyage" — so
                the old header's "Nagaland, India", "Bon Voyage, John." and
                "Johns Nagaland" made five statements of two facts. The
                greeting is the only thing here that had not been said. */}
            {/* The stage rail above this line already says "Bon Voyage", and
                so does the bar at the top of the screen. The greeting is the
                human moment on this page, so it keeps its place and gives up
                the words that were already spoken. */}
            <h2 style={{ ...SEASONS, fontSize: 'var(--text-t1)', lineHeight: 1.15, color: 'var(--color-text)', marginBottom: '18px', fontWeight: 700 }}>
              {primaryName ? `Everything is ready, ${primaryName}.` : 'Everything is ready.'}
            </h2>

            {(trip.start_date || nights || travelers.length > 0) && (
              <div
                style={{
                  ...OPTIMA,
                  marginTop: 'var(--pad-40)',
                  paddingTop:  '24px',
                  borderTop:   '0.5px solid rgb(var(--borges-rgb) / 0.12)',
                  display:     'flex',
                  flexWrap:    'wrap' as const,
                  gap:         '24px',
                  fontSize: 'var(--text-caption)',
                  color:       'var(--color-text-accent)',
                }}
              >
                {trip.start_date && <span>{fmtRange(trip.start_date, trip.end_date)}</span>}
                {nights && <span>{nights} nights</span>}
                {travelers.length > 0 && (
                  <span>{travelers.map(t => t.full_name.split(' ')[0]).join(', ')}</span>
                )}
              </div>
            )}
          </header>
        </>
      ) : (
        /* ── RESERVATIONS HEADER ──────────────────────────────────────────── */
        <header style={{ marginBottom: 'var(--pad-72)', paddingBottom: 'var(--pad-48)', borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.12)' }}>
          {destLabel && (
            <p className="font-optima"
              style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
              {destLabel}
            </p>
          )}

          <h2 style={{ ...SEASONS, fontSize: 'var(--text-t1)', lineHeight: 1.15, color: 'var(--color-text)', marginBottom: '18px', fontWeight: 700 }}>
            Your journey is confirmed.
          </h2>

          <p className="font-optima cq-measure"
            style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)', lineHeight: 1.8, marginBottom: '36px' }}>
            Every reservation, document and payment associated with your journey can be accessed from this dossier.
          </p>

          {(trip.start_date || nights || travelers.length > 0) && (
            <div className="font-optima" style={{
              marginTop: 'var(--pad-40)', paddingTop: '24px',
              borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.12)',
              display: 'flex', flexWrap: 'wrap' as const, gap: '24px',
              fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)',
            }}>
              {trip.start_date && <span>{fmtRange(trip.start_date, trip.end_date)}</span>}
              {nights && <span>{nights} nights</span>}
              {travelers.length > 0 && (
                <span>{travelers.map(t => t.full_name.split(' ')[0]).join(', ')}</span>
              )}
              {iteration && <span style={{ color: 'var(--color-text-muted)' }}>Blueprint {iteration.name}</span>}
            </div>
          )}
        </header>
      )}

      {/* ── What's happening, on the ground ─────────────────────────────── */}
      {isBonVoyage && (
        <>
          {/* An index for a long page: everything here was reachable, but
              reaching the vouchers meant scrolling past the whole brief. */}
          <SectionNav
            sections={[
              { id: 'daily-brief', label: 'Daily brief',   present: dailyBriefs.length > 0 },
              { id: 'vouchers',    label: 'Vouchers',      present: voucherDocs.length > 0 },
              { id: 'concierge',   label: 'Concierge',     present: true },
              { id: 'recommends',  label: 'Recommends',    present: recommendations.length > 0 },
              { id: 'in-full',     label: 'The full journey', present: days.length > 0 },
            ]}
          />

          {/* Today leads the page, in full. Everything else stays a door. */}
          <TodayInFull
            day={today}
            city={trip.state_county ?? trip.destination_country ?? null}
            imageFor={t => todayImages[t] ?? null}
          />

          <div className="cq-door-list" style={{ display: 'grid', rowGap: 'var(--gap-section)' }}>
          <MobileCollapse
            id="daily-brief"
            eyebrow="Day by day"
            title="Daily Brief"
            summary={dailyBriefs.length ? `${dailyBriefs.length} ${dailyBriefs.length === 1 ? 'briefing' : 'briefings'}` : null}
          >
            <p className="font-optima cq-measure" style={{ fontSize: 'var(--text-body)', lineHeight: 1.75, color: 'var(--color-text-secondary)', marginBottom: '28px' }}>
              Everything you need for the day ahead, in one place. Each briefing is written the evening before.
            </p>
            <DailyBriefSection briefs={dailyBriefs} />
          </MobileCollapse>

          <MobileCollapse
            id="vouchers"
            eyebrow="Ready to present"
            title="Vouchers & Tickets"
            summary={voucherDocs.length ? `${voucherDocs.length}` : null}
          >
            <VouchersSection docs={voucherDocs} />
          </MobileCollapse>

          <MobileCollapse
            id="concierge"
            eyebrow="Ask for anything"
            title="Concierge Requests"
            summary={conciergeRequests.length ? `${conciergeRequests.length} open` : null}
          >
            <ConciergeRequestsSection tripId={tripId} requests={conciergeRequests} />
          </MobileCollapse>

          <MobileCollapse
            id="recommends"
            eyebrow="Around you"
            title="CQ Recommends"
            summary={recommendations.length ? `${recommendations.length} places` : null}
          >
            <RecommendsSection places={recommendations} />
          </MobileCollapse>
          </div>
        </>
      )}


      {/* ── No itinerary yet ── */}
      {days.length === 0 && (
        <div style={{ padding: '64px 0', textAlign: 'center' }}>
          <p className="cq-subhead" style={{ fontSize: 'var(--text-subhead)', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
            Your itinerary is being finalised
          </p>
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)' }}>
            The day-by-day manuscript will appear here once confirmed.
          </p>
        </div>
      )}

      {/* ── Day chapters — one card per day, opened on demand ── */}
      {/* A door, not the whole itinerary poured onto the page beneath today. */}
      {days.length > 0 && isBonVoyage && !journeyOnly && (
        <div
          className="cq-span-9"
          style={{
            marginTop: 'var(--gap-section)',
            paddingTop: 'var(--gap-opening)',
            borderTop: '1px solid var(--color-rule-strong)',
          }}
        >
          <SectionTitle id="in-full" eyebrow="The whole journey">Your Designed Journey, in Full</SectionTitle>
          <p className="cq-body cq-measure" style={{ marginTop: 0 }}>
            Every day of the journey, start to finish.
          </p>
          <p style={{ marginTop: 'var(--space-6)', marginBottom: 0 }}>
            <Link
              href={`/trip/${tripId}/journey`}
              className="font-optima cq-tap-link"
              style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-accent)' }}
            >
              Read the full journey →
            </Link>
          </p>
        </div>
      )}

      {days.length > 0 && (!isBonVoyage || journeyOnly) && (
        <div
          className="cq-span-9"
          style={{
            marginTop: 'var(--gap-section)',
            paddingTop: 'var(--gap-opening)',
            borderTop: '1px solid var(--color-rule-strong)',
          }}
        >
        <SectionTitle id="in-full" eyebrow="The whole journey">Your Designed Journey, in Full</SectionTitle>
        <DayByDayItinerary
          blocks={pageBlocks}
          days={days}
          fallbackCity={trip.state_county ?? trip.destination_country ?? null}
        />
        </div>
      )}

      {/* Print note */}
      {days.length > 0 && (
        <div
          style={{
            marginTop: 'var(--pad-96)',
            paddingTop:  '32px',
            borderTop:   '0.5px solid rgb(var(--borges-rgb) / 0.10)',
          }}
        >
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
            Closequarters · Private dossier · {trip.trip_name}
          </p>
        </div>
      )}
    </article>
  )
}
