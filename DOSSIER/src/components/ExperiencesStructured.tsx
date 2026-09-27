'use client'

import { useMemo, useState } from 'react'
import type { ParsedBlock } from '@/app/api/sync-content-pages/route'
import type { DatesDestination, Experience, Transfer } from '@/lib/types'
import GalleryCard from '@/components/GalleryCard'
import { alike, harvestPage } from '@/lib/notionImages'
import DestinationChapter from '@/components/DestinationChapter'
import DaySequence from '@/components/DaySequence'
import { withoutEchoedTitle } from '@/lib/text'

const RULE = 'rgb(var(--borges-rgb) / 0.18)'
const CARD_SHADOW = '0 2px 4px rgb(var(--night-rgb) / 0.05), 0 12px 32px rgb(var(--night-rgb) / 0.09)'

export { alike, harvestPage } from '@/lib/notionImages'

/** "2026-05-09" → "05-09" */
const dayKeyFromDate = (d: string | null): string | null =>
  d && d.length >= 10 ? d.slice(5, 10) : null

function fmtDate(d: string | null): string | null {
  if (!d) return null
  const parsed = new Date(d + (d.length === 10 ? 'T00:00:00' : ''))
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
}

interface Leg { transfer: Transfer }

/** One transfer, written as a route with its particulars beneath. */
function TransferLine({ t, last }: { t: Transfer; last: boolean }) {
  const route = [t.from_location, t.to_location].filter(Boolean).join(' → ')
  // Deliberately no notes or amount here — those fields carry vendor and
  // costing detail meant for us, not for the client's dossier.
  const facts = [
    fmtDate(t.date),
    t.transfer_mode,
    t.carrier,
    t.duration,
  ].filter(Boolean) as string[]

  return (
    <div style={{
      paddingBottom: last ? 0 : '14px',
      marginBottom: last ? 0 : '14px',
      borderBottom: last ? 'none' : `0.5px solid ${RULE}`,
    }}>
      <p className="font-optima" style={{ fontSize: 'var(--text-body)', lineHeight: 1.5, color: 'var(--color-text)' }}>
        {route || t.transfer_purpose || 'Transfer'}
      </p>
      {facts.length > 0 && (
        <p className="font-optima" style={{
          fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginTop: '6px',
        }}>
          {facts.join('  ·  ')}
        </p>
      )}
    </div>
  )
}

/**
 * Chain legs so each one departs from where the last arrived — same-day legs
 * carry identical dates and sort orders, so date alone leaves a flight sitting
 * behind the car that meets it.
 */
function chainLegs(list: Transfer[]): Transfer[] {
  const byDate = [...list].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  const out: Transfer[] = []
  const pool = [...byDate]
  while (pool.length > 0) {
    const last = out[out.length - 1]
    // Continue from where we are if a leg picks up there on the same day
    let nextIdx = last
      ? pool.findIndex(t => t.date === last.date && alike(t.from_location, last.to_location))
      : -1
    if (nextIdx < 0) {
      // Otherwise open the earliest day at the head of its chain — the leg no
      // other leg on that day feeds into
      const day = pool[0].date
      const sameDay = pool.filter(t => t.date === day)
      const head = sameDay.find(t => !sameDay.some(o => o !== t && alike(t.from_location, o.to_location)))
      nextIdx = head ? pool.indexOf(head) : 0
    }
    out.push(...pool.splice(nextIdx, 1))
  }
  return out
}

