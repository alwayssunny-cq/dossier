'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const BUDGETS = [
  'Flexible',
  'Under $5,000',
  '$5,000 – $10,000',
  '$10,000 – $20,000',
  '$20,000+',
]

const PANEL_IMAGE = 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=900&h=700&auto=format&fit=crop&q=85'

const INPUT_BASE: React.CSSProperties = {
  backgroundColor: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--color-border-interactive)',
  borderRadius: 0,
  padding: '10px 0',
  color: 'var(--color-text)',
  fontSize: 'var(--text-body)',
  fontFamily: 'inherit',
  width: '100%',
  outline: 'none',
}

const LABEL_BASE: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-caption)',
  color: 'var(--color-text-muted)',
  marginBottom: '6px',
  fontFamily: 'var(--font-body)',
}

interface Props {
  clientId: string | null
  /** On file already — shown pre-filled and editable rather than asked again. */
  clientName?: string | null
  clientEmail?: string | null
  clientPhone?: string | null
  firstName?: string
  prefilledDestination?: string
  customTrigger?: (open: () => void) => React.ReactNode
}

export default function NewTripRequestCard({
  clientId, firstName, prefilledDestination, customTrigger,
  clientName, clientEmail, clientPhone,
}: Props) {
  const router = useRouter()
  const [open, setOpen]             = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [panelLoaded, setPanelLoaded] = useState(false)

  const [destination, setDestination] = useState(prefilledDestination ?? '')
  const [travelMonth, setTravelMonth] = useState('')
  const [duration, setDuration]       = useState('')
  const [budget, setBudget]           = useState('')
  const [theQuestion, setTheQuestion] = useState('')
  const [notes, setNotes]             = useState('')

  // The dossier already holds these. They are shown so the client can correct
  // them, not so they can type them again.
  const [name,  setName]  = useState(clientName  ?? '')
  const [email, setEmail] = useState(clientEmail ?? '')
  const [phone, setPhone] = useState(clientPhone ?? '')
  const [adults,   setAdults]   = useState(2)
  const [children, setChildren] = useState(0)
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR')

  function openModal(dest?: string) {
    if (dest) setDestination(dest)
    setOpen(true)
    setSubmitted(false)
    setError(null)
  }

  function closeModal() {
    setOpen(false)
    setDestination(prefilledDestination ?? '')
    setTravelMonth(''); setDuration('')
    setAdults(2); setChildren(0); setCurrency('INR'); setBudget('')
    setTheQuestion(''); setNotes('')
    setSubmitted(false); setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true); setError(null)
    try {
      const notesWithDetails = [
        duration    && `Duration: ${duration}`,
        travelMonth && `Travel month: ${travelMonth}`,
        children > 0 && `Children: ${children}`,
        budget && `Budget currency: ${currency}`,
        notes,
      ].filter(Boolean).join('. ') || null

      const res = await fetch('/api/trip-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:         clientId,
          contact_name:      name  || null,
          contact_email:     email || null,
          contact_phone:     phone || null,
          destination_ideas: destination,
          start_date:        travelMonth ? `${travelMonth}-01` : null,
          end_date:          null,
          travelers_count:   adults + children,
          budget_range:      budget     || null,
          the_question:      theQuestion || null,
          additional_notes:  notesWithDetails,
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Failed to submit')
      }
      setSubmitted(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
    setSubmitting(false)
  }

  return (
    <>
      {/* ── Trigger ── */}
      {customTrigger ? (
        customTrigger(() => openModal())
      ) : (
        /* Editorial line trigger */
        <button
          onClick={() => openModal()}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.12)',
            paddingTop: '20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            textAlign: 'left',
          }}
        >
          <div>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: 'var(--text-subhead)',
                color: 'var(--color-text)',
                marginBottom: '4px',
                lineHeight: 1.2,
              }}
            >
              Plan a new designed journey
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-accent)',
              }}
            >
              Tell us what you&rsquo;re dreaming of
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div style={{ width: '28px', height: '0.5px', backgroundColor: 'var(--color-text-accent)', opacity: 0.5 }} />
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.6 }}>
              <path d="M2 7h10M8 3l4 4-4 4" stroke="#706E56" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>
      )}

      {/* ── Modal overlay ── */}
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: [
              'radial-gradient(ellipse at center,',
              '  rgb(var(--night-rgb) / 0.18) 0%,',
              '  rgb(var(--night-rgb) / 0.82) 55%,',
              '  rgb(var(--night-rgb) / 0.94) 100%)',
            ].join(' '),
            backdropFilter: 'blur(18px) saturate(0.66) brightness(0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '28px 24px calc(28px + 8vh)',
          }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div
            style={{
              width: 'min(1020px, calc(100vw - 48px))',
              maxHeight: '88vh',
              // Opaque: the translucent sunken tint takes on the scrim behind
              // it and turns the whole panel grey.
              backgroundColor: 'var(--color-panel)',
              border: '0.5px solid rgb(var(--borges-rgb) / 0.15)',
              borderRadius: '12px',
              overflow: 'hidden',
              display: 'flex',
              animation: 'fadeSlideUp 0.28s ease',
            }}
          >
            {/* ── Left panel — cinematic image ── */}
            <div
              style={{
                flex: '0 0 42%',
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: 'var(--color-surface)',
              }}
            >
              {!panelLoaded && <div className="skeleton absolute inset-0" style={{ borderRadius: 0 }} />}

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PANEL_IMAGE}
                alt="Travel"
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%', objectFit: 'cover',
                  filter: 'brightness(0.55) saturate(0.85)',
                  transition: 'opacity 0.6s ease',
                  opacity: panelLoaded ? 1 : 0,
                }}
                onLoad={() => setPanelLoaded(true)}
                onError={() => setPanelLoaded(true)}
              />

              {/* Deep gradient */}
              <div
                style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(to top, rgb(var(--night-rgb) / 0.97) 0%, rgb(var(--night-rgb) / 0.28) 50%, transparent 100%)',
                }}
              />

              {/* Panel text */}
              <div style={{ position: 'absolute', bottom: '36px', left: '32px', right: '32px' }}>
                <p
                  className="font-optima"
                  style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '16px' }}
                >
                  A new chapter
                </p>
                <h3
                  className="cq-t1"
                  style={{
                    fontSize: 'var(--text-t1)',
                    color: 'rgb(var(--mist-rgb) / 0.97)',
                    lineHeight: 1.02,
                    marginBottom: '18px',
                  }}
                >
                  {firstName ? `Where shall we\ntake you next,\n${firstName}?` : 'Where shall we\ntake you next?'}
                </h3>
                <p
                  className="font-optima"
                  style={{ fontSize: 'var(--text-body)', color: 'rgb(var(--fade-rgb) / 0.78)', lineHeight: 1.65, }}
                >
                  &ldquo;There&rsquo;s a part of you waiting to be found somewhere else.&rdquo;
                </p>
                <div style={{ height: '0.5px', width: '28px', backgroundColor: 'var(--color-text-accent)', opacity: 0.4, marginTop: '20px' }} />
              </div>
            </div>

            {/* ── Right panel — form ── */}
            <div
              style={{
                flex: '1 1 0',
                overflowY: 'auto',
                padding: '36px 32px 44px',
                position: 'relative',
              }}
            >
              {/* Close */}
              <button
                type="button"
                onClick={closeModal}
                style={{
                  position: 'absolute', top: '20px', right: '20px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '4px',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </button>

              {submitted ? (
                /* ── Success state ── */
                <div style={{ paddingTop: '24px' }}>
                  <div
                    style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      backgroundColor: 'rgb(var(--borges-rgb) / 0.1)',
                      border: '0.5px solid rgb(var(--borges-rgb) / 0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: '22px',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12l5 5L20 7" stroke="#6FCF97" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <h3
                    className="cq-t1"
                    style={{ fontSize: 'var(--text-t1)', color: 'var(--color-text)', lineHeight: 1.05, marginBottom: '14px' }}
                  >
                    We&rsquo;ll be in touch
                  </h3>
                  <p
                    className="font-optima"
                    style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)', lineHeight: 1.75, marginBottom: '32px', maxWidth: '280px' }}
                  >
                    Your request has been submitted. We’ll be in touch shortly to begin designing your journey.
                  </p>
                  <button
                    onClick={closeModal}
                    className="font-optima"
                    style={{
                      padding: '0',
                      background: 'none',
                      border: 'none',
                      borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.4)',
                      color: 'var(--color-text-accent)',
                      fontSize: 'var(--text-caption)',
                      letterSpacing: '0.01em',
                      cursor: 'pointer',
                      paddingBottom: '3px',
                    }}
                  >
                    Close
                  </button>
                </div>
              ) : (
                /* ── Form ── */
                <form onSubmit={handleSubmit}>
                  <div style={{ marginBottom: '28px' }}>
                    <p
                      className="cq-label"
                      style={{ marginBottom: 'var(--space-3)' }}
                    >
                      New Designed Journey
                    </p>
                    <h2
                      className="cq-t1"
                      style={{ fontSize: 'var(--text-t1)', color: 'var(--color-text)', lineHeight: 1.05, marginBottom: '10px' }}
                    >
                      Tell us your vision
                    </h2>
                    <p
                      className="font-optima"
                      style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)', lineHeight: 1.65 }}
                    >
                      Share what you&rsquo;re dreaming of — we&rsquo;ll take it from here.
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                    {/* Already on file. Shown so it can be corrected, not
                        so it has to be entered again. */}
                    <div>
                      <label style={LABEL_BASE}>Your details</label>
                      <p className="cq-label" style={{ marginTop: '-2px', marginBottom: 'var(--space-4)' }}>
                        From your dossier — change anything that is out of date.
                      </p>
                      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                        <input
                          type="text" value={name} onChange={e => setName(e.target.value)}
                          placeholder="Name" aria-label="Name" style={INPUT_BASE}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                          <input
                            type="email" value={email} onChange={e => setEmail(e.target.value)}
                            placeholder="Email" aria-label="Email" style={INPUT_BASE}
                          />
                          <input
                            type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                            placeholder="Phone" aria-label="Phone" style={INPUT_BASE}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Destination */}
                    <div>
                      <label style={LABEL_BASE}>Where would you like to go?</label>
                      <input
                        type="text"
                        value={destination}
                        onChange={e => setDestination(e.target.value)}
                        placeholder="Anywhere warm, Japan, the Amalfi Coast…" aria-label="Anywhere warm, Japan, the Amalfi Coast"
                        style={INPUT_BASE}
                      />
                    </div>

                    {/* Travel month + Duration */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={LABEL_BASE}>Travel month</label>
                        <select
                          value={travelMonth}
                          onChange={e => setTravelMonth(e.target.value)}
                          style={{ ...INPUT_BASE, appearance: 'none' as const }}
                        >
                          <option value="">Not sure yet</option>
                          {Array.from({ length: 24 }, (_, i) => {
                            const d = new Date()
                            d.setDate(1)
                            d.setMonth(d.getMonth() + 1 + i)
                            const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
                            const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                            return <option key={value} value={value}>{label}</option>
                          })}
                        </select>
                      </div>
                      <div>
                        <label style={LABEL_BASE}>Duration</label>
                        <select
                          value={duration}
                          onChange={e => setDuration(e.target.value)}
                          style={{ ...INPUT_BASE, appearance: 'none' as const }}
                        >
                          <option value="">Not sure yet</option>
                          <option value="A weekend (2–3 days)">A weekend (2–3 days)</option>
                          <option value="4–5 days">4–5 days</option>
                          <option value="1 week">1 week</option>
                          <option value="10 days">10 days</option>
                          <option value="2 weeks">2 weeks</option>
                          <option value="3 weeks">3 weeks</option>
                          <option value="1 month+">1 month+</option>
                        </select>
                      </div>
                    </div>

                    {/* Adults and children are separate columns in CQ Clients,
                        so they are asked separately here too. */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={LABEL_BASE}>Adults</label>
                        <input
                          type="number" min={1} max={50}
                          value={adults}
                          onChange={e => setAdults(parseInt(e.target.value) || 1)}
                          style={INPUT_BASE}
                        />
                      </div>
                      <div>
                        <label style={LABEL_BASE}>Children</label>
                        <input
                          type="number" min={0} max={20}
                          value={children}
                          onChange={e => setChildren(parseInt(e.target.value) || 0)}
                          style={INPUT_BASE}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '16px' }}>
                      <div>
                        <label style={LABEL_BASE}>Currency</label>
                        <select
                          value={currency}
                          onChange={e => setCurrency(e.target.value as 'INR' | 'USD')}
                          style={{ ...INPUT_BASE, appearance: 'none' as const }}
                        >
                          <option value="INR">INR</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                      <div>
                        <label style={LABEL_BASE}>Budget range</label>
                        <select
                          value={budget}
                          onChange={e => setBudget(e.target.value)}
                          style={{ ...INPUT_BASE, appearance: 'none' as const }}
                        >
                          <option value="">Select…</option>
                          {BUDGETS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* The Question */}
                    <div>
                      <label style={LABEL_BASE}>The Question</label>
                      <p
                        className="font-optima"
                        style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)', marginBottom: '8px', fontStyle: 'italic', lineHeight: 1.5 }}
                      >
                        It&rsquo;s not about the where — it&rsquo;s about the why.
                      </p>
                      <textarea
                        value={theQuestion}
                        onChange={e => setTheQuestion(e.target.value)}
                        placeholder="What do you want this trip to do for you?" aria-label="What do you want this trip to do for you?"
                        rows={3}
                        style={{ ...INPUT_BASE, resize: 'vertical' as const, lineHeight: 1.6 }}
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label style={LABEL_BASE}>
                        Any other details?{' '}
                        <span style={{ opacity: 0.5 }}>(optional)</span>
                      </label>
                      <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Dietary requirements, mobility needs, must-haves…" aria-label="Dietary requirements, mobility needs, must-haves"
                        rows={2}
                        style={{ ...INPUT_BASE, resize: 'vertical' as const, lineHeight: 1.6 }}
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="font-optima" style={{ marginTop: '14px', fontSize: 'var(--text-caption)', color: 'var(--color-text)' }}>
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="font-optima"
                    style={{
                      marginTop: '28px',
                      width: '100%',
                      padding: '15px',
                      borderRadius: '3px',
                      backgroundColor: submitting ? 'rgb(var(--borges-rgb) / 0.5)' : 'var(--color-text-accent)',
                      border: 'none',
                      color: 'var(--color-surface)',
                      fontSize: 'var(--text-caption)',
                      letterSpacing: '0.01em',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      transition: 'background-color 0.2s ease',
                    }}
                  >
                    {submitting ? 'Sending…' : 'Begin the conversation'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
