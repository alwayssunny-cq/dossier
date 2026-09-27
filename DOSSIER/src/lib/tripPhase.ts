export type TripPhase = 'inquiry' | 'crafting' | 'reservations' | 'live' | 'completed'

export type StageSlug = 'first-steps' | 'crafting' | 'reservations' | 'bon-voyage'

export const STAGES: { key: StageSlug; label: string }[] = [
  { key: 'first-steps',  label: 'First Steps'  },
  { key: 'crafting',     label: 'Crafting'      },
  { key: 'reservations', label: 'Reservations'  },
  { key: 'bon-voyage',   label: 'Bon Voyage'    },
]

export const STAGE_LABELS: Record<StageSlug, string> = {
  'first-steps':  'First Steps',
  'crafting':     'Crafting',
  'reservations': 'Reservations',
  'bon-voyage':   'Bon Voyage',
}

export interface TripTabConfig {
  actualPhase: TripPhase
  viewingPhase: TripPhase
  visibleTabs: string[]
  isViewingPastStage: boolean
}

// ── internal helpers ─────────────────────────────────────────────────────────

function statusToStageSlug(status: string | null, isLive: boolean): StageSlug {
  if (isLive) return 'bon-voyage'
  const s = (status ?? '').toLowerCase()
  if (s.includes('bon') || s === 'completed')                        return 'bon-voyage'
  if (s.includes('reserv') || s === 'confirmed' || s === 'booked')  return 'reservations'
  if (s.includes('craft') || s === 'active' || s === 'planning')    return 'crafting'
  return 'first-steps'
}

function stageSlugToPhase(slug: StageSlug, treatAsLive: boolean): TripPhase {
  if (treatAsLive) return 'live'
  switch (slug) {
    case 'bon-voyage':   return 'completed'
    case 'reservations': return 'reservations'
    case 'crafting':     return 'crafting'
    case 'first-steps':  return 'inquiry'
  }
}

function tabsForPhase(phase: TripPhase): { visibleTabs: string[] } {
  switch (phase) {
    case 'live':         return { visibleTabs: ['today', 'your-trip', 'travel-guide', 'log'] }
    case 'completed':    return { visibleTabs: ['your-trip', 'travel-guide', 'log'] }
    case 'reservations': return { visibleTabs: ['reservations-payments', 'your-trip', 'log'] }
    case 'crafting':     return { visibleTabs: ['dates-destinations', 'stays', 'experiences', 'log'] }
    case 'inquiry':
    default:             return { visibleTabs: ['brief', 'log'] }
  }
}

// ── public API ───────────────────────────────────────────────────────────────

/**
 * Returns an ordered list of stage slugs the client is allowed to view,
 * based on the trip's actual current status.
 *
 * Stages are cumulative: reaching Reservations means you can also view
 * First Steps and Crafting.
 */
export function getAccessibleStages(status: string | null, isLive = false): StageSlug[] {
  const currentSlug = statusToStageSlug(status, isLive)
  const idx = STAGES.findIndex(s => s.key === currentSlug)
  return STAGES.slice(0, idx + 1).map(s => s.key)
}

/**
 * Derives trip phase, visible tabs, and viewing state.
 *
 * Tab logic:
 *   first-steps  → ['brief', 'log']
 *   crafting     → ['dates-destinations', 'stays', 'experiences', 'log']
 *   reservations → ['reservations-payments', 'your-trip', 'log']
 *   bon-voyage   → ['your-trip', 'reservations-payments', 'log']
 *   live         → ['today', 'your-trip', 'reservations-payments', 'log']
 */
export function getTripPhase(
  status: string | null,
  isLive = false,
  viewingStageOverride?: string | null,
): TripTabConfig {
  const actualSlug  = statusToStageSlug(status, isLive)
  const actualPhase = stageSlugToPhase(actualSlug, isLive && actualSlug === 'bon-voyage')

  const accessible = getAccessibleStages(status, isLive)
  const validOverride = (
    viewingStageOverride &&
    STAGES.some(s => s.key === viewingStageOverride) &&
    accessible.includes(viewingStageOverride as StageSlug)
  ) ? viewingStageOverride as StageSlug : null

  const viewingSlug        = validOverride ?? actualSlug
  const isViewingPastStage = viewingSlug !== actualSlug
  const viewingIsLive      = isLive && !isViewingPastStage
  const viewingPhase       = stageSlugToPhase(viewingSlug, viewingIsLive)

  const { visibleTabs } = tabsForPhase(viewingPhase)

  return { actualPhase, viewingPhase, visibleTabs, isViewingPastStage }
}
