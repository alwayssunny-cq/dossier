'use client'

import { useState } from 'react'
import type { ParsedBlock } from '@/app/api/sync-content-pages/route'

export default function NotionImageBlock({ block }: { block: ParsedBlock }) {
  const [failed, setFailed] = useState(false)

  const src = block.imageType === 'file' && block.blockId
    ? `/api/notion-image?blockId=${encodeURIComponent(block.blockId)}`
    : (block.url ?? null)

  if (!src) return null

  return (
    <figure style={{ margin: '28px 0' }}>
      {failed ? (
        <div style={{
          width: '100%',
          height: '200px',
          borderRadius: '10px',
          border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
          backgroundColor: 'rgb(var(--borges-rgb) / 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span
            className="font-optima"
            style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)', letterSpacing: '0.06em' }}
          >
            Image unavailable
          </span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={block.caption || 'Image'}
          onError={() => setFailed(true)}
          style={{
            width: '100%',
            borderRadius: '10px',
            display: 'block',
            border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
          }}
        />
      )}
      {block.caption && (
        <figcaption
          className="font-optima"
          style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', marginTop: '10px', textAlign: 'center', letterSpacing: '0.06em' }}
        >
          {block.caption}
        </figcaption>
      )}
    </figure>
  )
}
