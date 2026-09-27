import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import type { Trip, Document, DestinationInfo } from '@/lib/types'
import { getTripPhase } from '@/lib/tripPhase'
import { DESTINATION_DATA, fetchWeather } from '@/lib/destinationData'
import QuickLinkCard from '@/components/QuickLinkCard'
import AboutDestinationCard from '@/components/AboutDestinationCard'
import { requireTripAccess } from '@/lib/tripAccess'

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return null
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return null }
}

/**
 * The payment schedule's columns, declared once.
 *
 * The header row and the body rows are two separate grids, and the third
 * column used to be `auto`: it sized to the word "Status" in the header and
 * to a wider pill in the rows, so the two grids resolved different widths and
 * Amount and Due By never lined up with their own headings. Fractions resolve
 * identically in both because the containers are the same width.
 */
const SCHEDULE_COLS = 'minmax(0, 1.15fr) minmax(0, 1fr) minmax(0, 0.85fr)'

function fmtCurrency(amount: number | null, currency = 'INR'): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: currency ?? 'INR', maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Top-level section landing — an ink rule, an eyebrow, then the title in
 * Seasons. Deliberately heavier than the sub-headers inside a section so the
 * page reads as chapters rather than one continuous scroll.
 */
function SectionTitle({ children, eyebrow }: { children: React.ReactNode; eyebrow?: string }) {
  return (
    <div style={{ marginBottom: 'var(--pad-40)' }}>
      <div style={{ height: '1px', backgroundColor: 'rgb(var(--night-rgb) / 0.55)', width: '100%', marginBottom: '16px' }} />
      {eyebrow && (
        <p className="font-optima" style={{
          fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '10px',
        }}>
          {eyebrow}
        </p>
      )}
      <h2 className="cq-t1" style={{ fontSize: 'var(--text-t1)', lineHeight: 1.05, color: 'var(--color-text)' }}>
        {children}
      </h2>
    </div>
  )
}

/**
 * Sub-header inside a section — a step below SectionTitle. Opens with a rule
 * and generous air above it so each block announces itself as it arrives.
 */
function SubSectionTitle({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <>
      <div style={{ height: '0.5px', backgroundColor: 'rgb(var(--borges-rgb) / 0.22)', marginBottom: 'var(--pad-40)' }} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '28px' }}>
        <h3 className="cq-subhead" style={{ fontSize: 'var(--text-subhead)', color: 'var(--color-text)', flexShrink: 0 }}>
          {children}
        </h3>
        {note && (
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', flexShrink: 0 }}>
            {note}
          </p>
        )}
        <div style={{ flex: 1, height: '0.5px', backgroundColor: 'rgb(var(--borges-rgb) / 0.18)' }} />
      </div>
    </>
  )
}

// ── Payment Schedule ─────────────────────────────────────────────────────────

interface ScheduleRow {
  amount: number
  dueBy: string | null
  status: 'Complete' | 'Due' | 'Partial'
}

/**
 * Status in brand tones only: settled matters read in Night Sky, what still
 * needs the client's attention in Terra — the one accent the palette allows.
 */
function StatusPill({ status }: { status: ScheduleRow['status'] }) {
  const colors: Record<ScheduleRow['status'], { bg: string; text: string; border: string }> = {
    Complete: { bg: 'rgb(var(--night-rgb) / 0.06)',      text: 'var(--color-text)', border: 'rgb(var(--night-rgb) / 0.18)' },
    Due:      { bg: 'rgb(var(--borges-rgb) / 0.10)',  text: 'var(--color-text-accent)', border: 'rgb(var(--borges-rgb) / 0.32)' },
    Partial:  { bg: 'rgb(var(--borges-rgb) / 0.10)',  text: 'var(--color-text-accent)', border: 'rgb(var(--borges-rgb) / 0.28)' },
  }
  const c = colors[status]
  return (
    <span className="font-optima" style={{
      display: 'inline-block', padding: '4px 12px', borderRadius: '999px',
      backgroundColor: c.bg, color: c.text, border: `0.5px solid ${c.border}`,
      fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
    }}>
      {status}
    </span>
  )
}

