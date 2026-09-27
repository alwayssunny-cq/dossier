'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

export type SubTabSlug = 'day-by-day' | 'experiences' | 'stay' | 'transfers'

const SUB_TABS: { slug: SubTabSlug; label: string }[] = [
  { slug: 'day-by-day',   label: 'Day-by-day' },
  { slug: 'experiences',  label: 'Experiences' },
  { slug: 'stay',         label: 'Stay' },
  { slug: 'transfers',    label: 'Transfers' },
]

export default function ItinerarySubTabs({
  tripId,
  activeSub,
  iterName,
}: {
  tripId:    string
  activeSub: string
  iterName:  string | null
}) {
  const pathname    = usePathname()
  const searchParams = useSearchParams()

  function tabHref(slug: SubTabSlug): string {
    const params = new URLSearchParams()
    // Preserve ?iter if viewing a non-current iteration
    if (iterName) params.set('iter', iterName)
    params.set('sub', slug)
    return `${pathname}?${params.toString()}`
  }

  return (
    <div
      style={{
        borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.12)',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <div
        className="mx-auto flex overflow-x-auto"
        style={{
          maxWidth:         '980px',
          padding:          '0 20px',
          scrollbarWidth:   'none',
          msOverflowStyle:  'none',
        } as React.CSSProperties}
      >
        {SUB_TABS.map(({ slug, label }) => {
          const active = activeSub === slug
          return (
            <Link
              key={slug}
              href={tabHref(slug)}
              className="relative flex-shrink-0 text-center transition-colors"
              style={{ padding: '16px 14px 14px', textDecoration: 'none' }}
            >
              <span
                className={`font-optima transition-colors duration-200 whitespace-nowrap ${
                  active ? 'text-ink' : 'text-ink-muted'
                }`}
                style={{ fontSize: 'var(--text-body)', fontWeight: active ? 600 : 400 }}
              >
                {label}
              </span>
              {active && (
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-[1px]"
                  style={{ width: '20px', height: '1.5px', backgroundColor: 'var(--color-text-accent)' }}
                />
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
