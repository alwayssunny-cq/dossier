import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

let _supabase: ReturnType<typeof createAdminClient> | null = null
/** Built on first use — see note above; never at import time. */
const supabase = () => (_supabase ??= createAdminClient())

/** Check if a column exists by attempting a HEAD select. */
async function columnExists(table: string, column: string): Promise<boolean> {
  const { error } = await supabase().from(table).select(column).limit(1).maybeSingle()
  // PostgREST returns a 400 with "column does not exist" if missing
  if (error?.message?.toLowerCase().includes('does not exist')) return false
  return true
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { password?: string }
  if (body.password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const checks: Record<string, { exists: boolean; sql: string }> = {}
  const missing: string[] = []

  const migrations = [
    {
      key: 'stays.image_urls',
      table: 'stays',
      column: 'image_urls',
      sql: 'ALTER TABLE stays ADD COLUMN IF NOT EXISTS image_urls TEXT[];',
    },
    {
      key: 'experiences.image_urls',
      table: 'experiences',
      column: 'image_urls',
      sql: 'ALTER TABLE experiences ADD COLUMN IF NOT EXISTS image_urls TEXT[];',
    },
    {
      key: 'trips.dates_destinations_link',
      table: 'trips',
      column: 'dates_destinations_link',
      sql: 'ALTER TABLE trips ADD COLUMN IF NOT EXISTS dates_destinations_link TEXT;',
    },
    {
      key: 'trips.stay_link_url',
      table: 'trips',
      column: 'stay_link_url',
      sql: 'ALTER TABLE trips ADD COLUMN IF NOT EXISTS stay_link_url TEXT;',
    },
    {
      key: 'trips.stay_notion_page_id',
      table: 'trips',
      column: 'stay_notion_page_id',
      sql: 'ALTER TABLE trips ADD COLUMN IF NOT EXISTS stay_notion_page_id TEXT;',
    },
    {
      key: 'trips.reading_page_url',
      table: 'trips',
      column: 'reading_page_url',
      sql: 'ALTER TABLE trips ADD COLUMN IF NOT EXISTS reading_page_url TEXT;',
    },
    {
      key: 'trips.reading_insights',
      table: 'trips',
      column: 'reading_insights',
      sql: 'ALTER TABLE trips ADD COLUMN IF NOT EXISTS reading_insights TEXT;',
    },
    {
      key: 'trips.pre_travel_guide',
      table: 'trips',
      column: 'pre_travel_guide',
      sql: 'ALTER TABLE trips ADD COLUMN IF NOT EXISTS pre_travel_guide TEXT;',
    },
    {
      key: 'trips.drawing_board_url',
      table: 'trips',
      column: 'drawing_board_url',
      sql: 'ALTER TABLE trips ADD COLUMN IF NOT EXISTS drawing_board_url TEXT;',
    },
  ]

  const tableSQL = `
-- trip_content_pages: stores parsed Notion content for client portal rendering
CREATE TABLE IF NOT EXISTS trip_content_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'dates_destinations',
  notion_page_id TEXT,
  notion_url TEXT,
  raw_blocks JSONB,
  parsed_content JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, type)
);`.trim()

  // Unique index SQL — run once in the Supabase SQL editor to prevent future duplicates
  const uniqueIndexSQL = [
    `DELETE FROM experiences a USING experiences b WHERE a.id > b.id AND a.title = b.title AND a.trip_id = b.trip_id;`,
    `DELETE FROM stays a USING stays b WHERE a.id > b.id AND a.property_name = b.property_name AND a.trip_id = b.trip_id;`,
    `DELETE FROM transfers a USING transfers b WHERE a.id > b.id AND a.from_location = b.from_location AND a.to_location = b.to_location AND a.trip_id = b.trip_id;`,
    `CREATE UNIQUE INDEX IF NOT EXISTS unique_experience_per_trip ON experiences(title, trip_id) WHERE title IS NOT NULL;`,
    `CREATE UNIQUE INDEX IF NOT EXISTS unique_stay_per_trip ON stays(property_name, trip_id) WHERE property_name IS NOT NULL;`,
    `CREATE UNIQUE INDEX IF NOT EXISTS unique_transfer_per_trip ON transfers(from_location, to_location, date, trip_id) WHERE from_location IS NOT NULL;`,
  ]

  for (const m of migrations) {
    const exists = await columnExists(m.table, m.column)
    checks[m.key] = { exists, sql: m.sql }
    if (!exists) missing.push(m.sql)
  }

  return NextResponse.json({
    checks,
    missing_columns: missing.length,
    sql_to_run: missing.length > 0
      ? `Run the following SQL in your Supabase SQL editor:\n\n${missing.join('\n')}`
      : 'All columns already exist — no migration needed.',
    unique_indexes_sql: `Run once in Supabase SQL editor to prevent duplicate data:\n\n${uniqueIndexSQL.join('\n')}`,
    trip_content_pages_sql: `Run once in Supabase SQL editor to create the content cache table:\n\n${tableSQL}`,
    dates_destinations_sql: `Run once in Supabase SQL editor to create the structured Dates & Destinations table:\n\nCREATE TABLE IF NOT EXISTS dates_destinations (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  notion_page_id TEXT UNIQUE,\n  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,\n  iteration_num INTEGER NOT NULL DEFAULT 1,\n  sort_order INTEGER DEFAULT 0,\n  dates_label TEXT,\n  place TEXT NOT NULL,\n  duration TEXT,\n  description TEXT,\n  image_url TEXT,\n  map_image_url TEXT,\n  synced_at TIMESTAMPTZ DEFAULT NOW(),\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\nCREATE INDEX IF NOT EXISTS idx_dates_destinations_trip ON dates_destinations(trip_id, iteration_num, sort_order);`,
    dates_destinations_fields_sql: `Run once in Supabase SQL editor to add the full Dates & Destinations field set:\n\nALTER TABLE dates_destinations\n  ADD COLUMN IF NOT EXISTS row_type TEXT DEFAULT 'Destination',\n  ADD COLUMN IF NOT EXISTS display_name TEXT,\n  ADD COLUMN IF NOT EXISTS arrival_date DATE,\n  ADD COLUMN IF NOT EXISTS nights INTEGER,\n  ADD COLUMN IF NOT EXISTS atmosphere TEXT,\n  ADD COLUMN IF NOT EXISTS things_to_do TEXT,\n  ADD COLUMN IF NOT EXISTS where_you_stay TEXT,\n  ADD COLUMN IF NOT EXISTS from_location TEXT,\n  ADD COLUMN IF NOT EXISTS to_location TEXT,\n  ADD COLUMN IF NOT EXISTS travel_time TEXT,\n  ADD COLUMN IF NOT EXISTS mode TEXT,\n  ADD COLUMN IF NOT EXISTS theme_intro TEXT,\n  ADD COLUMN IF NOT EXISTS pull_quote TEXT,\n  ADD COLUMN IF NOT EXISTS what_to_expect TEXT,\n  ADD COLUMN IF NOT EXISTS what_it_means TEXT,\n  ADD COLUMN IF NOT EXISTS closing_note TEXT,\n  ADD COLUMN IF NOT EXISTS sign_off TEXT,\n  ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';`,
    suggestions_sql: `Run once in Supabase SQL editor to create the CQ Suggestions table:\n\nCREATE TABLE IF NOT EXISTS suggestions (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  notion_page_id TEXT UNIQUE,\n  headline TEXT NOT NULL,\n  content TEXT,\n  category TEXT,\n  archetype TEXT,\n  image_url TEXT,\n  status TEXT,\n  published_at DATE,\n  updated_at TIMESTAMPTZ DEFAULT NOW(),\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\nCREATE INDEX IF NOT EXISTS idx_suggestions_archetype ON suggestions(archetype, published_at DESC);`,
    loaf_stories_sql: `Run once in Supabase SQL editor to create the CQ Loaf stories table:\n\nCREATE TABLE IF NOT EXISTS loaf_stories (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  notion_page_id TEXT UNIQUE,\n  headline TEXT NOT NULL,\n  location TEXT,\n  summary TEXT,\n  story TEXT,\n  reading_link TEXT,\n  tags TEXT[] DEFAULT '{}',\n  source TEXT,\n  submitted_by TEXT,\n  why_interesting TEXT,\n  date_featured DATE,\n  is_this_week BOOLEAN DEFAULT FALSE,\n  cover_url TEXT,\n  created_at TIMESTAMPTZ DEFAULT NOW(),\n  updated_at TIMESTAMPTZ DEFAULT NOW()\n);`,
  })
}
