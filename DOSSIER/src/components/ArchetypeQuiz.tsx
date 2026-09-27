'use client'

import { useState } from 'react'
import Link from 'next/link'
import CQLogo from '@/components/CQLogo'
import NewTripRequestCard from '@/components/NewTripRequestCard'
import { QUESTIONS, ARCHETYPES, type ArchetypeData } from '@/lib/archetypes'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  firstName: string
  clientId: string | null
  /** 4-letter archetype code (e.g. "SINX") already on file for this client, if any. */
  initialCode?: string | null
}


// ── Quiz component ────────────────────────────────────────────────────────────

const initialResult = (code?: string | null) => (code ? ARCHETYPES[code] ?? null : null)

export default function ArchetypeQuiz({ firstName, clientId, initialCode }: Props) {
  const startingArchetype = initialResult(initialCode)
  const [phase, setPhase]         = useState<'intro' | 'quiz' | 'result'>(startingArchetype ? 'result' : 'intro')
  const [currentQ, setCurrentQ]   = useState(0)
  const [answers, setAnswers]     = useState<string[]>([])   // index 0-3 → q1-q4 values
  const [selected, setSelected]   = useState<string | null>(null)
  const [archetype, setArchetype] = useState<ArchetypeData | null>(startingArchetype)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [copied, setCopied]       = useState(false)
  const [saveError, setSaveError] = useState(false)

  function handleSelect(value: string) {
    setSelected(value)
  }

  async function persistResult(code: string, result: ArchetypeData) {
    if (!clientId) return
    try {
      const res = await fetch('/api/archetype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, code, name: result.name, displayCode: result.code }),
      })
      setSaveError(!res.ok)
    } catch {
      setSaveError(true)
    }
  }

  function handleNext() {
    if (!selected) return
    const next = [...answers, selected]
    setAnswers(next)
    setSelected(null)

    if (currentQ < 3) {
      setCurrentQ(currentQ + 1)
    } else {
      const code = next.join('')
      const result = ARCHETYPES[code] ?? ARCHETYPES['SINX']
      setArchetype(result)
      setPhase('result')
      setSaveError(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      void persistResult(ARCHETYPES[code] ? code : 'SINX', result)
    }
  }

  function handleRetake() {
    setPhase('intro')
    setCurrentQ(0)
    setAnswers([])
    setSelected(null)
    setArchetype(null)
    setImgLoaded(false)
    setSaveError(false)
  }

  async function handleShare() {
    const text = `I'm ${archetype?.name} — my CQ travel archetype. What's yours?`
    if (navigator.share) {
      await navigator.share({ title: archetype?.name ?? 'My Travel Archetype', text, url: window.location.href })
    } else {
      await navigator.clipboard.writeText(`${text} ${window.location.href}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const q = QUESTIONS[currentQ]

  // ── Intro ──────────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-surface)' }}>
        <main className="mx-auto px-5" style={{ maxWidth: '560px', paddingTop: 'var(--pad-40)', paddingBottom: 'var(--pad-96)' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--pad-72)' }}>
            <Link href="/dashboard"><CQLogo variant="dark" height={40} /></Link>
            <Link href="/dashboard" className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', textDecoration: 'none', letterSpacing: '0.07em', display: 'inline-flex', alignItems: 'center', minHeight: '44px', paddingInline: '8px', marginRight: '-8px' }}>
              Skip
            </Link>
          </div>

          <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
            4 questions
          </p>
          <h1 className="cq-t1" style={{ fontSize: 'var(--text-t1)', lineHeight: 1.0, color: 'var(--color-text)', marginBottom: '18px' }}>
            Find your travel archetype.
          </h1>
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)', lineHeight: 1.85, marginBottom: 'var(--pad-48)', maxWidth: '420px' }}>
            A short reading that tells us how you move through the world — so we can design travel that feels made for you.
          </p>

          <button
            onClick={() => setPhase('quiz')}
            className="font-optima"
            style={{
              padding: '15px 36px', backgroundColor: 'var(--color-text)', color: 'var(--color-surface)',
              border: 'none', borderRadius: '3px', cursor: 'pointer',
              fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
            }}
          >
            Begin
          </button>
        </main>
      </div>
    )
  }

  // ── Quiz ───────────────────────────────────────────────────────────────────

  if (phase === 'quiz') {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-surface)' }}>
        <main className="mx-auto px-5" style={{ maxWidth: '560px', paddingTop: 'var(--pad-40)', paddingBottom: 'var(--pad-96)' }}>
          {/* Top bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--pad-56)' }}>
            <Link href="/dashboard"><CQLogo variant="dark" height={40} /></Link>
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', letterSpacing: '0.01em' }}>
              {currentQ + 1} / {QUESTIONS.length}
            </p>
          </div>

          {/* Progress bar */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: 'var(--pad-48)' }}>
            {QUESTIONS.map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1, height: '2px', borderRadius: '1px',
                  backgroundColor: i < currentQ ? 'var(--color-text)' : i === currentQ ? 'rgb(var(--night-rgb) / 0.35)' : 'rgb(var(--night-rgb) / 0.1)',
                  transition: 'background-color 0.3s',
                }}
              />
            ))}
          </div>

          {/* Question */}
          <h2 className="cq-t1" style={{ fontSize: 'var(--text-t1)', lineHeight: 1.1, color: 'var(--color-text)', marginBottom: '32px' }}>
            {q.text}
          </h2>

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: 'var(--pad-40)' }}>
            {q.options.map(opt => {
              const isSelected = selected === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  style={{
                    width: '100%', textAlign: 'left', cursor: 'pointer',
                    padding: '20px 22px', borderRadius: '8px',
                    backgroundColor: isSelected ? 'var(--color-text)' : 'var(--color-surface-sunken)',
                    border: isSelected ? '0.5px solid var(--color-text)' : '0.5px solid rgb(var(--borges-rgb) / 0.18)',
                    transition: 'all 0.18s ease',
                  }}
                >
                  <p
                    className="font-optima"
                    style={{
                      fontSize: opt.attribution ? '15px' : '17px',
                      color: isSelected ? 'var(--color-surface)' : 'var(--color-text)',
                      lineHeight: 1.35,
                      marginBottom: (opt.sublabel || opt.attribution) ? '6px' : '0',
                      fontStyle: opt.attribution ? 'italic' : 'normal',
                    }}
                  >
                    {opt.label}
                  </p>
                  {opt.sublabel && (
                    <p
                      className="font-optima"
                      style={{ fontSize: 'var(--text-caption)', color: isSelected ? 'rgb(var(--mist-rgb) / 0.6)' : 'var(--color-text-muted)', lineHeight: 1.5 }}
                    >
                      {opt.sublabel}
                    </p>
                  )}
                  {opt.attribution && (
                    <p
                      className="font-optima"
                      style={{ fontSize: 'var(--text-caption)', color: isSelected ? 'rgb(var(--mist-rgb) / 0.55)' : 'var(--color-text-muted)', letterSpacing: '0.04em' }}
                    >
                      {opt.attribution}
                    </p>
                  )}
                </button>
              )
            })}
          </div>

          {/* Continue */}
          <button
            onClick={handleNext}
            disabled={!selected}
            className="font-optima"
            style={{
              width: '100%', padding: '15px',
              backgroundColor: selected ? 'var(--color-text-accent)' : 'rgb(var(--borges-rgb) / 0.25)',
              color: 'var(--color-surface)', border: 'none', borderRadius: '3px',
              fontSize: 'var(--text-caption)', letterSpacing: '0.01em',
              cursor: selected ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.2s',
            }}
          >
            {currentQ < 3 ? 'Continue' : 'Reveal my archetype'}
          </button>
        </main>
      </div>
    )
  }

  // ── Result ─────────────────────────────────────────────────────────────────

  if (!archetype) return null
  const dest = archetype.destination

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-surface)' }}>
      <main style={{ maxWidth: '680px', margin: '0 auto', paddingBottom: 'var(--pad-96)' }}>

        {/* ── Hero image ── */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '21 / 9', backgroundColor: 'var(--color-text-secondary)', overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dest.imageUrl}
            alt={dest.name}
            style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              filter: 'brightness(0.72) saturate(0.85)',
              transition: 'opacity 0.6s',
              opacity: imgLoaded ? 1 : 0,
            }}
            onLoad={() => setImgLoaded(true)}
          />
          {/* Deep gradient */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgb(var(--night-rgb) / 0.96) 0%, rgb(var(--night-rgb) / 0.3) 45%, transparent 100%)' }} />

          {/* Top bar overlay */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '28px 28px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link href="/dashboard" style={{ display: 'flex' }}><CQLogo variant="white" height={36} /></Link>
            <button
              onClick={handleRetake}
              className="font-optima"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'rgb(var(--mist-rgb) / 0.5)' }}
            >
              Retake
            </button>
          </div>

          {/* Archetype identity — bottom of image */}
          <div style={{ position: 'absolute', bottom: '28px', left: '28px', right: '28px' }}>
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
              {archetype.code}
            </p>
            <h1 className="cq-t1" style={{ fontSize: 'var(--text-t1)', lineHeight: 1.0, color: 'var(--color-surface)' }}>
              {archetype.name}
            </h1>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="px-5" style={{ paddingTop: '36px' }}>

          {/* Essence */}
          <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)', lineHeight: 1.85, marginBottom: 'var(--pad-40)' }}>
            {archetype.essence}
          </p>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', opacity: 0.3 }}>
            <div style={{ flex: 1, height: '0.5px', backgroundColor: 'var(--color-text-accent)' }} />
            <span className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '5px', color: 'var(--color-text-accent)' }}>· · ·</span>
            <div style={{ flex: 1, height: '0.5px', backgroundColor: 'var(--color-text-accent)' }} />
          </div>

          {/* Destination */}
          <div style={{ marginBottom: '36px' }}>
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
              Your destination
            </p>
            <h2 className="cq-subhead-lg" style={{ fontSize: 'var(--text-subhead-lg)', lineHeight: 1.05, color: 'var(--color-text)', marginBottom: '4px' }}>
              {dest.name}
            </h2>
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', marginBottom: '14px', letterSpacing: '0.06em' }}>
              {dest.country}
            </p>
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.75, marginBottom: '14px' }}>
              {dest.description}
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {dest.bullets.map((b, i) => (
                <li key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ flexShrink: 0, marginTop: '6px', width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgb(var(--borges-rgb) / 0.7)' }} />
                  <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)', lineHeight: 1.75 }}>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* You might bump into */}
          <div
            style={{
              padding: '14px 18px', borderRadius: '8px',
              backgroundColor: 'var(--color-surface-sunken)', border: '0.5px solid rgb(var(--borges-rgb) / 0.14)',
              marginBottom: '36px', display: 'flex', alignItems: 'center', gap: '12px',
            }}
          >
            <p className="font-optima" style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.01em', color: 'var(--color-text-muted)', flexShrink: 0 }}>
              You might bump into
            </p>
            <div style={{ flex: 1, height: '0.5px', backgroundColor: 'rgb(var(--borges-rgb) / 0.14)' }} />
            <p className="font-optima" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', flexShrink: 0 }}>
              {dest.bumpInto.join(' · ')}
            </p>
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '32px', flexWrap: 'wrap' }}>
            {/* Take me there → opens trip request modal */}
            <NewTripRequestCard
              clientId={clientId}
              firstName={firstName}
              prefilledDestination={`${dest.name}, ${dest.country}`}
              customTrigger={open => (
                <button
                  onClick={open}
                  className="font-optima"
                  style={{
                    padding: '14px 28px', backgroundColor: 'var(--color-text)', color: 'var(--color-surface)',
                    border: 'none', borderRadius: '3px', cursor: 'pointer',
                    fontSize: 'var(--text-caption)', letterSpacing: '0.01em', flexShrink: 0,
                  }}
                >
                  Take me there
                </button>
              )}
            />

            {/* Share */}
            <button
              onClick={handleShare}
              className="font-optima"
              style={{
                padding: '14px 28px',
                backgroundColor: 'transparent',
                color: 'var(--color-text-accent)',
                border: '0.5px solid rgb(var(--borges-rgb) / 0.35)',
                borderRadius: '3px', cursor: 'pointer',
                fontSize: 'var(--text-caption)', letterSpacing: '0.01em', flexShrink: 0,
              }}
            >
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>

          {/* Secondary actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', paddingTop: '20px', borderTop: '0.5px solid rgb(var(--borges-rgb) / 0.10)' }}>
            <button
              onClick={handleRetake}
              className="font-optima"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', padding: 0 }}
            >
              Retake quiz
            </button>
            <Link
              href="/dashboard"
              className="font-optima"
              style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', textDecoration: 'none' }}
            >
              Back to dashboard
            </Link>
            {saveError && (
              <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)' }}>
                Couldn&rsquo;t save your result — please try again.
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
