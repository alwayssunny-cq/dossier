import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Message } from '@/lib/types'
import LogClient from './LogClient'

export default async function LogPage({
  params,
}: {
  params: Promise<{ tripId: string }>
}) {
  const { tripId } = await params
  const supabase = await createClient()
  const db = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: trip } = await db
    .from('trips')
    .select('id, status')
    .eq('trip_id', tripId)
    .maybeSingle() as { data: { id: string; status: string | null } | null }

  const { data } = trip
    ? await db
        .from('messages')
        .select('*')
        .eq('trip_id', trip.id)
        .order('timestamp', { ascending: true })
    : { data: [] }

  const messages = (data as Message[]) ?? []

  return (
    <LogClient
      tripId={trip?.id ?? tripId}
      initialMessages={messages}
      userId={user?.id ?? ''}
      tripStatus={trip?.status ?? null}
    />
  )
}
