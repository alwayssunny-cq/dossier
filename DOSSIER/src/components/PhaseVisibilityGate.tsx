'use client'

import { useSearchParams } from 'next/navigation'
import { getTripPhase, type TripPhase } from '@/lib/tripPhase'

/** Hides its children during specific trip phases — respects ?stage= preview
 *  overrides the same way the tab bar and progress nav already do. */
export default function PhaseVisibilityGate({
  status,
  isLive,
  hideDuring,
  children,
}: {
  status: string | null
  isLive: boolean
  hideDuring: TripPhase[]
  children: React.ReactNode
}) {
  const stageOverride = useSearchParams().get('stage')
  const { viewingPhase } = getTripPhase(status, isLive, stageOverride)

  if (hideDuring.includes(viewingPhase)) return null
  return <>{children}</>
}
