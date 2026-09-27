'use client'

import type { DestinationInfo } from '@/lib/types'
import type { WeatherSummary } from '@/lib/destinationData'
import TimeDifference from '@/components/TimeDifference'

export function combineCost(local: string | null | undefined, inr: string | null | undefined): string | null {
  const strip = (s: string) => s.replace(/^₹\s*/, '').trim()
  if (local && inr) {
    // Destinations where the local currency already is INR (e.g. India) — avoid showing it twice.
    if (strip(local) === strip(inr)) return local.startsWith('₹') ? local : `₹${local}`
    return `${local} · ₹${strip(inr)}`
  }
  if (local) return local
  if (inr) return `₹${strip(inr)}`
  return null
}

type FactType = 'weather' | 'time' | 'currency' | 'meal' | 'coffee'

function FactIcon({ type }: { type: FactType }) {
  const stroke = 'var(--color-text-accent)'
  switch (type) {
    case 'weather':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="6.5" cy="6.5" r="3" stroke={stroke} strokeWidth="1.3"/>
          <path d="M6.5 1.5v1.4M6.5 10.2v1.4M1.5 6.5h1.4M10.2 6.5h1.4M3.4 3.4l1 1M8.6 8.6l1 1M3.4 9.6l1-1M8.6 4.4l1-1" stroke={stroke} strokeWidth="1.1" strokeLinecap="round"/>
          <path d="M8 12.5a3 3 0 003-3 2.6 2.6 0 00-2.3-2.58A3.5 3.5 0 003 8.5" stroke={stroke} strokeWidth="1.1" strokeLinecap="round"/>
        </svg>
      )
    case 'time':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke={stroke} strokeWidth="1.3"/>
          <path d="M8 4.5V8l2.5 1.5" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    case 'currency':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke={stroke} strokeWidth="1.3"/>
          <path d="M6 5.5h3.2M6 8h2.6M6 5.5v6M6 8L9.5 11.5" stroke={stroke} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    case 'meal':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M4 2v5.5M3 2v3.3a1 1 0 002 0V2M5 7.5v6.5" stroke={stroke} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M11.5 2c-1.1 0-2 1.3-2 3s.9 2.8 2 3v6" stroke={stroke} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    case 'coffee':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M2.5 5.5h8v3.8a3 3 0 01-3 3H5.5a3 3 0 01-3-3V5.5z" stroke={stroke} strokeWidth="1.2" strokeLinejoin="round"/>
          <path d="M10.5 6.5H12a1.8 1.8 0 010 3.6h-1.2" stroke={stroke} strokeWidth="1.1" strokeLinecap="round"/>
          <path d="M5 3.2c-.5.5-.5 1 0 1.5M7.2 3.2c-.5.5-.5 1 0 1.5" stroke={stroke} strokeWidth="1" strokeLinecap="round"/>
        </svg>
      )
  }
}

export default function AboutDestinationCard({
  weather, travelDateLabel, destinationTz, currency, destinationInfo,
}: {
  weather: WeatherSummary | null
  travelDateLabel: string | null
  destinationTz: string | null
  currency: string | null
  destinationInfo: DestinationInfo | null
}) {
  const mealCost   = combineCost(destinationInfo?.meal_cost_local, destinationInfo?.meal_cost_inr)
  const coffeeCost = combineCost(destinationInfo?.coffee_cost_local, destinationInfo?.coffee_cost_inr)

  type Fact = { type: FactType; text: React.ReactNode }
  const facts: (Fact | null)[] = [
    weather ? {
      type: 'weather',
      text: `Expect ${weather.avgMinC}°–${weather.avgMaxC}°C${travelDateLabel ? ` around ${travelDateLabel}` : ' during your stay'}${weather.maxRainProb > 40 ? ', with rain likely' : ''}.`,
    } : null,
    destinationTz ? {
      type: 'time',
      text: <><TimeDifference destinationTz={destinationTz} />.</>,
    } : null,
    currency ? { type: 'currency', text: `Settle up in ${currency}.` } : null,
    mealCost ? { type: 'meal', text: `A meal will typically run ${mealCost}.` } : null,
    coffeeCost ? { type: 'coffee', text: `A coffee costs around ${coffeeCost}.` } : null,
  ]
  const factsFiltered = facts.filter((f): f is Fact => !!f)

  if (factsFiltered.length === 0) {
    return (
      <div style={{
        backgroundColor: 'rgb(var(--borges-rgb) / 0.04)', border: '0.5px solid rgb(var(--borges-rgb) / 0.12)',
        borderRadius: '12px', padding: '28px',
      }}>
        <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          Destination details are being prepared by your curator.
        </p>
      </div>
    )
  }

  return (
    <div style={{
      backgroundColor: 'var(--color-surface)', border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
      borderRadius: '12px', padding: '8px 28px', boxShadow: '0 2px 4px rgb(var(--night-rgb) / 0.05), 0 12px 32px rgb(var(--night-rgb) / 0.09)',
    }}>
      {factsFiltered.map((fact, i) => (
        <div key={fact.type} style={{
          display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 0',
          borderBottom: i < factsFiltered.length - 1 ? '0.5px solid rgb(var(--borges-rgb) / 0.10)' : 'none',
        }}>
          <div style={{
            flexShrink: 0, width: '30px', height: '30px', borderRadius: '50%',
            backgroundColor: 'rgb(var(--borges-rgb) / 0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FactIcon type={fact.type} />
          </div>
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
            {fact.text}
          </p>
        </div>
      ))}
    </div>
  )
}
