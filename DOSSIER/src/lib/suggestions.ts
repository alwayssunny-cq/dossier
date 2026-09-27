import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface Suggestion {
  name: string
  category: string   // e.g. "Restaurant", "Café", "Hidden gem", "Experience", "Attraction"
  note: string       // one quiet CQ-voice sentence on why it's worth their time
  area: string | null
}

/** ISO date (yyyy-mm-dd) of the most recent Monday — the weekly refresh key. */
export function currentWeekStart(now = new Date()): string {
  const d = new Date(now)
  const day = d.getDay() // 0 Sun … 6 Sat
  const back = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - back)
  return d.toISOString().split('T')[0]
}

interface GenerateArgs {
  locationLabel: string          // "Kohima, Nagaland, India" or "Mumbai, India"
  traveling: boolean             // true → on the ground mid-journey; false → at home
  archetypeName: string | null
  archetypeEssence: string | null
}

async function generateSuggestions(args: GenerateArgs): Promise<Suggestion[] | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const persona = args.archetypeName
    ? `The reader's travel archetype is "${args.archetypeName}": ${args.archetypeEssence ?? ''}
Let this shape the curation — pick places and experiences that resonate with who they are, not generic tourist picks.`
    : 'No archetype is known — curate for a discerning traveller who values depth over display.'

  const situation = args.traveling
    ? `They are currently travelling in ${args.locationLabel}. Suggest what's near them right now.`
    : `They are at home in ${args.locationLabel}. Suggest what's worth their time nearby in the coming week.`

  const prompt = `You curate for Closequarters Club, a quiet travel studio. Write 4 suggestions for one specific reader.

${situation}
${persona}

Mix the categories: restaurants, cafés, hidden gems, local experiences, attractions — whatever genuinely fits this person and place. Real, specific places only; if unsure a place still exists, choose better-known ones you are confident about.

Voice rules: concise and atmospheric; no exclamation marks; never use these words: luxury, premium, elite, bespoke, VIP, bucket-list, wanderlust, breathtaking, stunning, magical, experiential.

Reply with ONLY a JSON array, no other text:
[{"name":"…","category":"Restaurant|Café|Hidden gem|Experience|Attraction","note":"one sentence, ≤160 chars","area":"neighbourhood or null"}]`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    const jsonStart = text.indexOf('[')
    const jsonEnd = text.lastIndexOf(']')
    if (jsonStart === -1 || jsonEnd === -1) return null
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as Suggestion[]
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    return parsed.slice(0, 4).map(s => ({
      name: String(s.name ?? '').slice(0, 80),
      category: String(s.category ?? 'Experience').slice(0, 30),
      note: String(s.note ?? '').slice(0, 200),
      area: s.area ? String(s.area).slice(0, 60) : null,
    })).filter(s => s.name)
  } catch {
    return null
  }
}

/**
 * Weekly suggestions for a client — cached per (client, Monday-week) in the
 * weekly_suggestions table, regenerated when a new week begins.
 * Returns null when no location is known or generation fails (UI shows a quiet
 * placeholder). Storage failures are non-fatal: fresh results still return.
 */
export async function getWeeklySuggestions(
  db: SupabaseClient,
  clientId: string,
  args: GenerateArgs,
): Promise<Suggestion[] | null> {
  const weekStart = currentWeekStart()

  try {
    const { data } = await db
      .from('weekly_suggestions')
      .select('items, location_label')
      .eq('client_id', clientId)
      .eq('week_start', weekStart)
      .maybeSingle()
    const row = data as { items: Suggestion[]; location_label: string | null } | null
    // Reuse the cached week unless the client's location has changed (e.g. trip went live)
    if (row?.items?.length && row.location_label === args.locationLabel) return row.items
  } catch { /* table may not exist yet — fall through to generation */ }

  const items = await generateSuggestions(args)
  if (!items) return null

  try {
    await db.from('weekly_suggestions').upsert(
      { client_id: clientId, week_start: weekStart, location_label: args.locationLabel, items },
      { onConflict: 'client_id,week_start' },
    )
  } catch { /* non-fatal */ }

  return items
}

/**
 * Suggestions read from Notion, rather than generated.
 *
 * Two sources, chosen by whether the client is on the ground:
 *
 *   travelling — CQ Recommends, which hangs off the trip and names real
 *                places near them, with timings and a map link.
 *   between    — CQ Suggestions, filtered to their archetype. These are
 *                editorial, not geographic, so they carry no place.
 *
 * Returns the same shape the dashboard already renders, so the section is
 * unchanged whichever source answers.
 */
export async function getDossierSuggestions(
  db: SupabaseClient,
  { tripId, archetypeName }: { tripId: string | null; archetypeName: string | null },
): Promise<Suggestion[] | null> {
  if (tripId) {
    const { data, error } = await db
      .from('recommendations')
      .select('name, category, description, destination')
      .eq('trip_id', tripId)
      .limit(12)
    if (error || !data?.length) return null
    return data.map(r => ({
      name:     r.name as string,
      category: (r.category as string | null) ?? 'Nearby',
      note:     (r.description as string | null) ?? '',
      area:     (r.destination as string | null) ?? null,
    }))
  }

  if (!archetypeName) return null

  const { data, error } = await db
    .from('suggestions')
    .select('headline, category, content, archetype, status, published_at')
    .eq('archetype', archetypeName)
    .order('published_at', { ascending: false })
    .limit(6)

  // The table is created by hand in Supabase; until it exists PostgREST
  // answers PGRST205 and the section simply stays quiet.
  if (error || !data?.length) return null

  return data
    .filter(r => (r.status ?? '').toLowerCase() !== 'draft')
    .map(r => ({
      name:     r.headline as string,
      category: (r.category as string | null) ?? 'For you',
      note:     (r.content as string | null) ?? '',
      area:     null,
    }))
}
