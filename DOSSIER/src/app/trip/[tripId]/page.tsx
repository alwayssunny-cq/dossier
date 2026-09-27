import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import type { Trip } from '@/lib/types'
import { getTripPhase } from '@/lib/tripPhase'

export default async function TripPage({
  params,
}: {
  params: Promise<{ tripId: string }>
}) {
  const { tripId } = await params
  const db = createAdminClient()

  const { data: trip } = await db
    .from('trips')
    .select('status, start_date, end_date')
    .eq('trip_id', tripId)
    .maybeSingle() as { data: Pick<Trip, 'status' | 'start_date' | 'end_date'> | null }

  const todayMs = new Date().setHours(0, 0, 0, 0)
  const isLive  = !!(
    trip?.start_date && trip?.end_date &&
    new Date(trip.start_date).getTime() <= todayMs &&
    todayMs <= new Date(trip.end_date).getTime()
  )

  const { visibleTabs } = getTripPhase(trip?.status ?? null, isLive)
  const defaultTab = visibleTabs[0] ?? 'log'

  redirect(`/trip/${tripId}/${defaultTab}`)
}
