'use client'

import { useState } from 'react'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import {
  STAGES,
  getAccessibleStages,
  type StageSlug,
} from '@/lib/tripPhase'

const STAGE_SUBTITLES: Record<StageSlug, string> = {
  'first-steps':  'Your journey begins',
  'crafting':     'Designing your journey',
  'reservations': 'Securing your trip',
  'bon-voyage':   'Time to travel',
}

export default function ProgressBar({
  tripId,
  status,
  isLive,
}: {
  tripId: string
  status: string | null
  isLive: boolean
}) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [hovered, setHovered] = useState<StageSlug | null>(null)

  const stageOverride = searchParams.get('stage')
  const version       = searchParams.get('version')
  const accessible    = getAccessibleStages(status, isLive)

  const actualSlug   = accessible[accessible.length - 1] ?? 'first-steps'
  const actualIndex  = STAGES.findIndex(s => s.key === actualSlug)

  const validOverride: StageSlug | null =
    stageOverride && accessible.includes(stageOverride as StageSlug)
      ? (stageOverride as StageSlug)
      : null

  const viewingSlug  = validOverride ?? actualSlug
  const viewingIndex = STAGES.findIndex(s => s.key === viewingSlug)

  function handleClick(stageKey: StageSlug) {
    if (!accessible.includes(stageKey)) return

    const params = new URLSearchParams()
    if (version) params.set('version', version)

    if (stageKey === actualSlug) {
      // Bon Voyage opens on Your Days — the days are what the client is
      // actually travelling with at that point, not the overview.
      if (stageKey === 'bon-voyage') {
        const q = params.toString()
        router.push(`/trip/${tripId}/your-trip${q ? `?${q}` : ''}`)
        return
      }
      // Other stages: strip the override and stay on current tab
      const segments   = pathname.split('/')
      const currentTab = segments[3] ?? 'brief'
      const q = params.toString()
      router.push(`/trip/${tripId}/${currentTab}${q ? `?${q}` : ''}`)
    } else {
      // Clicking a past stage: land on the default tab for that stage
      const defaultTab =
        stageKey === 'crafting'     ? 'dates-destinations'    :
        stageKey === 'reservations' ? 'reservations-payments' :
        stageKey === 'bon-voyage'   ? 'your-trip'             : 'brief'
      params.set('stage', stageKey)
      router.push(`/trip/${tripId}/${defaultTab}?${params.toString()}`)
    }
  }

  return (
    <>
      {/* ── Phone: a four-segment rail ──────────────────────────────────────
          The pills were a centred `overflow-x: auto` row. Four of them need
          about 530px; a phone gives 390, and centring meant the row was cut
          off at BOTH ends at once — "…ps" on the left, "Bon…" on the right —
          with no edge to grab and nothing to say more existed. That single
          row was the broken-looking element on every trip page.

          A rail cannot overflow: four segments divide whatever width there
          is. It also says more than the pills did — how far along the journey
          is, at a glance — and the stage being viewed is named underneath in
          full, so no label has to survive being squeezed into a quarter of a
          phone screen. */}
      <div className="md:hidden">
        <div style={{ display: 'flex', gap: '6px' }}>
          {STAGES.map((stage, i) => {
            const isAccessible = accessible.includes(stage.key)
            const reached      = i <= actualIndex
            const viewing      = i === viewingIndex
            return (
              <button
                key={stage.key}
                onClick={() => handleClick(stage.key)}
                disabled={!isAccessible}
                aria-label={`${stage.label} stage`}
                aria-current={viewing ? 'step' : undefined}
                style={{
                  flex: '1 1 0',
                  minWidth: 0,
                  // 21px either side of a 3px rule is a 45px target: the rail
                  // reads as a hairline but answers to a thumb.
                  padding: '21px 0',
                  background: 'none',
                  border: 'none',
                  cursor: isAccessible ? 'pointer' : 'default',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    height: '3px',
                    borderRadius: '2px',
                    backgroundColor:
                      viewing ? 'var(--color-text)' :
                      reached ? 'rgb(var(--borges-rgb) / 0.55)' :
                                'rgb(var(--borges-rgb) / 0.18)',
                    transition: 'background-color var(--duration-fast) var(--ease-out)',
                  }}
                />
              </button>
            )
          })}
        </div>
        <p
          className="font-optima"
          style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', marginTop: '2px' }}
        >
          {STAGES[viewingIndex]?.label}
        </p>
        <p className="cq-label" style={{ color: 'var(--color-text-muted)', marginTop: '4px' }}>
          {STAGE_SUBTITLES[viewingSlug]} · Step {viewingIndex + 1} of {STAGES.length}
        </p>
      </div>

      {/* ── Tablet and up: the pills, which have the room here ── */}
      <div
        className="hidden md:flex"
        style={{
          alignItems:     'center',
          gap:            '8px',
          justifyContent: 'center',
          flexWrap:       'wrap',
          padding:        '2px 4px',
        } as React.CSSProperties}
      >
        {STAGES.map((stage, i) => {
          const isAccessible  = accessible.includes(stage.key)
          const isCompleted   = i < actualIndex
          const isActual      = i === actualIndex
          const isViewing     = i === viewingIndex
          const isFuture      = i > actualIndex
          const isHov         = hovered === stage.key && isAccessible

          const state: 'active' | 'completed' | 'inactive' | 'future' =
            isViewing   ? 'active' :
            isCompleted ? 'completed' :
            isActual    ? (isViewing ? 'active' : 'completed') :
            isFuture    ? 'future' : 'inactive'

          const styles = getStageStyles(state, isHov)

          return (
            <button
              key={stage.key}
              onClick={() => handleClick(stage.key)}
              disabled={!isAccessible}
              onMouseEnter={() => isAccessible && setHovered(stage.key)}
              onMouseLeave={() => setHovered(null)}
              style={{
                flexShrink:         0,
                position:          'relative',
                display:           'inline-flex',
                alignItems:        'center',
                justifyContent:    'center',
                height:            '44px',
                padding:           '0 24px',
                borderRadius:      '999px',
                border:            styles.border,
                backgroundColor:   styles.bg,
                boxShadow:         styles.shadow,
                cursor:            isAccessible ? 'pointer' : 'default',
                transition:        'background-color 0.25s cubic-bezier(0.4,0,0.2,1), border-color 0.25s cubic-bezier(0.4,0,0.2,1), box-shadow 0.25s cubic-bezier(0.4,0,0.2,1), transform 0.25s cubic-bezier(0.4,0,0.2,1)',
                transform:         isHov && isAccessible ? 'translateY(-1px)' : 'translateY(0)',
                WebkitTapHighlightColor: 'transparent',
              } as React.CSSProperties}
              aria-pressed={isViewing}
              aria-label={`${stage.label} stage`}
            >
              <span
                className="font-optima"
                style={{
                  fontSize:      'var(--text-body)',
                  letterSpacing: '0.01em',
                  color:         styles.labelColor,
                  fontWeight:    400,
                  lineHeight:    1,
                  whiteSpace:    'nowrap',
                  transition:    'color 0.25s',
                }}
              >
                {stage.label}
              </span>
            </button>
          )
        })}
      </div>

      <p
        className="cq-label hidden md:block"
        style={{ textAlign: 'center', marginTop: '12px', color: 'var(--color-text-muted)' }}
      >
        {STAGE_SUBTITLES[viewingSlug]}
      </p>

    </>
  )
}

