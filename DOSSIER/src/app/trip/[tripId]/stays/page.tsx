import { createAdminClient } from '@/lib/supabase/admin'
import StaysGallery from '@/components/StaysGallery'
import StaysStructured from '@/components/StaysStructured'
import IterationDropdown from '@/components/itinerary/IterationDropdown'
import type { Stay } from '@/lib/types'

/**
 * Day/month label for an iteration, matching the other crafting tabs.
 * Always a date: an untagged row falls back to today rather than showing a bare
 * version number, so 'Viewing' never reads as anything but a date.
 */
function iterDayMonth(d: string | null): string {
  const src = d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')) : new Date()
  const day = Number.isNaN(src.getTime()) ? new Date() : src
  return `${day.getDate()}/${day.getMonth() + 1}`
}

export default async function StaysPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>
  searchParams: Promise<{ iter?: string }>
}) {
  const { tripId } = await params
  const { iter: iterParam } = await searchParams
  const supabase = createAdminClient()

  const { data: trip } = await supabase
    .from('trips').select('id').eq('trip_id', tripId).maybeSingle() as { data: { id: string } | null }

  if (!trip) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>Trip not found</p>
      </div>
    )
  }

  // ── Structured source — the CQ Stays database ──────────────────────────────
  let stayRows: Stay[] = []
  try {
    const { data } = await supabase
      .from('stays').select('*').eq('trip_id', trip.id)
      .order('check_in', { ascending: true, nullsFirst: false })
    stayRows = (data as Stay[]) ?? []
  } catch { /* table absent — fall through to the Notion page snapshot */ }

  // Versions come from the Iteration set on each CQ Stays record. Rows with no
  // iteration are treated as version 1 so a part-tagged database still renders.
  const versionOf = (s: Stay) => s.iteration_num ?? 1
  const nums = stayRows.length > 0
    ? [...new Set(stayRows.map(versionOf))].sort((a, b) => b - a)
    : []
  const latest = nums[0] ?? 1
  const dateFor = (n: number) =>
    stayRows.find(s => versionOf(s) === n && s.iteration_date)?.iteration_date ?? null
  const requestedVersion = (() => {
    if (!iterParam || nums.length === 0) return NaN
    const m = iterParam.match(/version\s*(\d+)/i) ?? iterParam.match(/^\s*(\d+)\s*$/)
    if (m) return parseInt(m[1], 10)
    // The label is a day/month like "6/8" — match it back to its version
    return nums.find(n => iterDayMonth(dateFor(n)) === iterParam.trim()) ?? NaN
  })()
  const shownVersion = nums.includes(requestedVersion) ? requestedVersion : latest
  const staysForVersion = stayRows.filter(s => versionOf(s) === shownVersion)

  /** 'Viewing 6/8' — the same day/month control the other crafting tabs use. */
  const versionBar = nums.length > 0 ? (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '18px' }}>
      <IterationDropdown
        iterations={nums.map(n => ({
          id: String(n), notion_id: null,
          name: iterDayMonth(dateFor(n)),
          trip_id: trip.id, notion_page_id: '',
          is_current: n === latest,
          synced_at: new Date().toISOString(), created_at: '',
        }))}
        selectedName={iterDayMonth(dateFor(shownVersion))}
      />
    </div>
  ) : null

  const { data: contentPage, error: contentError } = await supabase
    .from('trip_content_pages')
    .select('parsed_content')
    .eq('trip_id', trip.id)
    .eq('type', 'stay')
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

  // No Notion page yet — the CQ Stays records alone still make a full tab
  if ((!contentPage || !(contentPage.parsed_content as { blocks?: unknown[] } | null)?.blocks?.length)
      && staysForVersion.length > 0) {
    return (
      <div style={{ paddingTop: '32px', paddingBottom: 'var(--pad-96)' }}>
        {versionBar}
        <StaysStructured stays={staysForVersion} />
      </div>
    )
  }

  if (!contentPage) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ border: '0.5px solid rgb(var(--borges-rgb) / 0.14)', backgroundColor: 'var(--color-surface-sunken)' }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M3 8l8-6 8 6v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="#6B696C" strokeWidth="1.3" strokeLinejoin="round"/>
            <path d="M8 22V11h6v11" stroke="#6B696C" strokeWidth="1.3" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>Not ready yet</p>
        <p className="font-optima mt-1.5" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)', lineHeight: 1.65, maxWidth: '320px' }}>
          Your stay details will appear here once they&apos;ve been prepared.
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
      {versionBar}
      <StaysGallery blocks={parsed.blocks} stays={staysForVersion} />
    </div>
  )
}
