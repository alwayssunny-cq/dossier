import { createAdminClient } from '@/lib/supabase/admin'
import ExperiencesGallery from '@/components/ExperiencesGallery'
import ExperiencesStructured from '@/components/ExperiencesStructured'
import IterationDropdown from '@/components/itinerary/IterationDropdown'
import type { DatesDestination, Experience, Iteration, Transfer } from '@/lib/types'
import { requireTripAccess } from '@/lib/tripAccess'

/** Day/month label for an iteration, as the other crafting tabs write it. */
function iterDayMonth(d: string | null): string {
  const src = d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')) : new Date()
  const day = Number.isNaN(src.getTime()) ? new Date() : src
  return `${day.getDate()}/${day.getMonth() + 1}`
}

export default async function ExperiencesPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>
  searchParams: Promise<{ iter?: string }>
}) {
  const { tripId } = await params
  await requireTripAccess(tripId)
  const { iter: iterParam } = await searchParams
  const supabase = createAdminClient()

  const { data: trip } = await supabase
    .from('trips').select('id, state_county, destination_country').eq('trip_id', tripId).maybeSingle() as
    { data: { id: string; state_county: string | null; destination_country: string | null } | null }

  if (!trip) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>Trip not found</p>
      </div>
    )
  }

  // ── Iterated structured path — when the Drawing Board has synced iterations ──
  let iterations: Iteration[] = []
  let selected: Iteration | null = null
  try {
    const { data: iterData } = await supabase
      .from('iterations').select('*').eq('trip_id', trip.id)
      .order('synced_at', { ascending: false })
    iterations = (iterData as Iteration[]) ?? []
    if (iterations.length > 0) {
      selected =
        (iterParam ? iterations.find(i => i.name === iterParam) : null) ??
        iterations.find(i => i.is_current) ?? iterations[0]
    }
  } catch { /* iterations table absent — fall through to snapshot */ }

  // ── The structured record: destinations, experiences, transfers together ────
  const [destRes, expRes, transRes] = await Promise.all([
    supabase.from('dates_destinations').select('*').eq('trip_id', trip.id)
      .eq('row_type', 'Destination').order('sort_order', { ascending: true }),
    supabase.from('experiences').select('*').eq('trip_id', trip.id),
    supabase.from('transfers').select('*').eq('trip_id', trip.id),
  ])
  const destinations = (destRes.data as DatesDestination[] | null) ?? []
  const allExperiences = (expRes.data as Experience[] | null) ?? []
  const allTransfers = (transRes.data as Transfer[] | null) ?? []

  // Show one iteration at a time: the one the dropdown names, else the current set
  const forIteration = <T extends { iteration_id: string | null; is_current: boolean | null }>(rows: T[]): T[] => {
    if (selected) {
      const own = rows.filter(r => r.iteration_id === selected.id)
      if (own.length > 0) return own
    }
    const current = rows.filter(r => r.is_current)
    return current.length > 0 ? current : rows
  }
  const experiences = forIteration(allExperiences)
  const transfers = forIteration(allTransfers)

  const { data: contentPage, error: contentError } = await supabase
    .from('trip_content_pages')
    .select('parsed_content')
    .eq('trip_id', trip.id)
    .eq('type', 'experiences')
    .maybeSingle()

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageBlocks: any[] = (contentPage?.parsed_content as any)?.blocks ?? []

  // The record drives the page: destinations, then the days inside each one.
  if (destinations.length > 0 && experiences.length > 0) {
    return (
      <div style={{ paddingTop: '32px', paddingBottom: 'var(--pad-96)' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '18px' }}>
          <IterationDropdown
            iterations={iterations.length > 0 ? iterations : [{
              id: 'current', notion_id: null,
              name: iterDayMonth(experiences[0]?.iteration_date ?? null),
              trip_id: trip.id, notion_page_id: '', is_current: true,
              synced_at: new Date().toISOString(), created_at: '',
            }]}
            selectedName={selected?.name ?? iterDayMonth(experiences[0]?.iteration_date ?? null)}
          />
        </div>
        <ExperiencesStructured
          destinations={destinations}
          experiences={experiences}
          transfers={transfers}
          blocks={pageBlocks}
        />
      </div>
    )
  }

  if (!contentPage) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ border: '0.5px solid rgb(var(--borges-rgb) / 0.14)', backgroundColor: 'var(--color-surface-sunken)' }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="3" y="3" width="16" height="16" rx="2" stroke="#6B696C" strokeWidth="1.3"/>
            <path d="M7 11h8M11 7v8" stroke="#6B696C" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </div>
        <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>Not ready yet</p>
        <p className="font-optima mt-1.5" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)', lineHeight: 1.65, maxWidth: '320px' }}>
          Your experiences will appear here once they&apos;ve been prepared.
        </p>
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = contentPage.parsed_content as any

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
      <ExperiencesGallery blocks={parsed.blocks} />
    </div>
  )
}
