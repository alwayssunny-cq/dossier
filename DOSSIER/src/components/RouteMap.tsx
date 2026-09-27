'use client'

interface Props {
  destinations: string[]
}

export default function RouteMap({ destinations }: Props) {
  if (destinations.length < 2) return null

  const count  = destinations.length
  const nodeW  = 88
  const padX   = 28
  const totalW = padX * 2 + count * nodeW + (count - 1) * 8
  const centerY = 32

  const nodeX = (i: number) => padX + i * (nodeW + 8) + nodeW / 2

  return (
    <div
      style={{
        borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.12)',
        backgroundColor: 'var(--color-surface)',
        padding: '14px 24px 16px',
      }}
    >
      <p
        className="font-optima"
        style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '12px' }}
      >
        Route
      </p>
      <div className="overflow-x-auto scrollbar-hide" style={{ marginLeft: '-4px' }}>
        <svg
          width={Math.max(totalW, 320)}
          height={centerY + 32}
          viewBox={`0 0 ${Math.max(totalW, 320)} ${centerY + 32}`}
          style={{ display: 'block' }}
        >
          {/* Dashed connector line */}
          <line
            x1={nodeX(0)}
            y1={centerY}
            x2={nodeX(count - 1)}
            y2={centerY}
            stroke="rgb(var(--borges-rgb) / 0.2)"
            strokeWidth="1"
            strokeDasharray="3 4"
          />

          {destinations.map((dest, i) => {
            const x       = nodeX(i)
            const isFirst = i === 0
            const isLast  = i === count - 1
            const isEdge  = isFirst || isLast

            return (
              <g key={`${dest}-${i}`}>
                {/* Arrow between nodes */}
                {i < count - 1 && (
                  <text
                    x={(nodeX(i) + nodeX(i + 1)) / 2}
                    y={centerY + 4}
                    textAnchor="middle"
                    fontSize="8"
                    fontFamily="'Optima', sans-serif"
                    fill="rgb(var(--borges-rgb) / 0.35)"
                  >
                    →
                  </text>
                )}

                {/* Node circle */}
                <circle
                  cx={x}
                  cy={centerY}
                  r={isEdge ? 6 : 4}
                  fill={isEdge ? 'var(--color-text-accent)' : 'rgb(var(--borges-rgb) / 0.35)'}
                  opacity={isEdge ? 1 : 0.8}
                />
                {isEdge && (
                  <circle
                    cx={x}
                    cy={centerY}
                    r={isEdge ? 10 : 7}
                    fill="none"
                    stroke="rgb(var(--borges-rgb) / 0.18)"
                    strokeWidth="1"
                  />
                )}

                {/* Label */}
                <text
                  x={x}
                  y={centerY + 20}
                  textAnchor="middle"
                  fontSize="8"
                  fontFamily="'Optima', 'Trebuchet MS', sans-serif"
                  fill={isEdge ? 'rgb(var(--night-rgb) / 0.65)' : 'rgb(var(--night-rgb) / 0.38)'}
                  fontWeight={isEdge ? '600' : '400'}
                  letterSpacing="0.04em"
                >
                  {dest.length > 10 ? dest.slice(0, 9) + '…' : dest}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
