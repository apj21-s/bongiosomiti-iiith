import { NextResponse } from 'next/server'

// Small in-process sliding-window limiter for the endpoints that send email or
// create rows on behalf of an unauthenticated caller.
//
// Note on serverless: state lives in the instance's memory, so the effective
// limit is per instance rather than global. That is enough to stop a single
// caller hammering one address in a loop, which is the abuse this guards
// against; it is not a substitute for a shared store if stricter limits are
// ever needed.
//
// Keys are deliberately NOT IP-based for registration: a campus network puts
// every attendee behind one address, so an IP limit would lock out legitimate
// users during an event.

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const MAX_TRACKED_KEYS = 10_000

function prune(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number }

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()

  if (buckets.size > MAX_TRACKED_KEYS) prune(now)

  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  bucket.count += 1

  if (bucket.count > limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) }
  }

  return { allowed: true, retryAfterSeconds: 0 }
}

export function tooManyRequests(retryAfterSeconds: number, message: string) {
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  )
}
