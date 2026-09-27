'use client'

import { useState, useMemo } from 'react'
import type { Transfer, Document } from '@/lib/types'
import ScrollReveal from '@/components/ScrollReveal'

function modeLabel(mode: string | null, style: string | null): string {
  const m = (mode ?? '').toLowerCase()
  if (m.includes('flight') || m.includes('air') || m.includes('plane')) return 'FLIGHT'
  if (m.includes('train') || m.includes('rail')) return 'TRAIN'
  if (m.includes('ferry') || m.includes('boat')) return 'FERRY'
  if (m.includes('bus')) return 'BUS'
  if (m.includes('car') || m.includes('drive')) return 'CAR'
  return (mode ?? style ?? 'TRANSFER').toUpperCase()
}

function purposeBadge(t: Transfer): { label: string; bg: string; text: string } | null {
  const style = (t.transfer_style ?? '').toLowerCase()
  const mode  = (t.transfer_mode ?? '').toLowerCase()
  const isTransit = style === 'transit' || ['flight', 'air', 'plane', 'train', 'rail'].some(k => mode.includes(k))
  if (isTransit) return { label: 'TRANSIT', bg: 'var(--color-surface-sunken)', text: 'var(--color-text)' }
  const p = (t.transfer_purpose ?? '').toLowerCase()
  if (p.includes('airport') && (p.includes('pick') || p.includes('arrival')))
    return { label: 'AIRPORT PICKUP', bg: 'var(--color-surface-sunken)', text: 'var(--color-text)' }
  if (p.includes('airport') && (p.includes('drop') || p.includes('departure')))
    return { label: 'AIRPORT DROP', bg: 'var(--color-surface-sunken)', text: 'var(--color-text-accent)' }
  if (t.transfer_purpose)
    return { label: t.transfer_purpose.toUpperCase(), bg: 'var(--color-surface-sunken)', text: 'var(--color-text-accent)' }
  return { label: 'TRANSFER', bg: 'var(--color-surface-sunken)', text: 'var(--color-text-accent)' }
}

function docTypeLabel(type: string | null): string {
  const s = (type ?? '').toLowerCase()
  if (s.includes('boarding')) return 'Boarding Pass'
  if (s.includes('flight') || (s.includes('ticket') && !s.includes('entry'))) return 'Boarding Pass'
  if (s.includes('voucher')) return 'Voucher'
  if (s.includes('confirmation')) return 'Confirmation'
  return type ?? 'Document'
}

