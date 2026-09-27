'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

const RATE_KEY = 'cq_rates_usd_base'
const RATE_TTL = 24 * 3600_000

interface CurrencyState {
  fromCode: string
  toCode: string
  rates: Record<string, number> | null
  setFromCode: (c: string) => void
  setToCode: (c: string) => void
  setRates: (r: Record<string, number>) => void
}

const CurrencyCtx = createContext<CurrencyState>({
  fromCode: 'USD',
  toCode: 'INR',
  rates: null,
  setFromCode: () => {},
  setToCode: () => {},
  setRates: () => {},
})

export function useCurrency() {
  return useContext(CurrencyCtx)
}

export function CurrencyProvider({
  children,
  defaultFrom = 'USD',
  defaultTo = 'INR',
}: {
  children: ReactNode
  defaultFrom?: string
  defaultTo?: string
}) {
  const [fromCode, setFromCode] = useState(defaultFrom)
  const [toCode, setToCode] = useState(defaultTo)
  const [rates, setRatesState] = useState<Record<string, number> | null>(null)

  // Load rates on mount
  useEffect(() => {
    async function load() {
      try {
        const raw = localStorage.getItem(RATE_KEY)
        if (raw) {
          const c = JSON.parse(raw) as { rates: Record<string, number>; ts: number }
          if (Date.now() - c.ts < RATE_TTL) { setRatesState(c.rates); return }
        }
        const r = await fetch('/api/exchange-rates')
        const d = await r.json() as { rates?: Record<string, number> }
        if (d.rates) {
          localStorage.setItem(RATE_KEY, JSON.stringify({ rates: d.rates, ts: Date.now() }))
          setRatesState(d.rates)
        }
      } catch {}
    }
    load()
  }, [])

  function setRates(r: Record<string, number>) {
    setRatesState(r)
    try { localStorage.setItem(RATE_KEY, JSON.stringify({ rates: r, ts: Date.now() })) } catch {}
  }

  return (
    <CurrencyCtx.Provider value={{ fromCode, toCode, rates, setFromCode, setToCode, setRates }}>
      {children}
    </CurrencyCtx.Provider>
  )
}
