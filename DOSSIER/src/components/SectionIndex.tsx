/**
 * Editorial section marker.
 *
 * The reference sites in the brand book all wayfind the same way: a numbered
 * index and a tracked-out micro-cap label, a hairline running out to the
 * margin, then the title beneath it. This replaces the ten hand-rolled
 * "heading plus 0.5px line" blocks that had drifted apart across the dossier.
 *
 * Type tiers are honoured here so callers cannot get them wrong: the eyebrow
 * is Optima at the caption step, the title is Tier 1 Seasons.
 */

interface Props {
  /** Section number. Rendered zero-padded — 1 becomes "01". */
  index?: number
  /** Tracked-out micro-cap label sitting on the rule. */
  eyebrow?: string
  /** Tier 1 title. Omit for a bare numbered rule. */
  title?: React.ReactNode
  /** Tightens the space beneath, for sections that open with a dense block. */
  tight?: boolean
}

export default function SectionIndex({ index, eyebrow, title, tight = false }: Props) {
  const marker = [
    index != null ? String(index).padStart(2, '0') : null,
    eyebrow,
  ].filter(Boolean).join('  ·  ')

  return (
    <div style={{ marginBottom: tight ? '20px' : '32px' }}>
      {marker && <div className="cq-index">{marker}</div>}
      {title && (
        <h2
          className="cq-t1"
          style={{ marginTop: marker ? '14px' : 0, color: 'var(--color-text)' }}
        >
          {title}
        </h2>
      )}
      {!title && !marker && <hr className="cq-rule" />}
    </div>
  )
}
