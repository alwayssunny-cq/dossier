'use client'

import { useState, useMemo } from 'react'
import { SubSectionOpen } from '@/components/PageSection'
import type { ParsedBlock } from '@/app/api/sync-content-pages/route'
import GalleryCard, { collectImages } from '@/components/GalleryCard'

const txt = (b: ParsedBlock): string =>
  (b.richText ?? []).map(r => r.text ?? '').join('') || (b.text ?? '')

interface ExpEntry {
  title: string
  quote: string | null
  description: string[]
  bullets: string[]
  images: ParsedBlock[]
}
interface DayGroup {
  day: string
  experiences: ExpEntry[]
}

/** A day heading reads like "May 9" / "9 May" rather than a range ("9 to 12 May"). */
function isDayHeading(s: string): boolean {
  return !/\bto\b|–|—/.test(s) && /\d/.test(s)
}

function parse(blocks: ParsedBlock[]): { summary: ParsedBlock | null; groups: DayGroup[] } {
  let summary: ParsedBlock | null = null
  const groups: DayGroup[] = []
  let group: DayGroup | null = null
  let entry: ExpEntry | null = null
  let inGlance = false

  const closeEntry = () => { if (group && entry) group.experiences.push(entry); entry = null }

  for (const b of blocks) {
    if (b.type === 'heading' && b.level === 1) {
      const label = txt(b).trim()
      closeEntry()
      if (/at a glance/i.test(label)) { inGlance = true; continue }
      inGlance = false
      if (isDayHeading(label)) {
        if (group) groups.push(group)
        group = { day: label, experiences: [] }
      }
      continue
    }
    if (inGlance && b.type === 'table' && !summary) { summary = b; continue }
    if (b.type === 'heading' && b.level === 2) {
      closeEntry()
      entry = { title: txt(b).trim(), quote: null, description: [], bullets: [], images: [] }
      continue
    }
    if (!entry) continue
    if (b.type === 'quote') {
      const t = txt(b).trim()
      if (t) entry.quote = t
    } else if (b.type === 'paragraph') {
      const t = txt(b).trim()
      if (t) entry.description.push(t)
    } else if (b.type === 'bullet' || b.type === 'bulleted_list_item') {
      const t = txt(b).trim()
      if (t) entry.bullets.push(t)
    } else if (b.type === 'image') {
      entry.images.push(b)
    } else if (b.type === 'column_list' || b.type === 'column') {
      entry.images.push(...collectImages([b]))
    }
  }
  closeEntry()
  if (group) groups.push(group)
  return { summary, groups: groups.filter(g => g.experiences.length > 0) }
}

function SummaryTable({ table }: { table: ParsedBlock }) {
  const rows = table.rows ?? []
  if (rows.length === 0) return null
  const [head, ...body] = rows
  return (
    <div style={{
      backgroundColor: 'var(--color-surface-sunken)', border: '0.5px solid rgb(var(--borges-rgb) / 0.12)',
      borderRadius: '12px', overflow: 'hidden', marginBottom: 'var(--pad-40)',
      boxShadow: '0 2px 4px rgb(var(--night-rgb) / 0.05), 0 12px 32px rgb(var(--night-rgb) / 0.09)',
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              {head.map((cell, i) => (
                <th key={i} className="font-optima" style={{
                  fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', textAlign: 'left',
                  padding: '14px 20px', borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.14)', whiteSpace: 'nowrap',
                }}>
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className={ci === 0 ? 'cq-subhead' : 'font-optima'} style={{
                    fontSize: ci === 0 ? '14px' : '12.5px',
                    color: ci === 0 ? 'var(--color-text)' : 'var(--color-text-accent)',
                    padding: '13px 20px', lineHeight: 1.6, verticalAlign: 'top',
                    borderBottom: ri < body.length - 1 ? '0.5px solid rgb(var(--borges-rgb) / 0.08)' : 'none',
                  }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ExperiencesGallery({ blocks }: { blocks: ParsedBlock[] }) {
  const { summary, groups } = useMemo(() => parse(blocks), [blocks])
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups
      .map(g => ({ ...g, experiences: g.experiences.filter(e =>
        e.title.toLowerCase().includes(q) ||
        g.day.toLowerCase().includes(q) ||
        e.description.some(d => d.toLowerCase().includes(q))
      ) }))
      .filter(g => g.experiences.length > 0)
  }, [groups, query])

  const total = groups.reduce((n, g) => n + g.experiences.length, 0)

  return (
    <div>
      {/* At a glance — the summary, kept up top */}
      {summary && (
        <>
          <SubSectionOpen title="At a Glance" />
          <SummaryTable table={summary} />
        </>
      )}

      {groups.length > 0 && (
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
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`Search ${total} experience${total === 1 ? '' : 's'}`}
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
      )}

      {filtered.length === 0 && query ? (
        <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
          Nothing matches &ldquo;{query}&rdquo;.
        </p>
      ) : (
        filtered.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 'var(--pad-48)' }}>
            <SubSectionOpen title={group.day} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {group.experiences.map((exp, ei) => (
                <GalleryCard
                  key={ei}
                  title={exp.title}
                  meta={[group.day, exp.quote]}
                  description={exp.description}
                  bullets={exp.bullets}
                  images={exp.images}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
