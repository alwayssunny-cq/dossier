import { redirect } from 'next/navigation'
import { requireTripAccess } from '@/lib/tripAccess'

/**
 * The full journey, on its own page.
 *
 * While travelling, the dossier shows today and keeps the rest behind doors —
 * a whole itinerary open on the same page buries the thing the reader needs
 * now. This is that door. It reuses Your Days' loader by way of a query flag
 * so there is one place that assembles a journey, not two that drift.
 */
export default async function JourneyPage({
  params,
}: {
  params: Promise<{ tripId: string }>
}) {
  const { tripId } = await params
  await requireTripAccess(tripId)
  redirect(`/trip/${tripId}/your-trip?view=journey`)
}
