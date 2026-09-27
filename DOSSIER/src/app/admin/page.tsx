'use client'

// Never prerendered. This page builds a Supabase client while rendering, so
// prerendering it at build time makes the build depend on the runtime
// environment being present — the same fragility that stopped every
// Git-triggered deploy of this site. It is an interactive, gated screen with
// nothing worth prerendering.
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

import type { Trip, Message, TripRequest } from '@/lib/types'
import CQLogo from '@/components/CQLogo'

// Built on first use. Calling createClient() while a component renders means
// it also runs during the server render of this page, where there is no
// browser environment — which is what made the build depend on runtime
// configuration and fail wherever a .env.local did not happen to exist.
let _sb: ReturnType<typeof createClient> | null = null
const sb = () => (_sb ??= createClient())

const ADMIN_PASSWORD = 'cqadmin2026'

// ── Shared helpers ─────────────────────────────────────────────────────────────

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function formatDay(ts: string) {
  return new Date(ts).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

function MessageTypeBadge({ type }: { type: string | null }) {
  const map: Record<string, { bg: string; text: string }> = {
    update:   { bg: 'var(--color-surface-sunken)', text: 'var(--color-text)' },
    feedback: { bg: 'var(--color-surface-sunken)', text: 'var(--color-text-accent)' },
    request:  { bg: 'var(--color-surface-sunken)', text: 'var(--color-text)' },
    note:     { bg: 'var(--color-surface-sunken)', text: 'var(--color-text-accent)' },
  }
  if (!type) return null
  const style = map[type.toLowerCase()] ?? map['note']
  return (
    <span className="text-caption tracking-[0.1em] px-2 py-0.5 rounded-full"
      style={{ backgroundColor: style.bg, color: style.text }}>
      {type}
    </span>
  )
}

// ── Financials Admin ─────────────────────────────────────────────────────────
//
// Read-only view of synced financial data. All data entry happens in Notion.
// The team adds entries to: CQ Quotations, CQ Payments, CQ Invoices databases.
// Hit "Sync from Notion" to pull the latest into Supabase.

interface FinSummary {
  quotations: number
  totalQuoted: number
  payments: number
  totalPaid: number
  invoices: number
  currency: string
}

function FinancialsAdmin({ trips, onRunSync }: { trips: Trip[]; onRunSync: () => Promise<void> }) {
  const [selectedTripId, setSelectedTripId] = useState<string>('')
  const [summary, setSummary] = useState<FinSummary | null>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const selectedTrip = trips.find(t => t.trip_id === selectedTripId) ?? null

  const loadSummary = async (tripId: string) => {
    setLoadingData(true); setSummary(null)
    try {
      const [qRes, pRes, iRes] = await Promise.all([
        sb().from('quotations').select('total_amount, currency').eq('trip_id', tripId),
        sb().from('payments').select('amount, currency').eq('trip_id', tripId).eq('direction', 'inbound'),
        sb().from('invoices').select('id').eq('trip_id', tripId),
      ])
      const qs = (qRes.data ?? []) as { total_amount: number | null; currency: string | null }[]
      const ps = (pRes.data ?? []) as { amount: number; currency: string | null }[]
      const is = (iRes.data ?? []) as { id: string }[]
      const currency = qs[0]?.currency ?? ps[0]?.currency ?? 'USD'
      setSummary({
        quotations:  qs.length,
        totalQuoted: qs.reduce((s, q) => s + (q.total_amount ?? 0), 0),
        payments:    ps.length,
        totalPaid:   ps.reduce((s, p) => s + (p.amount ?? 0), 0),
        invoices:    is.length,
        currency,
      })
    } catch {}
    setLoadingData(false)
  }

  useEffect(() => {
    if (selectedTripId) loadSummary(selectedTripId)
    else setSummary(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTripId])

  const handleSync = async () => {
    setSyncing(true); setSyncMsg(null)
    try {
      await onRunSync()
      setSyncMsg('Sync complete. Refreshing data…')
      if (selectedTripId) await loadSummary(selectedTripId)
      setSyncMsg('Sync complete.')
      setTimeout(() => setSyncMsg(null), 4000)
    } catch {
      setSyncMsg('Sync failed — check console.')
    }
    setSyncing(false)
  }

  const fmt = (n: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

  const inputCls = "w-full border border-fade rounded-lg bg-surface-base px-3 py-2 text-body text-ink-secondary outline-none focus:border-ink transition-colors"
  const labelCls = "block text-caption tracking-[0.01em] text-accent mb-1.5"
  const sectionCls = "bg-surface-base rounded-2xl border border-fade p-6"

  // Notion DB links (open in new tab so team can edit)
  const notionLinks = [
    { label: 'CQ Quotations', envKey: 'NOTION_QUOTATIONS_DB', desc: 'Line items per trip' },
    { label: 'CQ Payments',   envKey: 'NOTION_PAYMENTS_DB',   desc: 'Client payment records' },
    { label: 'CQ Invoices',   envKey: 'NOTION_INVOICES_DB',   desc: 'Invoice PDFs and dates' },
  ]

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: 'var(--color-surface)' }}>
      <div className="max-w-2xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── Workflow note ── */}
        <div className="bg-sunken border border-sunken rounded-2xl p-5">
          <p className="text-caption tracking-[0.01em] text-ink mb-2">How it works</p>
          <p className="text-body text-accent leading-relaxed">
            Add quotation line items, payments, and invoices in the Notion databases below.
            Click <strong>Sync from Notion</strong> to pull the latest into Supabase — the client portal reads from there.
          </p>
        </div>

        {/* ── Notion database links ── */}
        <div className={sectionCls}>
          <p className={labelCls}>Notion Databases — edit data here</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {notionLinks.map(link => (
              <a
                key={link.label}
                href={`https://notion.so`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-fade hover:border-ink transition-colors group"
              >
                <div>
                  <p className="text-body text-ink-secondary group-hover:text-ink">{link.label}</p>
                  <p className="text-caption text-ink-muted">{link.desc}</p>
                </div>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-ink-muted group-hover:text-ink">
                  <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-fade flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 bg-ink hover:bg-ink disabled:opacity-50 text-ink-inverse text-caption tracking-wider px-5 py-2.5 rounded-xl transition-colors"
            >
              {syncing ? (
                <>
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="2" strokeDasharray="20 10"/>
                  </svg>
                  Syncing…
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M10 6A4 4 0 112 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M10 2v4H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Sync from Notion
                </>
              )}
            </button>
            {syncMsg && <p className="text-caption text-accent">{syncMsg}</p>}
          </div>
        </div>

        {/* ── Trip selector ── */}
        <div className={sectionCls}>
          <label className={labelCls}>View financials for trip</label>
          <select
            value={selectedTripId}
            onChange={e => setSelectedTripId(e.target.value)}
            className={inputCls}
          >
            <option value="">— Select a trip —</option>
            {trips.map(t => (
              <option key={t.id} value={t.trip_id}>
                {t.trip_name}{t.destination_country ? ` · ${t.destination_country}` : ''} ({t.trip_id})
              </option>
            ))}
          </select>
        </div>

        {/* ── Financial summary ── */}
        {selectedTrip && (
          <div className={sectionCls}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="cq-subhead text-ink-secondary">{selectedTrip.trip_name}</h2>
              <button
                onClick={() => loadSummary(selectedTrip.trip_id)}
                className="text-caption text-accent hover:text-ink-secondary tracking-wider transition-colors"
              >
                Refresh
              </button>
            </div>

            {loadingData ? (
              <p className="text-body text-ink-muted">Loading…</p>
            ) : summary ? (
              <>
                {/* Summary numbers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', backgroundColor: 'var(--fade)', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                  {[
                    { label: 'Quoted',   value: fmt(summary.totalQuoted, summary.currency), sub: `${summary.quotations} quotation${summary.quotations !== 1 ? 's' : ''}` },
                    { label: 'Paid',     value: fmt(summary.totalPaid, summary.currency),   sub: `${summary.payments} payment${summary.payments !== 1 ? 's' : ''}` },
                    { label: 'Balance',  value: fmt(Math.max(0, summary.totalQuoted - summary.totalPaid), summary.currency), sub: summary.totalQuoted - summary.totalPaid <= 0 ? 'Fully paid' : 'Outstanding', highlight: summary.totalQuoted - summary.totalPaid > 0 },
                  ].map(col => (
                    <div key={col.label} className="bg-surface-base p-4 text-center">
                      <p className="text-caption tracking-wider text-ink-muted mb-1">{col.label}</p>
                      <p className={`cq-subhead text-lg ${col.highlight ? 'text-ink' : 'text-ink-secondary'}`}>{col.value}</p>
                      <p className="text-caption text-ink-muted mt-0.5">{col.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Invoices count */}
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-base">
                  <p className="text-body text-accent">Invoices</p>
                  <p className="text-body text-ink-secondary">
                    {summary.invoices > 0 ? `${summary.invoices} invoice${summary.invoices !== 1 ? 's' : ''}` : 'None yet'}
                  </p>
                </div>

                {/* No data nudge */}
                {summary.quotations === 0 && summary.payments === 0 && (
                  <div className="mt-4 px-4 py-3 rounded-xl bg-surface-base border border-accent text-body text-accent">
                    No financial data synced yet for this trip. Add entries in the Notion databases above, then sync.
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

      </div>
    </div>
  )
}

// ── Drawing Board Sync ────────────────────────────────────────────────────────

interface Iteration {
  id: string
  title: string
  lastEdited: string
}

interface ImgItem {
  id: string          // Supabase uuid
  rowId: string       // experience_id / stay_id
  table: 'experiences' | 'stays'
  label: string       // title or property_name
  image_url: string | null
  image_urls: string[] | null   // multiple images (stays only)
}

interface ParsedRow {
  raw: {
    date: string
    destination: string
    experience: string
    stay: string
    transit: string
    transfer: string
    notes: string
  }
  parsed: {
    date: string | null
    destination: string | null
    experience: { title: string; time_of_day: string | null; duration: string | null; cost_indicator: string | null; tags: string[] } | null
    stay: { property_name: string; room_type: string | null; bed_type: string | null } | null
    transit: { from_location: string | null; to_location: string | null; transfer_mode: string | null } | null
    transfer: { transfer_purpose: string | null; from_location: string | null; to_location: string | null } | null
    notes: string | null
  } | null
  error?: string
}

function StatusCell({ value }: { value: unknown }) {
  if (value == null) return <span className="text-ink-muted">—</span>
  if (typeof value === 'string') return <span className="text-ink-secondary">{value}</span>
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const label = (obj.title ?? obj.property_name ?? obj.from_location) as string | undefined
    if (label) return <span className="text-ink-secondary">{label}</span>
  }
  return <span className="text-ink">✓</span>
}

// Extract a Notion page ID from a URL or raw ID string.
// Handles: full URLs, 32-char hex without dashes, UUIDs with dashes.
function extractNotionPageId(input: string): string {
  const s = input.trim()

  // UUID format already: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const uuidMatch = s.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
  if (uuidMatch) return uuidMatch[1].toLowerCase()

  // 32-char hex (Notion URLs embed IDs as the last segment, after the page title)
  // e.g. notion.so/workspace/Page-Title-32dcc540df0981c8a2ffe059ccfd4bc1
  const hexMatch = s.match(/([0-9a-f]{32})(?:[?#]|$)/i)
  if (hexMatch) {
    const h = hexMatch[1].toLowerCase()
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`
  }

  // Return as-is and let the API report an error
  return s
}

function DrawingBoardSync({ trips, onRefreshTrips }: { trips: Trip[]; onRefreshTrips: () => void }) {
  // Mode 1 (direct) vs Mode 2 (browse hierarchy)
  const [mode, setMode] = useState<'direct' | 'browse'>('direct')

  // Mode 1 state
  const [directInput, setDirectInput] = useState('')

  // Mode 2 state
  const [clientPageId, setClientPageId] = useState('')
  const [iterations, setIterations] = useState<Iteration[]>([])
  const [loadingIterations, setLoadingIterations] = useState(false)
  const [iterError, setIterError] = useState('')

  // Shared state
  const [selectedIterationId, setSelectedIterationId] = useState('')
  const [selectedTripId, setSelectedTripId] = useState('')

  // Seed trip selector once trips load (they arrive async after mount)
  useEffect(() => {
    if (trips.length > 0 && !selectedTripId) {
      const firstId = trips[0].trip_id
      setSelectedTripId(firstId)
      loadSyncHistory(firstId)
      const saved = trips[0].drawing_board_url ?? ''
      setDrawingBoardUrl(saved)
      if (saved && !directInput) setDirectInput(saved)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips, selectedTripId])
  const [previewData, setPreviewData] = useState<ParsedRow[] | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ experiences: number; stays: number; transfers: number } | null>(null)
  const [syncError, setSyncError] = useState('')
  const [iterationTitle, setIterationTitle] = useState<string | null>(null)
  const [syncHistory, setSyncHistory] = useState<{ version: string; count: number }[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<{ version: string; count: number } | null>(null)
  const [forceSync, setForceSync] = useState(false)

  // Edit images state
  const [editImgOpen, setEditImgOpen] = useState(false)
  const [coverImgUrl, setCoverImgUrl] = useState('')
  const [savingImg, setSavingImg] = useState(false)
  const [imgSaved, setImgSaved] = useState(false)
  const [imgItems, setImgItems] = useState<ImgItem[]>([])
  const [loadingImgItems, setLoadingImgItems] = useState(false)
  const [imgEdits, setImgEdits] = useState<Record<string, string>>({})
  const [imgUrlsEdits, setImgUrlsEdits] = useState<Record<string, string[]>>({})
  const [newUrlInputs, setNewUrlInputs] = useState<Record<string, string>>({})
  const [savingImgItem, setSavingImgItem] = useState<Record<string, boolean>>({})

  // Reading Insights state
  const [readingPageInput, setReadingPageInput] = useState('')
  const [readingGenerating, setReadingGenerating] = useState(false)
  const [readingInsights, setReadingInsights] = useState<string | null>(null)
  const [readingError, setReadingError] = useState('')
  const [readingSaved, setReadingSaved] = useState(false)

  // Pre-Travel Guide state
  const [preTravelTripId, setPreTravelTripId]         = useState('')
  const [preTravelNotionUrl, setPreTravelNotionUrl]   = useState('')
  const [preTravelGenerating, setPreTravelGenerating] = useState(false)
  const [preTravelDone, setPreTravelDone]             = useState(false)
  const [preTravelError, setPreTravelError]           = useState('')

  // Drawing Board URL state
  const [drawingBoardUrl, setDrawingBoardUrl] = useState('')
  const [savingDbUrl, setSavingDbUrl]         = useState(false)
  const [dbUrlSaved, setDbUrlSaved]           = useState(false)
  const [dbUrlError, setDbUrlError]           = useState('')

  const selectedTrip = trips.find(t => t.trip_id === selectedTripId) ?? null

  // Derived: resolved iteration ID ready to use
  const resolvedIterationId =
    mode === 'direct' ? extractNotionPageId(directInput) : selectedIterationId

  // Effective trip ID: prefer explicit selection, fall back to first trip
  const effectiveTripId = selectedTripId || trips[0]?.trip_id || ''

  function resetPreview() {
    setPreviewData(null)
    setSyncResult(null)
    setPreviewError('')
    setSyncError('')
    setIterationTitle(null)
    setDuplicateWarning(null)
    setForceSync(false)
  }

  async function handleSaveImage() {
    if (!selectedTripId || !coverImgUrl.trim()) return
    setSavingImg(true)
    try {
      await sb().from('trips').update({ cover_image_url: coverImgUrl.trim() }).eq('trip_id', selectedTripId)
      setImgSaved(true)
      setTimeout(() => setImgSaved(false), 3000)
    } finally {
      setSavingImg(false)
    }
  }

  async function loadImgItems(tripId: string) {
    if (!tripId) return
    setLoadingImgItems(true)
    setImgItems([])
    setImgEdits({})
    setImgUrlsEdits({})
    setNewUrlInputs({})
    try {
      const { data: tripData } = await sb().from('trips').select('id').eq('trip_id', tripId).maybeSingle()
      if (!tripData) return
      const tripUuid = (tripData as { id: string }).id

      const [{ data: exps }, { data: stys }] = await Promise.all([
        sb().from('experiences').select('id, experience_id, title, image_url').eq('trip_id', tripUuid).eq('is_active_version', true).order('sort_order', { ascending: true }),
        sb().from('stays').select('id, stay_id, property_name, image_url, image_urls').eq('trip_id', tripUuid).eq('is_active_version', true).order('sort_order', { ascending: true }),
      ])

      const items: ImgItem[] = [
        ...((exps ?? []) as { id: string; experience_id: string; title: string; image_url: string | null }[]).map(e => ({
          id: e.id, rowId: e.experience_id, table: 'experiences' as const, label: e.title,
          image_url: e.image_url, image_urls: null,
        })),
        ...((stys ?? []) as { id: string; stay_id: string; property_name: string; image_url: string | null; image_urls: string[] | null }[]).map(s => ({
          id: s.id, rowId: s.stay_id, table: 'stays' as const, label: s.property_name,
          image_url: s.image_url, image_urls: s.image_urls,
        })),
      ]
      setImgItems(items)
      const edits: Record<string, string> = {}
      const urlsEdits: Record<string, string[]> = {}
      for (const item of items) {
        edits[item.id] = item.image_url ?? ''
        urlsEdits[item.id] = item.image_urls ?? []
      }
      setImgEdits(edits)
      setImgUrlsEdits(urlsEdits)
    } catch {
      // Column may not exist yet
    } finally {
      setLoadingImgItems(false)
    }
  }

  async function saveImgItem(item: ImgItem) {
    setSavingImgItem(p => ({ ...p, [item.id]: true }))
    try {
      if (item.table === 'stays') {
        // For stays: save image_urls array; derive image_url from first entry
        const urls = (imgUrlsEdits[item.id] ?? []).filter(u => u.trim())
        const primary = urls[0] ?? null
        await sb().from('stays').update({ image_url: primary, image_urls: urls.length ? urls : null }).eq('id', item.id)
        setImgItems(prev => prev.map(i => i.id === item.id ? { ...i, image_url: primary, image_urls: urls.length ? urls : null } : i))
      } else {
        const url = imgEdits[item.id]?.trim() ?? ''
        await sb().from(item.table).update({ image_url: url || null }).eq('id', item.id)
        setImgItems(prev => prev.map(i => i.id === item.id ? { ...i, image_url: url || null } : i))
      }
    } finally {
      setSavingImgItem(p => ({ ...p, [item.id]: false }))
    }
  }

  function addUrlToStay(itemId: string) {
    const url = (newUrlInputs[itemId] ?? '').trim()
    if (!url) return
    const current = imgUrlsEdits[itemId] ?? []
    if (current.length >= 10) return
    setImgUrlsEdits(p => ({ ...p, [itemId]: [...current, url] }))
    setNewUrlInputs(p => ({ ...p, [itemId]: '' }))
  }

  function removeUrlFromStay(itemId: string, index: number) {
    setImgUrlsEdits(p => ({
      ...p,
      [itemId]: (p[itemId] ?? []).filter((_, i) => i !== index),
    }))
  }

  // Load sync history for the selected trip
  const loadSyncHistory = async (tripId: string) => {
    if (!tripId) return
    setLoadingHistory(true)
    try {
      // First get trip uuid
      const { data: tripData } = await sb().from('trips').select('id').eq('trip_id', tripId).maybeSingle()
      if (!tripData) { setLoadingHistory(false); return }
      const { data } = await sb()
        .from('experiences')
        .select('iteration_version')
        .eq('trip_id', (tripData as { id: string }).id)
        .not('iteration_version', 'is', null)
      if (!data) { setLoadingHistory(false); return }
      const counts: Record<string, number> = {}
      for (const row of data as { iteration_version: string | null }[]) {
        const v = row.iteration_version
        if (v) counts[v] = (counts[v] ?? 0) + 1
      }
      const history = Object.entries(counts)
        .map(([version, count]) => ({ version, count }))
        .reverse()
      setSyncHistory(history)
    } catch {
      // ignore errors (column might not exist yet)
    } finally {
      setLoadingHistory(false)
    }
  }

  async function handleLoadIterations() {
    if (!clientPageId.trim()) return
    setLoadingIterations(true)
    setIterError('')
    setIterations([])
    resetPreview()
    try {
      const res = await fetch(
        `/api/list-iterations?password=${encodeURIComponent(ADMIN_PASSWORD)}&pageId=${encodeURIComponent(extractNotionPageId(clientPageId))}`
      )
      const json = await res.json()
      if (!res.ok) { setIterError(json.error ?? 'Failed to load iterations'); return }
      setIterations(json.iterations ?? [])
      if (json.iterations?.length > 0) setSelectedIterationId(json.iterations[0].id)
    } catch {
      setIterError('Network error. Is the server running?')
    } finally {
      setLoadingIterations(false)
    }
  }

  async function handlePreview() {
    // Validate inline — button is always enabled
    const iterationId = resolvedIterationId
    if (!iterationId || iterationId.trim().length === 0) {
      setPreviewError('Please enter an iteration page URL or ID.')
      return
    }
    if (!effectiveTripId) {
      setPreviewError('No trip available. Run the main sync first or refresh trips.')
      return
    }
    setPreviewing(true)
    setPreviewError('')
    setPreviewData(null)
    setSyncResult(null)
    try {
      const res = await fetch('/api/sync-drawing-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: ADMIN_PASSWORD,
          iterationPageId: iterationId,
          tripId: effectiveTripId,
          preview: true,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setPreviewError(json.error ?? 'Preview failed'); return }
      setPreviewData(json.parsed ?? [])
      if (json.iterationTitle) setIterationTitle(json.iterationTitle)
      if (json.duplicateWarning) setDuplicateWarning(json.duplicateWarning)
      else setDuplicateWarning(null)
    } catch {
      setPreviewError('Network error during preview')
    } finally {
      setPreviewing(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncError('')
    try {
      const res = await fetch('/api/sync-drawing-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: ADMIN_PASSWORD,
          iterationPageId: resolvedIterationId,
          tripId: effectiveTripId,
          preview: false,
          force: forceSync || !duplicateWarning,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setSyncError(json.error ?? 'Sync failed'); return }
      setSyncResult(json.created)
      if (json.iterationTitle) setIterationTitle(json.iterationTitle)
      // Reload sync history after successful sync
      if (effectiveTripId) loadSyncHistory(effectiveTripId)
    } catch {
      setSyncError('Network error during sync')
    } finally {
      setSyncing(false)
    }
  }

  async function handleGenerateInsights() {
    if (!effectiveTripId || !readingPageInput.trim()) return
    setReadingGenerating(true)
    setReadingError('')
    setReadingInsights(null)
    setReadingSaved(false)
    try {
      const res = await fetch('/api/ai/reading-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: ADMIN_PASSWORD,
          tripId: effectiveTripId,
          readingPageUrl: readingPageInput.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) { setReadingError(json.error ?? 'Failed to generate insights'); return }
      setReadingInsights(json.insights)
      setReadingSaved(true)
      setTimeout(() => setReadingSaved(false), 4000)
    } catch {
      setReadingError('Network error — check your connection')
    } finally {
      setReadingGenerating(false)
    }
  }

  async function handleGeneratePreTravel() {
    const targetTripId = preTravelTripId || effectiveTripId
    if (!targetTripId) return
    setPreTravelGenerating(true)
    setPreTravelError('')
    setPreTravelDone(false)
    try {
      const res  = await fetch('/api/ai/pre-travel-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: ADMIN_PASSWORD,
          tripId: targetTripId,
          notionUrl: preTravelNotionUrl.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) { setPreTravelError(json.error ?? 'Failed to generate guide'); return }
      setPreTravelDone(true)
      setTimeout(() => setPreTravelDone(false), 5000)
    } catch {
      setPreTravelError('Network error — check your connection')
    } finally {
      setPreTravelGenerating(false)
    }
  }

  async function handleSaveDrawingBoardUrl() {
    if (!effectiveTripId || !drawingBoardUrl.trim()) return
    setSavingDbUrl(true)
    setDbUrlError('')
    try {
      const { error } = await sb().from('trips').update({ drawing_board_url: drawingBoardUrl.trim() }).eq('trip_id', effectiveTripId)
      if (error) {
        if (error.message.toLowerCase().includes('column') || error.message.toLowerCase().includes('does not exist')) {
          setDbUrlError('Column missing — run in Supabase SQL Editor: ALTER TABLE trips ADD COLUMN IF NOT EXISTS drawing_board_url TEXT;')
        } else {
          setDbUrlError(error.message)
        }
        return
      }
      setDbUrlSaved(true)
      setDirectInput(drawingBoardUrl.trim())
      resetPreview()
      setTimeout(() => setDbUrlSaved(false), 4000)
    } finally {
      setSavingDbUrl(false)
    }
  }

  const selectedIteration = iterations.find(i => i.id === selectedIterationId)
  const dataRows = previewData?.filter(r => r.parsed) ?? []

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">

      {/* Section 1 — Source */}
      <div className="bg-surface-base rounded-2xl border border-fade p-6 mb-4">
        <h2 className="cq-subhead text-ink-secondary mb-1">Source</h2>

        {/* Mode 1 — Direct (default) */}
        <div className="mb-3">
          <label className="block text-caption tracking-[0.1em] text-accent mb-2">
            Iteration page URL or ID
          </label>
          <input
            type="text"
            value={directInput}
            onChange={e => { setDirectInput(e.target.value); resetPreview() }}
            placeholder="notion.so/workspace/18-3-32dcc540df09… or paste just the ID"
            className="w-full border border-fade rounded-xl bg-surface-base px-4 py-2.5 text-body text-ink-secondary outline-none focus:border-ink transition-colors font-mono placeholder:text-ink-muted"
          />
          {/* Show resolved ID + iteration label when input is non-trivial */}
          {directInput.trim().length > 10 && (
            <div className="mt-1.5 flex items-center gap-3 flex-wrap">
              <p className="text-caption text-ink-muted font-mono">
                ID: {extractNotionPageId(directInput)}
              </p>
              {iterationTitle && (
                <span className="text-caption text-ink bg-sunken px-2.5 py-0.5 rounded-full">
                  Iteration: {iterationTitle}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Mode 2 toggle */}
        <button
          onClick={() => { setMode(m => m === 'direct' ? 'browse' : 'direct'); resetPreview() }}
          className="text-caption text-accent hover:text-ink transition-colors underline underline-offset-2"
        >
          {mode === 'direct' ? 'Or browse client iterations →' : '← Back to paste iteration URL'}
        </button>

        {/* Mode 2 — Browse hierarchy */}
        {mode === 'browse' && (
          <div className="mt-4 pt-4 border-t border-fade">
            <label className="block text-caption tracking-[0.1em] text-accent mb-2">
              Client page URL or ID
            </label>
            <div className="flex gap-3 mb-3">
              <input
                type="text"
                value={clientPageId}
                onChange={e => setClientPageId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLoadIterations()}
                placeholder="notion.so/workspace/Client-Name-…"
                className="flex-1 border border-fade rounded-xl bg-surface-base px-4 py-2.5 text-body text-ink-secondary outline-none focus:border-ink transition-colors font-mono placeholder:text-ink-muted"
              />
              <button
                onClick={handleLoadIterations}
                disabled={loadingIterations || !clientPageId.trim()}
                className="bg-ink hover:bg-ink disabled:opacity-40 text-ink-inverse text-body px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
              >
                {loadingIterations ? 'Loading…' : 'Load Iterations'}
              </button>
            </div>

            {iterError && (
              <p className="text-body text-ink bg-sunken rounded-xl px-4 py-2.5 mb-3">{iterError}</p>
            )}

            {iterations.length > 0 && (
              <div>
                <label className="block text-caption tracking-[0.1em] text-accent mb-2">
                  Iteration ({iterations.length} found)
                </label>
                <select
                  value={selectedIterationId}
                  onChange={e => { setSelectedIterationId(e.target.value); resetPreview() }}
                  className="w-full border border-fade rounded-xl bg-surface-base px-4 py-2.5 text-body text-ink-secondary outline-none focus:border-ink transition-colors"
                >
                  {iterations.map(iter => (
                    <option key={iter.id} value={iter.id}>
                      {iter.title} — {new Date(iter.lastEdited).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 2 — Destination trip */}
      <div className="bg-surface-base rounded-2xl border border-fade p-6 mb-4">
        <h2 className="cq-subhead text-ink-secondary mb-1">Destination</h2>
        <p className="text-caption text-ink-muted mb-4">Which trip should this iteration be synced to?</p>
        <div className="flex items-center gap-2 mb-2">
          <label className="block text-caption tracking-[0.1em] text-accent">
            Trip
          </label>
          <button
            onClick={onRefreshTrips}
            className="ml-auto text-caption text-ink hover:text-ink transition-colors underline underline-offset-2"
          >
            Refresh trips
          </button>
        </div>
        {trips.length === 0 ? (
          <p className="text-body text-ink-muted">No trips found. Run the main sync first.</p>
        ) : (
          <select
            value={selectedTripId || trips[0]?.trip_id}
            onChange={e => {
              const tid = e.target.value
              setSelectedTripId(tid)
              setPreviewData(null)
              setSyncResult(null)
              setDbUrlSaved(false)
              loadSyncHistory(tid)
              const t = trips.find(tr => tr.trip_id === tid)
              const saved = t?.drawing_board_url ?? ''
              setDrawingBoardUrl(saved)
              if (saved) { setDirectInput(saved); resetPreview() }
              if (editImgOpen) { setImgItems([]); setImgEdits({}); setImgUrlsEdits({}); setNewUrlInputs({}); loadImgItems(tid) }
            }}
            className="w-full border border-fade rounded-xl bg-surface-base px-4 py-2.5 text-body text-ink-secondary outline-none focus:border-ink transition-colors"
          >
            {trips.map(trip => (
              <option key={trip.id} value={trip.trip_id}>
                {trip.trip_name}{trip.destination_country ? ` — ${trip.destination_country}` : ''}
              </option>
            ))}
          </select>
        )}

        {/* Drawing Board URL — save once, auto-fills Source on trip change */}
        <div className="mt-5 pt-5 border-t border-fade">
          <label className="block text-caption tracking-[0.1em] text-accent mb-1.5">
            Drawing Board URL
          </label>
          <p className="text-caption text-ink-muted mb-3">
            Save the Notion drawing board URL for this trip. It will auto-fill the Source field whenever this trip is selected.
          </p>
          <div className="flex gap-3">
            <input
              type="url"
              value={drawingBoardUrl}
              onChange={e => { setDrawingBoardUrl(e.target.value); setDbUrlSaved(false); setDbUrlError('') }}
              placeholder="notion.so/…"
              className="flex-1 border border-fade rounded-xl bg-surface-base px-4 py-2.5 text-body text-ink-secondary outline-none focus:border-ink transition-colors font-mono placeholder:text-ink-muted"
            />
            <button
              onClick={handleSaveDrawingBoardUrl}
              disabled={savingDbUrl || !drawingBoardUrl.trim()}
              className={`px-4 py-2.5 rounded-xl text-caption tracking-wider transition-all whitespace-nowrap ${
                dbUrlSaved
                  ? 'bg-sunken text-ink'
                  : 'bg-ink hover:bg-ink text-ink-inverse disabled:opacity-50'
              }`}
            >
              {savingDbUrl ? 'Saving…' : dbUrlSaved ? '✓ Saved' : 'Save URL'}
            </button>
          </div>
          {dbUrlError && (
            <div className="mt-3 rounded-xl bg-sunken border border-sunken p-3">
              <p className="text-caption text-ink mb-1">Schema migration required</p>
              <pre className="text-caption text-ink font-mono break-words whitespace-pre-wrap">{dbUrlError}</pre>
            </div>
          )}
        </div>
      </div>

      {/* Section 3 — Preview & Sync */}
      <div className="bg-surface-base rounded-2xl border border-fade p-6">
        <h2 className="cq-subhead text-ink-secondary mb-4">Preview &amp; Sync</h2>

        {/* Preview button — always enabled */}
        {!syncResult && (
          <button
            onClick={handlePreview}
            disabled={previewing}
            className="bg-ink hover:bg-ink disabled:opacity-60 text-ink-inverse text-body px-5 py-2.5 rounded-xl transition-colors mb-4"
          >
            {previewing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" stroke="white" strokeWidth="2" strokeDasharray="20 10"/>
                </svg>
                Parsing with Claude…
              </span>
            ) : 'Preview Parse'}
          </button>
        )}

        {previewError && (
          <p className="text-body text-ink bg-sunken rounded-xl px-4 py-2.5 mb-4">{previewError}</p>
        )}

        {/* Preview table */}
        {previewData && dataRows.length > 0 && !syncResult && (
          <div className="mb-6">
            <p className="text-caption text-accent mb-3">
              Parsed <span className="text-ink-secondary">{dataRows.length}</span> rows
              {previewData.length - dataRows.length > 0 && (
                <span className="text-ink"> ({previewData.length - dataRows.length} failed)</span>
              )}
              {' '}from iteration <span className="text-ink-secondary">{selectedIteration?.title ?? resolvedIterationId.slice(0, 8) + '…'}</span>
              {' '}→ <span className="text-ink-secondary">{selectedTrip?.trip_name}</span>
            </p>

            <div className="overflow-x-auto rounded-xl border border-fade">
              <table className="w-full text-body">
                <thead>
                  <tr className="bg-surface-base border-b border-fade">
                    {['Day', 'Date', 'Destination', 'Experience', 'Stay', 'Transit', 'Transfer'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-caption tracking-[0.1em] text-accent whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.map(({ parsed }, idx) => (
                    <tr key={idx} className="border-b border-fade last:border-0 hover:bg-surface-base">
                      <td className="px-3 py-2.5 text-center">
                        <span className="w-6 h-6 rounded-full bg-sunken text-ink text-caption flex items-center justify-center mx-auto">
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-caption text-accent whitespace-nowrap">{parsed?.date ?? '—'}</td>
                      <td className="px-3 py-2.5 text-caption text-ink-secondary whitespace-nowrap">{parsed?.destination ?? '—'}</td>
                      <td className="px-3 py-2.5 text-caption max-w-[160px]">
                        <StatusCell value={parsed?.experience ? { title: parsed.experience.title } : null} />
                      </td>
                      <td className="px-3 py-2.5 text-caption max-w-[140px]">
                        <StatusCell value={parsed?.stay ? { property_name: parsed.stay.property_name } : null} />
                      </td>
                      <td className="px-3 py-2.5 text-caption max-w-[140px]">
                        <StatusCell value={parsed?.transit
                          ? { title: `${parsed.transit.from_location ?? '?'} → ${parsed.transit.to_location ?? '?'}` }
                          : null} />
                      </td>
                      <td className="px-3 py-2.5 text-caption max-w-[120px]">
                        <StatusCell value={parsed?.transfer
                          ? { title: parsed.transfer.transfer_purpose ?? 'Transfer' }
                          : null} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Duplicate warning */}
            {duplicateWarning && (
              <div className="mt-4 bg-surface-base border border-accent rounded-xl px-4 py-3">
                <p className="text-body text-accent mb-1">
                  ⚠ Iteration &ldquo;{duplicateWarning.version}&rdquo; was already synced ({duplicateWarning.count} experience{duplicateWarning.count !== 1 ? 's' : ''} exist).
                </p>
                <p className="text-caption text-accent mb-2.5">Syncing again will replace the existing data for this iteration.</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceSync}
                    onChange={e => setForceSync(e.target.checked)}
                    className="accent-ink"
                  />
                  <span className="text-caption text-accent">I understand — replace existing data</span>
                </label>
              </div>
            )}

            {/* Confirm sync */}
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleSync}
                disabled={syncing || (!!duplicateWarning && !forceSync)}
                className="bg-ink hover:bg-ink disabled:opacity-40 text-ink-inverse text-body px-6 py-2.5 rounded-xl transition-colors flex items-center gap-2"
              >
                {syncing ? (
                  <>
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="6" stroke="rgb(var(--mist-rgb) / 0.5)" strokeWidth="2" strokeDasharray="20 10"/>
                    </svg>
                    Syncing…
                  </>
                ) : 'Confirm & Sync to Database'}
              </button>
              <button
                onClick={() => { setPreviewData(null); setSyncResult(null) }}
                className="text-body text-accent hover:text-ink-secondary transition-colors"
              >
                Cancel
              </button>
            </div>

            {syncError && (
              <p className="text-body text-ink bg-sunken rounded-xl px-4 py-2.5 mt-3">{syncError}</p>
            )}
          </div>
        )}

        {previewData && dataRows.length === 0 && !syncResult && (
          <div className="py-8 text-center">
            <p className="text-body text-accent">No parseable rows found in this iteration.</p>
            <p className="text-caption text-ink-muted mt-1">Check that the table has data rows with at least one filled cell.</p>
          </div>
        )}

        {/* Success state */}
        {syncResult && (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-full bg-sunken flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-ink">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="cq-subhead-lg text-ink-secondary mb-2">Sync complete</h3>
            <p className="text-body text-accent mb-4">
              Created{' '}
              <span className="text-ink-secondary">{syncResult.experiences} experience{syncResult.experiences !== 1 ? 's' : ''}</span>,{' '}
              <span className="text-ink-secondary">{syncResult.stays} stay{syncResult.stays !== 1 ? 's' : ''}</span>,{' '}
              <span className="text-ink-secondary">{syncResult.transfers} transfer{syncResult.transfers !== 1 ? 's' : ''}</span>
            </p>
            <div className="flex items-center justify-center gap-3">
              {selectedTrip && (
                <a
                  href={`/trip/${selectedTrip.trip_id}/experiences`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-ink hover:bg-ink text-ink-inverse text-body px-5 py-2.5 rounded-xl transition-colors"
                >
                  View Trip →
                </a>
              )}
              <button
                onClick={() => { setPreviewData(null); setSyncResult(null) }}
                className="text-body text-accent hover:text-ink-secondary transition-colors px-4 py-2.5"
              >
                Sync Another
              </button>
            </div>
          </div>
        )}

        {/* Empty state (before any action) */}
        {!previewData && !syncResult && (
          <div className="py-8 text-center text-ink-muted">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mx-auto mb-3">
              <rect x="4" y="8" width="24" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M4 13h24" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M11 8V4M21 8V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <p className="text-body">Select an iteration and trip above, then click Preview Parse.</p>
          </div>
        )}
      </div>

      {/* Section 4 — Sync History */}
      {(syncHistory.length > 0 || loadingHistory) && (
        <div className="bg-surface-base rounded-2xl border border-fade p-6 mt-4">
          <h2 className="cq-subhead text-ink-secondary mb-1">Sync History</h2>
          <p className="text-caption text-ink-muted mb-4">Previous iterations synced for this trip.</p>
          {loadingHistory ? (
            <p className="text-body text-ink-muted">Loading…</p>
          ) : (
            <div className="space-y-2">
              {syncHistory.map((item, i) => (
                <div key={item.version} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-surface-base">
                  <div className="flex items-center gap-2.5">
                    {i === 0 && (
                      <span className="text-caption tracking-[0.01em] text-ink-inverse bg-ink px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                    <span className="text-body text-ink-secondary">{item.version}</span>
                  </div>
                  <span className="text-caption text-ink-muted">{item.count} experience{item.count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Section 5 — Edit Trip Images */}
      <div className="bg-surface-base rounded-2xl border border-fade mt-4 overflow-hidden">
        <button
          onClick={() => {
            const next = !editImgOpen
            setEditImgOpen(next)
            if (next && selectedTripId && imgItems.length === 0 && !loadingImgItems) {
              loadImgItems(selectedTripId)
            }
          }}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-base transition-colors"
        >
          <div>
            <h2 className="cq-subhead text-ink-secondary text-left">Edit Trip Images</h2>
            <p className="text-caption text-ink-muted text-left mt-0.5">Set cover photo and manage experience/stay images.</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
            className={`text-ink-muted transition-transform flex-shrink-0 ${editImgOpen ? 'rotate-180' : ''}`}>
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {editImgOpen && (
          <div className="border-t border-fade px-6 pt-5 pb-6 space-y-6">

            {/* Cover image */}
            <div>
              <p className="text-caption tracking-[0.1em] text-accent mb-1">Trip Cover Photo</p>
              <p className="text-caption text-ink-muted mb-2">Paste a permanent direct image URL (.jpg/.png/.webp). Notion-hosted URLs expire after ~1 hour.</p>
              <div className="flex gap-2">
                <input type="url" value={coverImgUrl}
                  onChange={e => { setCoverImgUrl(e.target.value); setImgSaved(false) }}
                  placeholder="https://images.unsplash.com/photo-…"
                  className="flex-1 border border-fade rounded-xl bg-surface-base px-3 py-2 text-body text-ink-secondary outline-none focus:border-ink transition-colors placeholder:text-ink-muted"
                />
                <button onClick={handleSaveImage}
                  disabled={savingImg || !coverImgUrl.trim() || !selectedTripId}
                  className="bg-ink hover:bg-ink disabled:opacity-40 text-ink-inverse text-caption px-4 py-2 rounded-xl transition-colors whitespace-nowrap">
                  {savingImg ? 'Saving…' : imgSaved ? '✓ Saved' : 'Save'}
                </button>
              </div>
              {coverImgUrl && (
                <div className="mt-2 rounded-xl overflow-hidden border border-fade h-24">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverImgUrl} alt="Preview" className="w-full h-full object-cover"
                    onError={e => (e.currentTarget.style.display = 'none')} />
                </div>
              )}
            </div>

            {/* Experiences + Stays */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-caption tracking-[0.1em] text-accent">
                  Experiences &amp; Stays
                  {imgItems.length > 0 && <span className="text-ink-muted font-normal ml-1">({imgItems.length})</span>}
                </p>
                <button
                  onClick={() => loadImgItems(selectedTripId)}
                  disabled={loadingImgItems || !selectedTripId}
                  className="text-caption text-ink hover:text-ink disabled:opacity-40 transition-colors underline underline-offset-2"
                >
                  {loadingImgItems ? 'Loading…' : imgItems.length > 0 ? 'Refresh' : 'Load items'}
                </button>
              </div>

              {loadingImgItems && (
                <p className="text-body text-ink-muted py-4 text-center">Loading…</p>
              )}

              {!loadingImgItems && imgItems.length === 0 && (
                <p className="text-caption text-ink-muted py-2">No active experiences or stays for this trip yet.</p>
              )}

              <div className="space-y-4">
                {imgItems.map(item => (
                  <div key={item.id} className="p-4 bg-surface-base rounded-xl border border-fade">
                    {/* Header row */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-caption tracking-[0.01em] px-1.5 py-0.5 rounded-full ${
                          item.table === 'experiences' ? 'bg-sunken text-ink' : 'bg-sunken text-accent'
                        }`}>
                          {item.table === 'experiences' ? 'Exp' : 'Stay'}
                        </span>
                        <p className="text-caption text-ink-secondary">{item.label}</p>
                      </div>
                      <button
                        onClick={() => saveImgItem(item)}
                        disabled={savingImgItem[item.id]}
                        className="bg-ink hover:bg-ink disabled:opacity-40 text-ink-inverse text-caption px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                      >
                        {savingImgItem[item.id] ? 'Saving…' : 'Save'}
                      </button>
                    </div>

                    {item.table === 'stays' ? (
                      /* ── Stay: multi-image management ── */
                      <div>
                        {/* Existing thumbnails */}
                        {(imgUrlsEdits[item.id] ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {(imgUrlsEdits[item.id] ?? []).map((url, i) => (
                              <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden bg-sunken flex-shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={url}
                                  alt={`Image ${i + 1}`}
                                  className="w-full h-full object-cover"
                                  onError={e => (e.currentTarget.style.opacity = '0.3')}
                                />
                                <button
                                  onClick={() => removeUrlFromStay(item.id, i)}
                                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                                >
                                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                    <path d="M1 1l6 6M7 1l-6 6" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                                  </svg>
                                </button>
                                {i === 0 && (
                                  <span className="absolute bottom-1 left-1 text-caption text-ink-inverse bg-black/50 px-1 rounded">
                                    Primary
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Count indicator */}
                        <p className="text-caption text-ink-muted mb-2">
                          {(imgUrlsEdits[item.id] ?? []).length}/10 images
                        </p>
                        {/* Add URL input */}
                        {(imgUrlsEdits[item.id] ?? []).length < 10 && (
                          <div className="flex gap-1.5">
                            <input
                              type="url"
                              value={newUrlInputs[item.id] ?? ''}
                              onChange={e => setNewUrlInputs(p => ({ ...p, [item.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') addUrlToStay(item.id) }}
                              placeholder="Paste image URL and press Enter or Add"
                              className="flex-1 border border-fade rounded-lg bg-surface-base px-2.5 py-1.5 text-caption text-ink-secondary outline-none focus:border-ink transition-colors placeholder:text-ink-muted"
                            />
                            <button
                              onClick={() => addUrlToStay(item.id)}
                              disabled={!(newUrlInputs[item.id] ?? '').trim()}
                              className="bg-accent hover:bg-accent disabled:opacity-40 text-ink-inverse text-caption px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                            >
                              Add
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* ── Experience: single image URL ── */
                      <div className="flex gap-3 items-start">
                        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-sunken">
                          {(imgEdits[item.id] || item.image_url) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imgEdits[item.id] || item.image_url || ''}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={e => (e.currentTarget.style.display = 'none')}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <rect x="1" y="3" width="14" height="10" rx="1.5" stroke="#6B696C" strokeWidth="1.2"/>
                                <circle cx="5.5" cy="6.5" r="1.2" fill="#6B696C"/>
                                <path d="M1 10l4-3 3 3 2-2 5 4" stroke="#6B696C" strokeWidth="1" strokeLinejoin="round"/>
                              </svg>
                            </div>
                          )}
                        </div>
                        <input
                          type="url"
                          value={imgEdits[item.id] ?? ''}
                          onChange={e => setImgEdits(p => ({ ...p, [item.id]: e.target.value }))}
                          placeholder="https://… or leave blank to use Unsplash auto"
                          className="flex-1 border border-fade rounded-lg bg-surface-base px-2.5 py-1.5 text-caption text-ink-secondary outline-none focus:border-ink transition-colors placeholder:text-ink-muted"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Reading Insights ── */}
      <div className="bg-surface-base rounded-2xl border border-fade p-6 mb-4">
        <h2 className="cq-subhead text-ink-secondary mb-1">Reading Insights</h2>
        <p className="text-caption text-ink-muted mb-4">
          Paste the client&apos;s Reading page URL. Claude will extract key insights and publish them to their First Steps dossier.
        </p>

        <label className="block text-caption tracking-[0.1em] text-accent mb-2">
          Trip
        </label>
        <select
          value={selectedTripId}
          onChange={e => setSelectedTripId(e.target.value)}
          className="w-full border border-fade rounded-xl bg-surface-base px-4 py-2.5 text-body text-ink-secondary outline-none focus:border-ink transition-colors mb-4"
        >
          {trips.map(t => (
            <option key={t.trip_id} value={t.trip_id}>
              {t.trip_name}{t.destination_country ? ` — ${t.destination_country}` : ''} ({t.trip_id})
            </option>
          ))}
        </select>

        <label className="block text-caption tracking-[0.1em] text-accent mb-2">
          Reading Page URL
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={readingPageInput}
            onChange={e => { setReadingPageInput(e.target.value); setReadingInsights(null); setReadingError('') }}
            placeholder="notion.so/… or any page URL"
            className="flex-1 border border-fade rounded-xl bg-surface-base px-4 py-2.5 text-body text-ink-secondary outline-none focus:border-ink transition-colors font-mono placeholder:text-ink-muted"
          />
          <button
            onClick={handleGenerateInsights}
            disabled={readingGenerating || !readingPageInput.trim() || !effectiveTripId}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-caption tracking-wider transition-all whitespace-nowrap ${
              readingSaved
                ? 'bg-sunken text-ink'
                : 'bg-ink hover:bg-ink text-ink-inverse disabled:opacity-50'
            }`}
          >
            {readingGenerating ? (
              <>
                <svg className="animate-spin w-3 h-3" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="2" strokeDasharray="20 10"/>
                </svg>
                Reading…
              </>
            ) : readingSaved ? (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Saved
              </>
            ) : 'Generate Insights'}
          </button>
        </div>

        {readingError && (
          <p className="mt-2 text-caption text-red-600">{readingError}</p>
        )}

        {readingInsights && (
          <div className="mt-4 bg-surface-base border border-fade rounded-xl p-4">
            <p className="text-caption tracking-[0.01em] text-ink-muted mb-2">Insights saved to dossier</p>
            <p className="text-body text-ink-secondary leading-relaxed whitespace-pre-wrap">{readingInsights}</p>
          </div>
        )}
      </div>

      {/* ── Pre-Travel Guide ── */}
      <div className="bg-surface-base rounded-2xl border border-fade p-6">
        <h2 className="cq-subhead text-ink-secondary mb-1">Pre-Travel Guide</h2>
        <p className="text-caption text-ink-muted mb-5 leading-relaxed">
          Claude generates films, music, reads, and cultural insights for the Reservations page. Optionally paste a Notion URL with curator notes to personalise the output.
        </p>

        {/* Trip selector */}
        <div className="mb-4">
          <label className="block text-caption tracking-[0.1em] text-accent mb-2">
            Select Trip
          </label>
          <select
            value={preTravelTripId || effectiveTripId}
            onChange={e => setPreTravelTripId(e.target.value)}
            className="w-full border border-fade rounded-xl bg-surface-base px-4 py-2.5 text-body text-ink-secondary outline-none focus:border-ink transition-colors"
          >
            <option value="">— Select a trip —</option>
            {trips.map(t => (
              <option key={t.id} value={t.trip_id}>
                {t.trip_name}{t.destination_country ? ` · ${t.destination_country}` : ''} ({t.trip_id})
              </option>
            ))}
          </select>
        </div>

        {/* Optional Notion URL */}
        <div className="mb-5">
          <label className="block text-caption tracking-[0.1em] text-accent mb-2">
            Curator Notes URL <span className="normal-case tracking-normal text-ink-muted ml-1">(optional — Notion page with manual content)</span>
          </label>
          <input
            type="url"
            value={preTravelNotionUrl}
            onChange={e => { setPreTravelNotionUrl(e.target.value); setPreTravelError('') }}
            placeholder="notion.so/…"
            className="w-full border border-fade rounded-xl bg-surface-base px-4 py-2.5 text-body text-ink-secondary outline-none focus:border-ink transition-colors font-mono placeholder:text-ink-muted"
          />
          <p className="mt-1.5 text-caption text-ink-muted">
            If provided, Claude reads this page and uses its content to personalise the guide.
          </p>
        </div>

        <button
          onClick={handleGeneratePreTravel}
          disabled={preTravelGenerating || !(preTravelTripId || effectiveTripId)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-caption tracking-wider transition-all ${
            preTravelDone
              ? 'bg-sunken text-ink'
              : 'bg-ink hover:bg-ink text-ink-inverse disabled:opacity-50'
          }`}
        >
          {preTravelGenerating ? (
            <>
              <svg className="animate-spin w-3 h-3" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="2" strokeDasharray="20 10"/>
              </svg>
              Generating… (30–60s)
            </>
          ) : preTravelDone ? (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Guide Saved to Dossier
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M10 6A4 4 0 112 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M10 2v4H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Generate Pre-Travel Guide
            </>
          )}
        </button>

        {preTravelError && (
          <div className="mt-3 rounded-xl bg-sunken border border-sunken p-3">
            <p className="text-caption text-ink">Error</p>
            <p className="text-caption text-ink mt-0.5 break-words">{preTravelError}</p>
          </div>
        )}
      </div>

    </div>
  )
}

// ── Trip Requests Admin ───────────────────────────────────────────────────────

const STATUS_OPTIONS = ['Pending', 'Reviewed', 'Trip Created', 'Declined']

function RequestsAdmin() {
  const [requests, setRequests] = useState<TripRequest[]>([])
  const [loading, setLoading]   = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/trip-requests')
      .then(r => r.json())
      .then(({ data }) => setRequests((data as TripRequest[]) ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id)
    try {
      const res = await fetch('/api/trip-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
      }
    } catch (e) { console.error(e) }
    setUpdatingId(null)
  }

  const statusColor: Record<string, string> = {
    'Pending':      'var(--color-text-accent)',
    'Reviewed':     'var(--color-text-secondary)',
    'Trip Created': 'var(--color-text-accent)',
    'Declined':     'var(--color-text)',
  }

  const inputCls  = "border border-fade rounded-lg bg-surface-base px-2 py-1 text-caption text-ink-secondary outline-none focus:border-ink transition-colors"

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: 'var(--color-surface)' }}>
      <div className="max-w-3xl mx-auto">
        {/* Table note */}
        <div className="bg-sunken border border-sunken rounded-2xl p-5 mb-5">
          <p className="text-caption tracking-[0.01em] text-ink mb-1">
            Trip Requests
          </p>
          <p className="text-body text-accent leading-relaxed">
            Requests submitted by clients from the dashboard. Update status as you progress each request.
            To create a trip, go to Notion and create the trip there, then run a Sync.
          </p>
          <p className="text-caption text-ink-muted mt-2">
            If no requests appear, run this SQL in Supabase first:&nbsp;
            <code className="bg-surface-base px-1.5 py-0.5 rounded text-ink">
              CREATE TABLE IF NOT EXISTS trip_requests (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), client_id UUID REFERENCES clients(id), destination_ideas TEXT, start_date DATE, end_date DATE, travelers_count INTEGER DEFAULT 1, budget_range TEXT, the_question TEXT, additional_notes TEXT, status TEXT DEFAULT &apos;Pending&apos;, created_at TIMESTAMPTZ DEFAULT now());
            </code>
          </p>
        </div>

        {loading ? (
          <p className="text-body text-ink-muted text-center py-12">Loading requests…</p>
        ) : requests.length === 0 ? (
          <div className="bg-surface-base rounded-2xl border border-fade p-12 text-center">
            <p className="cq-subhead text-ink-secondary mb-2">No requests yet</p>
            <p className="text-body text-ink-muted">Requests submitted from the client portal will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {requests.map(req => (
              <div key={req.id} className="bg-surface-base rounded-2xl border border-fade p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="font-optima text-lg text-ink-secondary leading-tight mb-1">
                      {req.destination_ideas ?? 'Destination TBD'}
                    </p>
                    <div className="flex flex-wrap gap-3 text-caption text-ink-muted">
                      {req.budget_range && <span>Budget: {req.budget_range}</span>}
                      {req.travelers_count && <span>{req.travelers_count} traveller{req.travelers_count !== 1 ? 's' : ''}</span>}
                      {req.start_date && <span>From {req.start_date}</span>}
                      {req.end_date && <span>To {req.end_date}</span>}
                      <span className="text-ink-muted">
                        {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  {/* Status selector */}
                  <select
                    value={req.status}
                    disabled={updatingId === req.id}
                    onChange={e => updateStatus(req.id, e.target.value)}
                    className={inputCls}
                    style={{ color: statusColor[req.status] ?? 'var(--color-text-muted)', flexShrink: 0 }}
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s} style={{ color: statusColor[s] ?? 'var(--color-text-secondary)' }}>{s}</option>
                    ))}
                  </select>
                </div>

                {req.the_question && (
                  <div className="bg-surface-base rounded-xl p-4 mb-3">
                    <p className="text-caption tracking-[0.01em] text-accent mb-1">
                      The Question
                    </p>
                    <p className="text-body text-ink-secondary leading-relaxed italic">
                      &ldquo;{req.the_question}&rdquo;
                    </p>
                  </div>
                )}

                {req.additional_notes && (
                  <div className="bg-surface-base rounded-xl p-4">
                    <p className="text-caption tracking-[0.01em] text-accent mb-1">
                      Additional Notes
                    </p>
                    <p className="text-body text-accent leading-relaxed">{req.additional_notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Content Sync Admin ────────────────────────────────────────────────────────

interface SyncResult {
  status: 'idle' | 'syncing' | 'done' | 'error'
  message: string | null
  sql?: string | null
  blockCount?: number
  parsedBlockCount?: number
  syncedAt?: string | null
}

const SYNC_INITIAL: SyncResult = { status: 'idle', message: null }

function ContentSyncAdmin({ trips }: { trips: Trip[] }) {
  const [selectedTripId, setSelectedTripId]   = useState<string>('')
  const [migrationStatus, setMigrationStatus] = useState<'unknown' | 'running' | 'ok' | 'sql_required'>('unknown')
  const [migrationSQL, setMigrationSQL]       = useState<string | null>(null)
  const [sqlCopied, setSqlCopied]             = useState(false)
  const [datesSync,       setDatesSync]       = useState<SyncResult>(SYNC_INITIAL)
  const [staySync,        setStaySync]        = useState<SyncResult>(SYNC_INITIAL)
  const [experiencesSync, setExperiencesSync] = useState<SyncResult>(SYNC_INITIAL)
  const [craftingSync, setCraftingSync] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [lastSynced, setLastSynced]    = useState<Record<string, any>>({})
  const selectedTrip = trips.find(t => t.trip_id === selectedTripId) ?? null

  // Load last-synced timestamps for selected trip
  useEffect(() => {
    if (!selectedTrip) { setLastSynced({}); return }
    let active = true
    setDatesSync(SYNC_INITIAL)
    setStaySync(SYNC_INITIAL)
    Promise.resolve(
      sb()
        .from('trip_content_pages')
        .select('type, synced_at')
        .eq('trip_id', selectedTrip.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ).then(({ data }: { data: any }) => {
      if (!active) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map: Record<string, any> = {}
      for (const row of (data ?? [])) map[row.type] = row
      setLastSynced(map)
    }).catch(() => { /* table may not exist yet — silently skip */ })
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTripId])

  // Run / attempt migration
  const handleRunMigration = async () => {
    setMigrationStatus('running')
    setMigrationSQL(null)
    try {
      const res  = await fetch('/api/admin/run-migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: ADMIN_PASSWORD }),
      })
      const json = await res.json()
      if (json.ok) {
        setMigrationStatus('ok')
      } else {
        setMigrationStatus('sql_required')
        setMigrationSQL(json.sql ?? null)
      }
    } catch {
      setMigrationStatus('sql_required')
    }
  }

  const handleCopySQL = () => {
    if (!migrationSQL) return
    navigator.clipboard.writeText(migrationSQL).then(() => {
      setSqlCopied(true)
      setTimeout(() => setSqlCopied(false), 2000)
    })
  }

  // Generic sync handler
  const handleSync = async (type: 'dates_destinations' | 'stay' | 'experiences', setState: (s: SyncResult) => void) => {
    if (!selectedTripId) return
    setState({ status: 'syncing', message: null })
    try {
      const res  = await fetch('/api/sync-content-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: ADMIN_PASSWORD, tripId: selectedTripId, type }),
      })
      const json = await res.json()
      if (!res.ok) {
        // If table missing, flip migration status
        if (json.error?.includes('table not found') || json.error?.includes('does not exist')) {
          setMigrationStatus('sql_required')
          setMigrationSQL(json.migration_sql ?? null)
        }
        setState({ status: 'error', message: json.error ?? 'Sync failed', sql: json.migration_sql ?? null })
        return
      }
      setState({
        status: 'done',
        message: `Synced "${json.pageTitle}"`,
        blockCount: json.blockCount,
        parsedBlockCount: json.parsedBlockCount,
        syncedAt: json.synced_at,
      })
      // Refresh last-synced map
      setLastSynced(prev => ({ ...prev, [type]: { synced_at: json.synced_at } }))
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Network error' })
    }
  }

  const handleSyncCrafting = async () => {
    if (!selectedTripId) return
    setCraftingSync('syncing')
    setDatesSync({ status: 'syncing', message: null })
    setStaySync({ status: 'syncing', message: null })
    setExperiencesSync({ status: 'syncing', message: null })
    try {
      const [datesRes, stayRes, experiencesRes] = await Promise.all([
        fetch('/api/sync-content-pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: ADMIN_PASSWORD, tripId: selectedTripId, type: 'dates_destinations' }),
        }),
        fetch('/api/sync-content-pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: ADMIN_PASSWORD, tripId: selectedTripId, type: 'stay' }),
        }),
        fetch('/api/sync-content-pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: ADMIN_PASSWORD, tripId: selectedTripId, type: 'experiences' }),
        }),
      ])
      const [datesJson, stayJson, experiencesJson] = await Promise.all([datesRes.json(), stayRes.json(), experiencesRes.json()])
      if (!datesRes.ok) setDatesSync({ status: 'error', message: datesJson.error ?? 'D&D sync failed' })
      else setDatesSync({ status: 'done', message: `Synced "${datesJson.pageTitle}"`, blockCount: datesJson.blockCount, parsedBlockCount: datesJson.parsedBlockCount, syncedAt: datesJson.synced_at })
      if (!stayRes.ok) setStaySync({ status: 'error', message: stayJson.error ?? 'Stay sync failed' })
      else setStaySync({ status: 'done', message: `Synced "${stayJson.pageTitle}"`, blockCount: stayJson.blockCount, parsedBlockCount: stayJson.parsedBlockCount, syncedAt: stayJson.synced_at })
      if (!experiencesRes.ok) setExperiencesSync({ status: 'error', message: experiencesJson.error ?? 'Experience sync failed' })
      else setExperiencesSync({ status: 'done', message: `Synced "${experiencesJson.pageTitle}"`, blockCount: experiencesJson.blockCount, parsedBlockCount: experiencesJson.parsedBlockCount, syncedAt: experiencesJson.synced_at })
      setCraftingSync((!datesRes.ok || !stayRes.ok || !experiencesRes.ok) ? 'error' : 'done')
      if (datesJson.synced_at) setLastSynced(prev => ({ ...prev, dates_destinations: { synced_at: datesJson.synced_at } }))
      if (stayJson.synced_at)  setLastSynced(prev => ({ ...prev, stay: { synced_at: stayJson.synced_at } }))
      if (experiencesJson.synced_at) setLastSynced(prev => ({ ...prev, experiences: { synced_at: experiencesJson.synced_at } }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error'
      setDatesSync({ status: 'error', message: msg })
      setStaySync({ status: 'error', message: msg })
      setExperiencesSync({ status: 'error', message: msg })
      setCraftingSync('error')
    }
  }

  const labelCls   = "block text-caption tracking-[0.01em] text-accent mb-1.5"
  const sectionCls = "bg-surface-base rounded-2xl border border-fade p-6"
  const inputCls   = "w-full border border-fade rounded-lg bg-surface-base px-3 py-2 text-body text-ink-secondary outline-none focus:border-ink transition-colors"

  const SyncButton = ({
    type, label, syncState, onSync,
  }: {
    type: 'dates_destinations' | 'stay' | 'experiences'
    label: string
    syncState: SyncResult
    onSync: () => void
  }) => {
    const lastSyncedAt = lastSynced[type]?.synced_at as string | undefined
    return (
      <div className="pt-4 border-t border-fade first:border-0 first:pt-0">
        <div className="flex items-center justify-between mb-2">
          <p className={labelCls} style={{ marginBottom: 0 }}>{label}</p>
          {lastSyncedAt && syncState.status !== 'done' && (
            <span className="text-caption text-ink-muted">
              Last: {new Date(lastSyncedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <button
          onClick={onSync}
          disabled={syncState.status === 'syncing'}
          className="flex items-center gap-2 bg-ink hover:bg-ink disabled:opacity-50 text-ink-inverse text-caption tracking-wider px-4 py-2 rounded-xl transition-colors"
        >
          {syncState.status === 'syncing' ? (
            <>
              <svg className="animate-spin w-3 h-3" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="2" strokeDasharray="20 10"/>
              </svg>
              Syncing…
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M10 6A4 4 0 112 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M10 2v4H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Sync {label}
            </>
          )}
        </button>

        {syncState.status === 'done' && (
          <div className="mt-3 flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="#08070E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-caption text-ink">
              {syncState.message} · {syncState.blockCount} blocks · {syncState.parsedBlockCount} parsed
            </p>
          </div>
        )}

        {syncState.status === 'error' && (
          <div className="mt-3 rounded-xl bg-sunken border border-sunken p-3">
            <p className="text-caption text-ink">Error</p>
            <p className="text-caption text-ink mt-0.5">{syncState.message}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: 'var(--color-surface)' }}>
      <div className="max-w-2xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── Step 1: Migration ── */}
        <div className={sectionCls}>
          <p className={labelCls}>Step 1 — Database Migration</p>
          <p className="text-caption text-accent mb-4 leading-relaxed">
            Creates the <code className="bg-surface-base px-1.5 py-0.5 rounded text-caption">trip_content_pages</code> table in Supabase.
            Run once. Safe to re-run — uses <code className="bg-surface-base px-1.5 py-0.5 rounded text-caption">CREATE TABLE IF NOT EXISTS</code>.
          </p>

          <button
            onClick={handleRunMigration}
            disabled={migrationStatus === 'running' || migrationStatus === 'ok'}
            className={`flex items-center gap-2 text-caption tracking-wider px-4 py-2 rounded-xl transition-colors disabled:opacity-50 ${
              migrationStatus === 'ok'
                ? 'bg-sunken text-ink'
                : 'bg-ink hover:bg-ink text-ink-inverse'
            }`}
          >
            {migrationStatus === 'running' ? (
              <>
                <svg className="animate-spin w-3 h-3" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="2" strokeDasharray="20 10"/>
                </svg>
                Running…
              </>
            ) : migrationStatus === 'ok' ? (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Migration Applied
              </>
            ) : (
              'Run Migration'
            )}
          </button>

          {/* SQL fallback */}
          {migrationStatus === 'sql_required' && migrationSQL && (
            <div className="mt-4 rounded-xl bg-surface-base border border-fade p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-caption text-accent tracking-[0.01em]">
                  Run this SQL in your Supabase SQL Editor
                </p>
                <button
                  onClick={handleCopySQL}
                  className="text-caption tracking-wider text-ink border border-sunken px-2.5 py-1 rounded-lg hover:bg-sunken transition-colors"
                >
                  {sqlCopied ? '✓ Copied' : 'Copy SQL'}
                </button>
              </div>
              <pre className="text-caption text-accent overflow-x-auto leading-relaxed whitespace-pre-wrap font-mono">
                {migrationSQL}
              </pre>
              <p className="text-caption text-ink-muted mt-3">
                After running the SQL, click <strong>Run Migration</strong> again to verify, then proceed to sync.
              </p>
            </div>
          )}
        </div>

        {/* ── Step 2: Trip selector ── */}
        <div className={sectionCls}>
          <label className={labelCls}>Step 2 — Select Trip</label>
          <select value={selectedTripId} onChange={e => setSelectedTripId(e.target.value)} className={inputCls}>
            <option value="">— Select a trip —</option>
            {trips.map(t => (
              <option key={t.id} value={t.trip_id}>
                {t.trip_name}{t.destination_country ? ` · ${t.destination_country}` : ''} ({t.trip_id})
              </option>
            ))}
          </select>
        </div>

        {/* ── Step 3: Sync Crafting ── */}
        {selectedTrip && (
          <div className={sectionCls}>
            <p className={labelCls}>Step 3 — Sync Crafting</p>
            <p className="text-caption text-accent mb-4 leading-relaxed">
              Fetches Dates &amp; Destination and Stay from Notion and caches them for the client dossier.
              One click syncs both.
            </p>

            {/* Primary combined Sync Crafting button */}
            <button
              onClick={handleSyncCrafting}
              disabled={craftingSync === 'syncing'}
              className="flex items-center gap-2 text-caption tracking-wider px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 mb-5"
              style={{
                backgroundColor: craftingSync === 'done' ? 'var(--color-surface-sunken)' : 'var(--color-text)',
                color: craftingSync === 'done' ? 'var(--color-text)' : 'var(--color-surface)',
              }}
            >
              {craftingSync === 'syncing' ? (
                <>
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="2" strokeDasharray="20 10"/>
                  </svg>
                  Syncing Crafting…
                </>
              ) : craftingSync === 'done' ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Crafting Synced
                </>
              ) : craftingSync === 'error' ? (
                'Retry Sync Crafting'
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M10 6A4 4 0 112 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M10 2v4H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Sync Crafting
                </>
              )}
            </button>

            {/* Individual status per type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <SyncButton
                type="dates_destinations"
                label="Dates & Destinations"
                syncState={datesSync}
                onSync={() => handleSync('dates_destinations', setDatesSync)}
              />
              <SyncButton
                type="stay"
                label="Stay Content"
                syncState={staySync}
                onSync={() => handleSync('stay', setStaySync)}
              />
              <SyncButton
                type="experiences"
                label="Experience Content"
                syncState={experiencesSync}
                onSync={() => handleSync('experiences', setExperiencesSync)}
              />
            </div>
          </div>
        )}

        {/* ── How it works ── */}
        <div className="bg-sunken border border-sunken rounded-2xl p-5">
          <p className="text-caption tracking-[0.01em] text-ink mb-2">Architecture</p>
          <ul className="text-caption text-accent leading-relaxed space-y-1">
            <li>• <strong>dates_destinations</strong> — reads <code>trips.dates_destinations_link</code></li>
            <li>• <strong>stay</strong> — reads <code>trips.stay_link_url</code></li>
            <li>• <strong>experiences</strong> — reads <code>trips.experience_link</code></li>
            <li>• Blocks fetched recursively, parsed into structured JSON, stored in <code>trip_content_pages</code></li>
            <li>• Client portal reads from Supabase — zero live Notion calls at render time</li>
          </ul>
        </div>

      </div>
    </div>
  )
}

// ── Main Admin Page ───────────────────────────────────────────────────────────

const ADMIN_TYPE_OPTIONS = [
  { value: 'update', label: 'Update' },
  { value: 'note', label: 'Note' },
]

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [view, setView] = useState<'inbox' | 'drawing-board'>('inbox')

  // Inbox state
  const [trips, setTrips] = useState<Trip[]>([])
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [content, setContent] = useState('')
  const [messageType, setMessageType] = useState('update')
  const [sending, setSending] = useState(false)
  const [tripPreviews, setTripPreviews] = useState<Record<string, Message>>({})
  const bottomRef = useRef<HTMLDivElement>(null)
  // Notion sync state
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
  const [syncResults, setSyncResults] = useState<Record<string, number> | null>(null)
  const syncToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // CQ LOAF sync state
  const [loafSyncState, setLoafSyncState] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
  const [loafSyncResult, setLoafSyncResult] = useState<{ added: number; stories: string[]; message: string } | null>(null)
  const loafToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthed(true)
    } else {
      setPwError('Incorrect password.')
    }
  }

  // Load trips via admin API (called on auth + manual refresh)
  const fetchTrips = (retries = 1) => {
    fetch(`/api/admin?password=${encodeURIComponent(ADMIN_PASSWORD)}&action=trips`)
      .then(r => r.json())
      .then(({ data }) => setTrips((data as Trip[]) ?? []))
      .catch(() => {
        if (retries > 0) setTimeout(() => fetchTrips(retries - 1), 1500)
      })
  }

  useEffect(() => {
    if (!authed) return
    fetchTrips()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed])

  // ── Notion sync ──────────────────────────────────────────────────────────────

  const runSync = async (silent = false) => {
    if (syncState === 'syncing') return
    if (!silent) setSyncState('syncing')

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: ADMIN_PASSWORD }),
      })
      const data = await res.json()

      if (!silent && data.success) {
        setSyncResults(data.results ?? null)
        setSyncState('done')
        fetchTrips() // refresh trip list
        if (syncToastTimer.current) clearTimeout(syncToastTimer.current)
        syncToastTimer.current = setTimeout(() => setSyncState('idle'), 5000)
      } else if (!silent) {
        setSyncState('error')
        if (syncToastTimer.current) clearTimeout(syncToastTimer.current)
        syncToastTimer.current = setTimeout(() => setSyncState('idle'), 4000)
      } else if (data.success) {
        // Silent success — refresh trips quietly
        fetchTrips()
      }
    } catch {
      if (!silent) setSyncState('error')
    }
  }

  const runLoafSync = async () => {
    if (loafSyncState === 'syncing') return
    setLoafSyncState('syncing')
    setLoafSyncResult(null)
    try {
      const res = await fetch('/api/ai/sync-loaf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: ADMIN_PASSWORD }),
      })
      const data = await res.json()
      if (data.success) {
        setLoafSyncResult({ added: data.stories_added ?? 0, stories: data.this_week ? [data.this_week] : [], message: data.message ?? '' })
        setLoafSyncState('done')
        if (loafToastTimer.current) clearTimeout(loafToastTimer.current)
        loafToastTimer.current = setTimeout(() => { setLoafSyncState('idle'); setLoafSyncResult(null) }, 7000)
      } else {
        setLoafSyncState('error')
        if (loafToastTimer.current) clearTimeout(loafToastTimer.current)
        loafToastTimer.current = setTimeout(() => setLoafSyncState('idle'), 4000)
      }
    } catch {
      setLoafSyncState('error')
      if (loafToastTimer.current) clearTimeout(loafToastTimer.current)
      loafToastTimer.current = setTimeout(() => setLoafSyncState('idle'), 4000)
    }
  }

  // Auto-sync every 2 minutes when admin is open
  useEffect(() => {
    if (!authed) return
    const id = setInterval(() => runSync(true), 2 * 60 * 1000)
    return () => {
      clearInterval(id)
      if (syncToastTimer.current) clearTimeout(syncToastTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed])

  // Load latest message preview for each trip
  useEffect(() => {
    if (!authed || trips.length === 0) return
    let active = true
    const load = async () => {
      await Promise.all(trips.map(async (trip) => {
        try {
          const res = await fetch(
            `/api/admin?password=${encodeURIComponent(ADMIN_PASSWORD)}&action=messages&tripId=${trip.id}`
          )
          if (!res.ok || !active) return
          const { data } = await res.json()
          const msgs = (data as Message[]) ?? []
          if (msgs.length > 0 && active) {
            setTripPreviews(prev => ({ ...prev, [trip.id]: msgs[msgs.length - 1] }))
          }
        } catch { /* network error — silently skip this trip preview */ }
      }))
    }
    load()
    return () => { active = false }
  }, [authed, trips])

  // Load messages for selected trip
  useEffect(() => {
    if (!selectedTrip) return
    fetch(`/api/admin?password=${encodeURIComponent(ADMIN_PASSWORD)}&action=messages&tripId=${selectedTrip.id}`)
      .then(r => r.json())
      .then(({ data }) => setMessages((data as Message[]) ?? []))
      .catch(() => {})
  }, [selectedTrip])

  // Realtime for selected trip
  useEffect(() => {
    if (!selectedTrip) return
    const channel = sb()
      .channel(`admin:messages:${selectedTrip.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `trip_id=eq.${selectedTrip.id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message])
      })
      .subscribe()
    return () => { sb().removeChannel(channel) }
  }, [selectedTrip])

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!content.trim() || !selectedTrip || sending) return
    setSending(true)
    await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: ADMIN_PASSWORD,
        tripId: selectedTrip.id,
        sender: 'cq',
        sender_name: 'CloseQuarters',
        message_type: messageType,
        content: content.trim(),
      }),
    })
    setSending(false)
    setContent('')
  }

  // ── Password gate ────────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center px-6">
        <div className="bg-surface-base rounded-2xl border border-fade p-8 w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="cq-subhead text-[32px] text-ink-secondary">CQ Admin</h1>
            <p className="text-caption text-accent mt-1 tracking-wider">Team Portal</p>
          </div>
          <div className="mb-4">
            <label className="block text-caption tracking-[0.1em] text-accent mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full border border-fade rounded-xl bg-surface-base px-4 py-3.5 text-ink-secondary text-body outline-none focus:border-ink transition-colors"
            />
          </div>
          {pwError && <p className="text-body text-ink mb-3">{pwError}</p>}
          <button
            onClick={handleLogin}
            className="w-full bg-ink hover:bg-ink text-ink-inverse text-body py-3.5 rounded-xl transition-colors"
          >
            Enter
          </button>
        </div>
      </div>
    )
  }

  // ── Authenticated ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-base flex flex-col">
      {/* Header */}
      <header className="bg-surface-base border-b border-fade px-6 py-3 flex items-center gap-3 flex-shrink-0 relative">
        <div className="flex-shrink-0 flex items-center gap-2">
          <CQLogo variant="dark" height={36} />
          <span className="text-caption tracking-[0.01em] text-accent">Admin</span>
        </div>

        {/* Tab navigation */}
        <div className="ml-4 flex gap-1">
          <button
            onClick={() => setView('inbox')}
            className={`px-4 py-1.5 rounded-lg text-caption tracking-wider transition-colors ${
              view === 'inbox' ? 'bg-surface-base text-ink-secondary' : 'text-ink-muted hover:text-accent'
            }`}
          >
            Inbox
          </button>
          <button
            onClick={() => setView('drawing-board')}
            className={`px-4 py-1.5 rounded-lg text-caption tracking-wider transition-colors ${
              view === 'drawing-board' ? 'bg-surface-base text-ink-secondary' : 'text-ink-muted hover:text-accent'
            }`}
          >
            Drawing Board
          </button>
        </div>

        {/* Sync buttons */}
        <div className="ml-auto flex items-center gap-3">
          {/* SYNC CQ LOAF */}
          <button
            onClick={runLoafSync}
            disabled={loafSyncState === 'syncing'}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-caption tracking-wider transition-all ${
              loafSyncState === 'done'
                ? 'bg-sunken text-ink'
                : loafSyncState === 'error'
                ? 'bg-sunken text-ink'
                : 'bg-accent hover:bg-accent text-ink-inverse disabled:opacity-60'
            }`}
          >
            {loafSyncState === 'syncing' ? (
              <>
                <svg className="animate-spin w-3 h-3" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="2" strokeDasharray="20 10" />
                </svg>
                Claude Reading…
              </>
            ) : loafSyncState === 'done' ? (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {loafSyncResult?.added === 0 ? 'LOAF Up To Date' : `+${loafSyncResult?.added} Added`}
              </>
            ) : loafSyncState === 'error' ? (
              'LOAF Sync Failed'
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Sync CQ LOAF
              </>
            )}
          </button>

          <button
            onClick={() => runSync(false)}
            disabled={syncState === 'syncing'}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-caption tracking-wider transition-all ${
              syncState === 'done'
                ? 'bg-sunken text-ink'
                : syncState === 'error'
                ? 'bg-sunken text-ink'
                : 'bg-ink hover:bg-ink text-ink-inverse disabled:opacity-60'
            }`}
          >
            {syncState === 'syncing' ? (
              <>
                <svg className="animate-spin w-3 h-3" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="2" strokeDasharray="20 10" />
                </svg>
                Syncing…
              </>
            ) : syncState === 'done' ? (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Synced
              </>
            ) : syncState === 'error' ? (
              'Sync failed'
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M10 6A4 4 0 112 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M10 2v4H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Sync Notion
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-ink" />
            <span className="text-caption text-accent">Team</span>
          </div>
        </div>

        {/* Sync results toast */}
        {syncState === 'done' && syncResults && (
          <div className="absolute top-full left-0 right-0 z-50 flex justify-center pointer-events-none">
            <div className="mt-2 bg-ink-secondary text-ink-inverse text-caption rounded-xl px-4 py-2.5 shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-accent flex-shrink-0">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="">Synced from Notion:</span>
              <span className="text-ink-inverse/70">
                {Object.entries(syncResults)
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => `${v} ${k}`)
                  .join(' · ')}
              </span>
            </div>
          </div>
        )}

        {/* LOAF sync toast */}
        {loafSyncState === 'done' && loafSyncResult && (
          <div className="absolute top-full left-0 right-0 z-50 flex justify-center pointer-events-none">
            <div className="mt-2 bg-accent text-ink-inverse text-caption rounded-xl px-4 py-2.5 shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-accent flex-shrink-0">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {loafSyncResult.added === 0 ? (
                <span>{loafSyncResult.message || 'CQ LOAF is up to date.'}</span>
              ) : (
                <span>
                  <span className="">CQ LOAF:</span>{' '}
                  {loafSyncResult.added} new {loafSyncResult.added === 1 ? 'story' : 'stories'} added to the dossier
                  {loafSyncResult.stories[0] ? ` — "${loafSyncResult.stories[0]}"` : ''}
                </span>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Body */}
      {view === 'drawing-board' ? (
        <DrawingBoardSync trips={trips} onRefreshTrips={fetchTrips} />
      ) : (
        <div className="flex flex-1 overflow-hidden max-h-[calc(100vh-65px)]">
          {/* Left: Trip List */}
          <div className="w-72 bg-surface-base border-r border-fade flex flex-col flex-shrink-0">
            <div className="px-4 py-3 border-b border-fade">
              <p className="text-caption tracking-[0.01em] text-accent">
                Trips ({trips.length})
              </p>
            </div>
            <div className="overflow-y-auto flex-1">
              {trips.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-body text-accent">No trips found.</p>
                </div>
              ) : (
                trips.map(trip => {
                  const preview = tripPreviews[trip.id]
                  const isSelected = selectedTrip?.id === trip.id
                  return (
                    <button
                      key={trip.id}
                      onClick={() => setSelectedTrip(trip)}
                      className={`w-full text-left px-4 py-4 border-b border-fade transition-colors ${
                        isSelected ? 'bg-surface-base' : 'hover:bg-surface-base'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {trip.cover_image_url ? (
                          <img src={trip.cover_image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-sunken flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-optima text-body text-ink-secondary truncate">{trip.trip_name}</p>
                          {trip.destination_country && (
                            <p className="text-caption text-accent tracking-wider truncate">{trip.destination_country}</p>
                          )}
                          {preview && (
                            <p className="text-caption text-ink-muted mt-1 truncate">
                              {preview.sender === 'cq' ? 'You: ' : ''}
                              {preview.content}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="w-1.5 h-1.5 rounded-full bg-ink flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Right: Chat View */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedTrip ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-full bg-surface-base border border-fade flex items-center justify-center mb-4">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-ink-muted">
                    <path d="M25 3H3v18l5-5h17V3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    <path d="M9 11h10M9 15h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className="text-body text-accent">Select a trip to view messages.</p>
              </div>
            ) : (
              <>
                {/* Trip header */}
                <div className="bg-surface-base border-b border-fade px-6 py-4 flex items-center gap-4">
                  <div className="flex-1">
                    <h2 className="cq-subhead text-ink-secondary">{selectedTrip.trip_name}</h2>
                    {selectedTrip.destination_country && (
                      <p className="text-caption text-accent tracking-wider">{selectedTrip.destination_country}</p>
                    )}
                  </div>
                  <span className="text-caption tracking-[0.1em] px-2.5 py-1 rounded-full bg-sunken text-ink">
                    {selectedTrip.status ?? 'Active'}
                  </span>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                      <p className="text-body text-accent">No messages yet.</p>
                      <p className="text-caption text-ink-muted mt-1">Send the first update to your client.</p>
                    </div>
                  ) : (
                    messages.map((msg, i) => {
                      const isNewDay = i === 0 || formatDay(messages[i-1].timestamp) !== formatDay(msg.timestamp)
                      return (
                        <div key={msg.id}>
                          {isNewDay && (
                            <div className="flex items-center gap-3 my-4">
                              <div className="flex-1 h-px bg-fade" />
                              <span className="text-caption tracking-wider text-ink-muted whitespace-nowrap">
                                {formatDay(msg.timestamp)}
                              </span>
                              <div className="flex-1 h-px bg-fade" />
                            </div>
                          )}
                          <div className={`flex gap-3 ${msg.sender === 'cq' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className="flex-shrink-0 mt-1">
                              {msg.sender === 'cq' ? (
                                <div className="w-8 h-8 rounded-full bg-ink flex items-center justify-center">
                                  <span className="text-ink-inverse text-caption">CQ</span>
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-sunken flex items-center justify-center">
                                  <span className="text-accent text-caption">
                                    {(msg.sender_name?.[0] ?? 'C').toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className={`max-w-[70%] flex flex-col gap-1 ${msg.sender === 'cq' ? 'items-end' : 'items-start'}`}>
                              <div className="flex items-center gap-2">
                                {msg.sender !== 'cq' && (
                                  <span className="text-caption text-ink-secondary">{msg.sender_name ?? 'Client'}</span>
                                )}
                                <MessageTypeBadge type={msg.message_type} />
                              </div>
                              <div className={`px-4 py-3 rounded-2xl text-body leading-relaxed ${
                                msg.sender === 'cq'
                                  ? 'bg-ink text-ink-inverse rounded-tr-sm'
                                  : 'bg-surface-base border border-fade text-ink-secondary rounded-tl-sm'
                              }`}>
                                {msg.content}
                              </div>
                              <span className="text-caption text-ink-muted">{formatTime(msg.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Compose */}
                <div className="bg-surface-base border-t border-fade p-4">
                  <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Write an update or note to your client…"
                    className="w-full text-body text-ink-secondary bg-surface-base rounded-xl px-4 py-3 resize-none outline-none placeholder:text-ink-muted min-h-[80px] border border-fade focus:border-ink transition-colors"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                  />
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex gap-2">
                      {ADMIN_TYPE_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setMessageType(opt.value)}
                          className={`text-caption tracking-[0.1em] px-3 py-1.5 rounded-full transition-colors ${
                            messageType === opt.value
                              ? opt.value === 'update'
                                ? 'bg-sunken text-ink'
                                : 'bg-sunken text-accent'
                              : 'bg-surface-base text-ink-muted'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={handleSend}
                      disabled={!content.trim() || sending}
                      className="flex items-center gap-2 bg-ink hover:bg-ink disabled:opacity-40 text-ink-inverse text-body px-4 py-2 rounded-xl transition-colors"
                    >
                      {sending ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
