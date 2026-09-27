/**
 * Weekly Notion → Supabase sync. Mondays, 00:30 UTC — the schedule that was
 * in vercel.json.
 *
 * This only rings the doorbell: /api/cron/sync checks CRON_SECRET and then
 * calls /api/sync, so the logic stays in one place and works on either host.
 */
export default async () => {
  const base = process.env.URL ?? process.env.NEXT_PUBLIC_APP_URL
  if (!base || !process.env.CRON_SECRET) {
    console.error('[cron-sync] missing URL or CRON_SECRET')
    return new Response('not configured', { status: 500 })
  }

  const res = await fetch(`${base}/api/cron/sync`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
  const body = await res.text()
  console.log('[cron-sync]', res.status, body.slice(0, 300))
  return new Response(body, { status: res.status })
}

export const config = { schedule: '30 0 * * 1' }
