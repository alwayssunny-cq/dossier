import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import type { Traveler } from '@/lib/types'
import DashboardHeader from '@/components/DashboardHeader'
import CQLogo from '@/components/CQLogo'
import Link from 'next/link'

const PILLARS = [
  {
    title: 'Intentional travel',
    body: 'Every trip we design begins with a question, not a destination. We ask why before where — because the right answer changes everything.',
  },
  {
    title: 'No packages, no templates',
    body: 'Closequarters doesn\'t sell itineraries off a shelf. Every designed journey is built from scratch, around your specific life, preferences, and timing.',
  },
  {
    title: 'The designer relationship',
    body: 'Think of us less as a travel agency and more as a trusted friend who happens to know everywhere. We carry context between trips so you never have to repeat yourself.',
  },
  {
    title: 'Quiet, not loud',
    body: 'We\'re drawn to the understated — the guesthouse that doesn\'t advertise, the restaurant with no signage, the experience that isn\'t on any list.',
  },
]

export default async function UnderstandCQPage() {
  const supabase = await createClient()
  const db = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const rawPhone = user.phone ?? ''
  const digits10 = rawPhone.replace(/^\+?91/, '')
  const orClause = [...new Set([digits10, '91'+digits10, '+91'+digits10, rawPhone].filter(Boolean))]
    .map(p => `phone.eq.${p}`).join(',')
  const { data: travelerRows } = await db
    .from('travelers').select('full_name, client_id').or(orClause).order('is_primary', { ascending: false })
  const traveler = (travelerRows?.[0] ?? null) as Pick<Traveler, 'full_name' | 'client_id'> | null
  const firstName = (traveler?.full_name?.trim().split(/\s+/)[0] ?? 'there').replace(/\.+$/, '')

  let archetypeName: string | null = null
  if (traveler?.client_id) {
    const { data: clientRow } = await db
      .from('clients').select('archetype_name').eq('id', traveler.client_id).maybeSingle()
    archetypeName = (clientRow as { archetype_name: string | null } | null)?.archetype_name ?? null
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-surface)' }}>
      <main className="mx-auto px-5" style={{ maxWidth: '680px', paddingTop: '32px', paddingBottom: 'var(--pad-96)' }}>

        <DashboardHeader firstName={firstName} />

        {/* Header */}
        <div style={{ marginBottom: 'var(--pad-48)' }}>
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
            Our approach
          </p>
          <h1 className="cq-t1" style={{ fontSize: 'var(--text-t1)', lineHeight: 1.05, color: 'var(--color-text)', marginBottom: '16px' }}>
            Understand CQ
          </h1>
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
            Closequarters is a studio, not an agency. We design vacations for people who have high standards for how they spend their time — and who know that depth rarely announces itself.
          </p>
        </div>

        {/* Pillars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {PILLARS.map((pillar, i) => (
            <div
              key={i}
              style={{
                paddingTop: '28px',
                paddingBottom: '28px',
                borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
              }}
            >
              <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', marginBottom: '10px', lineHeight: 1.5 }}>
                {pillar.title}
              </p>
              <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
                {pillar.body}
              </p>
            </div>
          ))}
        </div>

        {/* Quote */}
        <div style={{ paddingTop: 'var(--pad-48)', paddingBottom: 'var(--pad-48)', textAlign: 'center' }}>
          <p
            className="cq-subhead"
            style={{ fontSize: 'var(--text-subhead)', color: 'var(--color-text-accent)', lineHeight: 1.4, letterSpacing: '0.01em', maxWidth: '400px', margin: '0 auto' }}
          >
            &ldquo;There&rsquo;s a part of you waiting to be found somewhere else.&rdquo;
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '20px', opacity: 0.35 }}>
            <div style={{ height: '0.5px', width: '28px', backgroundColor: 'var(--color-text-accent)' }} />
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', letterSpacing: '4px' }}>· · ·</span>
            <div style={{ height: '0.5px', width: '28px', backgroundColor: 'var(--color-text-accent)' }} />
          </div>
        </div>

        {/* CTA: archetype quiz — result state once taken, prompt otherwise */}
        <div style={{ backgroundColor: 'var(--color-surface-sunken)', border: '0.5px solid rgb(var(--borges-rgb) / 0.14)', borderRadius: '10px', padding: '28px 24px', marginBottom: 'var(--pad-40)' }}>
          {archetypeName ? (
            <>
              <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', marginBottom: '8px' }}>
                You&rsquo;re {archetypeName}
              </p>
              <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: '18px' }}>
                Every recommendation on your dossier is shaped around it.
              </p>
              <Link
                href="/understand-you/reading"
                className="font-optima"
                style={{
                  display: 'inline-block',
                  fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
                  color: 'var(--color-text-accent)', backgroundColor: 'transparent',
                  border: '0.5px solid rgb(var(--borges-rgb) / 0.35)',
                  padding: '10px 20px', borderRadius: '3px',
                  textDecoration: 'none',
                }}
              >
                Retake
              </Link>
            </>
          ) : (
            <>
              <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', marginBottom: '8px' }}>
                Curious where you fit?
              </p>
              <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: '18px' }}>
                Find your travel archetype and help us tailor every recommendation to your specific way of experiencing the world.
              </p>
              <Link
                href="/understand-you/reading"
                className="font-optima"
                style={{
                  display: 'inline-block',
                  fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
                  color: 'var(--color-surface)', backgroundColor: 'var(--color-text-accent)',
                  padding: '10px 20px', borderRadius: '3px',
                  textDecoration: 'none',
                }}
              >
                Find your archetype
              </Link>
            </>
          )}
        </div>

        {/* Back */}
        <Link
          href="/dashboard"
          className="font-optima"
          style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: '44px', gap: '6px' }}
        >
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
            <path d="M11 5H1M5 1L1 5l4 4" stroke="#6B696C" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to dashboard
        </Link>

        <footer style={{ paddingTop: 'var(--pad-40)', borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.08)', marginTop: 'var(--pad-40)' }}>
          <CQLogo variant="muted" height={36} />
        </footer>
      </main>
    </div>
  )
}
