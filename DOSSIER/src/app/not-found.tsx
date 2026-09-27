import Link from 'next/link'

/**
 * A page that isn't there.
 *
 * Reached by an old link, a mistyped address, or a trip that has been removed.
 * The reader does not need to know which; they need to know they are not lost
 * and where to go next.
 */
export default function NotFound() {
  return (
    <main
      className="min-h-screen flex items-center"
      style={{ backgroundColor: 'var(--color-surface)', padding: 'var(--pad-40) var(--space-5)' }}
    >
      <div className="cq-shell" style={{ maxWidth: '560px' }}>
        <p className="cq-label" style={{ color: 'var(--color-text-muted)' }}>
          Not found
        </p>

        <h1 className="cq-t1" style={{ color: 'var(--color-text)', margin: 'var(--space-3) 0 var(--space-5)' }}>
          There&rsquo;s nothing at this address.
        </h1>

        <p className="cq-body cq-measure" style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>
          The link may be from an older version of your dossier, or the journey it
          pointed to may have moved. Everything current is on your dossier.
        </p>

        <p style={{ marginTop: 'var(--pad-40)' }}>
          <Link
            href="/dashboard"
            className="font-optima cq-tap-link"
            style={{
              padding: '0 var(--space-6)',
              borderRadius: '999px',
              border: '1px solid var(--color-border-interactive)',
              color: 'var(--color-text)',
              textDecoration: 'none',
              fontSize: 'var(--text-body)',
            }}
          >
            Back to your dossier
          </Link>
        </p>
      </div>
    </main>
  )
}
