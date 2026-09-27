'use client'

import { useState } from 'react'

export interface LoafStory {
  id: string
  headline: string
  location: string | null
  summary: string | null
  story: string | null
  tags: string[] | null
  date_featured: string | null
  is_this_week: boolean | null
  reading_link: string | null
  cover_url: string | null
}

function formatDate(d: string | null): string | null {
  if (!d) return null
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return null }
}

// ── This Week featured card ────────────────────────────────────────────────────

function LoafCard({
  story, onReadMore, featured = false,
}: {
  story: LoafStory
  onReadMore: () => void
  /** This week's story — same shape as the rest, darker so it still leads. */
  featured?: boolean | null
}) {
  const tag = story.tags?.[0] ?? null
  const dateStr = formatDate(story.date_featured)

  // One treatment for every story in the rail.
  //
  // The first card used to invert — night ground, mist ink — while the rest
  // sat on panel. Side by side in a scrolling rail that read as two different
  // components rather than one set, and when the featured story had no cover
  // image the inverted card became a black rectangle with nothing in it. The
  // rail is uniform now; which story leads is said by its position, which is
  // what a rail is for.
  //
  // steps flip to Milky Mist at the same relative weights.
  const ink      = 'var(--color-text)'
  const inkMuted = 'var(--color-text-muted)'
  const inkFaint = 'var(--color-text-accent)'

  return (
    <div
      className="card-lift"
      style={{
        backgroundColor: 'var(--color-panel)',
        border: '1px solid var(--color-rule)',
        borderRadius: '8px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 2px 4px rgb(var(--night-rgb) / 0.05), 0 12px 32px rgb(var(--night-rgb) / 0.10), 0 28px 64px rgb(var(--night-rgb) / 0.07)',
      }}
    >
      {/* Every card in the set has a picture area of the same shape, whether
          or not a picture exists. A set of cards is read by comparing them,
          and that only works when they share a silhouette — one card with a
          photograph beside one without reads as a broken card, not as a
          different card. Where there is no cover the space is a plate: the
          ground, the grain the rest of the dossier uses, and the category set
          quietly in Seasons, so it is plainly a choice. */}
      <div className="cq-loaf-media">
        {story.cover_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={story.cover_url}
            alt={story.headline}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: 'brightness(0.88) saturate(0.85)' }}
          />
        ) : (
          <div
            style={{
              width: '100%', height: '100%', position: 'relative',
              backgroundColor: 'var(--color-panel-raised)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute', inset: 0, opacity: 0.10, mixBlendMode: 'multiply',
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                backgroundSize: '160px 160px',
              }}
            />
            <span
              style={{
                position: 'relative',
                fontFamily: "'The Seasons', Georgia, serif",
                fontSize: 'var(--text-t1)',
                lineHeight: 1,
                color: 'var(--color-text-muted)',
              }}
            >
              ✧
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: '16px 18px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '6px' }}>
          {tag && (
            <span className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: inkMuted }}>
              {tag}
            </span>
          )}
          {dateStr && (
            <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
              · {dateStr}
            </span>
          )}
        </div>

        <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: ink, lineHeight: 1.5, marginBottom: '6px' }}>
          {story.headline}
        </p>

        {story.location && (
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: inkMuted, marginBottom: '6px' }}>
            {story.location}
          </p>
        )}

        {story.summary && (
          <p
            className="font-optima"
            style={{
              fontSize: 'var(--text-caption)', color: inkFaint, lineHeight: 1.6,
              // Three lines, and exactly three. `flex: 1` used to let this
              // paragraph grow into whatever height the tallest card in the
              // row happened to need, and because it also clips its overflow
              // the extra space was filled with a fourth line sliced through
              // the middle of the letters. A clamp only reads as deliberate
              // when it lands on a whole line.
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            } as React.CSSProperties}
          >
            {story.summary}
          </p>
        )}

        {story.reading_link ? (
          <a
            href={story.reading_link}
            target="_blank"
            rel="noopener noreferrer"
            className="font-optima"
            style={{
              display: 'inline-flex', alignItems: 'center', minHeight: '44px', marginTop: '4px',
              fontSize: 'var(--text-caption)', color: inkFaint,
              letterSpacing: '0.06em',
              textDecoration: 'none',
              borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.3)',
              paddingBottom: '1px',
            }}
          >
            Read →
          </a>
        ) : (
          <button
            onClick={onReadMore}
            className="font-optima"
            style={{
              display: 'inline-flex', alignItems: 'center', minHeight: '44px',
              marginTop: '10px', alignSelf: 'flex-start',
              fontSize: 'var(--text-caption)', color: inkFaint,
              letterSpacing: '0.06em',
              background: 'none', border: 'none',
              borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.3)',
              padding: '0 0 1px',
              cursor: 'pointer',
            }}
          >
            Read →
          </button>
        )}
      </div>
    </div>
  )
}

