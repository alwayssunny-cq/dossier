'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Built on first use, never while rendering. A browser client constructed in a
// component body is also constructed during that component's server render,
// where there is no browser environment — which made `next build` depend on
// runtime configuration being present and fail wherever it was not.
let _sb: ReturnType<typeof createClient> | null = null
const sb = () => (_sb ??= createClient())


interface Props {
  /** Supabase table names to watch */
  tables: string[]
  /** UUID of the trip to filter by (uses trip_id column) */
  tripUuid?: string
}

/**
 * Invisible component that subscribes to Supabase Realtime on the given tables.
 * When any INSERT / UPDATE / DELETE fires, it calls router.refresh() so the
 * parent server component re-fetches fresh data without a full page reload.
 */
export default function RealtimeRefresher({ tables, tripUuid }: Props) {
  const router = useRouter()
  // Debounce: avoid rapid consecutive refreshes
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleRefresh = () => {
    if (pendingRef.current) clearTimeout(pendingRef.current)
    pendingRef.current = setTimeout(() => router.refresh(), 300)
  }

  useEffect(() => {
    const channels = tables.map(table => {
      const channelName = `rt:${table}:${tripUuid ?? 'all'}`
      const filter = tripUuid ? `trip_id=eq.${tripUuid}` : undefined

      return sb()
        .channel(channelName)
        .on(
          'postgres_changes' as const,
          {
            event: '*' as const,
            schema: 'public',
            table,
            ...(filter ? { filter } : {}),
          },
          () => scheduleRefresh()
        )
        .subscribe()
    })

    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current)
      channels.forEach(ch => sb().removeChannel(ch))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(','), tripUuid])

  return null
}
