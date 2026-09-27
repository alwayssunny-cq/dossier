import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Traveler, Trip } from '@/lib/types'
import { ARCHETYPES } from '@/lib/archetypes'
import PageSection from '@/components/PageSection'
import MetaList from '@/components/MetaList'

/**
 * About You — what the dossier already knows, told back.
 *
 * This route used to open straight into the archetype quiz, which asked the
 * reader to do work before it gave them anything. A returning client has a
 * history sitting in CQ Travelers and CQ Trips: who they travel with, where
 * they have been, how long they stay, which months they choose. Read together
 * that is a portrait, and it is more interesting than a questionnaire.
 *
 * The reading is still here, at the end, as an invitation rather than a gate.
 */

export const dynamic = 'force-dynamic'

function year(d: string | null): number | null {
  if (!d) return null
  const n = Number(d.slice(0, 4))
  return Number.isFinite(n) ? n : null
}

function nights(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const n = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000)
  return n > 0 ? n : null
}

/** The most frequent value, and how often — used for months and companions. */
function commonest(values: string[]): { value: string; count: number } | null {
  const tally = new Map<string, number>()
  for (const v of values) tally.set(v, (tally.get(v) ?? 0) + 1)
  const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]
  return best ? { value: best[0], count: best[1] } : null
}

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']

