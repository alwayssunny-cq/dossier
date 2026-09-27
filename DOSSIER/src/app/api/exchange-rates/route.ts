import { NextResponse } from 'next/server'

// Cached at the edge for 24 hours — single server-side fetch, no browser console errors
export const revalidate = 86400

export async function GET() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 86400 },
    })
    if (!res.ok) throw new Error(`upstream ${res.status}`)
    const data = await res.json() as { rates?: Record<string, number> }
    if (!data.rates) throw new Error('no rates in response')
    return NextResponse.json({ rates: data.rates })
  } catch {
    return NextResponse.json({ rates: null }, { status: 502 })
  }
}
