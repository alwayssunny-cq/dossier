/**
 * POST /api/admin/run-migration
 * Body: { password }
 *
 * Attempts to create the trip_content_pages table via the Supabase Management API
 * (requires SUPABASE_ACCESS_TOKEN env var — a personal access token from supabase.com/dashboard/account/tokens).
 *
 * If SUPABASE_ACCESS_TOKEN is absent, returns the SQL for manual execution in the
 * Supabase SQL editor.
 */

import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminAuth'

const MIGRATION_SQL = `
-- trip_content_pages: Notion content cache for CQ client portal
CREATE TABLE IF NOT EXISTS trip_content_pages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL,
  notion_page_url  TEXT,
  notion_page_id   TEXT,
  raw_blocks   JSONB,
  parsed_content   JSONB,
  synced_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, type)
);

CREATE INDEX IF NOT EXISTS idx_trip_content_pages_trip_id ON trip_content_pages(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_content_pages_type    ON trip_content_pages(type);
`.trim()

function extractProjectRef(supabaseUrl: string): string | null {
  try {
    const host = new URL(supabaseUrl).hostname      // <project-ref>.supabase.co
    return host.split('.')[0] ?? null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { password?: string }

  if (!isAdminRequest(request, body)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accessToken = process.env.SUPABASE_ACCESS_TOKEN
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const projectRef  = extractProjectRef(supabaseUrl)

  // ── Auto-run via Supabase Management API ─────────────────────────────────
  if (accessToken && projectRef) {
    try {
      const res = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: MIGRATION_SQL }),
        }
      )

      const json = await res.json().catch(() => ({}))

      if (res.ok) {
        console.log('[migration] trip_content_pages created via Management API')
        return NextResponse.json({
          ok: true,
          method: 'management_api',
          message: 'Migration applied — trip_content_pages table ready.',
        })
      }

      // Management API returned an error (e.g. table already exists is fine)
      const errMsg: string = json?.message ?? json?.error ?? String(json)
      if (errMsg.toLowerCase().includes('already exists')) {
        return NextResponse.json({
          ok: true,
          method: 'management_api',
          message: 'Table already exists — no action needed.',
        })
      }

      // Real error — fall through to SQL fallback
      console.warn('[migration] Management API error:', errMsg)
      return NextResponse.json({
        ok: false,
        method: 'management_api',
        error: errMsg,
        sql: MIGRATION_SQL,
        instructions: 'Management API call failed. Run the SQL below in your Supabase SQL editor.',
      }, { status: 500 })

    } catch (err) {
      console.error('[migration] Management API fetch failed:', err)
    }
  }

  // ── No access token — return SQL for manual execution ─────────────────────
  return NextResponse.json({
    ok: false,
    method: 'manual',
    message: accessToken
      ? 'Management API request failed. Run the SQL manually.'
      : 'SUPABASE_ACCESS_TOKEN not set. Add it to .env.local to enable auto-migration.',
    sql: MIGRATION_SQL,
    instructions: [
      '1. Go to your Supabase project → SQL Editor',
      '2. Paste and run the SQL below',
      '3. Return here and retry syncing content',
    ].join('\n'),
  })
}
