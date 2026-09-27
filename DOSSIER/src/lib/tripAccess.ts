import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Who may see which trip.
 *
 * Server code reads with the service-role key, which bypasses RLS, so this is
 * the real check: a trip is visible only when trips.client_id belongs to a
 * traveler whose phone matches the signed-in user's. Phones are compared on
 * their last 10 digits, so +91 98…, 91 98… and 98… all match.
 *
 * Wrapped in React cache() so the layout and page share one lookup per render.
 */

const last10 = (phone: string | null | undefined) => (phone ?? '').replace(/\D/g, '').slice(-10)

export const getSessionUser = cache(async (): Promise<User | null> => {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  return user
})

/** client_ids of every traveler whose phone matches. Empty when none do. */
export const clientIdsForPhone = cache(async (phone: string | null | undefined): Promise<string[]> => {
  const key = last10(phone)
  if (key.length < 10) return []
  const { data } = await createAdminClient()
    .from('travelers')
    .select('client_id, phone')
    .not('phone', 'is', null)
    .not('client_id', 'is', null)
  const rows = (data ?? []) as { client_id: string; phone: string }[]
  return [...new Set(rows.filter(t => last10(t.phone) === key).map(t => t.client_id))]
})

export type TripRef = { tripId: string } | { tripUuid: string }

/** True when the user's traveler record owns the trip (by text trip ID or trips.id). */
export async function canAccessTrip(user: User | null, ref: TripRef): Promise<boolean> {
  if (!user) return false
  const clientIds = await clientIdsForPhone(user.phone)
  if (clientIds.length === 0) return false
  const q = createAdminClient().from('trips').select('id').in('client_id', clientIds)
  const { data } = await ('tripId' in ref ? q.eq('trip_id', ref.tripId) : q.eq('id', ref.tripUuid)).maybeSingle()
  return !!data
}

/** For trip pages and the trip layout: login if signed out, 404 if not theirs. */
export async function requireTripAccess(tripId: string): Promise<User> {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!(await canAccessTrip(user, { tripId }))) notFound()
  return user
}