function TransferEntry({ transfer: t, isLast, docs }: { transfer: Transfer; isLast: boolean; docs: Document[] }) {
  const mode  = modeLabel(t.transfer_mode, t.transfer_style)
  const badge = purposeBadge(t)

  const dateInfo = t.date ? (() => {
    try {
      const dt = new Date(t.date + 'T00:00:00')
      return {
        dayMonth: dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        weekday:  dt.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase(),
      }
    } catch { return null }
  })() : null

  return (
    <div style={{ display: 'flex', gap: '20px', marginBottom: isLast ? 0 : '24px', position: 'relative' }}>
      {/* ── Left column: 56px ── */}
      <div style={{ width: '56px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {dateInfo ? (
          <div style={{ textAlign: 'center', marginBottom: '6px' }}>
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', lineHeight: 1.4, color: 'var(--color-text-muted)' }}>{dateInfo.dayMonth}</p>
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', marginTop: '2px', color: 'var(--color-text-muted)' }}>{dateInfo.weekday}</p>
          </div>
        ) : (
          <div style={{ marginBottom: '6px' }}>
            <p className="font-optima text-ink-muted" style={{ fontSize: 'var(--text-caption)' }}>—</p>
          </div>
        )}
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-text-accent)', margin: '4px 0', flexShrink: 0, position: 'relative', zIndex: 1, boxShadow: '0 0 6px rgb(var(--borges-rgb) / 0.4)' }} />
        <p className="font-optima text-center" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', lineHeight: 1.4, marginTop: '4px', color: 'var(--color-text-muted)' }}>{mode}</p>
      </div>

      {/* ── Right column: card ── */}
      <div
        className="flex-1 min-w-0"
        style={{ backgroundColor: 'var(--color-surface-sunken)', border: '0.5px solid rgb(var(--borges-rgb) / 0.10)', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 12px rgb(var(--night-rgb) / 0.3)' }}
      >
        {(t.from_location || t.to_location) && (
          <div style={{ marginBottom: '12px' }}>
            <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.5, color: 'var(--color-text)' }}>{t.from_location ?? '—'}</p>
            <div className="flex items-center" style={{ margin: '8px 0' }}>
              <div style={{ width: '36px', height: '1px', backgroundColor: 'var(--color-text-accent)' }} />
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0 }}>
                <path d="M0 4h6M3.5 1l3 3-3 3" stroke="#706E56" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.5, color: 'var(--color-text)' }}>{t.to_location ?? '—'}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between" style={{ gap: '8px' }}>
          <div className="flex flex-wrap items-center gap-2">
            {badge && (
              <span className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', padding: '3px 10px', borderRadius: '999px', backgroundColor: badge.bg, color: badge.text }}>
                {badge.label}
              </span>
            )}
            {t.duration && <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>{t.duration}</span>}
            {t.carrier && <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>· {t.carrier}</span>}
          </div>
          {t.amount && <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)' }}>{t.amount}</span>}
        </div>

        {t.notes && (
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', fontStyle: 'italic', marginTop: '10px', lineHeight: 1.6, color: 'var(--color-text-muted)' }}>{t.notes}</p>
        )}

        {docs.length > 0 && (
          <div className="flex flex-wrap gap-1.5" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '0.5px solid var(--fade)' }}>
            {docs.map(doc => (
              <a key={doc.id} href={doc.file_url ?? '#'} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 font-optima transition-opacity hover:opacity-70"
                style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', backgroundColor: 'rgb(var(--borges-rgb) / 0.10)', borderRadius: '6px', padding: '4px 10px', textDecoration: 'none', border: '0.5px solid rgb(var(--borges-rgb) / 0.14)' }}>
                <svg width="9" height="11" viewBox="0 0 10 12" fill="none" className="flex-shrink-0">
                  <path d="M2 1h4.5L9 3.5V11H2V1z" stroke="#08070E" strokeWidth="1.1" strokeLinejoin="round"/>
                  <path d="M6 1v3h3" stroke="#08070E" strokeWidth="1.1" strokeLinejoin="round"/>
                </svg>
                {doc.document_name}
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>{docTypeLabel(doc.document_type)}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface Props {
  transfers: Transfer[]
  docsMap: Record<string, Document[]>
}

export default function TransfersClient({ transfers, docsMap }: Props) {
  const [query, setQuery]     = useState('')
  const [activeMode, setMode] = useState<string | null>(null)

  const modes = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const t of transfers) {
      const m = modeLabel(t.transfer_mode, t.transfer_style)
      if (!seen.has(m)) { seen.add(m); out.push(m) }
    }
    return out
  }, [transfers])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return transfers.filter(t => {
      if (activeMode && modeLabel(t.transfer_mode, t.transfer_style) !== activeMode) return false
      if (!q) return true
      return (
        (t.from_location ?? '').toLowerCase().includes(q) ||
        (t.to_location ?? '').toLowerCase().includes(q) ||
        (t.carrier ?? '').toLowerCase().includes(q) ||
        (t.transfer_purpose ?? '').toLowerCase().includes(q) ||
        (t.notes ?? '').toLowerCase().includes(q)
      )
    })
  }, [transfers, query, activeMode])

  const showSearch = transfers.length > 2

  return (
    <>
      {/* ── Search / Filter ── */}
      {showSearch && (
        <div style={{ marginBottom: '36px' }}>
          <div className="relative" style={{ marginBottom: modes.length > 1 ? '14px' : '0' }}>
            <svg
              width="13" height="13" viewBox="0 0 14 14" fill="none"
              className="absolute pointer-events-none"
              style={{ left: '0', top: '50%', transform: 'translateY(-50%)' }}
            >
              <circle cx="6" cy="6" r="4.5" stroke="#6B696C" strokeWidth="1.2"/>
              <path d="M9.5 9.5L12 12" stroke="#6B696C" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="Search transfers…" aria-label="Search transfers"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full font-optima bg-transparent outline-none"
              style={{
                paddingLeft: '22px',
                paddingBottom: '10px',
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text)',
                borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
                caretColor: 'var(--color-text-accent)',
              }}
            />
          </div>

          {/* Mode filter pills */}
          {modes.length > 1 && (
            <div className="flex flex-wrap gap-2" style={{ paddingTop: '4px' }}>
              {modes.map(m => (
                <button
                  key={m}
                  onClick={() => setMode(activeMode === m ? null : m)}
                  className="font-optima transition-all"
                  style={{
                    fontSize: 'var(--text-caption)',
                    letterSpacing: '0.01em',
                    padding: '4px 12px',
                    borderRadius: '999px',
                    border: activeMode === m ? 'none' : '0.5px solid rgb(var(--borges-rgb) / 0.14)',
                    backgroundColor: activeMode === m ? 'var(--color-text-accent)' : 'transparent',
                    color: activeMode === m ? 'var(--color-surface-sunken)' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {m}
                </button>
              ))}
              {activeMode && (
                <button
                  onClick={() => setMode(null)}
                  className="font-optima transition-opacity hover:opacity-60"
                  style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', marginBottom: '6px', color: 'var(--color-text-muted)' }}>No results</p>
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>Try adjusting your search.</p>
        </div>
      )}

      {/* ── Timeline ── */}
      {filtered.length > 0 && (
        <div style={{ position: 'relative' }}>
          {/* Vertical line */}
          <div style={{ position: 'absolute', left: '27px', top: '12px', bottom: '12px', width: '1px', backgroundColor: 'rgb(var(--borges-rgb) / 0.14)', zIndex: 0 }} />

          {filtered.map((t, i) => (
            <ScrollReveal key={t.id} delay={i * 60}>
              <TransferEntry
                transfer={t}
                isLast={i === filtered.length - 1}
                docs={docsMap[t.id] ?? []}
              />
            </ScrollReveal>
          ))}
        </div>
      )}
    </>
  )
}
