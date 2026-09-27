import { createAdminClient } from '@/lib/supabase/admin'
import { SubSectionOpen } from '@/components/PageSection'
import { notFound } from 'next/navigation'
import type { Trip, Quotation, QuotationLineItem, Payment, Invoice } from '@/lib/types'

function fmt(amount: number | null, currency = 'USD') {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency ?? 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StatusPill({ status }: { status: string | null }) {
  const map: Record<string, { bg: string; text: string }> = {
    completed: { bg: 'rgb(var(--night-rgb) / 0.35)',    text: 'var(--color-text-muted)' },
    paid:      { bg: 'rgb(var(--night-rgb) / 0.35)',    text: 'var(--color-text-muted)' },
    issued:    { bg: 'rgb(var(--borges-rgb) / 0.15)', text: 'var(--color-text-accent)' },
    pending:   { bg: 'rgb(var(--borges-rgb) / 0.15)', text: 'var(--color-text-accent)' },
    draft:     { bg: 'rgb(var(--borges-rgb) / 0.10)', text: 'var(--color-text-muted)' },
    sent:      { bg: 'rgb(var(--night-rgb) / 0.2)',     text: 'var(--color-text-muted)' },
    accepted:  { bg: 'rgb(var(--night-rgb) / 0.35)',    text: 'var(--color-text-muted)' },
    failed:    { bg: 'rgb(var(--night-rgb) / 0.3)',     text: 'var(--color-text-secondary)' },
    refunded:  { bg: 'rgb(var(--night-rgb) / 0.2)',     text: 'var(--color-text-secondary)' },
    cancelled: { bg: 'rgb(var(--borges-rgb) / 0.10)', text: 'var(--color-text-muted)' },
  }
  const s = status?.toLowerCase() ?? ''
  const style = map[s] ?? map['draft']
  return (
    <span
      className="font-optima"
      style={{
        fontSize: 'var(--text-caption)',
        letterSpacing: '0.01em',
        padding: '3px 10px',
        borderRadius: '999px',
        backgroundColor: style.bg,
        color: style.text,
      }}
    >
      {status ?? 'unknown'}
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <SubSectionOpen title={children} />
}

function Divider() {
  return <div style={{ height: '0.5px', backgroundColor: 'rgb(var(--borges-rgb) / 0.10)', margin: '36px 0' }} />
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: '20px',
        borderRadius: '10px',
        backgroundColor: 'rgb(var(--borges-rgb) / 0.05)',
        border: '0.5px solid rgb(var(--borges-rgb) / 0.08)',
        textAlign: 'center',
      }}
    >
      <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>{label}</p>
    </div>
  )
}

