import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import type { Traveler } from '@/lib/types'
import ArchetypeQuiz from '@/components/ArchetypeQuiz'

/**
 * The reading itself.
 *
 * It used to sit at /understand-you, which meant About You opened by asking
 * the reader to do work. That route now tells them what the dossier already
 * knows and links here, so the quiz is an invitation rather than a gate.
 */
export default async function ReadingPage() {
  const supabase = await createClient()
  const db = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const rawPhone = user.phone ?? ''
  const digits10 = rawPhone.replace(/^\+?91/, '')
  const orClause = [...new Set([digits10, '91'+digits10, '+91'+digits10, rawPhone].filter(Boolean))]
    .map(p => `phone.eq.${p}`).join(',')

  const { data: travelerRows } = await db
    .from('travelers').select('full_name, client_id').or(orClause)
    .order('is_primary', { ascending: false })
  const traveler = (travelerRows?.[0] ?? null) as Pick<Traveler, 'full_name' | 'client_id'> | null

  const firstName = (traveler?.full_name?.trim().split(/\s+/)[0] ?? 'there').replace(/\.+$/, '')
  const clientId = traveler?.client_id ?? null

  let initialCode: string | null = null
  if (clientId) {
    const { data: client } = await db
      .from('clients').select('archetype_code').eq('id', clientId).maybeSingle()
    initialCode = (client as { archetype_code: string | null } | null)?.archetype_code ?? null
  }

  return <ArchetypeQuiz firstName={firstName} clientId={clientId} initialCode={initialCode} />
}
