/**
 * Proving that whoever is registering can actually read the address they gave.
 *
 * Registration used to take the email on trust and, worse, took `isIiit` on
 * trust beside it - a boolean in the request body that halves the ticket
 * price. Anyone could type a roll number and any address ending in
 * @iiit.ac.in and be charged as a student. Syntax checks cannot tell a real
 * mailbox from an invented one, and neither can an MX lookup: iiit.ac.in has
 * perfectly good MX records, so every forged address at that domain passes.
 *
 * The only check that means anything is delivery. A one-time code is sent to
 * the address, and the registration is not accepted until the code comes back.
 * The IIIT price is then granted on the strength of the *verified* domain
 * rather than on what the form claimed.
 *
 * Nothing here imports the database or the mailer, so it can be exercised on
 * its own.
 */

/** How long a code stays usable. Long enough to switch to a mail client. */
export const CODE_TTL_MS = 10 * 60 * 1000

/** Guesses allowed against one code before it is dead. */
export const MAX_ATTEMPTS = 5

/** How long a completed verification stays good for, so the rest of the form
 *  can be filled in without the proof going stale. */
export const PROOF_TTL_MS = 60 * 60 * 1000

const PROOF_VERSION = 'ev1'

export function normaliseEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/**
 * Deliberately conservative. This is not the reachability check - that is the
 * code - it only rejects what cannot be an address at all, so an obvious typo
 * fails before any mail is sent.
 */
export function isPlausibleEmail(value: unknown): boolean {
  const email = normaliseEmail(value)
  if (email.length < 6 || email.length > 200) return false
  if (/\s/.test(email)) return false

  const at = email.indexOf('@')
  if (at < 1 || at !== email.lastIndexOf('@')) return false

  const local = email.slice(0, at)
  const domain = email.slice(at + 1)

  if (local.length > 64 || !/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local)) return false
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false

  // A domain needs at least one dot and a sane TLD; no trailing or doubled dots.
  if (!/^[a-z0-9.-]+$/.test(domain)) return false
  if (domain.startsWith('-') || domain.startsWith('.') || domain.endsWith('.') || domain.endsWith('-')) return false
  if (domain.includes('..')) return false
  const labels = domain.split('.')
  if (labels.length < 2) return false
  // Per label, not per domain: "bad-.com" has a well-formed domain string but a
  // label that ends in a hyphen, which is not a hostname.
  if (labels.some((l) => l.length === 0 || l.length > 63 || l.startsWith('-') || l.endsWith('-'))) return false
  if (!/^[a-z]{2,}$/.test(labels[labels.length - 1])) return false

  return true
}

/**
 * An address may also sit directly at iiit.ac.in, with no subdomain at all.
 * We now accept any subdomain under iiit.ac.in as a valid institute email.
 */

/**
 * Whether a *verified* address belongs to the institute.
 *
 * The institute's addresses are firstname.lastname@<subdomain>.iiit.ac.in,
 * with the subdomain optional. Anything else under iiit.ac.in is not an
 * address the institute hands out, so it does not earn the institute rate.
 *
 * The comparison is on whole labels, which is what keeps notiiit.ac.in and
 * iiit.ac.in.example.com out - both of which "ends with iiit.ac.in" would let
 * through.
 *
 * The local part is deliberately not held to firstname.lastname. That is the
 * convention rather than a rule the mail server enforces, and a person with
 * one name, or an older account predating it, would be turned away from a
 * rate they are entitled to. What establishes the entitlement is owning the
 * mailbox, and the confirmation code already proves that.
 */
export function isIiitEmail(value: unknown): boolean {
  const email = normaliseEmail(value)
  if (!isPlausibleEmail(email)) return false

  const domain = email.slice(email.indexOf('@') + 1)
  if (domain === 'iiit.ac.in') return true

  return domain.endsWith('.iiit.ac.in')
}

/** A six digit code, drawn from the system's random source rather than Math.random. */
export function makeCode(): string {
  const bytes = new Uint32Array(1)
  crypto.getRandomValues(bytes)
  // Rejection-free and uniform enough: 2^32 is not a multiple of 10^6, but the
  // bias is under one part in four thousand, which is irrelevant for a code
  // that expires in ten minutes and allows five guesses.
  return String(bytes[0] % 1_000_000).padStart(6, '0')
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * What gets stored instead of the code.
 *
 * Salted with the address so the same code issued to two people does not
 * produce the same row, and so a hash lifted from one row cannot be replayed
 * against another. A six digit code is brute-forceable the instant a hash
 * leaks, which is why codes expire in ten minutes, allow five guesses and are
 * consumed on use - the hash is a delay, not the defence.
 */
export function hashCode(code: string, email: string): Promise<string> {
  return sha256Hex(`${normaliseEmail(email)}:${code}`)
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))))
}

/**
 * The receipt for a completed verification.
 *
 * The browser holds it and sends it back with the registration. It is signed
 * with a server secret and carries a hash of the address it was issued for, so
 * it cannot be edited into a proof for a different address, and it cannot be
 * minted without the secret. The address itself is not in the token - the
 * register route already knows which address it is checking.
 */
export async function createProof(email: string, secret: string, now = Date.now()): Promise<string | null> {
  if (!secret) return null
  const normalised = normaliseEmail(email)
  if (!isPlausibleEmail(normalised)) return null

  const payload = `${PROOF_VERSION}.${await sha256Hex(normalised)}.${now + PROOF_TTL_MS}`
  return `${payload}.${await sign(payload, secret)}`
}

/** True only for a well-formed, unexpired, correctly signed proof for this address. */
export async function verifyProof(
  token: unknown,
  email: string,
  secret: string,
  now = Date.now()
): Promise<boolean> {
  if (typeof token !== 'string' || !secret) return false

  const parts = token.split('.')
  if (parts.length !== 4) return false

  const [version, emailHash, expiry, signature] = parts
  if (version !== PROOF_VERSION) return false

  const expiresAt = Number(expiry)
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return false

  const normalised = normaliseEmail(email)
  if (!isPlausibleEmail(normalised)) return false
  if (!constantTimeEqual(emailHash, await sha256Hex(normalised))) return false

  const expected = await sign(`${version}.${emailHash}.${expiry}`, secret)
  return constantTimeEqual(signature, expected)
}

/**
 * Whether an IIIT claim may stand, given the address that was actually proved.
 *
 * This is the point of the whole module. The form can ask, but only a verified
 * institute address settles it - otherwise a roll number typed beside any
 * address at all buys the student price.
 */
export function iiitClaimAllowed(claimed: boolean, verifiedEmail: string): boolean {
  return claimed ? isIiitEmail(verifiedEmail) : true
}
