import { NextResponse } from 'next/server'
import { requireAdmin } from '@/utils/auth/require-admin'
import { setDigestPaused } from '@/utils/data/digest-settings'

/** Pauses or resumes the daily digest. Body: `{ paused: boolean }`. */
export async function POST(request: Request) {
  const guard = await requireAdmin(3)
  if (!guard.ok) return guard.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  if (typeof body.paused !== 'boolean') {
    return NextResponse.json({ error: 'Say whether the digest is paused: { paused: true | false }.' }, { status: 400 })
  }

  const result = await setDigestPaused(body.paused, String(guard.user.email || guard.user.id))
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })

  return NextResponse.json({ paused: body.paused })
}
