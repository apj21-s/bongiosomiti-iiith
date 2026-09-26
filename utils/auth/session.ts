import type { AdminTier } from './admin-roles'

// Signed admin session cookies.
//
// This module is imported by middleware.ts (Edge runtime) as well as by server
// code (Node runtime), so it must stay on Web Crypto only: no node:crypto, no
// fs, no next/headers.
//
// Cookie value format: v2.<tier>.<subject>.<expiryMs>.<hmacSha256>
// The signature covers everything before it, so neither the tier, the subject
// nor the expiry can be edited by the client without invalidating the cookie.
//
// `subject` identifies a manager_profiles row for manager sign-ins, and is "-"
// for the env-credential tier admins. It is what scopes a manager to the
// payments made to their own UPI id, so it has to be signed rather than
// re-derived from anything the browser sends.

export const SESSION_COOKIE = 'bangiya.samiti.iiith_dummy_session'
export const LEGACY_TIER_COOKIE = 'bangiya.samiti.iiith_admin_tier'

const SESSION_VERSION = 'v2'
export const SESSION_TTL_SECONDS = 60 * 60 * 24 // 1 day, same as the previous cookie maxAge
const DEV_FALLBACK_SECRET = 'bangiya-samiti-local-dev-session-secret'

let warnedAboutDevSecret = false

// Prefers an explicit SESSION_SECRET, falls back to the service-role key so
// that existing deployments need no new env var. Both are secrets the client
// never sees, which is all the signature requires.
function getSecret(): string | null {
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (secret) return secret

  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[session] Neither SESSION_SECRET nor SUPABASE_SERVICE_ROLE_KEY is set. ' +
        'Refusing to issue or trust admin sessions.'
    )
    return null
  }

  if (!warnedAboutDevSecret) {
    warnedAboutDevSecret = true
    console.warn('[session] Using the local-dev session secret. Set SESSION_SECRET before deploying.')
  }
  return DEV_FALLBACK_SECRET
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sign(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return toBase64Url(new Uint8Array(signature))
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const NO_SUBJECT = '-'

function isSafeSubject(value: string): boolean {
  // Ids only: keeps the dot-delimited payload unambiguous.
  return value === NO_SUBJECT || /^[A-Za-z0-9-]{1,64}$/.test(value)
}

export async function createSessionToken(
  tier: AdminTier,
  subject: string = NO_SUBJECT
): Promise<string | null> {
  const secret = getSecret()
  if (!secret) return null
  if (!isSafeSubject(subject)) return null

  const payload = `${SESSION_VERSION}.${tier}.${subject}.${Date.now() + SESSION_TTL_SECONDS * 1000}`
  return `${payload}.${await sign(payload, secret)}`
}

// Returns the tier carried by a valid, unexpired, correctly signed cookie, or
// null for anything else. Never throws: a malformed cookie is just no session.
export async function readSessionToken(
  value: string | null | undefined
): Promise<{ tier: AdminTier; subject: string | null } | null> {
  if (!value) return null

  const parts = value.split('.')
  if (parts.length !== 5) return null

  const [version, tierRaw, subject, expiryRaw, signature] = parts
  if (version !== SESSION_VERSION) return null
  if (!isSafeSubject(subject)) return null

  const tier = Number(tierRaw)
  if (tier !== 1 && tier !== 2 && tier !== 3) return null

  const expiry = Number(expiryRaw)
  if (!Number.isFinite(expiry) || expiry <= Date.now()) return null

  const secret = getSecret()
  if (!secret) return null

  try {
    const expected = await sign(`${version}.${tierRaw}.${subject}.${expiryRaw}`, secret)
    if (!timingSafeEqual(signature, expected)) return null
  } catch {
    return null
  }

  return { tier: tier as AdminTier, subject: subject === NO_SUBJECT ? null : subject }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  }
}
