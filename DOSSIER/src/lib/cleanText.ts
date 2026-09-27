/**
 * Shared text-cleaning utilities for client-facing display.
 * Strips internal noise (pricing variants, tool names, option prefixes)
 * that leaks from Notion → Claude parsing into the UI.
 */

const STRIP_PREFIXES = [
  /^(option\s+[\dA-Za-z]+|primary\s+option|secondary\s+option|alternative)\s*:\s*/i,
]

const STRIP_PHRASES = [
  /buffer\s*cost[^;\n]*/gi,
  /buffer\s*price[^;\n]*/gi,
  /otilla[^;\n]*/gi,
  /booking\.com\s*business[^;\n]*/gi,
  /booking\.com[^;\n]*/gi,
  /alternative\s*:[^;\n]*/gi,
  /pay[\s-]?at[\s-]?property[^;\n]*/gi,
]

/**
 * Clean a raw description/title string for client display.
 * - Strips "Option 1:", "Primary option:", "Secondary option:", "Alternative:" prefixes
 * - Removes mentions of buffer cost/price, Otilla, Booking.com, pay-at-property
 * - Trims whitespace and leading bullets/dashes
 * - Returns empty string if nothing substantive remains
 */
export function cleanDisplayText(text: string): string {
  let s = text

  // Strip leading option/alternative prefixes
  for (const re of STRIP_PREFIXES) {
    s = s.replace(re, '').trim()
  }

  // Strip noise phrases
  for (const re of STRIP_PHRASES) {
    s = s.replace(re, '').trim()
  }

  // Strip leading bullet/dash
  s = s.replace(/^[•\-–*]\s*/, '').trim()

  // Collapse multiple spaces/newlines
  s = s.replace(/\s{2,}/g, ' ').trim()

  return s
}

/**
 * Clean a description for display, suppressing it entirely if:
 * - It's empty after cleaning
 * - It equals the title (case-insensitive) — avoids redundant repetition
 * - It's too short to be meaningful (≤10 chars)
 */
export function cleanDescription(
  desc: string | null | undefined,
  title: string
): string | null {
  if (!desc) return null
  const cleaned = cleanDisplayText(desc)
  if (!cleaned) return null
  if (cleaned.toLowerCase() === title.toLowerCase()) return null
  return cleaned.length > 10 ? cleaned : null
}

/**
 * Clean a price string, extracting only the primary USD/INR value.
 * Removes buffer costs, Otilla alternatives, Booking.com prices, etc.
 */
export function cleanPrice(raw: string | null | undefined): string | null {
  if (!raw) return null
  let s = cleanDisplayText(raw)

  const usd = s.match(/\$[\d,]+(?:\.\d+)?/)
  const inr = s.match(/(?:INR|₹)\s*[\d,]+(?:\.\d+)?/)

  if (usd && inr) {
    const inrStr = inr[0].startsWith('INR') ? '₹' + inr[0].replace(/^INR\s*/, '') : inr[0]
    return `${usd[0]} / ${inrStr}`
  }
  if (usd) return usd[0]
  if (inr) return inr[0].startsWith('INR') ? '₹' + inr[0].replace(/^INR\s*/, '') : inr[0]

  const bare = s.match(/^[\d,]+(?:\.\d+)?$/)
  if (bare) {
    const n = parseFloat(bare[0].replace(/,/g, ''))
    if (!isNaN(n) && n > 0) return '$' + n.toLocaleString('en-US')
  }

  const fallback = s.split(/[;|(]/)[0].trim()
  return fallback || null
}
