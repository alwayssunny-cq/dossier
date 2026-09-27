/**
 * Small helpers for text that arrives from Notion.
 *
 * The dossier prints a title and then, beneath it, a description that was
 * written to stand alone — so descriptions frequently open by repeating the
 * title they sit under: "Stop at Heirloom Naga Center" followed by "Stop at
 * Heirloom Naga Center, located 18 minutes from Dimapur Airport." On screen
 * that is the same words twice in two lines.
 *
 * This trims that opening repetition only. It never edits anything else, and
 * if removing the prefix would leave nothing worth reading it returns the
 * description untouched.
 */
export function withoutEchoedTitle(
  description: string | null | undefined,
  title: string | null | undefined,
): string | null {
  const body = (description ?? '').trim()
  const head = (title ?? '').trim()
  if (!body || !head || head.length < 6) return body || null

  const norm = (s: string) => s.toLowerCase().replace(/[\s’']+/g, ' ').trim()
  if (!norm(body).startsWith(norm(head))) return body

  // Drop the title and whatever punctuation joined it to the sentence.
  let rest = body.slice(head.length).replace(/^[\s,;:—–-]+/, '')
  if (rest.length < 24) return body            // nothing meaningful would remain
  rest = rest.charAt(0).toUpperCase() + rest.slice(1)
  return rest
}
