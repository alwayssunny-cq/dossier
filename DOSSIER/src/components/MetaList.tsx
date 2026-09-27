/**
 * The quiet column.
 *
 * Prose is held to a readable measure, which on a wide screen leaves the right
 * half of every block empty. Empty is correct — the brand wants the air — but
 * unstructured empty reads as unfinished rather than as restraint.
 *
 * So the space is given a job and an edge: facts that were previously crammed
 * inline beside the heading (dates, nights, how you arrive) move here, against
 * a hairline that turns blank space into a deliberate margin.
 *
 * Rows with no value are dropped rather than rendered empty, so the column
 * never shows a label with nothing after it.
 */

export interface MetaRow {
  label: string
  value: React.ReactNode
}

export default function MetaList({
  rows,
  title,
}: {
  rows: (MetaRow | null | undefined)[]
  /** Optional heading for the column itself. */
  title?: string
}) {
  const present = rows.filter(
    (r): r is MetaRow => !!r && r.value !== null && r.value !== undefined && r.value !== '',
  )
  if (present.length === 0) return null

  return (
    <div className="cq-col-rule">
      {title && (
        <p className="cq-label" style={{ marginBottom: 'var(--space-4)' }}>
          {title}
        </p>
      )}

      {/* A column of label-over-value pairs is right beside a body column on a
          desktop. Stacked down a phone, "Dates / 12 May / Duration / 1N2D /
          Places / 4" spends most of a screen on six short words. They flow
          into a row instead, and any pair too long for its share wraps onto
          the next line by itself. */}
      <dl className="cq-metalist" style={{ margin: 0, display: 'grid', rowGap: 'var(--space-4)' }}>
        {present.map(row => (
          <div key={row.label}>
            <dt className="cq-label" style={{ marginBottom: '2px' }}>
              {row.label}
            </dt>
            <dd
              className="font-optima"
              style={{
                margin: 0,
                fontSize: 'var(--text-body)',
                lineHeight: 1.5,
                color: 'var(--color-text)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
