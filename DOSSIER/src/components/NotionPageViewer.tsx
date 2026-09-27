import type { BlockWithChildren, RichTextItemResponse } from '@/lib/notionFetch'

// ── Rich text renderer ────────────────────────────────────────────────────────

function richText(items: RichTextItemResponse[]): React.ReactNode {
  return items.map((item, i) => {
    const text = item.plain_text
    const ann  = item.annotations
    let node: React.ReactNode = text

    if (ann.code)          node = <code key={i} style={{ fontFamily: 'monospace', fontSize: 'var(--text-code)', backgroundColor: 'rgb(var(--borges-rgb) / 0.14)', padding: '1px 5px', borderRadius: '4px' }}>{node}</code>
    if (ann.bold)          node = <strong key={i} style={{ }}>{node}</strong>
    if (ann.italic)        node = <em key={i}>{node}</em>
    if (ann.strikethrough) node = <del key={i}>{node}</del>
    if (ann.underline)     node = <u key={i}>{node}</u>

    if (item.href) {
      node = (
        <a key={i} href={item.href} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--color-text-accent)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
          {node}
        </a>
      )
    }

    return <span key={i}>{node}</span>
  })
}

// ── Individual block types ────────────────────────────────────────────────────

function Paragraph({ block }: { block: BlockWithChildren }) {
  const items = block.paragraph?.rich_text ?? []
  if (!items.length) return <div style={{ height: '14px' }} />
  return (
    <p style={{ fontSize: 'var(--text-body)', lineHeight: 1.75, color: 'var(--color-text-secondary)', margin: '0 0 14px' }}>
      {richText(items)}
    </p>
  )
}

function Heading({ block, level }: { block: BlockWithChildren; level: 1 | 2 | 3 }) {
  const key  = `heading_${level}` as 'heading_1' | 'heading_2' | 'heading_3'
  const items = block[key]?.rich_text ?? []
  const sizes: Record<number, string> = { 1: '28px', 2: '22px', 3: '17px' }
  const margins: Record<number, string> = { 1: '40px 0 16px', 2: '32px 0 12px', 3: '24px 0 8px' }
  return (
    <div className="font-optima" style={{ fontSize: sizes[level], lineHeight: 1.2, color: 'var(--color-text)', margin: margins[level], fontWeight: level === 3 ? 500 : 400 }}>
      {richText(items)}
    </div>
  )
}

function BulletedList({ block }: { block: BlockWithChildren }) {
  const items = block.bulleted_list_item?.rich_text ?? []
  return (
    <li style={{ fontSize: 'var(--text-body)', lineHeight: 1.75, color: 'var(--color-text-secondary)', marginBottom: '6px', paddingLeft: '4px' }}>
      {richText(items)}
      {block.children?.length > 0 && (
        <ul style={{ margin: '6px 0 0', paddingLeft: '20px', listStyle: 'disc' }}>
          {block.children.map(c => <BulletedList key={c.id} block={c} />)}
        </ul>
      )}
    </li>
  )
}

function NumberedList({ block, index }: { block: BlockWithChildren; index: number }) {
  const items = block.numbered_list_item?.rich_text ?? []
  return (
    <li value={index} style={{ fontSize: 'var(--text-body)', lineHeight: 1.75, color: 'var(--color-text-secondary)', marginBottom: '6px', paddingLeft: '4px' }}>
      {richText(items)}
      {block.children?.length > 0 && (
        <ol style={{ margin: '6px 0 0', paddingLeft: '20px' }}>
          {block.children.map((c, i) => <NumberedList key={c.id} block={c} index={i + 1} />)}
        </ol>
      )}
    </li>
  )
}

function Quote({ block }: { block: BlockWithChildren }) {
  const items = block.quote?.rich_text ?? []
  return (
    <blockquote style={{
      borderLeft: '2px solid var(--color-text-accent)', paddingLeft: '20px', margin: '20px 0',
      fontSize: 'var(--text-body)', lineHeight: 1.75, color: 'var(--color-text-secondary)', fontStyle: 'italic',
    }}>
      {richText(items)}
    </blockquote>
  )
}