/** The chapter head's detail: the writing about a place, and how you reach it. */
function DestinationDetail({
  description, legs,
}: {
  description: string | null
  legs: Leg[]
}) {
  if (!description && legs.length === 0) return null
  return (
    <div
      style={{
        display: 'grid',
        gap: 'var(--space-8)',
        marginBottom: 'var(--space-10)',
      }}
      className="md:grid-cols-2"
    >
      {description && (
        <div>
          <p className="cq-label" style={{ marginBottom: 'var(--space-3)' }}>Description</p>
          <p className="cq-body cq-measure" style={{ margin: 0 }}>{description}</p>
        </div>
      )}
      {legs.length > 0 && (
        <div>
          <p className="cq-label" style={{ marginBottom: 'var(--space-3)' }}>Getting there</p>
          {legs.map((l, i) => (
            <TransferLine key={l.transfer.id} t={l.transfer} last={i === legs.length - 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function DayRule({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
      <h3 className="cq-subhead" style={{ fontSize: 'var(--text-subhead)', color: 'var(--color-text)', flexShrink: 0 }}>
        {label}
      </h3>
      <div style={{ flex: 1, height: '0.5px', backgroundColor: RULE, marginTop: '4px' }} />
    </div>
  )
}

export default function ExperiencesStructured({
  destinations,
  experiences,
  transfers,
  blocks,
}: {
  destinations: DatesDestination[]
  experiences: Experience[]
  transfers: Transfer[]
  blocks: ParsedBlock[]
}) {
  const { byTitle, byDay } = useMemo(() => harvestPage(blocks), [blocks])
  const [query, setQuery] = useState('')

  /** Destinations in itinerary order, each with its dates, experiences and legs. */
  const sections = useMemo(() => {
    const dests = [...destinations].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

    // A destination's window opens on its first experience and runs for the
    // nights booked there, so it closes on the day you move on.
    const windows = dests.map(d => {
      const own = experiences.filter(e => alike(e.location, d.place))
      const dates = own.map(e => e.date).filter(Boolean).sort() as string[]
      const from = dates[0] ?? null
      const lastDay = dates[dates.length - 1] ?? null
      let to = lastDay
      if (from && d.nights != null) {
        // Count in UTC — a local-time date read back as ISO loses a day east of Greenwich
        const end = new Date(from + 'T00:00:00Z')
        end.setUTCDate(end.getUTCDate() + d.nights)
        const iso = end.toISOString().slice(0, 10)
        if (!to || iso > to) to = iso
      }
      return { dest: d, from, to, lastDay, experiences: own }
    })

    // A transfer belongs to the destination it delivers you to; anything after
    // the final destination begins is the journey home.
    const lastStart = windows[windows.length - 1]?.from ?? null
    const grouped = new Map<string, Transfer[]>()
    const onwardRaw: Transfer[] = []
    const add = (key: string, t: Transfer) =>
      grouped.set(key, [...(grouped.get(key) ?? []), t])

    for (const t of transfers) {
      const byPlace = windows.find(w => alike(t.to_location, w.dest.place))
      if (byPlace) { add(byPlace.dest.id, t); continue }
      if (lastStart && t.date && t.date >= lastStart) { onwardRaw.push(t); continue }
      const byWindow = windows.find(w =>
        t.date && w.from && w.lastDay && t.date >= w.from && t.date <= w.lastDay)
      if (byWindow) add(byWindow.dest.id, t)
      else onwardRaw.push(t)
    }

    const legs = new Map<string, Leg[]>()
    for (const [key, list] of grouped) {
      legs.set(key, chainLegs(list).map(transfer => ({ transfer })))
    }
    const onward: Leg[] = chainLegs(onwardRaw).map(transfer => ({ transfer }))

    return { windows, legs, onward }
  }, [destinations, experiences, transfers])

  /** An experience card, drawing prose and pictures from the Notion page. */
  const cardFor = (e: Experience) => {
    let match: { images: ParsedBlock[]; prose: string[] } | undefined
    for (const [title, v] of byTitle) {
      if (alike(title, e.title)) { match = v; break }
    }
    const dayImgs = byDay.get(dayKeyFromDate(e.date) ?? '') ?? []
    const images = (match?.images.length ?? 0) > 0 ? match!.images : dayImgs
    // Prose from Notion frequently opens by restating the name it sits under.
    const trimmed = withoutEchoedTitle(e.description, e.title)
    const description = (match?.prose.length ?? 0) > 0
      ? match!.prose
      : (trimmed ? [trimmed] : [])

    return (
      <GalleryCard
        key={e.id}
        title={e.title}
        meta={[e.time_of_day, e.tags?.join(', ') || null]}
        description={description}
        images={images}
      />
    )
  }

  const matches = (e: Experience) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return e.title.toLowerCase().includes(q)
      || (e.description ?? '').toLowerCase().includes(q)
      || (e.location ?? '').toLowerCase().includes(q)
  }

  const total = experiences.length
  if (total === 0 && destinations.length === 0) return null

  return (
    <div>
      {/* Search */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          backgroundColor: 'var(--color-surface-sunken)', border: '0.5px solid rgb(var(--borges-rgb) / 0.16)',
          borderRadius: '999px', padding: '0 18px', maxWidth: '380px',
        }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
            <circle cx="6" cy="6" r="4.5" stroke="#706E56" strokeWidth="1.3"/>
            <path d="M9.5 9.5L13 13" stroke="#706E56" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <input
            aria-label="Search experiences"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${total} experience${total === 1 ? '' : 's'}`}
            className="font-optima"
            style={{ flex: 1, minWidth: 0, alignSelf: 'stretch', minHeight: '44px', background: 'transparent', border: 'none', outline: 'none', fontSize: 'var(--text-caption)', color: 'var(--color-text)' }}
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 0 }}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {sections.windows.map((w, i) => {
        const shown = w.experiences.filter(matches)
        if (query && shown.length === 0) return null

        // Group the destination's experiences by the day they fall on
        const days = new Map<string, Experience[]>()
        for (const e of shown.sort((a, b) =>
          (a.date ?? '').localeCompare(b.date ?? '') || (a.sort_order ?? 0) - (b.sort_order ?? 0)
        )) {
          const key = e.date ?? 'undated'
          days.set(key, [...(days.get(key) ?? []), e])
        }

        return (
          <DestinationChapter
            key={w.dest.id}
            index={i + 1}
            total={sections.windows.length}
            place={w.dest.place ?? w.dest.display_name ?? 'Destination'}
            dates={(() => {
              const from = fmtDate(w.from), to = fmtDate(w.to)
              if (from && to && from !== to) {
                const [fd, fm] = from.split(' '), [, tm] = to.split(' ')
                return fm === tm ? `${fd} – ${to}` : `${from} – ${to}`
              }
              return from ?? w.dest.dates_label ?? null
            })()}
            nights={w.dest.nights}
            detail={
              <DestinationDetail
                description={w.dest.description}
                legs={sections.legs.get(w.dest.id) ?? []}
              />
            }
          >
            {[...days.entries()].map(([date, list], d) => (
              <DaySequence
                key={date}
                // The first day of the opening chapter is what the reader
                // lands on; every other day waits behind its heading.
                defaultOpen={i === 0 && d === 0}
                label={fmtDate(date) ?? 'Your day'}
                items={list.map(e => ({
                  key: e.id,
                  time: e.time_of_day ?? null,
                  node: cardFor(e),
                }))}
              />
            ))}
          </DestinationChapter>
        )
      })}

      {/* The journey home */}
      {!query && sections.onward.length > 0 && (
        <section>
          <DayRule label="Onward" />
          <div style={{
            backgroundColor: 'var(--color-surface-sunken)', border: `0.5px solid ${RULE}`, borderRadius: '12px',
            boxShadow: CARD_SHADOW, padding: '22px 26px',
          }}>
            {sections.onward.map((l, i) => (
              <TransferLine key={l.transfer.id} t={l.transfer} last={i === sections.onward.length - 1} />
            ))}
          </div>
        </section>
      )}

      {query && experiences.filter(matches).length === 0 && (
        <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
          Nothing matches &ldquo;{query}&rdquo;.
        </p>
      )}
    </div>
  )
}
