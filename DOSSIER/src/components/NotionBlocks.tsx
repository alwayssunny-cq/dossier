'use client'

import type { ParsedBlock } from '@/app/api/sync-content-pages/route'
import { blockText, flattenColumns, isGalleryColumnList } from '@/lib/notionBlocks'
import NotionImageBlock from '@/components/NotionImageBlock'

// ── Rich text ─────────────────────────────────────────────────────────────────

function RichText({ items }: { items: NonNullable<ParsedBlock['richText']> }) {
  return (
    <>
      {items.map((it, i) => {
        let node: React.ReactNode = it.text
        if (it.code) node = <code key={i} style={{ backgroundColor: 'rgb(var(--borges-rgb) / 0.10)', padding: '1px 5px', borderRadius: '4px', fontSize: 'var(--text-code)' }}>{node}</code>
        if (it.bold) node = <strong key={i}>{node}</strong>
        if (it.italic) node = <em key={i}>{node}</em>
        if (it.underline) node = <span key={i} style={{ textDecoration: 'underline' }}>{node}</span>
        if (it.strikethrough) node = <span key={i} style={{ textDecoration: 'line-through' }}>{node}</span>
        if (it.href) node = <a key={i} href={it.href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-text-accent)', textDecoration: 'underline' }}>{node}</a>
        return <span key={i}>{node}</span>
      })}
    </>
  )
}

// ── Image gallery (for column_lists that are all images) ──────────────────────

