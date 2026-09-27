import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { clientIdsForPhone, getSessionUser } from '@/lib/tripAccess'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

/**
 * POST /api/archetype
 * Body: { clientId, code, name, displayCode }
 * Signed-in clients only, and only for a client their own phone belongs to.
 *
 * Saves a client's CQ travel archetype to Supabase, then writes it back to
 * Notion so the two never drift. Retaking overwrites both.
 *
 * The write used to target the client's page in CQ Clients, as rich_text.
 * Neither was right: CQ Clients has no Archetype property at all, and the one
 * that exists — on CQ Travelers — is a select. Every write-back failed
 * silently and logged a warning about a property that was never going to be
 * there. It now updates the primary traveller's row in CQ Travelers.
 *
 * Notion creates a select option it has not seen before, so a result the
 * database does not yet list still lands rather than erroring.
 */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as {
    clientId?: string
    code?: string
    name?: string
    displayCode?: string
  }
  const { clientId, code, name } = body

  if (!clientId || !code || !name) {
    return NextResponse.json({ error: 'clientId, code, and name are required' }, { status: 400 })
  }
  if (!(await clientIdsForPhone(user.phone)).includes(clientId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = createAdminClient()

  const { error } = await db
    .from('clients')
    .update({
      archetype_code: code,
      archetype_name: name,
      archetype_taken_at: new Date().toISOString(),
    })
    .eq('id', clientId)

  if (error) {
    console.error('[archetype] Supabase update failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // The archetype belongs to a person, so it is written to the primary
  // traveller — falling back to the only traveller on the client when none is
  // flagged primary.
  let notionSynced = false
  if (process.env.NOTION_TOKEN) {
    const { data: travellers } = await db
      .from('travelers')
      .select('notion_page_id, is_primary')
      .eq('client_id', clientId)
      .not('notion_page_id', 'is', null)
      .order('is_primary', { ascending: false })
      .limit(1)

    const pageId = travellers?.[0]?.notion_page_id as string | undefined
    if (pageId) {
      try {
        await notion.pages.update({
          page_id: pageId,
          properties: { Archetype: { select: { name } } },
        })
        notionSynced = true
      } catch (err) {
        console.warn('[archetype] Notion write-back to CQ Travelers failed:', err)
      }
    } else {
      console.warn('[archetype] no traveller with a notion_page_id for client', clientId)
    }
  }

  return NextResponse.json({ ok: true, notionSynced })
}