// ── Style resolver ────────────────────────────────────────────────────────────

function getStageStyles(
  state: 'active' | 'completed' | 'inactive' | 'future',
  hovered: boolean,
) {
  switch (state) {
    // A solid fill, not a 10% tint. The selected pill has to be readable at a
    // glance without borrowing weight from the type.
    case 'active':
      return {
        bg:         'var(--fade)',
        border:     '1px solid rgb(var(--borges-rgb) / 0.45)',
        shadow:     'none',
        labelColor: 'var(--color-text)',
      }

    case 'completed':
      return {
        bg:         hovered ? 'rgb(var(--borges-rgb) / 0.07)' : 'transparent',
        border:     `1px solid ${hovered ? 'rgb(var(--borges-rgb) / 0.45)' : 'rgb(var(--borges-rgb) / 0.25)'}`,
        shadow:     hovered ? '0 2px 12px rgb(var(--borges-rgb) / 0.06)' : 'none',
        labelColor: hovered ? 'var(--color-text-secondary)' : 'var(--color-text-accent)',
      }

    case 'inactive':
      return {
        bg:         hovered ? 'rgb(var(--borges-rgb) / 0.08)' : 'transparent',
        border:     `1px solid ${hovered ? 'rgb(var(--night-rgb) / 0.15)' : 'rgb(var(--borges-rgb) / 0.13)'}`,
        shadow:     'none',
        labelColor: hovered ? 'var(--color-text-accent)' : 'var(--color-text-muted)',
      }

    case 'future':
    default:
      return {
        bg:         'transparent',
        border:     '1px solid rgb(var(--borges-rgb) / 0.08)',
        shadow:     'none',
        labelColor: 'rgb(var(--night-rgb) / 0.25)',
      }
  }
}
