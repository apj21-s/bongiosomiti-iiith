import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { rateLimit, tooManyRequests } from '@/utils/rate-limit'
import { sendVerificationCodeEmail } from '@/utils/email'
import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  createProof,
  hashCode,
  isPlausibleEmail,
  makeCode,
  normaliseEmail,
  constantTimeEqual,
} from '@/utils/email-verification'

/**
 * Proving an address is reachable, in two steps.
 *
 *   POST { email }         -> sends a code, returns { sent: true }
 *   POST { email, code }   -> checks it, returns { verified: true, proof }
 *
 * The proof goes back with the registration, where it is checked again. A
 * client that skips this route simply has no proof to send, and the register
 * route refuses.
 *
 * Both steps are rate limited, because this route sends mail to an address
 * chosen by whoever calls it: without a limit it is a way to have our server
 * mail a stranger repeatedly.
 *
 * Nothing in the response says whether an address has been seen before, and a
 * wrong code reads the same as an expired one, so this cannot be used to find
 * out who has registered.
 */

const SEND_LIMIT = 4
const SEND_WINDOW_MS = 15 * 60 * 1000
const CHECK_LIMIT = 12
const CHECK_WINDOW_MS = 15 * 60 * 1000

function secret(): string {
  return process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

function callerKey(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous'
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const email = normaliseEmail(body.email)
  if (!isPlausibleEmail(email)) {
    return NextResponse.json({ error: 'That does not look like an email address.' }, { status: 400 })
  }

  if (!secret()) {
    console.error('[verify] No SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY; cannot issue proofs.')
    return NextResponse.json(
      { error: 'Email verification is not configured on this server.' },
      { status: 503 }
    )
  }

  const supabase = await createServiceRoleClient()
  if (!('from' in supabase)) {
    return NextResponse.json(
      { error: 'Email verification is unavailable while DUMMY_DB is on.' },
      { status: 503 }
    )
  }

  const code = typeof body.code === 'string' ? body.code.trim() : ''
  return code ? check(request, supabase, email, code) : send(request, supabase, email)
}

/** Step one: mint a code, store its hash, mail the code. */
async function send(request: Request, supabase: any, email: string) {
  // Limited per address as well as per caller: one is what stops a mailbox
  // being flooded, the other is what stops the route being used as a mailer.
  for (const [key, limit] of [
    [`verify-send:${callerKey(request)}`, SEND_LIMIT],
    [`verify-send-addr:${email}`, SEND_LIMIT],
  ] as const) {
    const allowance = rateLimit(key, limit, SEND_WINDOW_MS)
    if (!allowance.allowed) {
      return tooManyRequests(allowance.retryAfterSeconds, 'Too many codes requested. Please wait a few minutes.')
    }
  }

  const code = makeCode()
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString()

  const { error } = await supabase.from('email_verifications').insert({
    email,
    code_hash: await hashCode(code, email),
    expires_at: expiresAt,
  })

  if (error) {
    if (/email_verifications/.test(error.message || '') || error.code === 'PGRST205') {
      return NextResponse.json({ error: 'Run supabase/email-verification.sql first.' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Could not start verification. Please try again.' }, { status: 500 })
  }

  const sent = await sendVerificationCodeEmail(email, code, Math.round(CODE_TTL_MS / 60000))
  if (!sent.ok) {
    // The row is useless without a delivered code, and leaving it would let a
    // later guess succeed against a code nobody ever received.
    await supabase.from('email_verifications').delete().eq('email', email).is('consumed_at', null)
    return NextResponse.json(
      {
        error:
          sent.reason === 'mail-not-configured'
            ? 'Email verification is not configured on this server.'
            : 'We could not send a code to that address. Please check it and try again.',
      },
      { status: sent.reason === 'mail-not-configured' ? 503 : 400 }
    )
  }

  return NextResponse.json({ sent: true, expiresInSeconds: Math.round(CODE_TTL_MS / 1000) })
}

/** Step two: check a code and hand back a proof. */
async function check(request: Request, supabase: any, email: string, code: string) {
  const allowance = rateLimit(`verify-check:${callerKey(request)}`, CHECK_LIMIT, CHECK_WINDOW_MS)
  if (!allowance.allowed) {
    return tooManyRequests(allowance.retryAfterSeconds, 'Too many attempts. Please wait a few minutes.')
  }

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'That code is not right.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('email_verifications')
    .select('id, code_hash, expires_at, attempts, consumed_at')
    .eq('email', email)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)

  const row = Array.isArray(data) ? data[0] : null

  // One message for every failure: a wrong code, an expired code, a code that
  // was already spent and an address nobody asked about all read the same.
  const refuse = () =>
    NextResponse.json({ error: 'That code is not right, or it has expired. Ask for a new one.' }, { status: 400 })

  if (error || !row) return refuse()
  if (new Date(row.expires_at).getTime() <= Date.now()) return refuse()
  if (row.attempts >= MAX_ATTEMPTS) return refuse()

  if (!constantTimeEqual(row.code_hash, await hashCode(code, email))) {
    await supabase
      .from('email_verifications')
      .update({ attempts: row.attempts + 1 })
      .eq('id', row.id)
    return refuse()
  }

  // Spent, so the same code cannot be used twice.
  await supabase
    .from('email_verifications')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', row.id)

  const proof = await createProof(email, secret())
  if (!proof) {
    return NextResponse.json({ error: 'Could not complete verification.' }, { status: 500 })
  }

  return NextResponse.json({ verified: true, proof })
}
