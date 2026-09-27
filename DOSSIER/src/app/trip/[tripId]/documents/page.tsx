import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import type { Trip, Document } from '@/lib/types'
import { requireTripAccess } from '@/lib/tripAccess'

// ── Category mapping ──────────────────────────────────────────────────────────
// Maps raw document_type strings → display group headings

const CATEGORY_ORDER = [
  'Boarding Passes',
  'Hotel Confirmations',
  'Entry Tickets',
  'Visas & Travel',
  'Other',
]

function resolveCategory(type: string | null): string {
  const t = (type ?? '').toLowerCase()
  if (t.includes('boarding') || t.includes('flight') || t.includes('air')) return 'Boarding Passes'
  if (t.includes('hotel') || t.includes('accommodation') || t.includes('confirmation') || t.includes('reservation')) return 'Hotel Confirmations'
  if (t.includes('ticket') || t.includes('entry') || t.includes('voucher') || t.includes('experience')) return 'Entry Tickets'
  if (t.includes('visa') || t.includes('passport') || t.includes('insurance') || t.includes('travel auth')) return 'Visas & Travel'
  return 'Other'
}

function badgeColor(category: string): { bg: string; text: string; border: string } {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    'Boarding Passes':    { bg: 'rgb(var(--night-rgb) / 0.15)',  text: 'var(--color-text-secondary)', border: 'rgb(var(--night-rgb) / 0.3)'  },
    'Hotel Confirmations':{ bg: 'rgb(var(--borges-rgb) / 0.12)', text: 'var(--color-text-accent)', border: 'rgb(var(--borges-rgb) / 0.3)' },
    'Entry Tickets':      { bg: 'rgb(var(--borges-rgb) / 0.1)',    text: 'var(--color-text-accent)', border: 'rgb(var(--borges-rgb) / 0.25)'  },
    'Visas & Travel':     { bg: 'rgb(var(--night-rgb) / 0.15)', text: 'var(--color-text-secondary)', border: 'rgb(var(--night-rgb) / 0.3)' },
    'Other':              { bg: 'rgb(var(--borges-rgb) / 0.10)', text: 'var(--color-text-muted)', border: 'rgb(var(--borges-rgb) / 0.14)' },
  }
  return map[category] ?? map['Other']
}

