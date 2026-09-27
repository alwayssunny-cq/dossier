'use client'

import { useState } from 'react'

interface Props {
  text: string
  maxLines?: number
}

function parseDescription(text: string): { type: 'text' | 'bullets'; content: string[] }[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const segments: { type: 'text' | 'bullets'; content: string[] }[] = []
  let bulletBuffer: string[] = []
  let textBuffer: string[] = []

  const flushText    = () => { if (textBuffer.length)   { segments.push({ type: 'text',    content: [...textBuffer] });   textBuffer = [] } }
  const flushBullets = () => { if (bulletBuffer.length) { segments.push({ type: 'bullets', content: [...bulletBuffer] }); bulletBuffer = [] } }

  for (const line of lines) {
    if (/^[•\-–*]\s+/.test(line)) {
      flushText()
      bulletBuffer.push(line.replace(/^[•\-–*]\s+/, ''))
    } else {
      flushBullets()
      textBuffer.push(line)
    }
  }
  flushText()
  flushBullets()
  return segments
}

export default function ExpandableDescription({ text, maxLines = 3 }: Props) {
  const [expanded, setExpanded] = useState(false)
  const segments = parseDescription(text)
  const totalLines = segments.reduce((n, s) => n + s.content.length, 0)
  const needsTruncation = totalLines > maxLines || text.length > 220

  return (
    <div className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: '1.85', color: 'var(--color-text-secondary)' }}>
      <div
        className={!expanded && needsTruncation ? 'overflow-hidden' : ''}
        style={!expanded && needsTruncation ? {
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        } as React.CSSProperties : {}}
      >
        {segments.map((seg, i) =>
          seg.type === 'text' ? (
            <p key={i} className={i > 0 ? 'mt-1.5' : ''}>{seg.content.join(' ')}</p>
          ) : (
            <ul key={i} className="mt-1.5 space-y-0.5 pl-3">
              {seg.content.map((item, j) => (
                <li key={j} className="flex gap-2">
                  <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-text-muted)' }}>·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )
        )}
      </div>

      {needsTruncation && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="font-optima tracking-[0.01em] transition-colors"
          style={{ marginTop: '8px', fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {expanded ? 'Read less ↑' : 'Continue reading →'}
        </button>
      )}
    </div>
  )
}
