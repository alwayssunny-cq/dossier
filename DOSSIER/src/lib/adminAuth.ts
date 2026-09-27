import { createHash, timingSafeEqual } from 'crypto'

/**
 * Shared-secret checks for admin and cron routes.
 *
 * Fail closed: an unset or empty secret never matches, so a missing env var
 * locks the route rather than opening it. Both sides are hashed before the
 * constant-time compare, so neither the content nor the length leaks.
 */
function matchesSecret(provided: unknown, expected: string | undefined): boolean {
  if (!expected) return false
  if (typeof provided !== 'string' || !provided) return false
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match ? match[1].trim() : null
}

export function isAdminPassword(provided: unknown): boolean {
  return matchesSecret(provided, process.env.ADMIN_PASSWORD)
}

/**
 * Admin password from the JSON body (`password`) or an
 * `Authorization: Bearer <ADMIN_PASSWORD>` header. Never from the URL.
 */
export function isAdminRequest(request: Request, body?: unknown): boolean {
  const password = body && typeof body === 'object' ? (body as { password?: unknown }).password : undefined
  return isAdminPassword(password) || isAdminPassword(bearerToken(request))
}

/** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. */
export function isCronRequest(request: Request): boolean {
  return matchesSecret(bearerToken(request), process.env.CRON_SECRET)
}

export function isAdminOrCronRequest(request: Request, body?: unknown): boolean {
  return isAdminRequest(request, body) || isCronRequest(request)
}
