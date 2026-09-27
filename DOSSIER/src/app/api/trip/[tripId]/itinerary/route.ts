import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { canAccessTrip, getSessionUser } from '@/lib/tripAccess'

function fmtDay(d: string): string {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
  } catch { return d }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessTrip(user, { tripId }))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const db = createAdminClient()

  const { data: trip } = await db
    .from('trips').select('*').eq('trip_id', tripId).maybeSingle()
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const t = trip as Record<string, unknown>

  const { data: iterRows } = await db
    .from('iterations').select('*').eq('trip_id', t.id)
    .order('synced_at', { ascending: false })
  const iterations = (iterRows ?? []) as Record<string, unknown>[]
  const iteration  = iterations.find(i => i.is_current) ?? iterations[0] ?? null

  let days: unknown[] = []

  if (iteration) {
    const [{ data: eData }, { data: sData }, { data: tData }] = await Promise.all([
      db.from('experiences').select('*').eq('trip_id', t.id).eq('iteration_id', iteration.id)
        .order('date', { ascending: true, nullsFirst: false })
        .order('sort_order', { ascending: true }),
      db.from('stays').select('*').eq('trip_id', t.id).eq('iteration_id', iteration.id)
        .order('check_in', { ascending: true, nullsFirst: false }),
      db.from('transfers').select('*').eq('trip_id', t.id).eq('iteration_id', iteration.id)
        .order('date', { ascending: true, nullsFirst: false })
        .order('sort_order', { ascending: true }),
    ])

    const exps      = (eData ?? []) as Record<string, unknown>[]
    const stays     = (sData ?? []) as Record<string, unknown>[]
    const transfers = (tData ?? []) as Record<string, unknown>[]

    // Build date set
    const dateSet = new Set<string>()
    for (const e of exps)      if (e.date) dateSet.add(e.date as string)
    for (const tr of transfers) if (tr.date) dateSet.add(tr.date as string)
    for (const s of stays) {
      const ci = s.check_in as string | null
      const co = s.check_out as string | null
      if (!ci) continue
      dateSet.add(ci)
      if (co) {
        const end = new Date(co + 'T00:00:00')
        const cur = new Date(ci + 'T00:00:00')
        cur.setDate(cur.getDate() + 1)
        while (cur < end) {
          dateSet.add(cur.toISOString().slice(0, 10))
          cur.setDate(cur.getDate() + 1)
        }
      }
    }

    const dates = Array.from(dateSet).sort()
    days = dates.map((date, idx) => {
      const dayExps = exps
        .filter(e => e.date === date || (!e.date && e.day_number === idx + 1))
        .sort((a, b) => ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0))
      const dayTrfs = transfers
        .filter(tr => tr.date === date)
        .sort((a, b) => ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0))
      const stay = stays.find(s => {
        const ci = s.check_in as string | null
        const co = s.check_out as string | null
        if (!ci) return false
        if (!co)  return ci === date
        return ci <= date && date < co
      }) ?? null
      const city =
        (dayExps[0]?.location as string | null) ??
        (dayTrfs[0]?.to_location as string | null) ??
        (stay?.destination as string | null) ?? null

      return {
        dayNumber: idx + 1,
        date,
        dayLabel: fmtDay(date),
        city,
        experiences: dayExps.map(e => ({
          id: e.id, title: e.title, time_of_day: e.time_of_day,
          description: e.description, location: e.location,
          duration: e.duration, status: e.status, sort_order: e.sort_order,
        })),
        stay: stay ? {
          property_name: stay.property_name, destination: stay.destination,
          room_type: stay.room_type, meals: stay.meals, nights: stay.nights,
          check_in: stay.check_in, check_out: stay.check_out,
          description: stay.description,
          image_url: stay.image_url,
          image_urls: stay.image_urls,
          status: stay.status,
        } : null,
        transfers: dayTrfs.map(tr => ({
          id: tr.id, from_location: tr.from_location, to_location: tr.to_location,
          transfer_mode: tr.transfer_mode, carrier: tr.carrier,
          duration: tr.duration, sort_order: tr.sort_order,
        })),
      }
    })
  }

  return NextResponse.json({
    tripName: t.trip_name,
    destLabel: [t.state_county, t.destination_country].filter(Boolean).join(', '),
    days,
  })
}
