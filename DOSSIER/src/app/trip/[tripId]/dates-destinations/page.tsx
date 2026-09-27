import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { getTripPhase } from '@/lib/tripPhase'
import DatesDestinationsGallery from '@/components/DatesDestinationsGallery'
import DatesDestinationsStructured from '@/components/DatesDestinationsStructured'
import IterationDropdown from '@/components/itinerary/IterationDropdown'
import type { Trip, Iteration, DatesDestination } from '@/lib/types'
import { requireTripAccess } from '@/lib/tripAccess'

export default async function DatesDestinationsPage({
  params,
  searchParams,
}: {
  params:       Promise<{ tripId: string }>
  searchParams: Promise<{ stage?: string; iter?: string }>
}) {
  const { tripId }            = await params
  await requireTripAccess(tripId)
  const { stage: stageParam, iter: iterParam } = await searchParams
  const supabase = createAdminClient()

  const { data: tripRow } = await supabase
    .from('trips')
    .select('*')
    .eq('trip_id', tripId)
    .maybeSingle() as { data: Trip | null }

  if (!tripRow) notFound()

  // Phase guard
  const todayMs = new Date().setHours(0, 0, 0, 0)
  const isLive  = !!(
    tripRow.start_date && tripRow.end_date &&
    new Date(tripRow.start_date).getTime() <= todayMs &&
    todayMs <= new Date(tripRow.end_date).getTime()
  )
  const { visibleTabs } = getTripPhase(tripRow.status, isLive, stageParam)
  if (!visibleTabs.includes('dates-destinations')) {
    redirect(`/trip/${tripId}/${visibleTabs[0] ?? 'log'}${stageParam ? `?stage=${stageParam}` : ''}`)
  }

  // ── Iterations — the version history for this trip ─────────────────────────
  let iterations: Iteration[] = []
  let selected: Iteration | null = null
  try {
    const { data: iterData } = await supabase
      .from('iterations').select('*').eq('trip_id', tripRow.id)
      .order('synced_at', { ascending: false })
    iterations = (iterData as Iteration[]) ?? []
    if (iterations.length > 0) {
      selected =
        (iterParam ? iterations.find(i => i.name === iterParam) : null) ??
        iterations.find(i => i.is_current) ?? iterations[0]
    }
  } catch { /* iterations table absent */ }

  // ── Structured source — the CQ Dates & Destinations database ──────────────
  let ddRows: DatesDestination[] = []
  try {
    const { data } = await supabase
      .from('dates_destinations').select('*').eq('trip_id', tripRow.id)
      .order('sort_order', { ascending: true })
    ddRows = (data as DatesDestination[]) ?? []
  } catch { /* table absent — fall back to the Notion page snapshot */ }

  if (ddRows.length > 0) {
    const nums = [...new Set(ddRows.map(r => r.iteration_num))].sort((a, b) => b - a)
    const latest = nums[0]
    // The dropdown labels versions as "Version 2 · 14 August 2026", so take the
    // number that follows "Version" rather than every digit in the string —
    // otherwise the date's digits get swallowed into the version number.
    const requested = (() => {
      if (!iterParam) return NaN
      const m = iterParam.match(/version\s*(\d+)/i) ?? iterParam.match(/^\s*(\d+)\s*$/)
      return m ? parseInt(m[1], 10) : NaN
    })()
    const shown = nums.includes(requested) ? requested : latest

    // The date the curator set on the iteration, if any — the same across every
    // row of a version, so the first one that carries it wins.
    const dateFor = (n: number) =>
      ddRows.find(r => r.iteration_num === n && r.iteration_date)?.iteration_date ?? null

    // Labelled day/month, matching how the Drawing Board names iterations on the
    // Stays and Experiences tabs (e.g. "10/4"). Falls back to the version number
    // when no date has been set.
    const iterLabel = (n: number) => {
      const d = dateFor(n)
      if (!d) return String(n)
      const parsed = new Date(d + (d.length === 10 ? 'T00:00:00' : ''))
      return Number.isNaN(parsed.getTime())
        ? String(n)
        : `${parsed.getDate()}/${parsed.getMonth() + 1}`
    }

    return (
      <div style={{ paddingTop: '32px', paddingBottom: 'var(--pad-96)' }}>
        {/* Same treatment as the Stays and Experiences tabs: the version selector
            sits top-right and stays visible even with a single version, so the
            client always knows which plan they're reading. */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '18px' }}>
          <IterationDropdown
            iterations={nums.map(nu => ({
              id: String(nu), notion_id: null,
              name: iterLabel(nu),
              trip_id: tripRow.id,
              notion_page_id: '', is_current: nu === latest,
              synced_at: ddRows.find(r => r.iteration_num === nu)?.synced_at ?? new Date().toISOString(),
              created_at: '',
            }))}
            selectedName={iterLabel(shown)}
          />
        </div>

        <DatesDestinationsStructured
          rows={ddRows.filter(r => r.iteration_num === shown)}
          region={[tripRow.state_county, tripRow.destination_country].filter(Boolean).join(', ') || null}
        />
      </div>
    )
  }

  // Content page
  const { data: contentPage, error: contentError } = await supabase
    .from('trip_content_pages')
    .select('parsed_content, notion_page_url, synced_at')
    .eq('trip_id', tripRow.id)
    .eq('type', 'dates_destinations')
    .maybeSingle()

  console.log(`[dates-destinations] trip=${tripId} id=${tripRow.id}`)
  console.log(`[dates-destinations] contentPage=${contentPage ? 'found' : 'null'} error=${contentError?.message ?? 'none'}`)

  // Table missing
  if (contentError?.code === 'PGRST205' || contentError?.message?.includes('does not exist')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ border: '0.5px solid rgb(var(--borges-rgb) / 0.14)', backgroundColor: 'var(--color-surface-sunken)' }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="3" y="3" width="16" height="16" rx="2" stroke="#706E56" strokeWidth="1.3"/>
            <path d="M11 7v8M7 11h8" stroke="#706E56" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </div>
        <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>Migration required</p>
        <p className="font-optima mt-1.5" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)', lineHeight: 1.65, maxWidth: '320px' }}>
          The content table hasn&apos;t been created yet. Go to <strong style={{ color: 'var(--color-text)' }}>Admin → Content</strong> and click <strong style={{ color: 'var(--color-text)' }}>Run Migration</strong>.
        </p>
      </div>
    )
  }

  if (contentError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>Database error</p>
        <p className="font-optima mt-1.5" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>{contentError.message}</p>
      </div>
    )
  }

  if (!contentPage) {
    const notionUrl = tripRow.dates_destinations_link
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ border: '0.5px solid rgb(var(--borges-rgb) / 0.14)', backgroundColor: 'var(--color-surface-sunken)' }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="3" y="3" width="16" height="16" rx="2" stroke="#6B696C" strokeWidth="1.3"/>
            <path d="M7 11h8M11 7v8" stroke="#6B696C" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </div>
        <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>Not ready yet</p>
        <p className="font-optima mt-1.5" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.65, maxWidth: '320px' }}>
          {notionUrl
            ? 'Notion page found but not yet synced. Go to Admin → Content and click Sync Dates & Destinations.'
            : "Your dates & destinations document will appear here once it's been prepared."}
        </p>
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = contentPage.parsed_content as any
  console.log(`[dates-destinations] rendering — title="${parsed?.title}" blocks=${parsed?.blocks?.length ?? 0}`)

  if (!parsed?.blocks?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>No content blocks</p>
        <p className="font-optima mt-1.5" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)', maxWidth: '320px', lineHeight: 1.65 }}>
          The Notion page was synced but contains no readable blocks. Re-sync after adding content.
        </p>
      </div>
    )
  }

  return (
    <div style={{ paddingTop: '32px', paddingBottom: 'var(--pad-96)' }}>
      {selected && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '18px' }}>
          <IterationDropdown iterations={iterations} selectedName={selected.name} />
        </div>
      )}
      {selected && !selected.is_current && (
        <div style={{
          backgroundColor: 'rgb(var(--borges-rgb) / 0.07)', border: '0.5px solid rgb(var(--borges-rgb) / 0.22)',
          borderRadius: '8px', padding: '12px 18px', marginBottom: '24px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--color-text-accent)', flexShrink: 0 }} />
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)' }}>
            You&rsquo;re viewing an earlier version. The latest is what we&rsquo;re working from.
          </p>
        </div>
      )}
      <DatesDestinationsGallery blocks={parsed.blocks} />
    </div>
  )
}
