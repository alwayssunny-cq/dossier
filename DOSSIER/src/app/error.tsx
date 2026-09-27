'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/**
 * What the reader sees when the dossier fails.
 *
 * There was no error boundary at all, so any server fault produced Next's own
 * page: a stack-shaped message, no route back, and nothing that belongs to
 * this product. The guide is specific about what an error state owes the
 * reader — say what happened in their terms, distinguish "the service is
 * unavailable" from "you typed something wrong", and give an action that
 * might actually resolve it.
 *
 * So: one sentence of plain cause, a retry that re-runs the render rather
 * than reloading the whole app, and a way back to the dossier. The digest is
 * shown because it is the one thing that makes a support message useful.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dossier]', error)
  }, [error])

  return (
    <main
      className="min-h-screen flex items-center"
      style={{ backgroundColor: 'var(--color-surface)', padding: 'var(--pad-40) var(--space-5)' }}
    >
      <div className="cq-shell" style={{ maxWidth: '560px' }}>
        <p className="cq-label" style={{ color: 'var(--color-text-muted)' }}>
          Something went wrong
        </p>

        <h1 className="cq-t1" style={{ color: 'var(--color-text)', margin: 'var(--space-3) 0 var(--space-5)' }}>
          This page didn&rsquo;t load.
        </h1>

        <p className="cq-body cq-measure" style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>
          The dossier itself is fine — this is on our side, not yours, and nothing
          you have entered has been lost. Trying again often works; if it doesn&rsquo;t,
          your curator can see the same thing you can.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', marginTop: 'var(--pad-40)' }}>
          <button
            onClick={reset}
            className="font-optima"
            style={{
              minHeight: '44px',
              padding: '0 var(--space-6)',
              borderRadius: '999px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: 'var(--color-text-accent)',
              color: 'var(--mist)',
              fontSize: 'var(--text-body)',
            }}
          >
            Try again
          </button>

          <Link
            href="/dashboard"
            className="font-optima cq-tap-link"
            style={{
              padding: '0 var(--space-5)',
              borderRadius: '999px',
              border: '1px solid var(--color-border-interactive)',
              color: 'var(--color-text)',
              textDecoration: 'none',
              fontSize: 'var(--text-body)',
            }}
          >
            Back to your dossier
          </Link>
        </div>

        {error.digest && (
          <p className="cq-label" style={{ color: 'var(--color-text-muted)', marginTop: 'var(--pad-40)' }}>
            Reference {error.digest}
          </p>
        )}
      </div>
    </main>
  )
}
