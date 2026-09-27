import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminAuth'

const PROJECT_REF = 'xuuzzsrilmifzujvmdox'

// Query current unique constraints on the three tables
const QUERY_SQL = `
SELECT constraint_name, table_name
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND constraint_type = 'UNIQUE'
  AND table_name IN ('experiences', 'stays', 'transfers')
ORDER BY table_name, constraint_name;
`.trim()

// Drop the three known blocking constraints
const DROP_SQL = `
ALTER TABLE experiences DROP CONSTRAINT IF EXISTS unique_experience_per_trip;
ALTER TABLE stays       DROP CONSTRAINT IF EXISTS unique_stay_per_trip;
ALTER TABLE transfers   DROP CONSTRAINT IF EXISTS unique_transfer_per_trip;
`.trim()

async function mgmtQuery(token: string, query: string) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    },
  )
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = process.env.SUPABASE_ACCESS_TOKEN

  if (!token) {
    return NextResponse.json({
      success: false,
      action: 'manual_sql_required',
      step1_diagnose: 'Run this first in Supabase SQL Editor to see what constraints exist:',
      diagnoseSql: QUERY_SQL,
      step2_fix: 'Then run this to drop the blocking constraints:',
      sql: DROP_SQL,
      instructions: [
        '1. Open Supabase dashboard → SQL Editor',
        '2. Run the diagnoseSql first — check if the three constraints appear',
        '3. Run the sql to drop them',
        '4. Re-sync: POST /api/sync-drawing-board with {"preview":false,"iterationPageId":"348cc540df0981448a27ead04aeb5605","tripId":"TRIP-4"}',
      ],
      optionalAutoFix: 'Set SUPABASE_ACCESS_TOKEN=<personal-access-token> in .env.local and call this endpoint again to auto-apply.',
    })
  }

  // ── Step 1: Query what constraints actually exist right now ──────────────────
  const { ok: qOk, body: qBody } = await mgmtQuery(token, QUERY_SQL)

  type ConstraintRow = { constraint_name: string; table_name: string }
  const allConstraints: ConstraintRow[] = qOk && Array.isArray(qBody) ? qBody : []
  const TARGET = ['unique_experience_per_trip', 'unique_stay_per_trip', 'unique_transfer_per_trip']
  const targetFound = allConstraints.filter(c => TARGET.includes(c.constraint_name))
  const otherFound = allConstraints.filter(c => !TARGET.includes(c.constraint_name))

  if (!qOk) {
    return NextResponse.json({
      success: false,
      message: 'Management API query failed — could not inspect current constraints.',
      queryError: qBody,
      fallbackSql: DROP_SQL,
    }, { status: 500 })
  }

  // ── Step 2: If none of the target constraints exist, they're already gone ────
  if (targetFound.length === 0) {
    return NextResponse.json({
      success: true,
      verdict: 'ALL THREE TARGET CONSTRAINTS ARE ALREADY ABSENT',
      allUniqueConstraints: allConstraints,
      message: 'The constraints do not exist in the DB. If syncs are still failing with [23505], this is a PostgREST schema cache issue.',
      nextSteps: [
        '1. Go to Supabase dashboard → Settings → API → click "Reload schema cache"',
        '2. Or restart the project (Settings → General → Restart)',
        '3. Then re-run: POST /api/sync-drawing-board with preview=false',
      ],
    })
  }

  // ── Step 3: Drop the constraints that still exist ────────────────────────────
  // Build targeted DROP SQL for only what we confirmed exists
  const targetedDropSql = targetFound
    .map(c => `ALTER TABLE ${c.table_name} DROP CONSTRAINT IF EXISTS ${c.constraint_name};`)
    .join('\n')

  const { ok: dropOk, status: dropStatus, body: dropBody } = await mgmtQuery(token, targetedDropSql)

  if (!dropOk) {
    return NextResponse.json({
      success: false,
      verdict: `FOUND ${targetFound.length} CONSTRAINT(S) — DROP FAILED`,
      constraintsFound: targetFound,
      otherUniqueConstraints: otherFound,
      dropApiStatus: dropStatus,
      dropApiError: dropBody,
      manualSql: targetedDropSql,
    }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    verdict: `DROPPED ${targetFound.length} CONSTRAINT(S) SUCCESSFULLY`,
    droppedConstraints: targetFound,
    otherUniqueConstraintsUnchanged: otherFound,
    detail: dropBody,
    nextStep: 'Re-run the 6/4 sync: POST /api/sync-drawing-board with {"preview":false,"iterationPageId":"348cc540df0981448a27ead04aeb5605","tripId":"TRIP-4","password":"..."}',
  })
}
