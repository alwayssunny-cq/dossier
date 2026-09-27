'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { Iteration } from '@/lib/types'

function relativeTime(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (hours < 1)  return 'just now'
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'yesterday'
  if (days < 30)  return `${days} days ago`
  const months = Math.floor(days / 30)
  return `${months} month${months !== 1 ? 's' : ''} ago`
}

function ChevronDown() {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden>
      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function IterationDropdown({
  iterations,
  selectedName,
}: {
  iterations: Iteration[]
  selectedName: string
}) {
  const [open, setOpen]   = useState(false)
  const router            = useRouter()
  const pathname          = usePathname()
  const searchParams      = useSearchParams()
  const containerRef      = useRef<HTMLDivElement>(null)

  const disabled   = iterations.length <= 1
  const currentIter = iterations.find(i => i.is_current)

  // Close panel on outside click
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function selectIteration(name: string) {
    setOpen(false)
    const params = new URLSearchParams(searchParams.toString())
    // Selecting the current iteration → remove ?iter so URL stays clean
    if (name === currentIter?.name) {
      params.delete('iter')
    } else {
      params.set('iter', name)
    }
    const q = params.toString()
    router.push(`${pathname}${q ? `?${q}` : ''}`)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            '8px',
          background:     'none',
          border:         `0.5px solid ${disabled ? 'rgb(var(--borges-rgb) / 0.10)' : 'rgb(var(--borges-rgb) / 0.25)'}`,
          borderRadius:   '8px',
          padding:        '7px 14px',
          cursor:         disabled ? 'default' : 'pointer',
          color:          disabled ? 'var(--color-text-accent)' : 'var(--color-text-accent)',
        }}
      >
        <span
          className="font-optima"
          style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.08em', color: disabled ? 'var(--color-text-accent)' : 'var(--color-text-muted)' }}
        >
          Viewing:
        </span>
        <span
          className="font-optima"
          style={{ fontSize: 'var(--text-body)', color: disabled ? 'var(--color-text-accent)' : 'var(--color-text)', letterSpacing: '0.02em' }}
        >
          {selectedName}
        </span>
        {!disabled && (
          <span
            style={{
              color:      'var(--color-text-accent)',
              transition: 'transform 0.15s',
              transform:  open ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            <ChevronDown />
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="listbox"
          style={{
            position:        'absolute',
            top:             'calc(100% + 6px)',
            right:           0,
            minWidth:        '220px',
            backgroundColor: 'var(--color-surface-sunken)',
            border:          '0.5px solid rgb(var(--borges-rgb) / 0.2)',
            borderRadius:    '10px',
            boxShadow:       '0 8px 32px rgb(var(--night-rgb) / 0.5)',
            zIndex:          50,
            overflow:        'hidden',
          }}
        >
          {iterations.map((iter, idx) => {
            const isSelected = iter.name === selectedName
            return (
              <button
                key={iter.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => selectIteration(iter.name)}
                style={{
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'space-between',
                  width:           '100%',
                  padding:         '12px 16px',
                  background:      isSelected ? 'rgb(var(--borges-rgb) / 0.08)' : 'none',
                  border:          'none',
                  borderTop:       idx > 0 ? '0.5px solid rgb(var(--borges-rgb) / 0.10)' : 'none',
                  cursor:          'pointer',
                  textAlign:       'left',
                  gap:             '12px',
                }}
              >
                {/* Left: name + date */}
                <div>
                  <p
                    className="font-optima"
                    style={{
                      fontSize: 'var(--text-body)',
                      color:    iter.is_current ? 'var(--color-text)' : 'var(--color-text-muted)',
                      lineHeight: 1.2,
                    }}
                  >
                    {iter.name}
                  </p>
                  <p
                    className="font-optima"
                    style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', marginTop: '2px', letterSpacing: '0.03em' }}
                  >
                    Synced {relativeTime(iter.synced_at)}
                  </p>
                </div>

                {/* Right: current badge */}
                {iter.is_current && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                    <span
                      style={{
                        width: '5px', height: '5px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-text-accent)',
                        flexShrink: 0,
                      }}
                    />
                    <span
                      className="font-optima"
                      style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', letterSpacing: '0.01em', }}
                    >
                      Current
                    </span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