function PlaceholderCard() {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-sunken)',
        border: '0.5px solid rgb(var(--borges-rgb) / 0.08)',
        borderRadius: '8px',
        overflow: 'hidden',
        opacity: 0.45,
      }}
    >
      <div style={{ height: '180px', backgroundColor: 'var(--color-surface-sunken)' }} />
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ height: '7px', width: '40px', backgroundColor: 'rgb(var(--borges-rgb) / 0.15)', borderRadius: '4px', marginBottom: '8px' }} />
        <div style={{ height: '13px', width: '85%', backgroundColor: 'rgb(var(--borges-rgb) / 0.18)', borderRadius: '4px', marginBottom: '5px' }} />
        <div style={{ height: '11px', width: '50%', backgroundColor: 'rgb(var(--borges-rgb) / 0.10)', borderRadius: '4px' }} />
      </div>
    </div>
  )
}

// ── Full-story modal (in-app fallback when there's no external reading_link) ──

function StoryModal({ story, onClose }: { story: LoafStory; onClose: () => void }) {
  const paragraphs = (story.story ?? story.summary ?? '').split(/\n+/).filter(Boolean)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgb(var(--night-rgb) / 0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--color-surface)', borderRadius: '10px',
          maxWidth: '640px', width: '100%', maxHeight: '84vh', overflowY: 'auto',
          padding: '40px 36px',
        }}
      >
        <button
          onClick={onClose}
          className="font-optima"
          style={{
            float: 'right', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', letterSpacing: '0.08em', padding: 0,
          }}
        >
          Close ✕
        </button>

        {story.location && (
          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
            {story.location}
          </p>
        )}
        <p className="cq-subhead-lg" style={{ fontSize: 'var(--text-subhead-lg)', color: 'var(--color-text)', lineHeight: 1.15, marginBottom: '20px', maxWidth: '90%' }}>
          {story.headline}
        </p>
        {paragraphs.map((p, i) => (
          <p key={i} className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)', lineHeight: 1.8, marginBottom: '16px' }}>
            {p}
          </p>
        ))}
      </div>
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function CQLoafSection({ stories, showHeader = true }: { stories: LoafStory[]; showHeader?: boolean }) {
  const thisWeek = stories.find(s => s.is_this_week)
  // Five is the shelf. Beyond that the oldest drops off rather than the row
  // growing forever.
  const ordered = [
    ...(thisWeek ? [thisWeek] : []),
    ...stories.filter(s => !s.is_this_week),
  ].slice(0, 5)
  const [openStory, setOpenStory] = useState<LoafStory | null>(null)

  return (
    <section>
      {showHeader && (
        <div className="flex items-center gap-3" style={{ marginBottom: '20px' }}>
          <div>
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '5px' }}>
              CQ Loaf
            </p>
            <p className="cq-subhead" style={{ fontSize: 'var(--text-subhead)', color: 'var(--color-text)', lineHeight: 1.1 }}>
              Stories from the field
            </p>
          </div>
          <div style={{ flex: 1, height: '0.5px', backgroundColor: 'rgb(var(--borges-rgb) / 0.10)', marginTop: '14px' }} />
        </div>
      )}

      {openStory && <StoryModal story={openStory} onClose={() => setOpenStory(null)} />}

      {stories.length > 0 ? (
        <>
          {/* One shelf, five cards, all the same shape. This week's used to be
              a full-width banner above the others, which stretched its image
              into a letterbox on a wide screen and broke the rhythm of the
              row. It keeps its darker treatment so it still reads as this
              week — it just stops being a different object. */}
          <div className="cq-loaf-set">
            {ordered.map(s => (
              <div key={s.id}>
                <LoafCard
                  story={s}
                  onReadMore={() => setOpenStory(s)}
                  featured={s.is_this_week}
                />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '14px' }}>
            <PlaceholderCard /><PlaceholderCard /><PlaceholderCard />
          </div>
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
            CQ Loaf stories will appear here once connected.
          </p>
        </div>
      )}
    </section>
  )
}
