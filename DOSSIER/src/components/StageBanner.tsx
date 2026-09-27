'use client'

import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { getAccessibleStages, STAGE_LABELS, STAGES, type StageSlug } from '@/lib/tripPhase'

export default function StageBanner({
  status,
  isLive,
}: {
  status: string | null
  isLive: boolean
}) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const stageOverride = searchParams.get('stage')
  const accessible    = getAccessibleStages(status, isLive)
  const actualSlug    = accessible[accessible.length - 1] ?? 'first-steps'

  const isValidOverride =
    stageOverride &&
    STAGES.some(s => s.key === stageOverride) &&
    accessible.includes(stageOverride as StageSlug)

  const isViewingPast = isValidOverride && stageOverride !== actualSlug

  if (!isViewingPast || !stageOverride) return null

  const viewingLabel = STAGE_LABELS[stageOverride as StageSlug]
  const actualLabel  = STAGE_LABELS[actualSlug]

  function returnToCurrent() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('stage')
    const q = params.toString()
    router.push(`${pathname}${q ? `?${q}` : ''}`)
  }

  return (
    <div
      style={{
        borderTop:    '1px solid rgb(var(--borges-rgb) / 0.2)',
        borderBottom: '1px solid rgb(var(--borges-rgb) / 0.2)',
        backgroundColor: 'var(--color-surface-sunken)',
      }}
    >
      <div
        className="mx-auto flex flex-col items-start md:flex-row md:items-center md:justify-between"
        style={{ maxWidth: '680px', padding: 'var(--space-2) 20px', gap: 'var(--space-1)' }}
      >
        {/* Left + middle */}
        <div className="flex items-center flex-wrap" style={{ gap: '0 8px', minWidth: 0 }}>
          <span
            className="font-optima whitespace-nowrap"
            style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text)', letterSpacing: '0.04em' }}
          >
            Viewing {viewingLabel}
          </span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-caption)' }}>·</span>
          <span
            className="font-optima whitespace-nowrap"
            style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', letterSpacing: '0.04em' }}
          >
            Currently at {actualLabel}
          </span>
        </div>

        {/* Right — return button */}
        <button
          onClick={returnToCurrent}
          className="font-optima whitespace-nowrap"
          style={{
            background: 'none',
            border: 'none',
            padding: '2px 0',
            cursor: 'pointer',
            fontSize: 'var(--text-caption)',
            color: 'var(--color-text-accent)',
            letterSpacing: '0.08em',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
            textDecorationColor: 'rgb(var(--borges-rgb) / 0.4)',
            flexShrink: 0,
            minHeight: '44px',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          Return to current
        </button>
      </div>
    </div>
  )
}