function Callout({ block }: { block: BlockWithChildren }) {
  const items = block.callout?.rich_text ?? []
  const emoji = block.callout?.icon?.emoji ?? '💡'
  return (
    <div style={{
      display: 'flex', gap: '14px', padding: '16px 18px', borderRadius: '8px', margin: '20px 0',
      backgroundColor: 'rgb(var(--borges-rgb) / 0.08)', border: '0.5px solid rgb(var(--borges-rgb) / 0.2)',
    }}>
      <span style={{ flexShrink: 0, fontSize: 'var(--text-subhead)' }}>{emoji}</span>
      <p style={{ fontSize: 'var(--text-body)', lineHeight: 1.7, color: 'var(--color-text-secondary)', margin: 0 }}>
        {richText(items)}
      </p>
    </div>
  )
}

function Divider() {
  return (
    <div style={{ margin: '28px 0', display: 'flex', justifyContent: 'center' }}>
      <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', letterSpacing: '6px' }}>· · ·</span>
    </div>
  )
}

function ImageBlock({ block }: { block: BlockWithChildren }) {
  const img   = block.image
  const url   = img?.type === 'external' ? img.external.url : img?.file?.url ?? null
  const caption = (img?.caption ?? []) as RichTextItemResponse[]
  if (!url) return null
  return (
    <figure style={{ margin: '24px 0' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={caption.map((c: RichTextItemResponse) => c.plain_text).join('') || 'Image'}
        style={{ width: '100%', borderRadius: '8px', display: 'block', border: '0.5px solid rgb(var(--borges-rgb) / 0.14)' }} />
      {caption.length > 0 && (
        <figcaption className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', marginTop: '8px', textAlign: 'center' }}>
          {richText(caption)}
        </figcaption>
      )}
    </figure>
  )
}

function ToDo({ block }: { block: BlockWithChildren }) {
  const items   = block.to_do?.rich_text ?? []
  const checked = block.to_do?.checked ?? false
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}>
      <div style={{
        width: '16px', height: '16px', flexShrink: 0, marginTop: '3px',
        borderRadius: '4px', border: `1.5px solid ${checked ? 'var(--color-text-accent)' : 'rgb(var(--borges-rgb) / 0.25)'}`,
        backgroundColor: checked ? 'rgb(var(--borges-rgb) / 0.15)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5l2.5 2.5L8 1" stroke="#706E56" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
      <p style={{ fontSize: 'var(--text-body)', lineHeight: 1.7, color: checked ? 'var(--color-text-muted)' : 'var(--color-text-secondary)', margin: 0,
        textDecoration: checked ? 'line-through' : 'none' }}>
        {richText(items)}
      </p>
    </div>
  )
}

function Code({ block }: { block: BlockWithChildren }) {
  const items = block.code?.rich_text ?? []
  return (
    <pre style={{
      backgroundColor: 'rgb(var(--borges-rgb) / 0.07)', border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
      borderRadius: '8px', padding: '16px 18px', margin: '20px 0', overflowX: 'auto',
      fontSize: 'var(--text-caption)', lineHeight: 1.6, color: 'var(--color-text-secondary)', fontFamily: 'monospace',
    }}>
      <code>{items.map((i: { plain_text: string }) => i.plain_text).join('')}</code>
    </pre>
  )
}

function Table({ block }: { block: BlockWithChildren }) {
  const rows = block.children ?? []
  return (
    <div style={{ overflowX: 'auto', margin: '20px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-body)' }}>
        <tbody>
          {rows.map((row, ri) => {
            const cells = row.table_row?.cells ?? []
            return (
              <tr key={row.id} style={{ borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.14)' }}>
                {cells.map((cell: RichTextItemResponse[], ci: number) => (
                  <td key={ci} style={{
                    padding: '10px 14px', color: ri === 0 ? 'var(--color-text)' : 'var(--color-text-accent)',
                    fontWeight: ri === 0 ? 500 : 400,
                    backgroundColor: ri === 0 ? 'rgb(var(--borges-rgb) / 0.07)' : 'transparent',
                  }}>
                    {richText(cell)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Block group renderer (collapses consecutive list items) ───────────────────

function BlockRenderer({ blocks }: { blocks: BlockWithChildren[] }) {
  const out: React.ReactNode[] = []
  let i = 0

  while (i < blocks.length) {
    const b = blocks[i]

    if (b.type === 'bulleted_list_item') {
      const group: BlockWithChildren[] = []
      while (i < blocks.length && blocks[i].type === 'bulleted_list_item') {
        group.push(blocks[i++])
      }
      out.push(
        <ul key={`ul-${i}`} style={{ paddingLeft: '20px', margin: '0 0 14px', listStyle: 'disc' }}>
          {group.map(b => <BulletedList key={b.id} block={b} />)}
        </ul>
      )
      continue
    }

    if (b.type === 'numbered_list_item') {
      const group: BlockWithChildren[] = []
      while (i < blocks.length && blocks[i].type === 'numbered_list_item') {
        group.push(blocks[i++])
      }
      out.push(
        <ol key={`ol-${i}`} style={{ paddingLeft: '24px', margin: '0 0 14px' }}>
          {group.map((b, idx) => <NumberedList key={b.id} block={b} index={idx + 1} />)}
        </ol>
      )
      continue
    }

    switch (b.type) {
      case 'paragraph':        out.push(<Paragraph key={b.id} block={b} />); break
      case 'heading_1':        out.push(<Heading key={b.id} block={b} level={1} />); break
      case 'heading_2':        out.push(<Heading key={b.id} block={b} level={2} />); break
      case 'heading_3':        out.push(<Heading key={b.id} block={b} level={3} />); break
      case 'quote':            out.push(<Quote key={b.id} block={b} />); break
      case 'callout':          out.push(<Callout key={b.id} block={b} />); break
      case 'divider':          out.push(<Divider key={b.id} />); break
      case 'image':            out.push(<ImageBlock key={b.id} block={b} />); break
      case 'to_do':            out.push(<ToDo key={b.id} block={b} />); break
      case 'code':             out.push(<Code key={b.id} block={b} />); break
      case 'table':            out.push(<Table key={b.id} block={b} />); break
      case 'column_list':      out.push(<BlockRenderer key={b.id} blocks={b.children ?? []} />); break
      case 'column':           out.push(<div key={b.id}><BlockRenderer blocks={b.children ?? []} /></div>); break
      default: break
    }
    i++
  }

  return <>{out}</>
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function NotionPageViewer({
  title,
  coverUrl,
  iconEmoji,
  blocks,
}: {
  title: string
  coverUrl: string | null
  iconEmoji: string | null
  blocks: BlockWithChildren[]
}) {
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <p className="font-optima"
          style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-accent)', marginBottom: '8px' }}>
          Blueprint 01
        </p>
        <h1 className="cq-t1"
          style={{ fontSize: 'var(--text-t1)', lineHeight: 1.1, color: 'var(--color-text)', marginBottom: '10px' }}>
          {iconEmoji && <span style={{ marginRight: '10px' }}>{iconEmoji}</span>}
          Dates &amp; Destinations
        </h1>
        <div style={{ width: '28px', height: '1.5px', backgroundColor: 'var(--color-text-accent)' }} />
      </div>

      {/* Cover image */}
      {coverUrl && (
        <div style={{ borderRadius: '10px', overflow: 'hidden', marginBottom: '32px', height: '200px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}

      {/* Page content */}
      <div style={{
        backgroundColor: 'var(--color-surface-sunken)',
        border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
        borderRadius: '10px',
        padding: '32px 28px',
      }}>
        {/* Page title from Notion */}
        {title && title !== 'Untitled' && (
          <h2 className="cq-subhead" style={{ fontSize: 'var(--text-subhead)', color: 'var(--color-text)', marginBottom: '24px', fontWeight: 400 }}>
            {title}
          </h2>
        )}
        <BlockRenderer blocks={blocks} />
      </div>
    </div>
  )
}
