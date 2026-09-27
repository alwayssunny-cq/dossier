import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Trip, Traveler, TripRequest } from '@/lib/types'
import RealtimeRefresher from '@/components/RealtimeRefresher'
import { ActiveTripCard, PastTripCard } from '@/components/TripCards'
import DashboardHeader from '@/components/DashboardHeader'
import DualClock from '@/components/DualClock'
import { SectionOpen } from '@/components/PageSection'
import RegisterInterestCard from '@/components/RegisterInterestCard'
import CQLoafSection from '@/components/CQLoafSection'
import { ARCHETYPES } from '@/lib/archetypes'
import { getDossierSuggestions, type Suggestion } from '@/lib/suggestions'
import type { LoafStory } from '@/components/CQLoafSection'
import CQLogo from '@/components/CQLogo'

const CQ_WHATSAPP = 'https://wa.me/919884256431'
const CQ_EMAIL    = 'mailto:hello@closequarters.club'

const STAGES = ['First Steps', 'Crafting', 'Reservations', 'Bon Voyage']

const CARD_SHADOW = '0 2px 4px rgb(var(--night-rgb) / 0.05), 0 12px 32px rgb(var(--night-rgb) / 0.10), 0 28px 64px rgb(var(--night-rgb) / 0.07)'

function stageIndex(status: string | null): number {
  const s = (status ?? '').toLowerCase()
  if (s.includes('voyage') || s === 'live' || s === 'completed') return 3
  if (s.includes('reserv')) return 2
  if (s.includes('craft')) return 1
  return 0
}

function fmtDay(d: string | null): string | null {
  if (!d) return null
  try {
    return new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
  } catch { return null }
}

