'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ConciergeRequest } from '@/lib/types'

function fmtDateTime(d: string): string {
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return d }
}

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  submitted:   { bg: 'rgb(var(--borges-rgb) / 0.14)',  text: 'var(--color-text-accent)' },
  in_progress: { bg: 'rgb(var(--borges-rgb) / 0.16)',  text: 'var(--color-text-accent)' },
  done:        { bg: 'rgb(var(--borges-rgb) / 0.16)', text: 'var(--color-text-accent)' },
}

function StatusPill({ status }: { status: string }) {
  const c = STATUS_COLOR[status] ?? STATUS_COLOR.submitted
  return (
    <span className="font-optima" style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '999px',
      backgroundColor: c.bg, color: c.text, fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
    }}>
      {status.replace('_', ' ')}
    </span>
  )
}

export default function ConciergeRequestsSection({
  tripId, requests,
}: {
  tripId: string
  requests: ConciergeRequest[]
}) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!text.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/concierge-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: tripId, request_text: text.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to send request')
      setText('')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div style={{
        // Open, like everything else on the page. A filled box around a
        // textarea made asking a question look like filing a form.
        border: 'none', borderBottom: '1px solid var(--color-rule-strong)',
        paddingBottom: 'var(--space-5)',
        maxWidth: '54rem',
        marginBottom: requests.length > 0 ? 'var(--gap-opening)' : '0',
      }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Ask your curator for anything — a table, a car, a change of plan." aria-label="Ask your curator for anything — a table, a car, a change of plan"
          rows={3}
          className="font-optima"
          style={{
            width: '100%', backgroundColor: 'transparent', border: 'none', outline: 'none',
            resize: 'vertical', fontSize: 'var(--text-caption)', color: 'var(--color-text)', lineHeight: 1.6, marginBottom: '12px',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {error ? (
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>{error}</p>
          ) : <span />}
          <button
            onClick={handleSubmit}
            disabled={submitting || !text.trim()}
            className="font-optima"
            style={{
              fontSize: 'var(--text-caption)', letterSpacing: '0.01em', padding: '10px 20px', borderRadius: '6px',
              border: 'none', cursor: submitting || !text.trim() ? 'not-allowed' : 'pointer',
              backgroundColor: submitting || !text.trim() ? 'rgb(var(--borges-rgb) / 0.3)' : 'var(--color-text-accent)',
              color: 'var(--color-surface)',
            }}
          >
            {submitting ? 'Sending…' : 'Send Request'}
          </button>
        </div>
      </div>

      {requests.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {requests.map(r => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px',
              padding: '14px 18px', borderRadius: '8px',
              backgroundColor: 'rgb(var(--borges-rgb) / 0.04)', border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)', lineHeight: 1.55, marginBottom: '4px' }}>
                  {r.request_text}
                </p>
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
                  {fmtDateTime(r.created_at)}
                </p>
              </div>
              <StatusPill status={r.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