export default async function FinancialsPage({
  params,
}: {
  params: Promise<{ tripId: string }>
}) {
  const { tripId } = await params
  const db = createAdminClient()

  const { data: trip } = await db
    .from('trips').select('*').eq('trip_id', tripId).maybeSingle() as { data: Trip | null }
  if (!trip) notFound()

  // ── Data fetching — graceful on missing tables ──
  let quotations:    Quotation[]          = []
  let payments:      Payment[]            = []
  let invoices:      Invoice[]            = []

  try {
    const { data } = await db
      .from('quotations')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })
    if (data) quotations = data as unknown as Quotation[]
  } catch {}

  try {
    const { data } = await db
      .from('payments')
      .select('*')
      .eq('trip_id', tripId)
      .eq('direction', 'inbound')
      .order('payment_date', { ascending: false })
    if (data) payments = data as unknown as Payment[]
  } catch {}

  try {
    const { data } = await db
      .from('invoices')
      .select('*')
      .eq('trip_id', tripId)
      .order('issued_date', { ascending: false })
    if (data) invoices = data as unknown as Invoice[]
  } catch {}

  // Fetch line items for all quotations
  const activeQuotation = quotations.find(q => q.status === 'accepted' || q.status === 'sent') ?? quotations[0] ?? null
  let lineItems: QuotationLineItem[] = []
  if (activeQuotation) {
    try {
      const { data } = await db
        .from('quotation_line_items')
        .select('*')
        .eq('quotation_id', activeQuotation.quotation_id)
        .order('sort_order', { ascending: true })
      if (data) lineItems = data as unknown as QuotationLineItem[]
    } catch {}
  }

  // ── Summary numbers ──
  const totalQuoted  = activeQuotation?.total_amount ?? null
  const currency     = activeQuotation?.currency ?? 'USD'
  const totalPaid    = payments.reduce((s, p) => s + (p.amount ?? 0), 0)
  const balance      = totalQuoted != null ? totalQuoted - totalPaid : null
  const fullyPaid    = balance != null && balance <= 0

  // Group line items by category
  const byCategory = lineItems.reduce<Record<string, QuotationLineItem[]>>((acc, item) => {
    const cat = item.category ?? 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  return (
    <div style={{ paddingBottom: 'var(--pad-40)' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 'var(--pad-40)' }}>
        <p
          className="font-optima"
          style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-accent)', marginBottom: '10px' }}
        >
          {trip.destination_country ?? 'Your Trip'}
        </p>
        <h2
          className="cq-t1"
          style={{ fontSize: 'var(--text-t1)', lineHeight: 1.05, color: 'var(--color-text)' }}
        >
          Financials
        </h2>
        <div style={{ width: '36px', height: '1.5px', backgroundColor: 'var(--color-text-accent)', marginTop: '14px' }} />
      </div>

      {/* ══════════════════════════════════════════════════════
          SECTION 1 — Trip Cost Summary
      ══════════════════════════════════════════════════════ */}
      <SectionLabel>Trip Cost Summary</SectionLabel>

      {totalQuoted == null && payments.length === 0 ? (
        <EmptyRow label="No financial data yet. Your curator will add the cost summary once your itinerary is confirmed." />
      ) : (
        <div
          style={{
            backgroundColor: 'var(--color-surface-sunken)',
            border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
            borderRadius: '14px',
            overflow: 'hidden',
          }}
        >
          {/* Main numbers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
            }}
          >
            {[
              { label: 'Total Quoted', value: totalQuoted != null ? fmt(totalQuoted, currency) : '—' },
              { label: 'Total Paid',   value: fmt(totalPaid, currency) },
              { label: 'Balance Due',  value: balance != null ? fmt(Math.max(0, balance), currency) : '—', highlight: !fullyPaid && balance != null && balance > 0 },
            ].map((col, i) => (
              <div
                key={col.label}
                style={{
                  padding: '20px 16px',
                  borderRight: i < 2 ? '0.5px solid rgb(var(--borges-rgb) / 0.10)' : 'none',
                  textAlign: 'center',
                }}
              >
                <p
                  className="font-optima"
                  style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '8px' }}
                >
                  {col.label}
                </p>
                <p
                  className="font-optima"
                  style={{ fontSize: 'var(--text-body)', color: col.highlight ? 'var(--color-text-secondary)' : 'var(--color-text)' }}
                >
                  {col.value}
                </p>
              </div>
            ))}
          </div>

          {/* Status row */}
          <div
            style={{
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
              {activeQuotation
                ? `Quotation ${activeQuotation.version ?? activeQuotation.quotation_id} · ${currency}`
                : 'No active quotation'}
            </p>
            {fullyPaid ? (
              <span
                className="font-optima"
                style={{
                  fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
                  padding: '3px 12px', borderRadius: '999px',
                  backgroundColor: 'rgb(var(--night-rgb) / 0.35)', color: 'var(--color-text-muted)',
                }}
              >
                Fully Paid
              </span>
            ) : balance != null && balance > 0 ? (
              <span
                className="font-optima"
                style={{
                  fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
                  padding: '3px 12px', borderRadius: '999px',
                  backgroundColor: 'rgb(var(--borges-rgb) / 0.2)', color: 'var(--color-text-accent)',
                }}
              >
                Balance Due
              </span>
            ) : null}
          </div>
        </div>
      )}

      <Divider />

      {/* ══════════════════════════════════════════════════════
          SECTION 2 — Cost Breakdown
      ══════════════════════════════════════════════════════ */}
      <SectionLabel>Cost Breakdown</SectionLabel>

      {lineItems.length === 0 ? (
        <EmptyRow label="Detailed breakdown will appear here once your quotation is ready." />
      ) : (
        <div
          style={{
            backgroundColor: 'var(--color-surface-sunken)',
            border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
            borderRadius: '14px',
            overflow: 'hidden',
          }}
        >
          {Object.entries(byCategory).map(([cat, items], ci) => {
            const catTotal = items.reduce((s, i) => s + (i.amount ?? 0), 0)
            return (
              <div
                key={cat}
                style={{ borderTop: ci > 0 ? '0.5px solid rgb(var(--borges-rgb) / 0.10)' : 'none' }}
              >
                {/* Category header */}
                <div
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'rgb(var(--borges-rgb) / 0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <p
                    className="font-optima"
                    style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-accent)' }}
                  >
                    {cat}
                  </p>
                  <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
                    {fmt(catTotal, currency)}
                  </p>
                </div>
                {/* Line items */}
                {items.map((item, ii) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '12px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '16px',
                      borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.07)',
                    }}
                  >
                    <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', flex: 1 }}>
                      {item.description}
                    </p>
                    <p
                      className="font-optima"
                      style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text)', flexShrink: 0 }}
                    >
                      {fmt(item.amount, item.currency ?? currency)}
                    </p>
                  </div>
                ))}
              </div>
            )
          })}

          {/* Grand total */}
          <div
            style={{
              borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>Total</p>
            <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)' }}>
              {fmt(totalQuoted, currency)}
            </p>
          </div>
        </div>
      )}

      <Divider />

      {/* ══════════════════════════════════════════════════════
          SECTION 3 — Payment History
      ══════════════════════════════════════════════════════ */}
      <SectionLabel>Payment History</SectionLabel>

      {payments.length === 0 ? (
        <EmptyRow label="No payments recorded yet." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {payments.map(payment => (
            <div
              key={payment.id}
              style={{
                backgroundColor: 'var(--color-surface-sunken)',
                border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div style={{ flex: 1 }}>
                <div className="flex items-center gap-2" style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
                    {fmt(payment.amount, payment.currency ?? 'USD')}
                  </p>
                  <StatusPill status={payment.status} />
                </div>
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
                  {formatDate(payment.payment_date)}
                  {payment.payment_method ? ` · ${payment.payment_method}` : ''}
                  {payment.reference ? ` · Ref: ${payment.reference}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Divider />

      {/* ══════════════════════════════════════════════════════
          SECTION 4 — Invoices
      ══════════════════════════════════════════════════════ */}
      <SectionLabel>Invoices</SectionLabel>

      {invoices.length === 0 ? (
        <EmptyRow label="No invoices issued yet." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {invoices.map(inv => (
            <div
              key={inv.id}
              style={{
                backgroundColor: 'var(--color-surface-sunken)',
                border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
                    {inv.invoice_number ?? inv.invoice_id}
                  </p>
                  <StatusPill status={inv.status} />
                </div>
                <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
                  {inv.amount != null ? `${fmt(inv.amount, inv.currency ?? 'USD')} · ` : ''}
                  Issued {formatDate(inv.issued_date)}
                  {inv.due_date ? ` · Due ${formatDate(inv.due_date)}` : ''}
                </p>
              </div>
              {inv.file_url ? (
                <a
                  href={inv.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-optima"
                  style={{
                    fontSize: 'var(--text-caption)',
                    letterSpacing: '0.01em',
                    color: 'var(--color-text-accent)',
                    textDecoration: 'none',
                    padding: '6px 14px',
                    borderRadius: '999px',
                    border: '0.5px solid rgb(var(--borges-rgb) / 0.3)',
                    flexShrink: 0,
                  }}
                >
                  Download
                </a>
              ) : (
                <span
                  className="font-optima"
                  style={{
                    fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
                    color: 'var(--color-text-muted)', flexShrink: 0,
                  }}
                >
                  No file
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <Divider />

      {/* ══════════════════════════════════════════════════════
          SECTION 5 — Make a Payment
      ══════════════════════════════════════════════════════ */}
      <SectionLabel>Make a Payment</SectionLabel>

      <div
        style={{
          backgroundColor: 'var(--color-surface-sunken)',
          border: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
          borderRadius: '14px',
          padding: '28px 24px',
        }}
      >
        <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', marginBottom: '10px' }}>
          Ready to make a payment?
        </p>
        <p
          className="font-optima"
          style={{ fontSize: 'var(--text-body)', lineHeight: 1.7, color: 'var(--color-text-muted)', marginBottom: '20px' }}
        >
          All payments are processed directly with your curator. Contact us on WhatsApp or email to initiate a transfer — we&rsquo;ll confirm the details and update your payment history here.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <a
            href="https://wa.me/919884256431"
            target="_blank"
            rel="noopener noreferrer"
            className="font-optima"
            style={{
              fontSize: 'var(--text-caption)',
              letterSpacing: '0.01em',
              color: 'var(--color-text-inverse)',
              textDecoration: 'none',
              padding: '10px 20px',
              borderRadius: '999px',
              backgroundColor: 'var(--color-text-accent)',
            }}
          >
            WhatsApp Us
          </a>
          <a
            href="mailto:hello@closequarters.club"
            className="font-optima"
            style={{
              fontSize: 'var(--text-caption)',
              letterSpacing: '0.01em',
              color: 'var(--color-text-accent)',
              textDecoration: 'none',
              padding: '10px 20px',
              borderRadius: '999px',
              border: '0.5px solid rgb(var(--borges-rgb) / 0.3)',
            }}
          >
            Send Email
          </a>
        </div>
      </div>

    </div>
  )
}