/** What's happening in the current stage, and the next moment coming. */
function stageSummary(trip: Trip, idx: number): { now: string; nextTitle: string; nextMeta: string | null } {
  if (idx === 0) {
    const rd = trip.reading_date ? new Date(trip.reading_date) : null
    const readingAhead = rd && rd.getTime() >= Date.now()
    return {
      now: 'We’re getting to know you and shaping the vision for this journey.',
      nextTitle: readingAhead ? 'Your Reading' : 'The Invitation',
      nextMeta: readingAhead
        ? fmtDay(trip.reading_date)
        : 'If we’re a match, we’ll extend it formally.',
    }
  }
  if (idx === 1) {
    return trip.blueprint_confirmed
      ? { now: 'Your blueprint is confirmed — the shape of each day is settled.', nextTitle: 'Reservations begin', nextMeta: 'We start confirming your bookings.' }
      : { now: 'Your itinerary is being designed — dates, places, and the shape of each day.', nextTitle: 'Your blueprint, for review', nextMeta: 'We’ll share it as soon as it’s ready.' }
  }
  if (idx === 2) {
    const pay = fmtDay(trip.next_payment_date)
    return {
      now: 'We’re confirming your stays, experiences, and transfers.',
      nextTitle: pay ? 'Next payment' : 'Bon Voyage',
      nextMeta: pay ?? 'Documents and final details follow.',
    }
  }
  const dep = fmtDay(trip.start_date)
  const days = trip.start_date
    ? Math.ceil((new Date(trip.start_date).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
    : null
  return {
    now: 'Everything is being readied for departure — documents, briefings, final touches.',
    nextTitle: 'Departure',
    nextMeta: [dep, days != null && days >= 0 ? `${days} day${days === 1 ? '' : 's'} to go` : null].filter(Boolean).join(' · ') || null,
  }
}

function requestStatusBadge(status: string): { bg: string; text: string; border: string } {
  if (status === 'Reviewed')     return { bg: 'rgb(var(--night-rgb) / 0.12)',  text: 'var(--color-text-secondary)', border: 'rgb(var(--night-rgb) / 0.3)'  }
  if (status === 'Trip Created') return { bg: 'rgb(var(--borges-rgb) / 0.1)',    text: 'var(--color-text-accent)', border: 'rgb(var(--borges-rgb) / 0.25)'  }
  if (status === 'Declined')     return { bg: 'rgb(var(--night-rgb) / 0.1)',  text: 'var(--color-text)', border: 'rgb(var(--night-rgb) / 0.3)' }
  return { bg: 'rgb(var(--borges-rgb) / 0.12)', text: 'var(--color-text-accent)', border: 'rgb(var(--borges-rgb) / 0.3)' }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const db = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const rawPhone = user.phone ?? ''
  const digits10 = rawPhone.replace(/^\+?91/, '')
  const orClause = [...new Set([digits10, '91'+digits10, '+91'+digits10, rawPhone].filter(Boolean))]
    .map(p => `phone.eq.${p}`).join(',')

  const { data: travelerRows } = await db
    .from('travelers').select('*').or(orClause).order('is_primary', { ascending: false })
  const traveler = (travelerRows?.[0] ?? null) as Traveler | null

  let trips: Trip[] = []
  if (traveler?.client_id) {
    const { data } = await db.from('trips').select('*').eq('client_id', traveler.client_id)
      .order('start_date', { ascending: false })
    trips = (data as Trip[]) ?? []
  } else {
    const { data } = await db.from('trips').select('*').order('start_date', { ascending: false })
    trips = (data as Trip[]) ?? []
  }

  const pastStatuses = ['completed', 'cancelled']
  const activeTrips  = trips.filter(t => !pastStatuses.includes((t.status ?? '').toLowerCase()))
  const pastTrips    = trips.filter(t =>  pastStatuses.includes((t.status ?? '').toLowerCase()))
  const firstName    = (traveler?.full_name?.trim().split(/\s+/)[0] ?? 'there').replace(/\.+$/, '')
  const clientId     = traveler?.client_id ?? null

  let clientEmail: string | null = null
  let clientFullName: string | null = null
  let clientPhone: string | null = null
  let archetypeCode: string | null = null
  let archetypeName: string | null = null
  let homeCity: string | null = null
  if (clientId) {
    const { data: clientRow } = await db
      .from('clients').select('*').eq('id', clientId).maybeSingle()
    const c = clientRow as {
      archetype_code?: string | null; archetype_name?: string | null; home_city?: string | null
      client_name?: string | null; email?: string | null
    } | null
    archetypeCode = c?.archetype_code ?? null
    archetypeName = c?.archetype_name ?? null
    homeCity      = c?.home_city ?? null
    clientEmail   = c?.email ?? null
    clientFullName = c?.client_name ?? null
  }
  if (clientId) {
    const { data: primary } = await db
      .from('travelers')
      .select('phone, email, full_name')
      .eq('client_id', clientId)
      .order('is_primary', { ascending: false })
      .limit(1)
      .maybeSingle()
    const t = primary as { phone?: string | null; email?: string | null; full_name?: string | null } | null
    clientPhone    = t?.phone ?? null
    clientEmail    = clientEmail ?? t?.email ?? null
    clientFullName = clientFullName ?? t?.full_name ?? null
  }

  const archetypeEssence = archetypeCode ? ARCHETYPES[archetypeCode]?.essence ?? null : null

  let birthdayDaysAway: number | null = null
  if (traveler?.date_of_birth) {
    const today = new Date()
    const dob = new Date(traveler.date_of_birth)
    const thisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate())
    const diffThis = Math.ceil((thisYear.getTime() - today.getTime()) / 86400000)
    if (diffThis >= 0 && diffThis <= 60) {
      birthdayDaysAway = diffThis
    } else {
      const nextYear = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate())
      const diffNext = Math.ceil((nextYear.getTime() - today.getTime()) / 86400000)
      if (diffNext >= 0 && diffNext <= 60) birthdayDaysAway = diffNext
    }
  }

  // ── What's Next signals — live trip, next itinerary item, weekly suggestions ──
  const todayMs  = new Date().setHours(0, 0, 0, 0)
  const todayStr = new Date(todayMs).toISOString().split('T')[0]
  const liveTrip = activeTrips.find(t =>
    t.start_date && t.end_date &&
    new Date(t.start_date).getTime() <= todayMs && todayMs <= new Date(t.end_date).getTime()
  ) ?? null
  const upcomingTrip = activeTrips[0] ?? null

  interface NextItem { title: string; date: string | null; time_of_day: string | null; location: string | null }
  let nextItem: NextItem | null = null
  if (liveTrip) {
    const { data } = await db
      .from('experiences')
      .select('title, date, time_of_day, location')
      .eq('trip_id', liveTrip.id).eq('is_current', true)
      .gte('date', todayStr)
      .order('date', { ascending: true }).order('sort_order', { ascending: true })
      .limit(1)
    nextItem = (data?.[0] as NextItem | undefined) ?? null
  }

  // Suggestions location: on the ground if travelling; otherwise home city,
  // falling back to the next journey's destination.
  const firstTown = (t: Trip) => t.towns_cities?.split(',')[0]?.trim() || null
  let suggestionsPlace: string | null = null
  if (liveTrip) {
    suggestionsPlace = [firstTown(liveTrip) ?? liveTrip.state_county, liveTrip.destination_country]
      .filter(Boolean).join(', ')
  } else if (homeCity) {
    suggestionsPlace = homeCity
  } else if (upcomingTrip?.destination_country) {
    suggestionsPlace = [upcomingTrip.state_county, upcomingTrip.destination_country].filter(Boolean).join(', ')
  }

  // Suggestions come from Notion now, not from generation: CQ Recommends
  // while they are on the ground, CQ Suggestions matched to their archetype
  // between trips.
  const suggestions: Suggestion[] | null = await getDossierSuggestions(db, {
    tripId: liveTrip?.id ?? null,
    archetypeName,
  })

  let loafStories: LoafStory[] = []
  try {
    const { data: loafData } = await db
      .from('loaf_stories')
      .select('id, headline, location, summary, story, tags, date_featured, is_this_week, reading_link, cover_url')
      .order('is_this_week', { ascending: false })
      .order('date_featured', { ascending: false })
      // Fetched well past what is shown, because the limit is applied before
      // duplicates are removed. Five Notion pages carry the same Uluru story,
      // so a limit of 6 returned five copies of it plus one other story — and
      // after de-duplication the shelf held two cards while two perfectly good
      // stories never left the database.
      .limit(40)
    // The same story can exist as several Notion pages — five copies of one
    // headline were published within a minute of each other — and each is a
    // legitimate row. The rail shows each story once regardless.
    const seenHeadlines = new Set<string>()
    loafStories = ((loafData as LoafStory[]) ?? []).filter(s => {
      const key = (s.headline ?? '').trim().toLowerCase()
      if (!key || seenHeadlines.has(key)) return false
      seenHeadlines.add(key)
      return true
    }).slice(0, 6)
  } catch { /* table not yet created */ }

  let pendingRequests: TripRequest[] = []
  if (clientId) {
    try {
      const { data: reqData } = await db
        .from('trip_requests').select('*')
        .eq('client_id', clientId).not('status', 'eq', 'Declined')
        .order('created_at', { ascending: false })
      pendingRequests = (reqData as TripRequest[]) ?? []
    } catch { /* table may not exist */ }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-surface)' }}>
      <RealtimeRefresher tables={['trips', 'loaf_stories']} />

      {/* §13: a landmark to jump to. Everything below the header is the
          dossier itself, and without <main> a screen reader had no way to
          skip the navigation and start reading. */}
      <main id="content">

      {/* ══════════════════════════════════════════════════════════
          ZONE A  ·  NAV + GREETING + ACTIVE JOURNEY
          Background: cream var(--color-surface) (page default)
      ══════════════════════════════════════════════════════════ */}
      <div style={{ backgroundColor: 'var(--color-surface)' }}>
        <div className="cq-shell page-content" style={{ paddingTop: '32px' }}>

          <DashboardHeader firstName={firstName} />

          {/* ── Dateline masthead — the dossier is a periodical of one ── */}
          <div style={{
            borderTop: '1px solid rgb(var(--night-rgb) / 0.7)',
            borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.18)',
            padding: '9px 2px',
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '16px',
          }}>
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text)' }}>
              Your Dossier
            </p>
            <DualClock destination={activeTrips[0]?.state_county ?? activeTrips[0]?.destination_country ?? null} />
          </div>

          {/* Greeting + standfirst.
              
              Held to about seven columns so the dossier opens as a statement
              rather than as another full-width band. Everything below it —
              the journey, what's next, the shelf of Selections — runs the
              width of the shell, so the page has two extents on one left
              edge instead of four identical rectangles. */}
          <div className="cq-span-7" style={{ paddingTop: 'var(--pad-56)', paddingBottom: 'var(--pad-96)' }}>
            <h1 className="cq-t1" style={{ fontSize: 'var(--text-t1)', lineHeight: 1.0, color: 'var(--color-text)' }}>
              Welcome back, {firstName}.
            </h1>
            {activeTrips[0]?.destination_country && activeTrips[0]?.start_date && (
              <p className="font-optima" style={{ marginTop: '18px', fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                {/* "— in motion" used to close this line, and the section
                    immediately beneath it is titled "In Motion". The reader
                    was told the same thing twice in two lines. The standfirst
                    keeps the facts; the section keeps the label. */}
                {activeTrips[0].destination_country},{' '}
                {new Date(activeTrips[0].start_date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}.
              </p>
            )}
            {birthdayDaysAway !== null && birthdayDaysAway <= 14 && (
              <p className="font-optima" style={{ marginTop: '14px', fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                {birthdayDaysAway === 0
                  ? 'Happy birthday.'
                  : `${birthdayDaysAway} day${birthdayDaysAway === 1 ? '' : 's'} to your birthday.`}
              </p>
            )}
          </div>

          {/* In Motion — lead story + requests rail */}
          <div style={{ marginBottom: 'var(--pad-96)' }}>
            <ZoneHeader eyebrow="In Motion" title="Your Journey" />
            <div className={pendingRequests.length > 0 ? 'grid gap-10 lg:grid-cols-[1.9fr_1fr]' : ''}>

              {/* Lead — the active journey */}
              <div>
                {activeTrips.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {activeTrips.map(t => <ActiveTripCard key={t.id} trip={t} />)}
                  </div>
                ) : (
                  <div style={{
                    padding: '28px 24px', border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
                    borderRadius: '10px', backgroundColor: 'var(--color-surface-sunken)', boxShadow: CARD_SHADOW,
                    display: 'flex', alignItems: 'center', gap: '18px',
                  }}>
                    <div style={{
                      width: '36px', height: '36px', flexShrink: 0, borderRadius: '50%',
                      backgroundColor: 'rgb(var(--borges-rgb) / 0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                        <path d="M3 7.5h9M7.5 3l4.5 4.5L7.5 12" stroke="#6B696C" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', marginBottom: '3px' }}>
                        Nothing in motion right now.
                      </p>
                      <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                        Your next designed journey starts below.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Rail — pending requests as brief dispatches */}
              {pendingRequests.length > 0 && (
                <aside>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      Requests
                    </p>
                    <div style={{ flex: 1, height: '0.5px', backgroundColor: 'rgb(var(--borges-rgb) / 0.16)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {pendingRequests.map((req, i) => {
                      const badge = requestStatusBadge(req.status)
                      return (
                        <div key={req.id} style={{
                          padding: '16px 0',
                          borderBottom: i < pendingRequests.length - 1 ? '0.5px solid rgb(var(--borges-rgb) / 0.12)' : 'none',
                        }}>
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-optima" style={{
                              fontSize: 'var(--text-body)', color: 'var(--color-text)', lineHeight: 1.5,
                              overflow: 'hidden', textOverflow: 'ellipsis',
                              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                            } as React.CSSProperties}>
                              {req.destination_ideas ?? 'New trip request'}
                            </p>
                            <span className="font-optima" style={{
                              fontSize: 'var(--text-caption)', letterSpacing: '0.01em', flexShrink: 0,
                              padding: '3px 10px', borderRadius: '3px',
                              backgroundColor: badge.bg, color: badge.text, border: `0.5px solid ${badge.border}`,
                            }}>
                              {req.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2" style={{ marginTop: '5px' }}>
                            {req.budget_range && (
                              <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)' }}>{req.budget_range}</span>
                            )}
                            {req.travelers_count && req.travelers_count > 1 && (
                              <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)' }}>· {req.travelers_count} travellers</span>
                            )}
                            <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)' }}>
                              · {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          {req.the_question && (
                            <p className="font-optima" style={{
                              fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', marginTop: '8px',
                              lineHeight: 1.6, fontStyle: 'italic',
                              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                            } as React.CSSProperties}>
                              &ldquo;{req.the_question}&rdquo;
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </aside>
              )}
            </div>
          </div>

          {/* ── What's Next — current stage | Next, one split card ── */}
          {(liveTrip || upcomingTrip) && (() => {
            const trip = (liveTrip ?? upcomingTrip)!
            const idx = liveTrip ? 3 : stageIndex(trip.status)
            const stageName = liveTrip ? 'Travelling' : STAGES[idx]
            const info = liveTrip
              ? {
                  now: `You’re on the ground${trip.destination_country ? ` in ${trip.destination_country}` : ''}.`,
                  nextTitle: nextItem?.title ?? 'A quiet stretch',
                  nextMeta: nextItem
                    ? [fmtDay(nextItem.date), nextItem.time_of_day, nextItem.location].filter(Boolean).join(' · ') || null
                    : 'Nothing scheduled next — enjoy the drift.',
                }
              : stageSummary(trip, idx)
            return (
              <div style={{ marginBottom: 'var(--pad-96)' }}>
                <ZoneHeader eyebrow="The Road Ahead" title="What's Next" />
                <div className="grid md:grid-cols-[1.4fr_1px_1fr]" style={{
                  backgroundColor: 'var(--color-surface-sunken)', border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
                  borderRadius: '12px', boxShadow: CARD_SHADOW, overflow: 'hidden',
                }}>
                  {/* Where things stand */}
                  <div style={{ padding: '30px 32px' }}>
                    <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                      {trip.trip_name}{trip.destination_country ? ` · ${trip.destination_country}` : ''}
                    </p>
                    <p className="cq-subhead-lg" style={{ fontSize: 'var(--text-subhead-lg)', color: 'var(--color-text)', lineHeight: 1.1, marginBottom: '10px' }}>
                      {stageName}
                      {liveTrip && (
                        <span className="relative inline-flex" style={{ width: '8px', height: '8px', marginLeft: '10px' }}>
                          <span className="absolute rounded-full" style={{ width: '100%', height: '100%', backgroundColor: 'var(--color-text-accent)', opacity: 0.4, animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite' }} />
                          <span className="relative inline-flex rounded-full" style={{ width: '100%', height: '100%', backgroundColor: 'var(--color-text-accent)' }} />
                        </span>
                      )}
                    </p>
                    <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
                      {info.now}
                    </p>
                  </div>

                  {/* Divider — vertical on desktop, horizontal on mobile */}
                  <div className="hidden md:block" style={{ backgroundColor: 'rgb(var(--borges-rgb) / 0.16)' }} />
                  <div className="md:hidden" style={{ height: '0.5px', backgroundColor: 'rgb(var(--borges-rgb) / 0.16)', margin: '0 32px' }} />

                  {/* Next */}
                  <div style={{ padding: '30px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                      Next
                    </p>
                    <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', lineHeight: 1.5, marginBottom: info.nextMeta ? '6px' : 0 }}>
                      {info.nextTitle}
                    </p>
                    {info.nextMeta && (
                      <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                        {info.nextMeta}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── Suggestions — CQ Recommends on the ground, CQ Suggestions
                 matched to the archetype between trips ── */}
          {(suggestions?.length ?? 0) > 0 && (
            <div style={{ marginBottom: 'var(--pad-96)' }}>
              <ZoneHeader
                eyebrow={liveTrip && suggestionsPlace ? `Near ${suggestionsPlace}` : 'Chosen for you'}
                title="Suggestions"
                aside={liveTrip ? undefined : archetypeName ?? undefined}
              />
              {suggestions && suggestions.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {suggestions.map((s, i) => (
                    <div key={i} className="card-lift" style={{
                      backgroundColor: 'var(--color-surface-sunken)', border: '0.5px solid rgb(var(--borges-rgb) / 0.12)',
                      borderRadius: '10px', padding: '20px 22px', boxShadow: CARD_SHADOW,
                    }}>
                      <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                        {s.category}{s.area ? ` · ${s.area}` : ''}
                      </p>
                      <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', lineHeight: 1.5, marginBottom: '6px' }}>
                        {s.name}
                      </p>
                      <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.65 }}>
                        {s.note}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  backgroundColor: 'rgb(var(--borges-rgb) / 0.04)', border: '0.5px solid rgb(var(--borges-rgb) / 0.12)',
                  borderRadius: '10px', padding: '24px 26px',
                }}>
                  <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
                    This week&rsquo;s suggestions are being prepared.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          ZONE B  ·  PLAN & PREPARE — continuous paper, ruled department
      ══════════════════════════════════════════════════════════ */}
      <div style={{ backgroundColor: 'var(--color-surface)' }}>
        <div className="cq-shell" style={{ paddingBottom: 'var(--pad-96)' }}>

          <ZoneHeader eyebrow="What happens next" title="Plan & Prepare" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>

            {/* Primary CTA: Register interest */}
            <RegisterInterestCard
              clientId={clientId}
              firstName={firstName}
              clientName={clientFullName}
              clientEmail={clientEmail}
              clientPhone={clientPhone}
            />

            {/* Archetype — premium profile card once taken, quiet CTA otherwise */}
            {archetypeName ? (
              <div style={{
                backgroundColor: 'var(--color-text)',
                border: '0.5px solid rgb(var(--borges-rgb) / 0.3)',
                boxShadow: '0 2px 4px rgb(var(--night-rgb) / 0.08), 0 16px 40px rgb(var(--night-rgb) / 0.18)',
                borderRadius: '10px', padding: '28px 26px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                gap: '20px', height: '100%', boxSizing: 'border-box',
              }}>
                <div>
                  <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                    Your archetype
                  </p>
                  <p className="cq-subhead-lg" style={{ fontSize: 'var(--text-subhead-lg)', color: 'var(--color-surface)', lineHeight: 1.1, marginBottom: '12px' }}>
                    {archetypeName}
                  </p>
                  {archetypeEssence && (
                    <p className="font-optima" style={{
                      fontSize: 'var(--text-caption)', color: 'rgb(var(--mist-rgb) / 0.55)', lineHeight: 1.7,
                      display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    } as React.CSSProperties}>
                      {archetypeEssence}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between flex-wrap" style={{ gap: '12px' }}>
                  <Link href="/understand-you" className="font-optima" style={{
                    fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-surface)',
                    textDecoration: 'none', borderBottom: '0.5px solid rgb(var(--mist-rgb) / 0.4)', paddingBottom: '3px',
                  }}>
                    View your reading →
                  </Link>
                  <Link href="/understand-you/reading" className="font-optima" style={{
                    fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'rgb(var(--mist-rgb) / 0.45)',
                    textDecoration: 'none',
                  }}>
                    Retake
                  </Link>
                </div>
              </div>
            ) : (
              <Link href="/understand-you/reading" style={{ textDecoration: 'none' }}>
                <div className="card-lift" style={{
                  backgroundColor: 'var(--color-surface-sunken)',
                  border: '0.5px solid rgb(var(--borges-rgb) / 0.18)',
                  borderRadius: '10px', padding: '24px', boxShadow: CARD_SHADOW,
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                  gap: '16px', height: '100%', boxSizing: 'border-box',
                }}>
                  <div>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      backgroundColor: 'rgb(var(--borges-rgb) / 0.10)',
                      border: '0.5px solid rgb(var(--borges-rgb) / 0.20)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: '14px',
                    }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="5" r="2.5" stroke="#706E56" strokeWidth="1.2"/>
                        <path d="M2 12c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="#706E56" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                      Personalise your dossier
                    </p>
                    <p className="cq-subhead" style={{ marginBottom: '6px' }}>
                      Find your archetype
                    </p>
                    <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)', lineHeight: 1.65 }}>
                      A mini-reading — helps us identify what you&rsquo;re about and filter content suited to your interests.
                    </p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: '2px', opacity: 0.45 }}>
                    <path d="M2 7h10M8 3l4 4-4 4" stroke="#706E56" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </Link>
            )}

          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          ZONE C  ·  PREVIOUS TRIPS  (cream — only if any)
      ══════════════════════════════════════════════════════════ */}
      {pastTrips.length > 0 && (
        <div style={{ backgroundColor: 'var(--color-surface)' }}>
          <div className="cq-shell" style={{ paddingBottom: 'var(--pad-96)' }}>
            <ZoneHeader eyebrow="Where you've been" title="Where You've Been" />
            {/* Runs off the edge rather than wrapping — a shelf you scan,
                not a grid you audit. */}
            <div className="cq-rail cq-rail-bleed">
              {pastTrips.map(t => (
                <div key={t.id} style={{ width: '240px' }}>
                  <PastTripCard trip={t} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          ZONE D  ·  SELECTIONS — continuous paper
      ══════════════════════════════════════════════════════════ */}
      <div style={{ backgroundColor: 'var(--color-surface)' }}>
        <div className="cq-shell" style={{ paddingBottom: 'var(--pad-96)' }}>
          <ZoneHeader
            eyebrow="Curated for you"
            title="Selections"
          />
          <CQLoafSection stories={loafStories} showHeader={false} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          ZONE F  ·  GO DEEPER + HELP + FOOTER — continuous paper
      ══════════════════════════════════════════════════════════ */}
      <div style={{ backgroundColor: 'var(--color-surface)' }}>
        <div className="cq-shell" style={{ paddingBottom: 'var(--pad-72)' }}>

          {/* Go deeper */}
          <div style={{ marginBottom: 'var(--pad-56)' }}>
            <ZoneHeader eyebrow="Optional" title="Go deeper" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

              <Link href="/understand-cq" style={{ textDecoration: 'none' }}>
                <div className="card-lift" style={{
                  backgroundColor: 'var(--color-surface-sunken)',
                  border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
                  borderRadius: '10px', padding: '24px',
                  height: '100%', boxSizing: 'border-box', boxShadow: CARD_SHADOW,
                }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    backgroundColor: 'rgb(var(--borges-rgb) / 0.10)',
                    border: '0.5px solid rgb(var(--borges-rgb) / 0.18)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '16px',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="5.5" stroke="#706E56" strokeWidth="1.2"/>
                      <path d="M7 5v2.5L8.5 9" stroke="#706E56" strokeWidth="1.1" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', marginBottom: '6px', lineHeight: 1.5 }}>
                    Understand CQ
                  </p>
                  <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                    What Closequarters is about, and how we think about travel.
                  </p>
                </div>
              </Link>

              <Link href="/understand-you" style={{ textDecoration: 'none' }}>
                <div className="card-lift" style={{
                  backgroundColor: 'var(--color-surface-sunken)',
                  border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
                  borderRadius: '10px', padding: '24px',
                  height: '100%', boxSizing: 'border-box', boxShadow: CARD_SHADOW,
                }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    backgroundColor: 'rgb(var(--borges-rgb) / 0.10)',
                    border: '0.5px solid rgb(var(--borges-rgb) / 0.18)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '16px',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="5" r="2.5" stroke="#706E56" strokeWidth="1.2"/>
                      <path d="M2 12c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="#706E56" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', marginBottom: '6px', lineHeight: 1.5 }}>
                    About You
                  </p>
                  <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
                    {archetypeName
                      ? <>You&rsquo;re {archetypeName}. Retake the reading anytime.</>
                      : <>Find your travel archetype — helps us tailor everything we curate.</>}
                  </p>
                </div>
              </Link>

            </div>
          </div>

          {/* Help */}
          <div style={{
            paddingTop: '28px', borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: '16px',
          }}>
            <div>
              <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', marginBottom: '3px' }}>Need help?</p>
              <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>We&rsquo;re always reachable.</p>
            </div>
            <div className="flex items-center gap-3">
              <a href={CQ_WHATSAPP} target="_blank" rel="noopener noreferrer" className="cq-tap-link" style={{ gap: '7px', textDecoration: 'none' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#706E56">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.522 5.848L.057 23.867l6.164-1.617A11.933 11.933 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.87 0-3.625-.48-5.15-1.322l-.368-.218-3.82 1.002 1.02-3.714-.239-.381A9.958 9.958 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
                <span className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-accent)' }}>WhatsApp</span>
              </a>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-caption)' }}>·</span>
              <a href={CQ_EMAIL} className="cq-tap-link" style={{ gap: '7px', textDecoration: 'none' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#706E56" strokeWidth="1.5"/>
                  <polyline points="22,6 12,13 2,6" stroke="#706E56" strokeWidth="1.5"/>
                </svg>
                <span className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-accent)' }}>Email</span>
              </a>
            </div>
          </div>

          {/* Footer */}
          <div style={{ paddingTop: 'var(--pad-40)' }}>
            <CQLogo variant="muted" height={40} />
          </div>

        </div>
      </div>

      </main>
    </div>
  )
}

// ── Department slug — small-caps label seated on a full-width rule,
//    Seasons title beneath. The page's recurring editorial device. ──────────────

/**
 * The dashboard's zones now open the same way every other section in the
 * dossier does. This was a fourth variant of the same idea — eyebrow left, a
 * rule running to the right of it, aside on the far side — which is why the
 * dashboard never quite looked like it belonged to the trip pages.
 */
function ZoneHeader({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string
  title: string
  aside?: string
}) {
  return <SectionOpen eyebrow={eyebrow} title={title} aside={aside} />
}
