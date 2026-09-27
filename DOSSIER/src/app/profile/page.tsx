import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import type { Traveler } from '@/lib/types'
import DashboardHeader from '@/components/DashboardHeader'
import CQLogo from '@/components/CQLogo'
import Link from 'next/link'

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div style={{ paddingTop: '16px', paddingBottom: '16px', borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.10)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)' }}>
        {label}
      </p>
      <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', lineHeight: 1.5 }}>
        {value}
      </p>
    </div>
  )
}

function TagRow({ label, values }: { label: string; values: string[] | null | undefined }) {
  if (!values?.length) return null
  return (
    <div style={{ paddingTop: '16px', paddingBottom: '16px', borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.10)' }}>
      <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
        {label}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {values.map((v, i) => (
          <span
            key={i}
            className="font-optima"
            style={{
              fontSize: 'var(--text-caption)', padding: '4px 10px', borderRadius: '3px',
              backgroundColor: 'rgb(var(--borges-rgb) / 0.10)',
              border: '0.5px solid rgb(var(--borges-rgb) / 0.18)',
              color: 'var(--color-text-accent)',
            }}
          >
            {v}
          </span>
        ))}
      </div>
    </div>
  )
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const db = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const rawPhone = user.phone ?? ''
  const digits10 = rawPhone.replace(/^\+?91/, '')
  const orClause = [...new Set([digits10, '91'+digits10, '+91'+digits10, rawPhone].filter(Boolean))]
    .map(p => `phone.eq.${p}`).join(',')

  const { data: travelerRows } = await db
    .from('travelers').select('*').or(orClause).order('is_primary', { ascending: false })
  const traveler = (travelerRows?.[0] ?? null) as Traveler | null

  const firstName = (traveler?.full_name?.trim().split(/\s+/)[0] ?? 'there').replace(/\.+$/, '')

  function fmtDob(d: string | null) {
    if (!d) return null
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) }
    catch { return null }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-surface)' }}>
      <main className="mx-auto px-5" style={{ maxWidth: '680px', paddingTop: '32px', paddingBottom: 'var(--pad-96)' }}>

        <DashboardHeader firstName={firstName} />

        {/* Page title */}
        <div style={{ marginBottom: 'var(--pad-40)' }}>
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
            Your Account
          </p>
          <h1 className="cq-t1" style={{ fontSize: 'var(--text-t1)', lineHeight: 1.05, color: 'var(--color-text)' }}>
            What we know about you
          </h1>
        </div>

        {!traveler ? (
          /* No traveler record found */
          <div
            style={{
              padding: '36px 28px', border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
              borderRadius: '8px', backgroundColor: 'var(--color-surface-sunken)', textAlign: 'center',
            }}
          >
            <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', marginBottom: '8px' }}>No profile found</p>
            <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)', lineHeight: 1.65 }}>
              Your profile hasn&rsquo;t been linked yet. Message us on WhatsApp and we&rsquo;ll connect your account.
            </p>
          </div>
        ) : (
          <>
            {/* Personal details */}
            <div
              style={{
                backgroundColor: 'var(--color-surface-sunken)',
                border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
                borderRadius: '10px',
                padding: '6px 24px 6px',
                marginBottom: '24px',
              }}
            >
              <Row label="Full name"       value={traveler.full_name} />
              <Row label="Passport name"   value={traveler.passport_name} />
              <Row label="Nationality"     value={traveler.nationality} />
              <Row label="Date of birth"   value={fmtDob(traveler.date_of_birth)} />
              <Row label="Email"           value={traveler.email} />
              <Row label="Phone"           value={traveler.phone} />
              <Row label="Relationship"    value={traveler.relationship} />
            </div>

            {/* Dietary & preferences */}
            {(traveler.diet_type?.length || traveler.restrictions?.length || traveler.allergies?.length) && (
              <div
                style={{
                  backgroundColor: 'var(--color-surface-sunken)',
                  border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
                  borderRadius: '10px',
                  padding: '6px 24px 6px',
                  marginBottom: '24px',
                }}
              >
                <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', paddingTop: '16px', paddingBottom: '4px' }}>
                  Diet &amp; Preferences
                </p>
                <TagRow label="Eats"         values={traveler.diet_type} />
                <TagRow label="Restrictions" values={traveler.restrictions} />
                <TagRow label="Allergies"    values={traveler.allergies} />
              </div>
            )}

            {/* Notes */}
            {traveler.notes && (
              <div
                style={{
                  backgroundColor: 'var(--color-surface-sunken)',
                  border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
                  borderRadius: '10px',
                  padding: '18px 24px',
                  marginBottom: '24px',
                }}
              >
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                  Notes
                </p>
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)', lineHeight: 1.75 }}>
                  {traveler.notes}
                </p>
              </div>
            )}

            {/* Amendment note */}
            <div style={{ paddingTop: '20px', borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.10)' }}>
              <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)', lineHeight: 1.65 }}>
                Something incorrect or out of date? Let us know on{' '}
                <a href="https://wa.me/919884256431" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-text-accent)' }}>WhatsApp</a>
                {' '}and we&rsquo;ll update it.
              </p>
            </div>
          </>
        )}

        {/* Back link */}
        <div style={{ marginTop: 'var(--pad-48)' }}>
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
        </div>

        <footer style={{ paddingTop: 'var(--pad-40)', borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.08)', marginTop: 'var(--pad-40)' }}>
          <CQLogo variant="muted" height={36} />
        </footer>
      </main>
    </div>
  )
}
