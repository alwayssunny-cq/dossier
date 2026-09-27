import { redirect } from 'next/navigation'

export default async function TransfersPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>
  searchParams: Promise<{ version?: string }>
}) {
  const { tripId } = await params
  const { version } = await searchParams
  redirect(`/trip/${tripId}/itinerary?sub=transfers${version ? `&iter=${encodeURIComponent(version)}` : ''}`)
}
