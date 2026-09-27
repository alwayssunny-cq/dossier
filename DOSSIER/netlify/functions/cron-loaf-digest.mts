/**
 * Weekly LOAF digest. Mondays, 01:00 UTC — the schedule that was in
 * vercel.json, an hour after the sync so it reads fresh content.
 */
export default async () => {
  const base = process.env.URL ?? process.env.NEXT_PUBLIC_APP_URL
  if (!base || !process.env.CRON_SECRET) {
    console.error('[cron-loaf-digest] missing URL or CRON_SECRET')
    return new Response('not configured', { status: 500 })
  }

  const res = await fetch(`${base}/api/cron/loaf-digest`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
  const body = await res.text()
  console.log('[cron-loaf-digest]', res.status, body.slice(0, 300))
  return new Response(body, { status: res.status })
}

export const config = { schedule: '0 1 * * 1' }