function PaymentScheduleTable({ rows, currency }: { rows: ScheduleRow[]; currency: string }) {
  if (rows.length === 0) {
    return (
      <div style={{
        padding: '48px 0', textAlign: 'center',
        backgroundColor: 'rgb(var(--borges-rgb) / 0.03)', borderRadius: '12px',
        border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
      }}>
        <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
          Payment details will appear here.
        </p>
        <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.7, color: 'var(--color-text-secondary)' }}>
          Contact your curator for a copy of your payment schedule.
        </p>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: 'var(--color-surface-sunken)', border: '0.5px solid rgb(var(--borges-rgb) / 0.10)', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: SCHEDULE_COLS,
        columnGap: 'var(--space-3)', padding: '14px 20px',
        borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
      }}>
        {['Amount', 'Due By', 'Status'].map(h => (
          <p key={h} className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)' }}>{h}</p>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: SCHEDULE_COLS,
          columnGap: 'var(--space-3)', padding: '18px 20px', alignItems: 'center',
          borderBottom: i < rows.length - 1 ? '0.5px solid rgb(var(--borges-rgb) / 0.10)' : 'none',
        }}>
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', fontWeight: 400 }}>
            {fmtCurrency(row.amount, currency)}
          </p>
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.7, color: 'var(--color-text-secondary)' }}>
            {row.dueBy ?? '—'}
          </p>
          <div><StatusPill status={row.status} /></div>
        </div>
      ))}
    </div>
  )
}

// ── Receipts ──────────────────────────────────────────────────────────────────

