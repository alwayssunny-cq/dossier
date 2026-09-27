'use client'

import type { ParsedBlock } from '@/app/api/sync-content-pages/route'
import { blockText, splitByH1 } from '@/lib/notionBlocks'
import NotionBlocks from '@/components/NotionBlocks'

// ── Split each date-range section into per-property options (H2s) ─────────────
// A short, content-less H2 right before another H2 (e.g. "Alternatively,") reads
// as a kicker label for the option that follows it, not an empty option of its own.

interface StayOption { title: string; kicker?: string; content: ParsedBlock[] }

function splitByH2(blocks: ParsedBlock[]): { leading: ParsedBlock[]; options: StayOption[] } {
  const leading: ParsedBlock[] = []
  const raw: { title: string; content: ParsedBlock[] }[] = []
  let current: { title: string; content: ParsedBlock[] } | null = null

  for (const b of blocks) {
    if (b.type === 'heading' && b.level === 2) {
      current = { title: blockText(b).trim(), content: [] }
      raw.push(current)
    } else if (current) {
      current.content.push(b)
    } else {
      leading.push(b)
    }
  }

  const isMeaningless = (b: ParsedBlock) => b.type === 'divider' || (b.type === 'paragraph' && !blockText(b).trim())

  const options: StayOption[] = []
  let pendingKicker: string | undefined
  for (const opt of raw) {
    if (opt.content.every(isMeaningless) && opt.title) { pendingKicker = opt.title; continue }
    options.push({ ...opt, kicker: pendingKicker })
    pendingKicker = undefined
  }
  return { leading, options }
}

function StayOption({ option, isPrimary }: { option: StayOption; isPrimary: boolean }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      {option.kicker && (
        <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
          {option.kicker}
        </p>
      )}
      <p className="font-optima" style={{ fontSize: isPrimary ? '20px' : '16px', color: 'var(--color-text)', marginBottom: '12px' }}>
        {option.title}
      </p>
      <NotionBlocks blocks={option.content} />
    </div>
  )
}

export default function StayPage({ blocks }: { blocks: ParsedBlock[] }) {
  const { sections } = splitByH1(blocks) // H1 = date range per stay

  if (!sections.length) return <NotionBlocks blocks={blocks} />

  return (
    <div>
      {sections.map((section, i) => {
        const { leading, options } = splitByH2(section.content)
        return (
          <div key={i} style={{ marginBottom: i < sections.length - 1 ? '40px' : 0 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '18px' }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
                <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="#706E56" strokeWidth="1.2"/>
                <path d="M2 6.5h12M5 2v2.5M11 2v2.5" stroke="#706E56" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)' }}>
                {section.title}
              </p>
            </div>

            {leading.length > 0 && <div style={{ marginBottom: '18px' }}><NotionBlocks blocks={leading} /></div>}

            {options.map((opt, oi) => (
              <StayOption key={oi} option={opt} isPrimary={oi === 0} />
            ))}

            {i < sections.length - 1 && (
              <div style={{ height: '0.5px', backgroundColor: 'rgb(var(--borges-rgb) / 0.10)', marginTop: '10px' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
