'use client'


export default function ResfeberEngine({
  phrases, languageLabel, localMedia,
}: {
  phrases: { en: string; local: string; pronunciation?: string }[] | null
  languageLabel: string | null
  localMedia: string | null
}) {
  const hasAnything = (phrases && phrases.length > 0) || !!localMedia

  if (!hasAnything) {
    return (
      <div style={{
        backgroundColor: 'rgb(var(--borges-rgb) / 0.04)', border: '0.5px solid rgb(var(--borges-rgb) / 0.12)',
        borderRadius: '12px', padding: '28px',
      }}>
        <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          Local phrases and media picks are being prepared for this destination.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {phrases && phrases.length > 0 && (
        <div>
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--color-text)', marginBottom: '14px' }}>
            Common Phrases{languageLabel ? ` · ${languageLabel}` : ''}
          </p>
          <div style={{ backgroundColor: 'var(--color-surface-sunken)', border: '0.5px solid rgb(var(--borges-rgb) / 0.10)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 4px rgb(var(--night-rgb) / 0.05), 0 12px 32px rgb(var(--night-rgb) / 0.09)' }}>
            {phrases.slice(0, 6).map((ph, i, arr) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '14px 22px', alignItems: 'center',
                borderBottom: i < arr.length - 1 ? '0.5px solid rgb(var(--borges-rgb) / 0.07)' : 'none',
              }}>
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)' }}>{ph.en}</p>
                <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>{ph.local}</p>
                {ph.pronunciation ? (
                  <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>{ph.pronunciation}</p>
                ) : <span />}
              </div>
            ))}
          </div>
        </div>
      )}


      {localMedia && (
        <div style={{ backgroundColor: 'var(--color-surface-sunken)', border: '0.5px solid rgb(var(--borges-rgb) / 0.10)', borderRadius: '12px', padding: '12px 26px', boxShadow: '0 2px 4px rgb(var(--night-rgb) / 0.05), 0 12px 32px rgb(var(--night-rgb) / 0.09)' }}>
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--color-text)', marginTop: '18px', marginBottom: '10px' }}>
            Local Media Recommends
          </p>
          {localMedia.split(/\n+/).filter(Boolean).map((line, i, arr) => {
            const m = line.match(/^([A-Za-z ]{2,12}):\s*(.+)$/)
            const kicker = m ? m[1] : null
            const body   = m ? m[2] : line
            return (
              <div key={i} style={{
                display: 'flex', gap: '10px', alignItems: 'flex-start',
                padding: '15px 0', borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.08)',
                marginBottom: i === arr.length - 1 ? '10px' : 0,
              }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgb(var(--borges-rgb) / 0.4)', flexShrink: 0, marginTop: '7px' }} />
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.65 }}>
                  {kicker && (
                    <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', marginRight: '8px' }}>
                      {kicker} —
                    </span>
                  )}
                  {body}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