function ReceiptsSection({ docs }: { docs: Document[] }) {
  if (docs.length === 0) {
    return (
      <div style={{
        padding: '48px 0', textAlign: 'center',
        backgroundColor: 'rgb(var(--borges-rgb) / 0.03)', borderRadius: '12px',
        border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
      }}>
        <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
          No receipts uploaded yet.
        </p>
        <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.7, color: 'var(--color-text-secondary)' }}>
          Your receipts will appear here as payments are processed.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {docs.map((doc, i) => (
        <a key={doc.id} href={doc.file_url ?? '#'} target="_blank" rel="noopener noreferrer" style={{
          textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '16px', padding: '18px 20px',
          backgroundColor: 'var(--color-surface-sunken)', borderRadius: i === 0 ? '12px 12px 0 0' : i === docs.length - 1 ? '0 0 12px 12px' : '0',
          borderBottom: i < docs.length - 1 ? '0.5px solid rgb(var(--borges-rgb) / 0.10)' : 'none',
        }}>
          <div>
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
              {doc.document_type ?? doc.category ?? 'Document'}
            </p>
            <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
              {doc.document_name ?? 'Receipt'}
            </p>
          </div>
          <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', letterSpacing: '0.01em', flexShrink: 0 }}>
            Open →
          </span>
        </a>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ReservationsPaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>
  searchParams: Promise<{ stage?: string }>
}) {
  const { tripId } = await params
  await requireTripAccess(tripId)
  const { stage: stageParam } = await searchParams
  const db = createAdminClient()

  const { data: trip } = await db
    .from('trips').select('*').eq('trip_id', tripId).maybeSingle() as { data: Trip | null }
  if (!trip) notFound()

  // Phase guard — only Reservations / Bon Voyage / Live have this page
  const todayMs = new Date().setHours(0, 0, 0, 0)
  const isLive  = !!(
    trip.start_date && trip.end_date &&
    new Date(trip.start_date).getTime() <= todayMs &&
    todayMs <= new Date(trip.end_date).getTime()
  )
  const { visibleTabs } = getTripPhase(trip.status, isLive, stageParam)
  if (!visibleTabs.includes('reservations-payments')) {
    redirect(`/trip/${tripId}/${visibleTabs[0] ?? 'log'}${stageParam ? `?stage=${stageParam}` : ''}`)
  }

  // Documents linked to this trip — general (unlinked) docs surface as Receipts
  const { data: tripDocRows } = await db.from('documents').select('*').eq('trip_id', trip.id)
  const tripDocs = (tripDocRows ?? []) as Document[]
  const receiptDocs = tripDocs.filter(d => !d.linked_experience_id && !d.linked_stay_id && !d.linked_transfer_id && d.file_url)

  // Payment schedule — derived from real trip-level summary fields (no itemized
  // ledger table exists yet in Supabase or Notion, so this is presented as two
  // rows: what's been paid, and what's still due).
  const totalPaid = trip.amount_paid ?? null
  const balance   = trip.amount_pending ?? null
  const nextPaymentDate = formatDate(trip.next_payment_date)
  const currency = 'INR'

  const scheduleRows: ScheduleRow[] = []
  if (totalPaid) scheduleRows.push({ amount: totalPaid, dueBy: 'Paid', status: 'Complete' })
  if (balance && balance > 0) scheduleRows.push({ amount: balance, dueBy: nextPaymentDate, status: 'Due' })

  // Destination info — same source as First Steps' About Destination card
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
  const travelDateLabel = formatDate(trip.start_date)
  const stageQs = stageParam ? `?stage=${stageParam}` : ''

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <article style={{ width: '100%' }}>

      {/* Quick links */}
      <div
        className="grid grid-cols-1 md:grid-cols-3"
        style={{ gap: '12px', marginBottom: 'var(--pad-56)' }}
      >
        <QuickLinkCard
          href={`/trip/${tripId}/your-trip${stageQs}`}
          label="Your Designed Journey, in full"
          desc="The complete itinerary, date by date."
          hardNav
        />
        <QuickLinkCard
          href={`/trip/${tripId}/log${stageQs}`}
          label="Conversation Log"
          desc="Every message with your curator."
          hardNav
        />
        <QuickLinkCard
          href="#receipts"
          label="Receipts"
          desc="Payment confirmations and invoices."
        />
      </div>

      {/* Payment Schedule */}
      <div style={{ marginBottom: 'var(--pad-96)' }}>
        <SectionTitle eyebrow="What you've paid">Payment Schedule</SectionTitle>
        <PaymentScheduleTable rows={scheduleRows} currency={currency} />
      </div>

      {/* Receipts */}
      <div id="receipts" style={{ marginBottom: 'var(--pad-96)', scrollMarginTop: '100px' }}>
        <SectionTitle eyebrow="Your records">Receipts</SectionTitle>
        <ReceiptsSection docs={receiptDocs} />
      </div>

      {/* About destination */}
      <div style={{ marginBottom: 'var(--pad-96)' }}>
        <SectionTitle eyebrow="The essentials">About {trip.destination_country ?? 'Your Destination'}</SectionTitle>
        <AboutDestinationCard
          weather={weather} travelDateLabel={travelDateLabel} destinationTz={countryRef?.tz ?? null}
          currency={countryRef?.currency ?? null} destinationInfo={destinationInfo}
        />
      </div>


      {/* Before You Go */}
      <PreTravelGuideSection trip={trip} />

      {/* Footer */}
      <div style={{ marginTop: 'var(--pad-96)', paddingTop: '32px', borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.10)' }}>
        <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
          Closequarters · Private dossier · {trip.trip_name}
        </p>
      </div>
    </article>
  )
}

// ── Pre-Travel Guide ──────────────────────────────────────────────────────────

interface CulturalPick {
  type: 'film' | 'music' | 'read'
  title: string
  creator: string
  year?: string
  description: string
}

interface ThingToKnow {
  category: string
  title: string
  insight: string
}

interface PreTravelGuide {
  opening_note: string
  cultural_picks: CulturalPick[]
  things_to_know: ThingToKnow[]
}

const CARD_SHADOW = '0 2px 4px rgb(var(--night-rgb) / 0.05), 0 12px 32px rgb(var(--night-rgb) / 0.09)'

const TYPE_LABEL: Record<string, string> = { film: 'Watch', music: 'Listen', read: 'Read' }

/** One pick — same linen card as the rest of the dossier, no icons, no accent colours. */
function CulturalPickCard({ pick }: { pick: CulturalPick }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-surface-sunken)',
      border: '0.5px solid rgb(var(--borges-rgb) / 0.12)',
      borderRadius: '12px',
      padding: '24px 26px',
      boxShadow: CARD_SHADOW,
      display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box',
    }}>
      <p className="font-optima" style={{
        fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '14px',
      }}>
        {TYPE_LABEL[pick.type] ?? pick.type}
      </p>

      <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.5, color: 'var(--color-text)', marginBottom: '5px' }}>
        {pick.title}
      </p>

      <p className="font-optima" style={{ fontSize: 'var(--text-caption)', lineHeight: 1.6, color: 'var(--color-text-muted)', marginBottom: '16px' }}>
        {pick.creator}{pick.year ? ` · ${pick.year}` : ''}
      </p>

      <div style={{ height: '0.5px', backgroundColor: 'rgb(var(--borges-rgb) / 0.14)', marginBottom: '16px' }} />

      <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.75, color: 'var(--color-text-secondary)', marginTop: 'auto' }}>
        {pick.description}
      </p>
    </div>
  )
}

