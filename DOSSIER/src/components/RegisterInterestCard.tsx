'use client'

import NewTripRequestCard from '@/components/NewTripRequestCard'

interface Props {
  clientId: string | null
  firstName: string
  /** Pre-filled into the form and editable, so nothing already on file is retyped. */
  clientName?: string | null
  clientEmail?: string | null
  clientPhone?: string | null
  dark?: boolean
}

export default function RegisterInterestCard({
  clientId, firstName, clientName, clientEmail, clientPhone, dark,
}: Props) {
  return (
    <NewTripRequestCard
      clientId={clientId}
      firstName={firstName}
      clientName={clientName}
      clientEmail={clientEmail}
      clientPhone={clientPhone}
      customTrigger={open => (
        <button
          onClick={open}
          className="card-lift"
          style={{
            width: '100%',
            background: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            border: dark
              ? '0.5px solid rgb(var(--borges-rgb) / 0.22)'
              : '0.5px solid rgb(var(--borges-rgb) / 0.18)',
            borderRadius: '10px',
            padding: '24px',
            boxShadow: dark ? 'none' : '0 2px 4px rgb(var(--night-rgb) / 0.05), 0 12px 32px rgb(var(--night-rgb) / 0.10), 0 28px 64px rgb(var(--night-rgb) / 0.07)',
            backgroundColor: dark ? 'rgb(var(--mist-rgb) / 0.05)' : 'var(--color-surface-sunken)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            boxSizing: 'border-box',
          }}
        >
          <div>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              backgroundColor: dark ? 'rgb(var(--borges-rgb) / 0.15)' : 'rgb(var(--borges-rgb) / 0.10)',
              border: dark ? '0.5px solid rgb(var(--borges-rgb) / 0.3)' : '0.5px solid rgb(var(--borges-rgb) / 0.20)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '14px',
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke={dark ? 'var(--color-text-accent)' : 'var(--color-text-accent)'} strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </div>
            <p style={{
              fontFamily: "'CQ Optima', 'Optima', sans-serif",
              fontSize: 'var(--text-caption)',
              letterSpacing: '0.01em',

              color: dark ? 'rgb(var(--borges-rgb) / 0.65)' : 'var(--color-text-muted)',
              marginBottom: '6px',
            }}>
              Plan a trip
            </p>
            <p
              className="cq-subhead"
              style={{
                color: dark ? 'rgb(var(--mist-rgb) / 0.92)' : 'var(--color-text)',
                marginBottom: '5px',
              }}
            >
              Register your interest
            </p>
            <p style={{
              fontFamily: "'CQ Optima', 'Optima', sans-serif",
              fontSize: 'var(--text-body)',
              color: dark ? 'rgb(var(--mist-rgb) / 0.45)' : 'var(--color-text-accent)',
              lineHeight: 1.6,
            }}>
              Tell us where you want to go — we&rsquo;ll design the rest.
            </p>
          </div>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: '2px', opacity: 0.45 }}>
            <path d="M2 7h10M8 3l4 4-4 4"
              stroke={dark ? 'rgb(var(--mist-rgb) / 0.8)' : 'var(--color-text-accent)'}
              strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    />
  )
}