function DocIconSvg({ category }: { category: string }) {
  const colors: Record<string, string> = {
    'Boarding Passes':    'var(--color-text-secondary)',
    'Hotel Confirmations':'var(--color-text-accent)',
    'Entry Tickets':      'var(--color-text-accent)',
    'Visas & Travel':     'var(--color-text-secondary)',
    'Other':              'var(--color-text-muted)',
  }
  const c = colors[category] ?? 'var(--color-text-muted)'
  return (
    <svg width="16" height="20" viewBox="0 0 16 20" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 1h6.5L14 5.5V19H3V1z" stroke={c} strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M9 1v5h5" stroke={c} strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M5 10h6M5 13h4" stroke={c} strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  )
}

function groupByCategory(docs: Document[]): Record<string, Document[]> {
  const groups: Record<string, Document[]> = {}
  for (const doc of docs) {
    const cat = resolveCategory(doc.document_type)
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(doc)
  }
  return groups
}

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ tripId: string }>
}) {
  const { tripId } = await params
  await requireTripAccess(tripId)
  const db = createAdminClient()

  const { data: trip } = await db
    .from('trips').select('*').eq('trip_id', tripId).maybeSingle() as { data: Trip | null }
  if (!trip) notFound()

  const { data: docs } = await db
    .from('documents')
    .select('*')
    .eq('trip_id', trip.id)
    .order('document_name', { ascending: true })

  const allDocs = (docs as Document[]) ?? []
  const groups  = groupByCategory(allDocs)
  // Render in fixed category order, skip empty groups
  const orderedCategories = CATEGORY_ORDER.filter(cat => groups[cat]?.length > 0)

  return (
    <div style={{ paddingBottom: 'var(--pad-40)' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 'var(--pad-40)' }}>
        <p
          className="font-optima"
          style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-accent)', marginBottom: '10px' }}
        >
          {trip.destination_country ?? 'Your Trip'}
        </p>
        <div className="flex items-baseline gap-3">
          <h2 className="cq-t1"
            style={{ fontSize: 'var(--text-t1)', lineHeight: 1.05, color: 'var(--color-text)' }}>
            Documents
          </h2>
          {allDocs.length > 0 && (
            <span
              className="font-optima"
              style={{
                fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)',
                padding: '2px 10px', borderRadius: '999px',
                backgroundColor: 'rgb(var(--borges-rgb) / 0.10)',
                border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
              }}
            >
              {allDocs.length}
            </span>
          )}
        </div>
        <div style={{ width: '36px', height: '1.5px', backgroundColor: 'var(--color-text-accent)', marginTop: '14px' }} />
      </div>

      {allDocs.length === 0 ? (

        /* ── Empty state ── */
        <div style={{
          backgroundColor: 'var(--color-surface-sunken)',
          border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
          borderRadius: '16px',
          padding: '48px 36px',
          textAlign: 'center',
        }}>
          <div className="mx-auto flex items-center justify-center" style={{
            width: '56px', height: '56px', borderRadius: '50%',
            border: '0.5px solid rgb(var(--borges-rgb) / 0.25)',
            backgroundColor: 'rgb(var(--borges-rgb) / 0.06)',
            marginBottom: '20px',
          }}>
            <svg width="22" height="26" viewBox="0 0 22 26" fill="none">
              <path d="M3 2h9.5L20 8.5V24H3V2z" stroke="#706E56" strokeWidth="1.3" strokeLinejoin="round"/>
              <path d="M12 2v7h8" stroke="#706E56" strokeWidth="1.3" strokeLinejoin="round"/>
              <path d="M7 14h8M7 18h5" stroke="#706E56" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </div>
          <h2 className="cq-subhead" style={{ fontSize: 'var(--text-subhead)', color: 'var(--color-text)', marginBottom: '10px' }}>
            No documents yet
          </h2>
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.7, color: 'var(--color-text-muted)', maxWidth: '360px', margin: '0 auto' }}>
            Your travel documents will appear here as they&rsquo;re prepared — boarding passes, hotel confirmations, visa letters, and more.
          </p>
        </div>

      ) : (

        /* ── Document groups ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {orderedCategories.map(cat => {
            const badge = badgeColor(cat)
            return (
              <div key={cat}>
                {/* Category header */}
                <div className="flex items-center gap-3" style={{ marginBottom: '12px' }}>
                  <p className="font-optima"
                    style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)' }}>
                    {cat}
                  </p>
                  <span className="font-optima" style={{
                    fontSize: 'var(--text-caption)', color: badge.text,
                    padding: '1px 8px', borderRadius: '999px',
                    backgroundColor: badge.bg, border: `0.5px solid ${badge.border}`,
                  }}>
                    {groups[cat].length}
                  </span>
                </div>

                {/* Documents */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {groups[cat].map(doc => (
                    doc.file_url ? (
                      <a
                        key={doc.id}
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group"
                        style={{ textDecoration: 'none', display: 'block' }}
                      >
                        <div className="flex items-center gap-4"
                          style={{
                            backgroundColor: 'var(--color-surface-sunken)',
                            border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
                            borderRadius: '10px',
                            padding: '16px 20px',
                            transition: 'border-color 0.15s ease',
                          }}
                        >
                          <DocIconSvg category={cat} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p className="font-optima" style={{
                              fontSize: 'var(--text-body)', color: 'var(--color-text)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {doc.document_name}
                            </p>
                            {doc.expiry_date && (
                              <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                Expires {new Date(doc.expiry_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="font-optima" style={{
                              fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
                              padding: '3px 10px', borderRadius: '999px',
                              backgroundColor: badge.bg, color: badge.text,
                              border: `0.5px solid ${badge.border}`,
                            }}>
                              {cat === 'Boarding Passes' ? 'Boarding' : cat === 'Hotel Confirmations' ? 'Hotel' : cat === 'Entry Tickets' ? 'Ticket' : cat === 'Visas & Travel' ? 'Travel' : 'Doc'}
                            </span>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M2 10L10 2M10 2H4M10 2v6" stroke="#706E56" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        </div>
                      </a>
                    ) : (
                      <div key={doc.id} className="flex items-center gap-4"
                        style={{
                          backgroundColor: 'var(--color-surface-sunken)',
                          border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
                          borderRadius: '10px',
                          padding: '16px 20px',
                        }}
                      >
                        <DocIconSvg category={cat} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="font-optima" style={{
                            fontSize: 'var(--text-body)', color: 'var(--color-text)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {doc.document_name}
                          </p>
                          {doc.expiry_date && (
                            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                              Expires {new Date(doc.expiry_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                        <span className="font-optima" style={{
                          fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
                          padding: '3px 10px', borderRadius: '999px', flexShrink: 0,
                          backgroundColor: 'rgb(var(--borges-rgb) / 0.07)', color: 'var(--color-text-muted)',
                          border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
                        }}>
                          Preparing
                        </span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )
          })}
        </div>

      )}
    </div>
  )
}
