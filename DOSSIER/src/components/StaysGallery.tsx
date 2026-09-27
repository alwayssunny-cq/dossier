'use client'

import { useState, useMemo } from 'react'
import { SubSectionOpen } from '@/components/PageSection'
import type { ParsedBlock } from '@/app/api/sync-content-pages/route'
import type { Stay } from '@/lib/types'
import GalleryCard, { collectImages } from '@/components/GalleryCard'

const txt = (b: ParsedBlock): string =>
  (b.richText ?? []).map(r => r.text ?? '').join('') || (b.text ?? '')

interface StayEntry {
  name: string
  description: string[]
  images: ParsedBlock[]
  alternative: boolean
}
interface DateGroup {
  dates: string
  stays: StayEntry[]
}

/** Notion stay pages read: H1 date range → H2 property → prose → hero image → gallery columns. */
function parseGroups(blocks: ParsedBlock[]): DateGroup[] {
  const groups: DateGroup[] = []
  let group: DateGroup | null = null
  let entry: StayEntry | null = null
  let altFlag = false

  const closeEntry = () => { if (group && entry) group.stays.push(entry); entry = null }

  for (const b of blocks) {
    if (b.type === 'heading' && b.level === 1) {
      closeEntry()
      if (group) groups.push(group)
      group = { dates: txt(b).trim(), stays: [] }
      altFlag = false
      continue
    }
    if (b.type === 'heading' && b.level === 2) {
      const label = txt(b).trim()
      // "Alternatively," is a separator, not a property
      if (/^alternativ/i.test(label)) { closeEntry(); altFlag = true; continue }
      closeEntry()
      entry = { name: label, description: [], images: [], alternative: altFlag }
      continue
    }
    if (!entry) continue
    if (b.type === 'paragraph') {
      const t = txt(b).trim()
      if (t) entry.description.push(t)
    } else if (b.type === 'image') {
      entry.images.push(b)
    } else if (b.type === 'column_list' || b.type === 'column') {
      entry.images.push(...collectImages([b]))
    }
  }
  closeEntry()
  if (group) groups.push(group)
  return groups.filter(g => g.stays.length > 0)
}

/** Loose match between a Notion heading and a CQ Stays property name. */
function matchStay(name: string, stays: Stay[]): Stay | null {
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const target = norm(name)
  if (!target) return null
  return stays.find(s => {
    const p = norm(s.property_name)
    return p === target || p.includes(target) || target.includes(p)
  }) ?? null
}

function fmtDay(d: string | null): string | null {
  if (!d) return null
  try {
    return new Date(d + (d.length === 10 ? 'T00:00:00' : ''))
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
  } catch { return null }
}

export default function StaysGallery({ blocks, stays = [] }: { blocks: ParsedBlock[]; stays?: Stay[] }) {
  const groups = useMemo(() => parseGroups(blocks), [blocks])
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups
      .map(g => ({ ...g, stays: g.stays.filter(s =>
        s.name.toLowerCase().includes(q) ||
        g.dates.toLowerCase().includes(q) ||
        s.description.some(d => d.toLowerCase().includes(q))
      ) }))
      .filter(g => g.stays.length > 0)
  }, [groups, query])

  const total = groups.reduce((n, g) => n + g.stays.length, 0)

  if (groups.length === 0) return null

  return (
    <div>
      {/* Search */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          backgroundColor: 'var(--color-surface-sunken)', border: '0.5px solid rgb(var(--borges-rgb) / 0.16)',
          borderRadius: '999px', padding: '10px 18px', maxWidth: '380px',
        }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
            <circle cx="6" cy="6" r="4.5" stroke="#706E56" strokeWidth="1.3"/>
            <path d="M9.5 9.5L13 13" stroke="#706E56" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <input
            aria-label="Search accommodations"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${total} accommodation${total === 1 ? '' : 's'}`}
            className="font-optima"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 'var(--text-caption)', color: 'var(--color-text)',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 0 }}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
          Nothing matches &ldquo;{query}&rdquo;.
        </p>
      ) : (
        filtered.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 'var(--pad-48)' }}>
            {/* Date rule */}
            <SubSectionOpen title={group.dates} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {group.stays.map((stay, si) => (
                <div key={si}>
                  {stay.alternative && (
                    <p className="font-optima" style={{
                      fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '10px',
                    }}>
                      Alternatively
                    </p>
                  )}
                  {(() => {
                    // The Notion page carries the room photography; the CQ Stays
                    // record carries the facts. Merge them so a card shows both.
                    const rec = matchStay(stay.name, stays)
                    const inD = fmtDay(rec?.check_in ?? null)
                    const outD = fmtDay(rec?.check_out ?? null)
                    // Collapse a shared month: "9 – 10 May", not "9 May – 10 May"
                    const recDates = inD && outD
                      ? (inD.split(' ')[1] === outD.split(' ')[1]
                          ? `${inD.split(' ')[0]} – ${outD}`
                          : `${inD} – ${outD}`)
                      : (inD ?? null)
                    const nights = rec?.nights != null
                      ? `${rec.nights} night${rec.nights === 1 ? '' : 's'}`
                      : null
                    const mealList = (rec?.meals ?? '').split(',').map(m => m.trim()).filter(Boolean)
                    // The group heading already states the range; only repeat the
                    // record's own dates when they say something different.
                    const loose = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '')
                    const datelineDates =
                      recDates && loose(recDates) !== loose(group.dates) ? recDates : null
                    return (
                      <GalleryCard
                        title={stay.name}
                        dateline={[
                          datelineDates,
                          rec?.destination ?? null,
                          nights,
                        ]}
                        meta={[
                          [rec?.room_type, rec?.bed_type].filter(Boolean).join('  ·  ') || null,
                          mealList.join(', ') || null,
                        ]}
                        description={
                          stay.description.length > 0
                            ? stay.description
                            : (rec?.description ? [rec.description] : [])
                        }
                        images={stay.images}
                      />
                    )
                  })()}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
