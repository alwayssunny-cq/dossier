'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The floating controls, which get out of the way while you read.
 *
 * Two circles pinned to the bottom-right corner sit on top of whatever is
 * behind them, permanently — the audit found them covering a section title
 * and a paragraph of the brief with no scroll position that clears them.
 *
 * A control anchored over the content has to earn its place continuously. It
 * withdraws when you scroll down — you are reading, not reaching for it — and
 * comes back the moment you scroll up. It deliberately does NOT return when
 * scrolling merely stops: coming to rest is how you settle on a paragraph,
 * and returning then puts the circle straight back over the words you stopped
 * to read. Reaching it is always one upward flick.
 */
export default function FloatingDock({ children }: { children: React.ReactNode }) {
  const [away, setAway] = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    lastY.current = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const down = y > lastY.current + 4
      const up = y < lastY.current - 4
      // Never hide at the very top, where there is nothing to read under it.
      if (down && y > 220) setAway(true)
      else if (up) setAway(false)
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      className="fixed right-5 z-50 flex flex-row-reverse md:flex-col items-end gap-3"
      style={{
        bottom: 'calc(var(--tabbar-h) + 1rem + env(safe-area-inset-bottom))',
        transform: away ? 'translateY(calc(100% + 1.5rem))' : 'translateY(0)',
        opacity: away ? 0 : 1,
        pointerEvents: away ? 'none' : 'auto',
        transition: 'transform 0.28s var(--ease-out), opacity 0.28s var(--ease-out)',
      }}
    >
      {children}
    </div>
  )
}
