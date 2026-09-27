'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function QuickLinkCard({
  href,
  label,
  desc,
  hardNav = false,
}: {
  href: string
  label: string
  desc: string
  /** Force a full page reload instead of client-side navigation. Use for links
   *  that cross trip stages (e.g. under a ?stage= preview) — the Next.js router
   *  cache can otherwise serve a stale page that doesn't reflect the stage
   *  you're actually viewing. */
  hardNav?: boolean
}) {
  const [hovered, setHovered] = useState(false)

  const card = (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: 'var(--color-surface-sunken)',
        border: `0.5px solid ${hovered ? 'rgb(var(--borges-rgb) / 0.20)' : 'rgb(var(--borges-rgb) / 0.12)'}`,
        borderRadius: '7px',
        padding: '18px 20px',
        height: '100%',
        transition: 'border-color 0.2s ease, transform 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', marginBottom: '6px' }}>
        {label}
      </p>
      <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
        {desc}
      </p>
    </div>
  )

  if (hardNav) {
    return <a href={href} style={{ textDecoration: 'none' }}>{card}</a>
  }
  return <Link href={href} style={{ textDecoration: 'none' }}>{card}</Link>
}
