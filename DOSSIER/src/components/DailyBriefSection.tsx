'use client'

import { useState } from 'react'
import type { DailyBrief } from '@/lib/types'

/**
 * The day's briefing, with the rest of the journey listed beneath it.
 *
 * This used to be a filled card above a two-column grid of bordered boxes,
 * each carrying a folder emoji — none of which belongs to the dossier's
 * vocabulary. It now reads the way the rest of the pages do: the selected
 * briefing set open on the page rather than boxed, and the other days as a
 * plain list separated by hairlines, marked by date.
 *
 * The list stays one column. Two columns forced the eye to zig-zag across a
 * sequence that is inherently linear, and dates read down a column far more
 * easily than across a grid.
 */

function fmtDate(d: string | null): string {
  if (!d) return ''
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return d }
}

function fmtShort(d: string | null): string {
  if (!d) return ''
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  } catch { return d }
}

/** Today's briefing, else the next one coming, else the last written. */
function pickDefaultBrief(briefs: DailyBrief[]): DailyBrief | null {
  if (briefs.length === 0) return null
  const todayStr = new Date().toISOString().slice(0, 10)
  const sorted = [...briefs].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  return (
    sorted.find(b => b.date === todayStr) ??
    sorted.find(b => (b.date ?? '') > todayStr) ??
    sorted[sorted.length - 1]
  )
}

export default function DailyBriefSection({ briefs }: { briefs: DailyBrief[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(pickDefaultBrief(briefs)?.id ?? null)
  const selected = briefs.find(b => b.id === selectedId) ?? null

  if (briefs.length === 0) {
    return (
      <p className="cq-body cq-measure" style={{ margin: 0 }}>
        Your daily briefs will appear here, updated the evening before each day
        of your journey.
      </p>
    )
  }

  const ordered = [...briefs].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))

  return (
    <div>
      {/* The briefing itself. Set open on the page — it is the thing you came
          to read, not a preview that needs a container around it. */}
      {selected && (
        <article
          style={{
            display: 'grid',
            gap: 'var(--space-8)',
            paddingBottom: 'var(--space-10)',
          }}
          className="md:grid-cols-[minmax(0,1fr)_220px]"
        >
          <div>
            <h3 className="cq-t1-sm" style={{ margin: 0, color: 'var(--color-text)' }}>
              {selected.title ?? 'Today'}
            </h3>
            {selected.body && (
              <p
                className="cq-body"
                style={{ marginTop: 'var(--space-5)', marginBottom: 0, whiteSpace: 'pre-line' }}
              >
                {selected.body}
              </p>
            )}
          </div>

          <div className="cq-col-rule">
            <p className="cq-label" style={{ marginBottom: '2px' }}>Briefing for</p>
            <p
              className="font-optima"
              style={{ margin: 0, fontSize: 'var(--text-body)', color: 'var(--color-text)' }}
            >
              {fmtDate(selected.date)}
            </p>
          </div>
        </article>
      )}

      {/* Every other day, as a list rather than a field of boxes. */}
      {ordered.length > 1 && (
        <div style={{ borderTop: '1px solid var(--color-rule-strong)' }}>
          {ordered.map(b => {
            const active = b.id === selectedId
            return (
              <button
                key={b.id}
                onClick={() => setSelectedId(b.id)}
                aria-current={active ? 'true' : undefined}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '5.5rem 1fr',
                  columnGap: 'var(--space-5)',
                  alignItems: 'baseline',
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid var(--color-rule)',
                  padding: 'var(--space-4) 0',
                }}
              >
                <span
                  className="cq-label"
                  style={{
                    fontVariantNumeric: 'tabular-nums',
                    color: active ? 'var(--color-text-accent)' : 'var(--color-text-muted)',
                  }}
                >
                  {fmtShort(b.date)}
                </span>
                <span
                  className="font-optima"
                  style={{
                    fontSize: 'var(--text-body)',
                    lineHeight: 1.5,
                    color: active ? 'var(--color-text)' : 'var(--color-text-secondary)',
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  {b.title ?? 'Untitled'}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