/**
 * Things to Know — each note its own card, columns held in a shared grid so
 * the set still reads as a table. Cards rise on hover.
 */
function ThingsToKnowTable({ items }: { items: ThingToKnow[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {items.map((item, i) => (
        <div
          key={i}
          className="lift-card grid md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]"
          style={{
            gap: '20px',
            padding: '26px 30px',
            backgroundColor: 'var(--color-surface-sunken)',
            border: '0.5px solid rgb(var(--borges-rgb) / 0.12)',
            borderRadius: '12px',
            boxShadow: CARD_SHADOW,
          }}
        >
          {/* Left — what it concerns */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '9px' }}>
              <span className="font-optima" style={{
                fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)',
              }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="font-optima" style={{
                fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-accent)',
                padding: '3px 11px', borderRadius: '999px',
                backgroundColor: 'rgb(var(--borges-rgb) / 0.10)',
                border: '0.5px solid rgb(var(--borges-rgb) / 0.20)',
              }}>
                {item.category}
              </span>
            </div>
            <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.5, color: 'var(--color-text)' }}>
              {item.title}
            </p>
          </div>

          {/* Right — the insight itself */}
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.75, color: 'var(--color-text-secondary)' }}>
            {item.insight}
          </p>
        </div>
      ))}
    </div>
  )
}

function PreTravelGuideSection({ trip }: { trip: Trip }) {
  let guide: PreTravelGuide | null = null
  if (trip.pre_travel_guide) {
    try { guide = JSON.parse(trip.pre_travel_guide) as PreTravelGuide } catch {}
  }

  if (!guide) {
    return (
      <div style={{ marginBottom: 'var(--pad-96)' }}>
        <SectionTitle eyebrow="Preparing">Before You Go</SectionTitle>
        <div style={{
          padding: '56px 32px', textAlign: 'center',
          backgroundColor: 'rgb(var(--borges-rgb) / 0.03)',
          borderRadius: '16px',
          border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
        }}>
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)', marginBottom: '10px' }}>
            Your pre-travel guide is being prepared.
          </p>
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
            Films, music, reads, and cultural insights — curated for your journey.
          </p>
        </div>
      </div>
    )
  }

  const films = guide.cultural_picks.filter(p => p.type === 'film')
  const music = guide.cultural_picks.filter(p => p.type === 'music')
  const reads = guide.cultural_picks.filter(p => p.type === 'read')
  const picks = [...films, ...music, ...reads]

  return (
    <div style={{ marginBottom: 'var(--pad-96)' }}>
      <SectionTitle eyebrow="Preparing">Before You Go</SectionTitle>

      {/* Opening note */}
      {guide.opening_note && (
        <div style={{ marginBottom: 'var(--pad-72)' }}>
          <p className="font-optima" style={{
            fontSize: 'var(--text-body)', lineHeight: 1.8,
            color: 'var(--color-text-accent)',
          }}>
            {guide.opening_note}
          </p>
        </div>
      )}

      {/* ── Cultural Picks — grouped, laid out in full, no sideways scrolling ── */}
      {picks.length > 0 && (
        <div style={{ marginBottom: 'var(--pad-96)' }}>
          <SubSectionTitle note="Before you arrive">Cultural Picks</SubSectionTitle>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {picks.map((pick, i) => <CulturalPickCard key={i} pick={pick} />)}
          </div>
        </div>
      )}

      {/* ── Things to Know ── */}
      {guide.things_to_know.length > 0 && (
        <div>
          <SubSectionTitle note="Worth reading twice">Things to Know</SubSectionTitle>

          <ThingsToKnowTable items={guide.things_to_know} />
        </div>
      )}
    </div>
  )
}
