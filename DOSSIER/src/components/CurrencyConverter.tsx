'use client'

import { useEffect, useRef, useState } from 'react'
import { useCurrency } from '@/components/CurrencyContext'

const CURRENCIES = [
  { code: 'USD', symbol: '$',   name: 'US Dollar' },
  { code: 'INR', symbol: '₹',   name: 'Indian Rupee' },
  { code: 'EUR', symbol: '€',   name: 'Euro' },
  { code: 'GBP', symbol: '£',   name: 'British Pound' },
  { code: 'AUD', symbol: 'A$',  name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥',   name: 'Japanese Yen' },
  { code: 'THB', symbol: '฿',   name: 'Thai Baht' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$',  name: 'Singapore Dollar' },
  { code: 'CHF', symbol: 'Fr',  name: 'Swiss Franc' },
  { code: 'CAD', symbol: 'C$',  name: 'Canadian Dollar' },
  { code: 'NZD', symbol: 'NZ$', name: 'NZ Dollar' },
  { code: 'MYR', symbol: 'RM',  name: 'Malaysian Ringgit' },
  { code: 'IDR', symbol: 'Rp',  name: 'Indonesian Rupiah' },
  { code: 'ZAR', symbol: 'R',   name: 'South African Rand' },
] as const

type CurrencyCode = (typeof CURRENCIES)[number]['code']

const RATE_KEY = 'cq_rates_usd_base'
const RATE_TTL = 24 * 60 * 60 * 1000

interface RateCache { rates: Record<string, number>; ts: number }

async function fetchRates(): Promise<Record<string, number> | null> {
  try {
    const raw = localStorage.getItem(RATE_KEY)
    if (raw) {
      const c = JSON.parse(raw) as RateCache
      if (Date.now() - c.ts < RATE_TTL) return c.rates
    }
    const r = await fetch('/api/exchange-rates')
    const d = await r.json() as { rates?: Record<string, number> }
    if (!d.rates) return null
    localStorage.setItem(RATE_KEY, JSON.stringify({ rates: d.rates, ts: Date.now() }))
    return d.rates
  } catch { return null }
}

function convert(amount: number, from: string, to: string, rates: Record<string, number>): number {
  const fromRate = rates[from] ?? 1
  const toRate   = rates[to]   ?? 1
  return (amount / fromRate) * toRate
}

function fmt(n: number, code: string): string {
  if (isNaN(n) || !isFinite(n)) return ''
  if (['JPY', 'IDR', 'KRW'].includes(code)) return Math.round(n).toLocaleString()
  return n.toFixed(2).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

const QUICK: Partial<Record<CurrencyCode, number[]>> & { default: number[] } = {
  USD: [50, 100, 500, 1000], EUR: [50, 100, 500, 1000],
  GBP: [50, 100, 500, 1000], AUD: [50, 100, 500, 1000],
  CAD: [50, 100, 500, 1000], INR: [1000, 5000, 10000, 50000],
  JPY: [1000, 5000, 10000, 50000], THB: [500, 1000, 5000, 10000],
  IDR: [10000, 50000, 100000, 500000],
  default: [10, 50, 100, 500],
}

function quickAmounts(code: string): number[] {
  return (QUICK as Record<string, number[]>)[code] ?? QUICK.default
}

function quickLabel(n: number, symbol: string): string {
  if (n >= 1_000_000) return `${symbol}${n / 1_000_000}M`
  if (n >= 1_000)     return `${symbol}${n / 1_000}k`
  return `${symbol}${n}`
}

interface DropdownProps { selected: string; onSelect: (code: string) => void; color: string }

function CurrencyDropdown({ selected, onSelect, color }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const curr = CURRENCIES.find(c => c.code === selected)!

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-black/5 transition-colors"
      >
        <span className="font-optima text-caption tracking-wide" style={{ color }}>
          {curr.code}
        </span>
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none">
          <path d="M1 1l3 3 3-3" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 w-52 rounded-xl z-30 max-h-52 overflow-y-auto"
          style={{
            backgroundColor: 'var(--color-text-secondary)',
            border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
            boxShadow: '0 12px 40px rgb(var(--night-rgb) / 0.6)',
          }}
        >
          {CURRENCIES.map(c => (
            <button
              key={c.code}
              onClick={() => { onSelect(c.code); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 transition-colors text-left"
              style={{ backgroundColor: c.code === selected ? 'rgb(var(--borges-rgb) / 0.15)' : 'transparent' }}
              onMouseEnter={e => { if (c.code !== selected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgb(var(--borges-rgb) / 0.07)' }}
              onMouseLeave={e => { if (c.code !== selected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
            >
              <span className="font-optima w-9 shrink-0" style={{ fontSize: 'var(--text-caption)', color: c.code === selected ? 'var(--color-text-accent)' : 'var(--color-text)' }}>{c.code}</span>
              <span className="font-optima truncate" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CurrencyConverter() {
  const ctx = useCurrency()
  const { fromCode, toCode, rates } = ctx

  const [open, setOpen]         = useState(false)
  const [fromVal, setFromVal]   = useState('100')
  const [toVal, setToVal]       = useState('')
  const [loaded, setLoaded]     = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || loaded) return
    setLoaded(true)
    if (rates) {
      const n = parseFloat(fromVal)
      if (!isNaN(n)) setToVal(fmt(convert(n, fromCode, toCode, rates), toCode))
      return
    }
    fetchRates().then(r => {
      if (!r) return
      ctx.setRates(r)
      const n = parseFloat(fromVal)
      if (!isNaN(n)) setToVal(fmt(convert(n, fromCode, toCode, r), toCode))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!rates || !fromVal) return
    const n = parseFloat(fromVal)
    if (!isNaN(n)) setToVal(fmt(convert(n, fromCode, toCode, rates), toCode))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCode, toCode])

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function recalcFrom(val: string, from: string, to: string, r: Record<string, number> | null) {
    const n = parseFloat(val.replace(/,/g, ''))
    setToVal(r && !isNaN(n) ? fmt(convert(n, from, to, r), to) : '')
  }

  function handleFromVal(val: string) { setFromVal(val); recalcFrom(val, fromCode, toCode, rates) }
  function handleToVal(val: string) {
    setToVal(val)
    if (!rates) return
    const n = parseFloat(val.replace(/,/g, ''))
    setFromVal(!isNaN(n) ? fmt(convert(n, toCode, fromCode, rates), fromCode) : '')
  }
  function handleFromCode(code: string) { ctx.setFromCode(code); recalcFrom(fromVal, code, toCode, rates) }
  function handleToCode(code: string)   { ctx.setToCode(code);   recalcFrom(fromVal, fromCode, code, rates) }

  function handleSwap() {
    ctx.setFromCode(toCode); ctx.setToCode(fromCode)
    setFromVal(toVal)
    if (rates && toVal) {
      const n = parseFloat(toVal.replace(/,/g, ''))
      setToVal(!isNaN(n) ? fmt(convert(n, toCode, fromCode, rates), fromCode) : '')
    }
  }

  function handleQuick(n: number) {
    setFromVal(String(n))
    if (rates) setToVal(fmt(convert(n, fromCode, toCode, rates), toCode))
  }

  const fromCurr = CURRENCIES.find(c => c.code === fromCode)!
  const rateLabel = rates
    ? `1 ${fromCode} = ${fmt(convert(1, fromCode, toCode, rates), toCode)} ${toCode}`
    : 'Loading rate…'

  return (
    <div ref={ref} className="flex flex-col items-end gap-3">

      {/* Card */}
      {open && (
        <div
          className="rounded-2xl overflow-visible"
          style={{
            width: '280px',
            backgroundColor: 'var(--color-surface-sunken)',
            boxShadow: '0 12px 40px rgb(var(--night-rgb) / 0.6)',
            border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
            animation: 'fadeSlideUp 0.2s ease',
          }}
        >
          {/* Header — ochre */}
          <div
            className="flex items-center justify-between rounded-t-2xl"
            style={{ backgroundColor: 'var(--color-text-accent)', padding: '14px 16px' }}
          >
            <div>
              <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-inverse)' }}>Currency Converter</p>
              <p className="font-optima" style={{ fontSize: 'var(--text-caption)', marginTop: '3px', color: 'var(--color-text-muted)' }}>{rateLabel}</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex items-center justify-center transition-opacity hover:opacity-70"
              style={{ width: '20px', height: '20px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2l6 6M8 2l-6 6" stroke="#F3EFE9" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* FROM row */}
            <div className="flex items-center rounded-xl overflow-visible" style={{ backgroundColor: 'var(--color-text-secondary)', border: '0.5px solid rgb(var(--borges-rgb) / 0.14)' }}>
              <div className="pl-2" style={{ borderRight: '0.5px solid rgb(var(--borges-rgb) / 0.14)' }}>
                <CurrencyDropdown selected={fromCode} onSelect={handleFromCode} color="var(--color-surface-sunken)" />
              </div>
              <input
                type="number"
                value={fromVal}
                onChange={e => handleFromVal(e.target.value)}
                placeholder="0" aria-label="0"
                className="flex-1 px-3 py-3 bg-transparent font-optima outline-none"
                style={{ fontSize: 'var(--text-body)', color: 'rgb(var(--mist-rgb) / 0.9)', caretColor: 'var(--color-text-accent)' }}
              />
            </div>

            {/* Swap */}
            <div className="flex items-center gap-2">
              <div className="h-px flex-1" style={{ backgroundColor: 'rgb(var(--borges-rgb) / 0.10)' }} />
              <button
                onClick={handleSwap}
                className="rounded-full flex items-center justify-center transition-all hover:rotate-180 duration-300"
                style={{ width: '28px', height: '28px', backgroundColor: 'var(--color-text-accent)', border: 'none', cursor: 'pointer' }}
                title="Swap currencies"
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2v10M4 5l3-3 3 3M4 9l3 3 3-3" stroke="#F3EFE9" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div className="h-px flex-1" style={{ backgroundColor: 'rgb(var(--borges-rgb) / 0.10)' }} />
            </div>

            {/* TO row */}
            <div className="flex items-center rounded-xl overflow-visible" style={{ backgroundColor: 'var(--color-text-secondary)', border: '0.5px solid rgb(var(--borges-rgb) / 0.14)' }}>
              <div className="pl-2" style={{ borderRight: '0.5px solid rgb(var(--borges-rgb) / 0.14)' }}>
                <CurrencyDropdown selected={toCode} onSelect={handleToCode} color="var(--color-surface-sunken)" />
              </div>
              <input
                type="text"
                value={toVal}
                onChange={e => handleToVal(e.target.value.replace(/,/g, ''))}
                placeholder="0" aria-label="0"
                className="flex-1 px-3 py-3 bg-transparent font-optima outline-none"
                style={{ fontSize: 'var(--text-body)', color: 'rgb(var(--mist-rgb) / 0.9)', caretColor: 'var(--color-text-accent)' }}
              />
            </div>

            {/* Quick amounts */}
            <div className="flex gap-1.5 pt-1">
              {quickAmounts(fromCode).map(n => (
                <button
                  key={n}
                  onClick={() => handleQuick(n)}
                  className="flex-1 font-optima rounded-lg py-1.5 transition-colors tracking-wide"
                  style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', backgroundColor: 'rgb(var(--borges-rgb) / 0.12)' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgb(var(--borges-rgb) / 0.22)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgb(var(--borges-rgb) / 0.12)')}
                >
                  {quickLabel(n, fromCurr.symbol)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Trigger — ochre circle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-center transition-all active:scale-95"
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-text-accent)',
          border: 'none',
          cursor: 'pointer',
          boxShadow: open
            ? '0 2px 8px rgb(var(--borges-rgb) / 0.4)'
            : '0 4px 18px rgb(var(--night-rgb) / 0.4)',
        }}
        aria-label="Currency converter"
      >
        <span className="font-optima text-center" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.02em', lineHeight: 1.4, color: 'var(--color-text-inverse)' }}>
          ₹/$
        </span>
      </button>
    </div>
  )
}
