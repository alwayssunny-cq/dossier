'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import CQLogo from '@/components/CQLogo'

const NAV_LINKS = [
  { href: '/dashboard',      label: 'Dashboard' },
  { href: '/profile',        label: 'Profile'   },
  { href: '/understand-cq',  label: 'Understand CQ'   },
  { href: '/understand-you', label: 'About You' },
]

export default function DashboardHeader({ firstName }: { firstName: string }) {
  const pathname    = usePathname()
  const [open, setOpen] = useState(false)
  const navRef      = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on route change
  useEffect(() => { setOpen(false) }, [pathname])

  function isActive(href: string) {
    return pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  }

  return (
    <div ref={navRef} style={{ marginBottom: 'var(--pad-56)' }}>
      {/* ── Top bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '18px',
          borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
        }}
      >
        {/* Logo */}
        <Link href="/dashboard" style={{ display: 'flex', textDecoration: 'none' }}>
          <CQLogo variant="dark" height={44} />
        </Link>

        {/* ── Desktop nav ── */}
        <nav className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="font-optima"
              style={{
                fontSize: 'var(--text-caption)',
                letterSpacing: '0.07em',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: '44px',
                color: isActive(link.href) ? 'var(--color-text)' : 'var(--color-text-muted)',
                transition: 'color 0.15s',
              }}
            >
              <span
                style={{
                  paddingBottom: '2px',
                  borderBottom: isActive(link.href)
                    ? '0.5px solid rgb(var(--night-rgb) / 0.5)'
                    : '0.5px solid transparent',
                }}
              >
                {link.label}
              </span>
            </Link>
          ))}
        </nav>

        {/* ── Right: sign-out + avatar (desktop), hamburger (mobile) ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Desktop sign out */}
          {/* A form, not a Link: Next prefetches links in the viewport, and a
              prefetch of the sign-out route signed the reader straight back
              out. Forms are never prefetched. */}
          <form action="/api/auth/signout" method="post" className="hidden md:block">
            <button
              type="submit"
              className="font-optima"
              style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.07em', color: 'var(--color-text-muted)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', minHeight: '44px' }}
            >
              Sign out
            </button>
          </form>

          {/* Avatar */}
          <div
            className="hidden md:flex items-center justify-center font-optima"
            style={{
              width: '28px', height: '28px', borderRadius: '50%',
              backgroundColor: 'rgb(var(--borges-rgb) / 0.12)',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-caption)',
              border: '0.5px solid rgb(var(--borges-rgb) / 0.28)',
              flexShrink: 0,
            }}
          >
            {firstName[0]?.toUpperCase()}
          </div>

          {/* Mobile hamburger */}
          <button
            className="flex md:hidden items-center justify-center"
            onClick={() => setOpen(o => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            style={{
              // 24x26 before. The only way into navigation on a phone should
              // not be the hardest thing on the page to hit.
              background: 'none', border: 'none', cursor: 'pointer',
              width: '44px', height: '44px', marginRight: '-10px', padding: 0,
            }}
          >
            <div style={{ width: '20px', height: '14px', position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 0, right: 0, height: '1px', backgroundColor: 'var(--color-text)',
                top: open ? '6px' : '0',
                transform: open ? 'rotate(45deg)' : 'none',
                transition: 'top 0.18s ease, transform 0.18s ease',
              }} />
              <span style={{
                position: 'absolute', top: '6px', left: 0, right: 0, height: '1px', backgroundColor: 'var(--color-text)',
                opacity: open ? 0 : 1,
                transition: 'opacity 0.15s',
              }} />
              <span style={{
                position: 'absolute', left: 0, right: 0, height: '1px', backgroundColor: 'var(--color-text)',
                top: open ? '6px' : '12px',
                transform: open ? 'rotate(-45deg)' : 'none',
                transition: 'top 0.18s ease, transform 0.18s ease',
              }} />
            </div>
          </button>
        </div>
      </div>

      {/* ── Mobile menu (slides in below bar) ── */}
      {open && (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.10)',
            animation: 'fadeSlideUp 0.18s ease',
            paddingBottom: '8px',
          }}
        >
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="font-optima"
              style={{
                display: 'block',
                padding: '13px 0',
                fontSize: 'var(--text-body)',
                color: isActive(link.href) ? 'var(--color-text)' : 'var(--color-text-accent)',
                textDecoration: 'none',
                borderBottom: '0.5px solid rgb(var(--borges-rgb) / 0.08)',
              }}
            >
              {link.label}
            </Link>
          ))}

          {/* Sign out row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px' }}>
            <span className="font-optima" style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
              {firstName}
            </span>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="font-optima"
                style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-accent)', letterSpacing: '0.07em', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
