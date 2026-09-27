import type { Document } from '@/lib/types'


/** Anything the client actually needs to present on the ground. */
export function isVoucher(type: string | null): boolean {
  const t = (type ?? '').toLowerCase()
  return t.includes('ticket') || t.includes('entry') || t.includes('voucher')
    || t.includes('coupon') || t.includes('pass')
}

export default function VouchersSection({ docs }: { docs: Document[] }) {
  if (docs.length === 0) {
    return (
      <p className="cq-body cq-measure" style={{ margin: 0 }}>
        Vouchers and tickets will appear here as they&rsquo;re confirmed.
      </p>
    )
  }

  return (
    <div style={{ maxWidth: '54rem' }}>
      {docs.map((doc, i) => (
        <a
          key={doc.id}
          href={doc.file_url ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            textDecoration: 'none',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 7rem',
            columnGap: 'var(--space-8)',
            alignItems: 'baseline',
            paddingBottom: 'var(--space-6)',
            marginBottom: i === docs.length - 1 ? 0 : 'var(--space-6)',
            borderBottom: i === docs.length - 1 ? 'none' : '1px solid var(--color-rule)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p
              className="font-optima"
              style={{ margin: 0, fontSize: 'var(--text-subhead)', color: 'var(--color-text)' }}
            >
              {doc.document_name ?? 'Voucher'}
            </p>
            <p className="cq-label" style={{ marginTop: 'var(--space-2)' }}>
              {doc.document_type ?? doc.category ?? 'Document'}
            </p>
          </div>
          <span
            className="cq-label"
            style={{
              textAlign: 'right',
              color: 'var(--color-text-accent)',
              borderBottom: '1px solid var(--color-rule-strong)',
              justifySelf: 'end',
            }}
          >
            Download
          </span>
        </a>
      ))}
    </div>
  )
}