export default async function UnderstandYouPage() {
  const supabase = await createClient()
  const db = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const rawPhone = user.phone ?? ''
  const digits10 = rawPhone.replace(/^\+?91/, '')
  const orClause = [...new Set([digits10, '91'+digits10, '+91'+digits10, rawPhone].filter(Boolean))]
    .map(p => `phone.eq.${p}`).join(',')

  const { data: travelerRows } = await db
    .from('travelers').select('full_name, client_id').or(orClause)
    .order('is_primary', { ascending: false })
  const traveler = (travelerRows?.[0] ?? null) as Pick<Traveler, 'full_name' | 'client_id'> | null

  const firstName = (traveler?.full_name?.trim().split(/\s+/)[0] ?? 'there').replace(/\.+$/, '')
  const clientId = traveler?.client_id ?? null

  let archetypeCode: string | null = null
  let companions: Traveler[] = []
  let trips: Trip[] = []

  if (clientId) {
    const [{ data: client }, { data: people }, { data: tripRows }] = await Promise.all([
      db.from('clients').select('archetype_code').eq('id', clientId).maybeSingle(),
      db.from('travelers').select('*').eq('client_id', clientId),
      db.from('trips').select('*').eq('client_id', clientId)
        .order('start_date', { ascending: true }),
    ])
    archetypeCode = (client as { archetype_code: string | null } | null)?.archetype_code ?? null
    companions = (people as Traveler[]) ?? []
    trips = (tripRows as Trip[]) ?? []
  }

  const archetype = archetypeCode ? ARCHETYPES[archetypeCode] : null

  // ── What the record adds up to ────────────────────────────────────────────
  const countries = [...new Set(trips.map(t => t.destination_country).filter(Boolean) as string[])]
  const years = trips.map(t => year(t.start_date)).filter((n): n is number => n != null)
  const totalNights = trips.reduce((sum, t) => sum + (nights(t.start_date, t.end_date) ?? 0), 0)
  const months = trips
    .map(t => (t.start_date ? MONTHS[Number(t.start_date.slice(5, 7)) - 1] : null))
    .filter((m): m is string => !!m)
  const favouriteMonth = commonest(months)
  const others = companions.filter(c => c.full_name !== traveler?.full_name)
  const partySize = companions.length

  const hasHistory = trips.length > 0

  return (
    <main className="cq-shell" style={{ paddingTop: 'var(--space-16)', paddingBottom: 'var(--space-24)' }}>
      <p className="cq-label">About you</p>
      <h1 className="cq-t1" style={{ margin: 'var(--space-2) 0 0', color: 'var(--color-text)' }}>
        {firstName}
      </h1>

      {/* ── The portrait ─────────────────────────────────────────────────── */}
      <p className="cq-body cq-measure" style={{ marginTop: 'var(--space-6)' }}>
        {hasHistory ? (
          <>
            {trips.length === 1
              ? 'One journey with us so far'
              : `${trips.length} journeys with us`}
            {countries.length > 0 && <> — {countries.join(', ')}</>}
            {years.length > 0 && (
              <>, {Math.min(...years) === Math.max(...years)
                ? `in ${Math.min(...years)}`
                : `between ${Math.min(...years)} and ${Math.max(...years)}`}</>
            )}
            {totalNights > 0 && <>. {totalNights} nights away, all told</>}.
          </>
        ) : (
          <>Your first journey with us is still ahead. What follows will fill in as you travel.</>
        )}
      </p>

      {/* ── Where you have been ──────────────────────────────────────────── */}
      {hasHistory && (
        <PageSection index={1} title="Where you have been">
          <div className="cq-split">
            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {trips.map((t, i) => {
                const n = nights(t.start_date, t.end_date)
                const place = [t.state_county, t.destination_country].filter(Boolean).join(', ')
                return (
                  <li
                    key={t.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '3.5rem 1fr',
                      columnGap: 'var(--space-5)',
                      alignItems: 'baseline',
                      paddingTop: i === 0 ? 0 : 'var(--space-4)',
                      paddingBottom: 'var(--space-4)',
                      borderTop: i === 0 ? 'none' : '1px solid var(--color-rule)',
                    }}
                  >
                    <span className="cq-label" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {year(t.start_date) ?? '—'}
                    </span>
                    <span>
                      <span
                        className="font-optima"
                        style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}
                      >
                        {place || t.trip_name}
                      </span>
                      {n != null && (
                        <span className="cq-label" style={{ display: 'block', marginTop: '2px' }}>
                          {n} night{n === 1 ? '' : 's'}
                        </span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ol>

            <aside className="cq-col-rule cq-split-sticky">
              <MetaList
                rows={[
                  { label: 'Countries', value: countries.length ? String(countries.length) : null },
                  { label: 'Nights away', value: totalNights ? String(totalNights) : null },
                  {
                    label: 'Month you choose most',
                    value: favouriteMonth && favouriteMonth.count > 1 ? favouriteMonth.value : null,
                  },
                  { label: 'Usually travelling as', value: partySize > 1 ? `${partySize} people` : 'One' },
                ]}
              />
            </aside>
          </div>
        </PageSection>
      )}

      {/* ── Who you travel with ──────────────────────────────────────────── */}
      {others.length > 0 && (
        <PageSection index={hasHistory ? 2 : 1} title="Who you travel with">
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            {others.map(p => (
              <div
                key={p.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,1fr) auto',
                  gap: 'var(--space-4)',
                  alignItems: 'baseline',
                  paddingBottom: 'var(--space-4)',
                  borderBottom: '1px solid var(--color-rule)',
                }}
              >
                <span
                  className="font-optima"
                  style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}
                >
                  {p.full_name}
                </span>
                {p.relationship && <span className="cq-label">{p.relationship}</span>}
              </div>
            ))}
          </div>
        </PageSection>
      )}

      {/* ── The reading ──────────────────────────────────────────────────── */}
      <PageSection
        index={(hasHistory ? 1 : 0) + (others.length > 0 ? 1 : 0) + 1}
        title={archetype ? 'Your reading' : 'The reading'}
      >
        {archetype ? (
          <div className="cq-split">
            <div>
              <h3 className="cq-t1-sm" style={{ margin: 0, color: 'var(--color-text)' }}>
                {archetype.name}
              </h3>
              <p className="cq-body" style={{ marginTop: 'var(--space-4)', marginBottom: 0 }}>
                {archetype.essence}
              </p>
              <p style={{ marginTop: 'var(--space-6)', marginBottom: 0 }}>
                <Link
                  href="/understand-you/reading"
                  className="font-optima"
                  style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-accent)' }}
                >
                  Take it again →
                </Link>
              </p>
            </div>
            <aside className="cq-col-rule">
              <MetaList rows={[{ label: 'Code', value: archetype.code }]} />
            </aside>
          </div>
        ) : (
          <>
            <p className="cq-body cq-measure" style={{ margin: 0 }}>
              A short reading — a handful of questions that tell us how you like to
              move, so the places we choose already suit you.
            </p>
            <p style={{ marginTop: 'var(--space-6)', marginBottom: 0 }}>
              <Link
                href="/understand-you/reading"
                className="font-optima cq-tap-link"
                style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-accent)' }}
              >
                Begin →
              </Link>
            </p>
          </>
        )}
      </PageSection>
    </main>
  )
}
