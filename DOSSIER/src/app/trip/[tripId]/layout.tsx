import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { requireTripAccess } from '@/lib/tripAccess'
import type { Trip } from '@/lib/types'
import TripTabs from '@/components/TripTabs'
import VersionSelector from '@/components/VersionSelector'
import HeroBanner from '@/components/HeroBanner'
import { isDirectImageUrl } from '@/lib/unsplash'
import PhaseVisibilityGate from '@/components/PhaseVisibilityGate'
import CurrencyConverter from '@/components/CurrencyConverter'
import { CurrencyProvider } from '@/components/CurrencyContext'
import InfoStrip from '@/components/InfoStrip'
import WhatsAppButton from '@/components/WhatsAppButton'
import ProgressBar from '@/components/ProgressBar'
import StageBanner from '@/components/StageBanner'
import RealtimeRefresher from '@/components/RealtimeRefresher'
import { Suspense } from 'react'
import CQLogo from '@/components/CQLogo'
import TripMobileBar from '@/components/TripMobileBar'
import FloatingDock from '@/components/FloatingDock'

function formatDateRange(start: string | null, end: string | null) {
  if (!start) return ''
  const s = new Date(start)
  const e = end ? new Date(end) : null
  const shortOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const fullOpts:  Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  if (!e) return s.toLocaleDateString('en-IN', fullOpts)
  return `${s.toLocaleDateString('en-IN', shortOpts)} – ${e.toLocaleDateString('en-IN', fullOpts)}`
}

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tripId: string }>
}) {
  // Auth is enforced here and in every trip page, not in the proxy: signed out
  // goes to login, and a trip that isn't the viewer's is a 404. Pages repeat
  // the check because layouts don't re-render on client-side navigation.
  const { tripId } = await params
  await requireTripAccess(tripId)
  const supabase = createAdminClient()

  const { data: trip } = await supabase
    .from('trips').select('*').eq('trip_id', tripId).maybeSingle() as { data: Trip | null }
  if (!trip) notFound()

  // The hero takes the cover chosen in Notion. Where none is set yet, it
  // borrows the journey's own first photograph rather than generating one:
  // these are pictures CQ already chose for this trip, so they are of the
  // right place and in the right register by construction. A generated stock
  // image would fail the book's test on both counts. The moment a Cover Image
  // is set in Notion it wins.
  let heroImage = isDirectImageUrl(trip.cover_image_url) ? trip.cover_image_url : null
  if (!heroImage) {
    const { data: firstShot } = await supabase
      .from('dates_destinations')
      .select('image_url')
      .eq('trip_id', trip.id)
      .not('image_url', 'is', null)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle()
    heroImage = (firstShot as { image_url: string | null } | null)?.image_url ?? null
  }

  const todayMs = new Date().setHours(0, 0, 0, 0)
  const isLive  = !!(
    trip.start_date &&
    trip.end_date &&
    new Date(trip.start_date).getTime() <= todayMs &&
    todayMs <= new Date(trip.end_date).getTime()
  )

  // ── ROUTER CACHE PROBE (server side) ────────────────────────────────────────
  console.log('[Layout:SERVER]', JSON.stringify({
    tripId,
    status: trip.status,
    isLive,
    ts: new Date().toISOString(),
  }))
  // ────────────────────────────────────────────────────────────────────────────

  let versions: string[] = []
  try {
    const { data: vd } = await supabase.from('experiences').select('iteration_version')
      .eq('trip_id', trip.id).not('iteration_version', 'is', null)
    if (vd) {
      const seen = new Set<string>(); const ordered: string[] = []
      for (const row of vd) {
        const v = (row as { iteration_version: string | null }).iteration_version
        if (v && !seen.has(v)) { seen.add(v); ordered.push(v) }
      }
      versions = ordered.reverse()
    }
  } catch {}

  // Client name + party size — for the "(Destination) for (Client)" banner heading
  let clientName: string | null = null
  if (trip.client_id) {
    const { data: clientRow } = await supabase
      .from('clients').select('client_name').eq('id', trip.client_id).maybeSingle()
    clientName = (clientRow as { client_name: string } | null)?.client_name ?? null
  }
  const { count: travelerCount } = await supabase
    .from('trip_travelers').select('id', { count: 'exact', head: true }).eq('trip_id', trip.id)

  return (
    <CurrencyProvider>
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-surface)' }}>

      {/* Realtime — refreshes page when trips row changes (e.g. status sync) */}
      <RealtimeRefresher tables={['trips']} />

      {/* Where you are, and the way out — phones only, once the hero has gone */}
      <TripMobileBar
        title={trip.state_county ? `Into ${trip.state_county}` : (trip.destination_country ? `Into ${trip.destination_country}` : trip.trip_name)}
        stage={isLive ? 'Live now' : trip.status}
      />

      {/* Hero — full bleed */}
      <HeroBanner
        tripName={trip.trip_name}
        destination={trip.destination_country}
        stateCounty={trip.state_county}
        townsCities={trip.towns_cities}
        dateRange={formatDateRange(trip.start_date, trip.end_date)}
        imageUrl={heroImage}
        isLive={isLive}
        clientName={clientName}
        travelerCount={travelerCount ?? 0}
      />

      {/* ── Progress timeline ── */}
      <div style={{ borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.12)', backgroundColor: 'var(--color-surface)' }}>
        <div className="cq-shell" style={{ paddingTop: 'var(--space-5)', paddingBottom: 'var(--space-5)' }}>
          <Suspense fallback={<div style={{ height: '36px' }} />}>
            <ProgressBar tripId={tripId} status={trip.status} isLive={isLive} />
          </Suspense>
        </div>
      </div>

      {/* ── Info strip (currency + local time) — hidden during Crafting and Reservations
          (both have their own dedicated About Destination card in-page instead) ── */}
      <PhaseVisibilityGate status={trip.status} isLive={isLive} hideDuring={['crafting', 'reservations']}>
        <div style={{ borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.12)', backgroundColor: 'var(--color-surface)' }}>
          <div
            className="cq-shell flex items-center justify-center"
            style={{ paddingTop: '10px', paddingBottom: '10px' }}
          >
            <Suspense fallback={null}>
              <InfoStrip destination={trip.destination_country} />
            </Suspense>
          </div>
        </div>
      </PhaseVisibilityGate>

      {/* Version selector — only during crafting/planning stages */}
      {!isLive && !(
        (trip.status ?? '').toLowerCase().includes('bon') ||
        (trip.status ?? '').toLowerCase() === 'completed'
      ) && (
        <Suspense>
          <VersionSelector versions={versions} tripId={tripId} />
        </Suspense>
      )}

      {/* ── Stage banner ── */}
      <Suspense fallback={null}>
        <StageBanner status={trip.status} isLive={isLive} />
      </Suspense>

      {/* ── Tab bar — sticky — hidden during Reservations, where the quick-link
          cards at the top of the page (Your Designed Journey / Log / Receipts)
          are the only navigation, so a duplicate bar isn't needed ── */}
      <PhaseVisibilityGate status={trip.status} isLive={isLive} hideDuring={['reservations']}>
        <div
          className="sticky top-0 z-30 hidden md:block"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.12)',
            boxShadow: '0 2px 16px rgb(var(--night-rgb) / 0.08)',
          }}
        >
          <div className="cq-shell">
            <Suspense fallback={<div style={{ height: '58px' }} />}>
              <TripTabs tripId={tripId} status={trip.status} isLive={isLive} />
            </Suspense>
          </div>
        </div>
      </PhaseVisibilityGate>

      {/* ── Phone navigation, fixed to the bottom of the screen ── */}
      <PhaseVisibilityGate status={trip.status} isLive={isLive} hideDuring={['reservations']}>
        <Suspense fallback={null}>
          <TripTabs tripId={tripId} status={trip.status} isLive={isLive} variant="bottom" />
        </Suspense>
      </PhaseVisibilityGate>

      {/* ── Page content ── */}
      <main
        id="content"
        className="page-content cq-shell"
        style={{
          paddingTop: 'var(--gap-chapter)',
          paddingBottom: 'calc(var(--tabbar-h) + var(--dock-clear) + var(--space-8))',
        }}
      >
        {children}
      </main>

      {/* Footer — left-aligned, rule-style */}
      <footer
        className="cq-shell"
        style={{
          paddingTop: '24px',
          paddingBottom: 'calc(var(--tabbar-h) + 56px)',
          borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
        }}
      >
        <CQLogo variant="muted" height={40} />
      </footer>

      {/* Floating dock. Both controls share one anchor and one gap, so the
          stack stays aligned whether or not the converter is showing. */}
      <FloatingDock>
        <WhatsAppButton />
        <PhaseVisibilityGate status={trip.status} isLive={isLive} hideDuring={['crafting', 'reservations']}>
          <CurrencyConverter />
        </PhaseVisibilityGate>
      </FloatingDock>
    </div>
    </CurrencyProvider>
  )
}
