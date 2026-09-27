'use client'

import type { ParsedBlock } from '@/app/api/sync-content-pages/route'
import { blockText, splitByH1, flattenColumns } from '@/lib/notionBlocks'
import NotionBlocks from '@/components/NotionBlocks'

// ── Group vs. day classification ────────────────────────────────────────────
// A "group" header (e.g. "9 to 12 May", a stay period, or a standalone transit
// day) opens with a column_list containing a Transfer/Transit callout and
// little else. Everything else is a "day" full of one or more experiences.

function isTransferCallout(b: ParsedBlock): boolean {
  const t = blockText(b).toLowerCase()
  return b.type === 'callout' && (t.includes('transfer') || t.includes('transit'))
}

function findGroupInfo(content: ParsedBlock[]): { transfer: ParsedBlock | null; description: string | null } | null {
  const cl = content.find(b => b.type === 'column_list')
  if (!cl) return null
  const flat = flattenColumns(cl)
  const transfer = flat.find(isTransferCallout) ?? null
  const description = flat.find(b => b !== transfer && (b.type === 'paragraph' || b.type === 'callout') && blockText(b).trim())
  // A "group" header has essentially nothing but this one column_list (plus dividers) as its content.
  const isGroup = content.every(b => b === cl || b.type === 'divider')
  if (!isGroup) return null
  return { transfer, description: description ? blockText(description).trim() : null }
}

// ── Split a day's content into experience units, heading by heading ───────────
// Headings can appear at the top level or nested inside a column_list (mixed
// with that column_list's own images/text) — both are treated as unit boundaries.

interface ExperienceUnit { title: string | null; blocks: ParsedBlock[] }

function explodeHeadedColumns(content: ParsedBlock[]): ParsedBlock[] {
  const out: ParsedBlock[] = []
  for (const b of content) {
    if (b.type === 'column_list' && flattenColumns(b).some(c => c.type === 'heading')) {
      out.push(...flattenColumns(b))
    } else {
      out.push(b)
    }
  }
  return out
}

function splitExperiences(content: ParsedBlock[]): ExperienceUnit[] {
  const flat = explodeHeadedColumns(content)
  const leadingBlocks: ParsedBlock[] = []
  const units: ExperienceUnit[] = []
  let current: ExperienceUnit | null = null

  for (const b of flat) {
    if (b.type === 'heading') {
      current = { title: blockText(b).trim(), blocks: [] }
      units.push(current)
    } else if (current) {
      current.blocks.push(b)
    } else if (b.type !== 'divider') {
      leadingBlocks.push(b)
    }
  }

  if (leadingBlocks.length) units.unshift({ title: null, blocks: leadingBlocks })
  return units
}

// ── UI ────────────────────────────────────────────────────────────────────────

function GroupCard({ title, description, transfer }: { title: string; description: string | null; transfer: ParsedBlock | null }) {
  const transferText = transfer ? blockText(transfer).replace(/^Transfer\s*/i, '').replace(/^Transit\s*/i, '').trim() : null
  return (
    <div style={{
      backgroundColor: 'var(--color-surface-sunken)', border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
      borderRadius: '12px', padding: '20px 22px', marginBottom: '28px',
    }}>
      <div className="flex items-center gap-2" style={{ marginBottom: description || transferText ? '16px' : 0 }}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
          <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="#706E56" strokeWidth="1.2"/>
          <path d="M2 6.5h12M5 2v2.5M11 2v2.5" stroke="#706E56" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>{title}</p>
      </div>
      {(description || transferText) && (
        <div className="flex gap-3 flex-wrap">
          {description && (
            <div style={{ flex: '1 1 200px', backgroundColor: 'var(--color-surface)', border: '0.5px solid rgb(var(--borges-rgb) / 0.10)', borderRadius: '8px', padding: '12px 14px' }}>
              <p className="font-optima" style={{ fontSize: 'var(--text-caption)', lineHeight: 1.6, color: 'var(--color-text-secondary)', margin: 0 }}>{description}</p>
            </div>
          )}
          {transferText && (
            <div style={{ flex: '1 1 200px', backgroundColor: 'var(--color-surface)', border: '0.5px solid rgb(var(--borges-rgb) / 0.10)', borderRadius: '8px', padding: '12px 14px' }}>
              <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Transfer</p>
              <p className="font-optima" style={{ fontSize: 'var(--text-caption)', lineHeight: 1.6, color: 'var(--color-text-secondary)', margin: 0, whiteSpace: 'pre-line' }}>{transferText}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ExperienceCard({ date, unit }: { date: string; unit: ExperienceUnit }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
        {date}
      </p>
      {unit.title && (
        <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', marginBottom: '12px' }}>{unit.title}</p>
      )}
      <NotionBlocks blocks={unit.blocks} />
    </div>
  )
}

export default function ExperiencesPage({ blocks }: { blocks: ParsedBlock[] }) {
  const { leading, sections } = splitByH1(blocks)

  return (
    <div>
      {/* Archive (Notion toggle blocks) and any other lead-in content, if present */}
      {leading.some(b => b.type === 'toggle' || (b.type !== 'divider')) && (
        <div style={{ marginBottom: '28px' }}>
          <NotionBlocks blocks={leading} />
        </div>
      )}

      {sections.map((section, i) => {
        const groupInfo = findGroupInfo(section.content)
        if (groupInfo) {
          return <GroupCard key={i} title={section.title} description={groupInfo.description} transfer={groupInfo.transfer} />
        }

        const units = splitExperiences(section.content)
        if (units.length === 0) {
          // A day with no detected experience — still show the date, nothing lost.
          return (
            <div key={i} style={{ marginBottom: '28px' }}>
              <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                {section.title}
              </p>
              <NotionBlocks blocks={section.content} />
            </div>
          )
        }
        return units.map((unit, ui) => (
          <ExperienceCard key={`${i}-${ui}`} date={section.title} unit={unit} />
        ))
      })}
    </div>
  )
}
