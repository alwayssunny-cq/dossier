'use client'

import type { ParsedBlock } from '@/app/api/sync-content-pages/route'
import { SubSectionOpen } from '@/components/PageSection'
import type { Stay } from '@/lib/types'
import { blockText, splitByH1, flattenColumns } from '@/lib/notionBlocks'
import NotionBlocks from '@/components/NotionBlocks'
import TripOverviewMap from '@/components/TripOverviewMap'

// ── Overview cards (the column_list blocks before the first destination H1) ───

interface OverviewCard {
  date: string | null
  place: string
  duration: string | null
  description: string | null
  image: ParsedBlock | null
}

function parseOverviewCard(columnList: ParsedBlock): OverviewCard | null {
  const flat = flattenColumns(columnList)
  const headings = flat.filter(b => b.type === 'heading').map(h => blockText(h).trim()).filter(Boolean)
  const paragraphs = flat.filter(b => b.type === 'paragraph' && blockText(b).trim())
  const image = flat.find(b => b.type === 'image') ?? null
  if (headings.length < 2) return null

  const [place, duration] = headings[1].split('|').map(s => s.trim())
  return {
    date: headings[0] || null,
    place: place || headings[1],
    duration: duration || null,
    description: paragraphs[0] ? blockText(paragraphs[0]).trim() : null,
    image,
  }
}

function OverviewCardRow({ card }: { card: OverviewCard }) {
  return (
    <div style={{
      display: 'flex', gap: '18px', backgroundColor: 'var(--color-surface-sunken)',
      border: '0.5px solid rgb(var(--borges-rgb) / 0.10)', borderRadius: '12px',
      padding: '18px', marginBottom: '12px', alignItems: 'stretch',
    }}>
      {card.image && (
        <div style={{ width: '110px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden' }}>
          {(() => {
            const src = card.image.imageType === 'file' && card.image.blockId
              ? `/api/notion-image?blockId=${encodeURIComponent(card.image.blockId)}`
              : card.image.url
            return src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={card.place} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : null
          })()}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {card.date && (
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
            {card.date}
          </p>
        )}
        <div className="flex items-baseline gap-2 flex-wrap" style={{ marginBottom: card.description ? '4px' : 0 }}>
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>{card.place}</p>
          {card.duration && (
            <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)' }}>{card.duration}</span>
          )}
        </div>
        {card.description && (
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
            {card.description}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Summary transit legs ────────────────────────────────────────────────────────

interface TransitLeg { from: string; to: string; detail: string | null }

function parseTransitLeg(columnList: ParsedBlock): TransitLeg | null {
  const flat = flattenColumns(columnList)
  const headings = flat.filter(b => b.type === 'heading').map(h => blockText(h).trim()).filter(Boolean)
  const details = flat.filter(b => b.type === 'paragraph').map(p => blockText(p).trim()).filter(Boolean)
  if (headings.length < 2) return null
  return { from: headings[0], to: headings[1], detail: details[0] ?? null }
}

function TransitSummary({ content }: { content: ParsedBlock[] }) {
  const legs = content
    .filter(b => b.type === 'column_list')
    .map(parseTransitLeg)
    .filter((l): l is TransitLeg => !!l)

  if (!legs.length) return <NotionBlocks blocks={content} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {legs.map((leg, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
          padding: '14px 0', borderBottom: i < legs.length - 1 ? '0.5px solid rgb(var(--borges-rgb) / 0.10)' : 'none',
        }}>
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
            {leg.from} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>→</span> {leg.to}
          </p>
          {leg.detail && (
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', flexShrink: 0 }}>{leg.detail}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Where You Stay (supplementary — from the structured stays table, not Notion prose) ──

function matchStays(place: string, stays: Stay[]): Stay[] {
  const pl = place.toLowerCase()
  return stays.filter(s => {
    const dest = (s.destination ?? '').toLowerCase()
    if (!dest) return false
    return dest.includes(pl) || pl.includes(dest) || dest.split(/[,\s]+/).some(w => w.length > 3 && pl.includes(w))
  })
}

// ── Section header ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <SubSectionOpen title={children} />
}

function Divider() {
  return <div style={{ height: '0.5px', backgroundColor: 'rgb(var(--borges-rgb) / 0.10)', margin: '36px 0' }} />
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DatesDestinationsPage({ blocks, stays }: { blocks: ParsedBlock[]; stays: Stay[] }) {
  const { leading, sections } = splitByH1(blocks)

  const overviewCards = leading
    .filter(b => b.type === 'column_list')
    .map(parseOverviewCard)
    .filter((c): c is OverviewCard => !!c)

  const introBlocks = leading.filter(b => b.type !== 'column_list' && b.type !== 'divider')

  const placeNames = new Set(overviewCards.map(c => c.place.toLowerCase()))
  const destinationSections = sections.filter(s => placeNames.has(s.title.toLowerCase()))
  const summarySection = sections.find(s => s.title.toLowerCase() === 'summary')
  const otherSections = sections.filter(s =>
    !placeNames.has(s.title.toLowerCase()) && s.title.toLowerCase() !== 'summary'
  )

  return (
    <div>
      {/* Map */}
      {overviewCards.length >= 2 && (
        <div style={{ marginBottom: '36px', borderRadius: '12px', overflow: 'hidden', border: '0.5px solid rgb(var(--borges-rgb) / 0.12)' }}>
          <TripOverviewMap locations={overviewCards.map(c => c.place)} />
        </div>
      )}

      {/* Intro prose, if any, before the trip overview */}
      {introBlocks.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <NotionBlocks blocks={introBlocks} />
        </div>
      )}

      {/* Overview cards */}
      {overviewCards.length > 0 && (
        <>
          <SectionLabel>Your Journey, At a Glance</SectionLabel>
          <div style={{ marginBottom: '8px' }}>
            {overviewCards.map((card, i) => <OverviewCardRow key={i} card={card} />)}
          </div>
          <Divider />
        </>
      )}

      {/* Per-destination detail */}
      {destinationSections.map((section, i) => {
        const relatedStays = matchStays(section.title, stays)
        return (
          <div key={i} style={{ marginBottom: i < destinationSections.length - 1 ? '36px' : 0 }}>
            <h2 className="cq-t1" style={{ fontSize: 'var(--text-t1)', color: 'var(--color-text)', marginBottom: '18px' }}>
              {section.title}
            </h2>

            {relatedStays.length > 0 && (
              <div style={{
                marginBottom: '20px', padding: '14px 18px', borderRadius: '10px',
                backgroundColor: 'var(--color-surface-sunken)', border: '0.5px solid rgb(var(--borges-rgb) / 0.25)',
              }}>
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                  Where You Stay
                </p>
                {relatedStays.map((stay, si) => (
                  <p key={si} className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>{stay.property_name}</p>
                ))}
              </div>
            )}

            {/* One overview map at the top covers geography — drop per-destination
                map screenshots from the Notion content to keep scroll light */}
            <NotionBlocks blocks={section.content.filter(b => b.type !== 'image')} />
            {i < destinationSections.length - 1 && <Divider />}
          </div>
        )
      })}

      {/* Summary — transit between destinations */}
      {summarySection && (
        <>
          <Divider />
          <SectionLabel>Summary</SectionLabel>
          <TransitSummary content={summarySection.content} />
        </>
      )}

      {/* Anything else — e.g. a closing note — preserved, not dropped */}
      {otherSections.map((section, i) => (
        <div key={i}>
          <Divider />
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.85, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
            <NotionBlocks blocks={section.content} />
          </p>
        </div>
      ))}
    </div>
  )
}
