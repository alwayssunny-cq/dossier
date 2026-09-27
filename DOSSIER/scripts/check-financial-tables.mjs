/**
 * Checks if financial tables exist and outputs CREATE TABLE SQL if not.
 * Run: node --env-file=.env.local scripts/check-financial-tables.mjs
 *
 * Then paste any output SQL into your Supabase SQL editor and run it.
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function tableExists(table) {
  const { error } = await supabase.from(table).select('id').limit(1).maybeSingle()
  if (error?.code === '42P01') return false   // relation does not exist
  if (error?.message?.toLowerCase().includes('does not exist')) return false
  return true
}

const CREATE_QUOTATIONS = `
CREATE TABLE IF NOT EXISTS quotations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id    TEXT NOT NULL UNIQUE,
  trip_id         TEXT NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
  version         TEXT,
  status          TEXT DEFAULT 'draft',          -- draft | sent | accepted | superseded
  currency        TEXT DEFAULT 'USD',
  total_amount    NUMERIC(12,2),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotation_line_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id    TEXT NOT NULL REFERENCES quotations(quotation_id) ON DELETE CASCADE,
  category        TEXT,                           -- Experiences | Stays | Transfers | Fees | Other
  description     TEXT NOT NULL,
  amount          NUMERIC(12,2),
  currency        TEXT DEFAULT 'USD',
  notes           TEXT,
  sort_order      INT DEFAULT 0
);
`.trim()

const CREATE_PAYMENTS = `
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id      TEXT NOT NULL UNIQUE,
  trip_id         TEXT NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
  quotation_id    TEXT REFERENCES quotations(quotation_id),
  direction       TEXT DEFAULT 'inbound',         -- inbound (client→CQ) | outbound (CQ→vendor)
  amount          NUMERIC(12,2) NOT NULL,
  currency        TEXT DEFAULT 'USD',
  payment_method  TEXT,                           -- Bank Transfer | Card | UPI | Cash | Other
  status          TEXT DEFAULT 'completed',        -- pending | completed | failed | refunded
  payment_date    DATE NOT NULL,
  reference       TEXT,                           -- bank ref / txn ID
  vendor_name     TEXT,                           -- for outbound payments
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
`.trim()

const CREATE_INVOICES = `
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      TEXT NOT NULL UNIQUE,
  trip_id         TEXT NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
  quotation_id    TEXT REFERENCES quotations(quotation_id),
  invoice_number  TEXT,
  status          TEXT DEFAULT 'issued',           -- draft | issued | paid | cancelled
  amount          NUMERIC(12,2),
  currency        TEXT DEFAULT 'USD',
  issued_date     DATE,
  due_date        DATE,
  file_url        TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
`.trim()

async function main() {
  console.log('Checking financial tables...\n')

  const tables = [
    { name: 'quotations',           sql: CREATE_QUOTATIONS },
    { name: 'quotation_line_items', sql: null },            // covered by quotations sql above
    { name: 'payments',             sql: CREATE_PAYMENTS  },
    { name: 'invoices',             sql: CREATE_INVOICES  },
  ]

  const missingSQL = []

  for (const t of tables) {
    if (!t.sql) continue   // sub-table, checked via parent
    const exists = await tableExists(t.name)
    console.log(`  ${exists ? '✓' : '✗'} ${t.name}`)
    if (!exists) missingSQL.push(t.sql)
  }

  // Also check quotation_line_items
  const liExists = await tableExists('quotation_line_items')
  console.log(`  ${liExists ? '✓' : '✗'} quotation_line_items`)

  if (missingSQL.length === 0) {
    console.log('\n✓ All financial tables already exist — no action needed.')
    return
  }

  console.log('\n══════════════════════════════════════════════════════════════')
  console.log('RUN THIS SQL IN YOUR SUPABASE SQL EDITOR:')
  console.log('══════════════════════════════════════════════════════════════\n')
  console.log(missingSQL.join('\n\n'))
  console.log('\n══════════════════════════════════════════════════════════════')
}

main().catch(console.error)