function ImageGallery({ blocks }: { blocks: ParsedBlock[] }) {
  const images = blocks.filter(b => b.type === 'image')
  const callout = blocks.find(b => b.type === 'callout')
  if (!images.length) return null

  return (
    <div style={{ margin: '20px 0' }}>
      <div
        className="flex gap-3"
        style={{ overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none', paddingBottom: '2px' }}
      >
        {images.map((img, i) => {
          const src = img.imageType === 'file' && img.blockId
            ? `/api/notion-image?blockId=${encodeURIComponent(img.blockId)}`
            : img.url
          if (!src) return null
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={img.caption || ''}
              style={{
                flexShrink: 0, scrollSnapAlign: 'start',
                width: images.length === 1 ? '100%' : '78%', maxWidth: '420px',
                aspectRatio: '4 / 3', objectFit: 'cover',
                borderRadius: '10px', border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
              }}
            />
          )
        })}
      </div>
      {callout && (
        <div style={{
          display: 'flex', gap: '10px', padding: '12px 14px', borderRadius: '8px', marginTop: '12px',
          backgroundColor: 'rgb(var(--borges-rgb) / 0.06)', border: '0.5px solid rgb(var(--borges-rgb) / 0.16)',
        }}>
          {callout.emoji && <span style={{ flexShrink: 0, fontSize: 'var(--text-body)' }}>{callout.emoji}</span>}
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', lineHeight: 1.65, color: 'var(--color-text-secondary)', margin: 0 }}>
            {callout.richText?.length ? <RichText items={callout.richText} /> : callout.text}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Main recursive renderer ─────────────────────────────────────────────────────
// Handles every ParsedBlock type produced by /api/sync-content-pages — including
// column_list, which most of the app previously dropped silently.

export default function NotionBlocks({ blocks }: { blocks: ParsedBlock[] }) {
  const rendered: React.ReactNode[] = []
  let bulletBuf: ParsedBlock[] = []
  let numberedBuf: ParsedBlock[] = []

  function flushBullets() {
    if (!bulletBuf.length) return
    rendered.push(
      <ul key={`bul-${rendered.length}`} style={{ paddingLeft: '18px', margin: '0 0 14px', listStyle: 'disc' }}>
        {bulletBuf.map((b, i) => (
          <li key={i} style={{ fontSize: 'var(--text-body)', lineHeight: 1.75, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
            {b.richText?.length ? <RichText items={b.richText} /> : b.text}
          </li>
        ))}
      </ul>
    )
    bulletBuf = []
  }

  function flushNumbered() {
    if (!numberedBuf.length) return
    rendered.push(
      <ol key={`num-${rendered.length}`} style={{ paddingLeft: '18px', margin: '0 0 14px' }}>
        {numberedBuf.map((b, i) => (
          <li key={i} style={{ fontSize: 'var(--text-body)', lineHeight: 1.75, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
            {b.richText?.length ? <RichText items={b.richText} /> : b.text}
          </li>
        ))}
      </ol>
    )
    numberedBuf = []
  }

  blocks.forEach((b, i) => {
    if (b.type === 'bullet') { flushNumbered(); bulletBuf.push(b); return }
    if (b.type === 'numbered') { flushBullets(); numberedBuf.push(b); return }
    flushBullets(); flushNumbered()

    if (b.type === 'paragraph') {
      const items = b.richText ?? []
      if (!blockText(b).trim() && !items.length) { rendered.push(<div key={i} style={{ height: '8px' }} />); return }
      rendered.push(
        <p key={i} className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.8, color: 'var(--color-text-secondary)', margin: '0 0 14px' }}>
          {items.length ? <RichText items={items} /> : b.text}
        </p>
      )
    } else if (b.type === 'heading') {
      const items = b.richText ?? []
      const sizes: Record<number, string> = { 1: '22px', 2: '18px', 3: '15px' }
      rendered.push(
        <div key={i} className="font-optima" style={{ fontSize: sizes[b.level ?? 2] ?? '18px', color: 'var(--color-text)', margin: '22px 0 10px', lineHeight: 1.25 }}>
          {items.length ? <RichText items={items} /> : b.text}
        </div>
      )
    } else if (b.type === 'callout') {
      const items = b.richText ?? []
      rendered.push(
        <div key={i} style={{ display: 'flex', gap: '12px', padding: '14px 16px', borderRadius: '8px', margin: '12px 0', backgroundColor: 'rgb(var(--borges-rgb) / 0.07)', border: '0.5px solid rgb(var(--borges-rgb) / 0.2)' }}>
          {b.emoji && <span style={{ flexShrink: 0, fontSize: 'var(--text-body)', lineHeight: 1.5 }}>{b.emoji}</span>}
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', lineHeight: 1.75, color: 'var(--color-text-secondary)', margin: 0 }}>
            {items.length ? <RichText items={items} /> : b.text}
          </p>
        </div>
      )
    } else if (b.type === 'quote') {
      const items = b.richText ?? []
      rendered.push(
        <blockquote key={i} className="font-optima" style={{ borderLeft: '2px solid rgb(var(--borges-rgb) / 0.4)', paddingLeft: '16px', margin: '16px 0', fontSize: 'var(--text-body)', lineHeight: 1.75, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
          {items.length ? <RichText items={items} /> : b.text}
        </blockquote>
      )
    } else if (b.type === 'divider') {
      rendered.push(<div key={i} style={{ height: '0.5px', backgroundColor: 'rgb(var(--borges-rgb) / 0.14)', margin: '20px 0' }} />)
    } else if (b.type === 'image') {
      rendered.push(<NotionImageBlock key={i} block={b} />)
    } else if (b.type === 'table' && b.rows?.length) {
      rendered.push(
        <div key={i} style={{ overflowX: 'auto', margin: '16px 0' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {b.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="font-optima" style={{ border: '0.5px solid rgb(var(--borges-rgb) / 0.15)', padding: '8px 12px', fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)' }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    } else if (b.type === 'todo') {
      rendered.push(
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', margin: '0 0 8px' }}>
          <div style={{
            width: '14px', height: '14px', flexShrink: 0, marginTop: '2px', borderRadius: '3px',
            border: '1px solid rgb(var(--borges-rgb) / 0.4)',
            backgroundColor: b.checked ? 'var(--color-text-accent)' : 'transparent',
          }} />
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: b.checked ? 'var(--color-text-muted)' : 'var(--color-text-secondary)', textDecoration: b.checked ? 'line-through' : 'none', margin: 0 }}>
            {b.richText?.length ? <RichText items={b.richText} /> : b.text}
          </p>
        </div>
      )
    } else if (b.type === 'code') {
      rendered.push(
        <pre key={i} style={{ backgroundColor: 'var(--color-text)', color: 'var(--color-text-inverse)', padding: '14px 16px', borderRadius: '8px', margin: '14px 0', overflowX: 'auto', fontSize: 'var(--text-caption)', lineHeight: 1.6 }}>
          <code>{b.text}</code>
        </pre>
      )
    } else if (b.type === 'column_list') {
      if (isGalleryColumnList(b)) {
        rendered.push(<ImageGallery key={i} blocks={flattenColumns(b)} />)
      } else {
        // Not a clean gallery — render each column's content in sequence, faithfully, nothing dropped.
        rendered.push(
          <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', margin: '8px 0' }}>
            {(b.children ?? []).map((col, ci) => (
              <div key={ci} style={{ flex: '1 1 240px', minWidth: 0 }}>
                <NotionBlocks blocks={col.children ?? []} />
              </div>
            ))}
          </div>
        )
      }
    } else if (b.type === 'toggle') {
      rendered.push(
        <details key={i} style={{ margin: '10px 0', border: '0.5px solid rgb(var(--borges-rgb) / 0.14)', borderRadius: '8px', padding: '10px 14px' }}>
          <summary className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-accent)', cursor: 'pointer' }}>
            {b.richText?.length ? <RichText items={b.richText} /> : (b.text || 'Archive')}
          </summary>
          <div style={{ marginTop: '12px' }}>
            <NotionBlocks blocks={b.children ?? []} />
          </div>
        </details>
      )
    }
    // Unknown block types are simply invisible in Notion's own export too (e.g. synced_block,
    // child_page) — nothing meaningful to render, and none appear in this app's parser output.
  })

  flushBullets()
  flushNumbered()
  return <>{rendered}</>
}
