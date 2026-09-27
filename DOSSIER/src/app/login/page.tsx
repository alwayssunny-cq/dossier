'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import CQLogo from '@/components/CQLogo'

// Built on first use, never while rendering. A browser client constructed in a
// component body is also constructed during that component's server render,
// where there is no browser environment — which made `next build` depend on
// runtime configuration being present and fail wherever it was not.
let _sb: ReturnType<typeof createClient> | null = null
const sb = () => (_sb ??= createClient())


export default function LoginPage() {
  const [phone, setPhone]     = useState('')
  const [otp, setOtp]         = useState(['', '', '', '', '', ''])
  const [step, setStep]       = useState<'phone' | 'otp'>('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const router      = useRouter()
  const refs        = useRef<(HTMLInputElement | null)[]>([])
  const inputRef    = useRef<HTMLDivElement>(null)
  const sendingRef  = useRef(false)
  const verifyingRef = useRef(false)

  const otpStr = otp.join('')

  async function sendOtp() {
    if (sendingRef.current) return
    sendingRef.current = true
    setError('')
    setLoading(true)

    const target = `+91${phone}`
    console.log('[OTP] sending to', target)

    try {
      const { error: otpError } = await sb().auth.signInWithOtp({ phone: target })
      if (otpError) {
        console.error('[OTP] error:', otpError)
        setError(otpError.message || 'Unable to send verification code right now.')
      } else {
        console.log('[OTP] sent successfully to', target)
        setStep('otp')
      }
    } catch (err) {
      console.error('[OTP] network/fetch error:', err)
      setError('Unable to send verification code right now. Please check your connection.')
    } finally {
      setLoading(false)
      sendingRef.current = false
    }
  }

  async function verifyOtp(code = otpStr) {
    if (code.length < 6) return
    if (verifyingRef.current) return
    verifyingRef.current = true
    setError('')
    setLoading(true)
    try {
      const { error: verifyError } = await sb().auth.verifyOtp({
        phone: `+91${phone}`,
        token: code,
        type: 'sms',
      })
      if (verifyError) {
        console.error('[OTP] verify error:', verifyError)
        setError(verifyError.message)
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err) {
      console.error('[OTP] verify network error:', err)
      setError('Verification failed. Please try again.')
    } finally {
      setLoading(false)
      verifyingRef.current = false
    }
  }

  function onOtpChange(i: number, val: string) {
    const d = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]; next[i] = d; setOtp(next)
    if (d && i < 5) refs.current[i + 1]?.focus()
    const full = next.join('')
    if (full.length === 6) setTimeout(() => verifyOtp(full), 60)
  }

  function onOtpKey(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace') {
      if (otp[i]) { const n = [...otp]; n[i] = ''; setOtp(n) }
      else if (i > 0) refs.current[i - 1]?.focus()
    }
  }

  useEffect(() => {
    if (step === 'otp') setTimeout(() => refs.current[0]?.focus(), 80)
  }, [step])

  const phoneOk = phone.replace(/\D/g, '').length >= 10
  const otpOk   = otpStr.length === 6

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ backgroundColor: 'var(--color-surface-sunken)', padding: '32px 20px' }}
    >
      {/* ── Brand lockup ── */}
      <div className="text-center" style={{ marginBottom: 'var(--pad-48)' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <CQLogo variant="dark" height={80} />
        </div>

        <p
          className="font-optima"
          style={{
            marginTop: 'var(--pad-48)',
            fontSize: 'var(--text-body)',
            color: 'var(--color-text-muted)',
            maxWidth: '320px',
            lineHeight: 1.6,
            textAlign: 'center',
          }}
        >
          There&rsquo;s a part of you waiting to be found somewhere else.
        </p>
      </div>

      {/* ── Card ── */}
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--color-surface-sunken)',
          borderRadius: '16px',
          padding: '44px 40px',
          border: '1px solid rgb(var(--borges-rgb) / 0.10)',
        }}
      >
        {step === 'phone' ? (
          <div style={{ animation: 'fadeSlideUp 0.3s ease forwards' }}>
            <h1
              className="cq-t1 text-center"
              style={{ fontSize: 'var(--text-t1)', marginBottom: '6px', color: 'var(--color-text)' }}
            >
              Welcome back
            </h1>
            <p
              className="font-optima text-center"
              style={{ fontSize: 'var(--text-caption)', lineHeight: 1.65, marginBottom: '36px', color: 'var(--color-text-muted)' }}
            >
              Enter your phone number to continue
            </p>

            <p
              className="font-optima"
              style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', marginBottom: '8px', color: 'var(--color-text-accent)' }}
            >
              Phone Number
            </p>

            <div
              ref={inputRef}
              className="flex items-center"
              style={{
                // A surface token, not a text one. This is a field, and it
                // was borrowing --color-text-secondary for its ground.
                backgroundColor: 'var(--color-surface-inverse)',
                borderRadius: '8px',
                padding: '14px 16px',
                marginBottom: '20px',
                transition: 'box-shadow 0.2s ease',
              }}
              onFocusCapture={() => {
                if (inputRef.current) inputRef.current.style.boxShadow = '0 0 0 1px rgb(var(--borges-rgb) / 0.4)'
              }}
              onBlurCapture={() => {
                if (inputRef.current) inputRef.current.style.boxShadow = 'none'
              }}
            >
              <span className="font-optima flex-shrink-0" style={{ fontSize: 'var(--text-body)', color: 'rgb(var(--mist-rgb) / 0.72)' }}>
                +91
              </span>
              <div
                style={{
                  width: '1px',
                  height: '20px',
                  backgroundColor: 'rgb(var(--borges-rgb) / 0.14)',
                  flexShrink: 0,
                  margin: '0 12px',
                }}
              />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="Your phone number" aria-label="Your phone number"
                className="flex-1 bg-transparent font-optima outline-none"
                style={{
                  fontSize: 'var(--text-body)',
                  color: 'rgb(var(--mist-rgb) / 0.9)',
                  caretColor: 'var(--color-text-accent)',
                  border: 'none',
                }}
                maxLength={10}
                onKeyDown={e => { if (e.key === 'Enter' && phoneOk && !loading) sendOtp() }}
                autoFocus
              />
            </div>

            {error && (
              <p className="font-optima" style={{ fontSize: 'var(--text-caption)', marginBottom: '12px', color: 'var(--color-text-muted)' }}>
                {error}
              </p>
            )}

            <button
              onClick={sendOtp}
              disabled={loading || !phoneOk}
              className="w-full font-optima"
              style={{
                fontSize: 'var(--text-caption)',
                letterSpacing: '0.01em',
                height: '52px',
                borderRadius: '8px',
                border: 'none',
                cursor: !phoneOk || loading ? 'not-allowed' : 'pointer',
                // The card this sits on is light, so the waiting state is dark
                // ink on a light tint — not the inverse, which is what a first
                // guess at "disabled" produced and measured 1.2:1.
                backgroundColor: !phoneOk || loading ? 'rgb(var(--borges-rgb) / 0.09)' : 'var(--color-text-accent)',
                color: !phoneOk || loading ? 'var(--color-text-muted)' : 'var(--mist)',
                transition: 'background-color 0.3s ease',
                marginBottom: '24px',
                animation: loading ? 'pulse 1.5s ease-in-out infinite' : 'none',
              }}
              onMouseEnter={e => {
                if (phoneOk && !loading)
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-text-accent)'
              }}
              onMouseLeave={e => {
                if (phoneOk && !loading)
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-text-accent)'
              }}
              onMouseDown={e => {
                if (phoneOk && !loading)
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)'
              }}
              onMouseUp={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
              }}
            >
              {loading ? 'Sending…' : 'Continue'}
            </button>

            <p
              className="font-optima text-center"
              style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-accent)' }}
            >
              Private Travel Portal
            </p>
          </div>
        ) : (
          <div style={{ animation: 'fadeSlideUp 0.3s ease forwards' }}>
            <button
              onClick={() => { setStep('phone'); setError(''); setOtp(['', '', '', '', '', '']) }}
              className="flex items-center gap-2 font-optima transition-opacity hover:opacity-70"
              style={{
                fontSize: 'var(--text-caption)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                marginBottom: '28px',
                color: 'var(--color-text-muted)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M8 10L4 6l4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Change number
            </button>

            <h2
              className="cq-t1"
              style={{ fontSize: 'var(--text-t1)', marginBottom: '6px', color: 'var(--color-text)' }}
            >
              Verify
            </h2>
            <p
              className="font-optima"
              style={{ fontSize: 'var(--text-caption)', lineHeight: 1.65, marginBottom: '32px', color: 'var(--color-text-muted)' }}
            >
              6-digit code sent to +91&nbsp;{phone}.
            </p>

            {/* 6 OTP boxes — fixed width, centered */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '28px',
              }}
            >
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={el => { refs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  value={d}
                  onChange={e => onOtpChange(i, e.target.value)}
                  onKeyDown={e => onOtpKey(i, e)}
                  className="font-optima text-center outline-none"
                  style={{
                    width: '48px',
                    height: '60px',
                    flexShrink: 0,
                    fontSize: 'var(--text-subhead)',
                    backgroundColor: 'var(--color-text-secondary)',
                    border: 'none',
                    borderBottom: d ? '2px solid var(--color-text-accent)' : '2px solid rgb(var(--borges-rgb) / 0.17)',
                    borderRadius: 0,
                    color: 'rgb(var(--mist-rgb) / 0.9)',
                    caretColor: 'var(--color-text-accent)',
                    transition: 'border-color 0.15s ease',
                  }}
                  maxLength={1}
                />
              ))}
            </div>

            {error && (
              <p className="font-optima" style={{ fontSize: 'var(--text-caption)', marginBottom: '12px', color: 'var(--color-text-muted)' }}>
                {error}
              </p>
            )}

            <button
              onClick={() => verifyOtp()}
              disabled={loading || !otpOk}
              className="w-full font-optima"
              style={{
                fontSize: 'var(--text-caption)',
                letterSpacing: '0.01em',
                height: '52px',
                borderRadius: '8px',
                border: 'none',
                cursor: !otpOk || loading ? 'not-allowed' : 'pointer',
                backgroundColor: !otpOk || loading ? 'rgb(var(--borges-rgb) / 0.3)' : 'var(--color-text-accent)',
                color: !otpOk || loading ? 'var(--color-text-muted)' : 'var(--color-surface-sunken)',
                transition: 'background-color 0.3s ease',
                marginBottom: '12px',
                animation: loading ? 'pulse 1.5s ease-in-out infinite' : 'none',
              }}
              onMouseEnter={e => {
                if (otpOk && !loading)
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-text-accent)'
              }}
              onMouseLeave={e => {
                if (otpOk && !loading)
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-text-accent)'
              }}
              onMouseDown={e => {
                if (otpOk && !loading)
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)'
              }}
              onMouseUp={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
              }}
            >
              {loading ? 'Verifying…' : 'Verify & Enter'}
            </button>

            <button
              onClick={sendOtp}
              disabled={loading}
              className="w-full font-optima transition-opacity hover:opacity-70"
              style={{
                fontSize: 'var(--text-caption)',
                background: 'none',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                padding: '10px 0',
                color: 'var(--color-text-accent)',
              }}
            >
              Resend code
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  )
}
