'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface VersionSelectorProps {
  versions: string[]     // all distinct iteration_version values, descending
  tripId: string
}

export default function VersionSelector({ versions, tripId }: VersionSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentVersion = searchParams.get('version')

  // No versions = column not yet added or no data
  if (versions.length === 0) return null

  const isLatest = !currentVersion
  const latestVersion = versions[0]

  function setVersion(v: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (v) {
      params.set('version', v)
    } else {
      params.delete('version')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div>
      {/* Archived version banner — cream bg, ochre left border */}
      {!isLatest && currentVersion && (
        <div
          className="flex items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderLeft: '3px solid var(--color-text-accent)',
            borderBottom: '0.5px solid var(--fade)',
            padding: '10px 20px',
          }}
        >
          <p className="font-optima text-caption text-accent">
            Viewing an earlier draft · <span style={{ color: 'var(--color-text-muted)' }}>{currentVersion}</span>
          </p>
          <button
            onClick={() => setVersion(null)}
            className="font-optima transition-opacity hover:opacity-70 whitespace-nowrap"
            style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Switch to latest →
          </button>
        </div>
      )}

      {/* Version selector row — show if ≥1 version */}
      <div className="bg-surface-base border-b border-fade px-5 py-2 flex items-center gap-3">
        <span className="font-optima text-caption tracking-[0.01em] text-ink-muted whitespace-nowrap">
          Iteration
        </span>
        {versions.length === 1 ? (
          <span className="font-optima text-caption text-ink-secondary">
            {latestVersion} <span className="text-ink-muted">(Current)</span>
          </span>
        ) : (
          <>
            <select
              value={currentVersion ?? ''}
              onChange={e => setVersion(e.target.value || null)}
              className="flex-1 max-w-[200px] font-optima text-caption text-ink-secondary bg-transparent border-0 outline-none appearance-none cursor-pointer"
            >
              <option value="">{latestVersion} (Latest)</option>
              {versions.slice(1).map(v => (
                <option key={v} value={v}>{v} (Previous)</option>
              ))}
            </select>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="flex-shrink-0 -ml-4 pointer-events-none">
              <path d="M1 1l4 4 4-4" stroke="#6B696C" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </>
        )}
      </div>
    </div>
  )
}
