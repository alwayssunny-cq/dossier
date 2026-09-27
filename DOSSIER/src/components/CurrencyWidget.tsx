'use client'

import { useCurrency } from '@/components/CurrencyContext'

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', INR: '₹', EUR: '€', GBP: '£', AUD: 'A$',
  JPY: '¥', THB: '฿', AED: 'د.إ', SGD: 'S$', CHF: 'Fr',
  CAD: 'C$', NZD: 'NZ$', MYR: 'RM', IDR: 'Rp', ZAR: 'R',
}

function convert(amount: number, from: string, to: string, rates: Record<string, number>): number {
  const fromRate = rates[from] ?? 1
  const toRate   = rates[to]   ?? 1
  return (amount / fromRate) * toRate
}

function fmtRate(n: number, code: string): string {
  if (['JPY', 'IDR', 'KRW', 'INR'].includes(code)) return Math.round(n).toLocaleString()
  return n >= 100 ? Math.round(n).toLocaleString() : n.toFixed(2)
}

export default function CurrencyWidget() {
  const { fromCode, toCode, rates } = useCurrency()

  if (!rates) return null

  const rate    = convert(1, fromCode, toCode, rates)
  const fromSym = CURRENCY_SYMBOLS[fromCode] ?? fromCode
  const toSym   = CURRENCY_SYMBOLS[toCode]   ?? toCode

  // Inline text only — no icon, for the single-line strip
  return (
    <span className="font-optima text-caption text-ink-muted">
      1 {fromCode} = {toSym}{fmtRate(rate, toCode)}
    </span>
  )
}
