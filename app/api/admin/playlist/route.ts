import { NextResponse } from 'next/server'
import { requireAdmin } from '@/utils/auth/require-admin'
import { getSitePlaylistSetting, setSitePlaylist } from '@/utils/data/site-playlist'

// Changing what plays on the public homepage is a super-admin job.
const REQUIRED_TIER = 3

// A pasted link is bounded before it is even parsed.
const MAX_LINK_LENGTH = 300

export async function GET() {
  const guard = await requireAdmin(REQUIRED_TIER)
  if (!guard.ok) return guard.response

  return NextResponse.json(await getSitePlaylistSetting())
}

export async function PUT(request: Request) {
  const guard = await requireAdmin(REQUIRED_TIER)
  if (!guard.ok) return guard.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const input = (body ?? {}) as Record<string, unknown>
  const link = typeof input.link === 'string' ? input.link : ''

  if (link.length > MAX_LINK_LENGTH) {
    return NextResponse.json({ error: 'That link is too long to be a playlist URL' }, { status: 400 })
  }

  // The link is reduced to a validated playlist id inside setSitePlaylist;
  // nothing the client sends is stored or rendered verbatim.
  const result = await setSitePlaylist({
    link,
    name: typeof input.name === 'string' ? input.name : undefined,
    isEnabled: typeof input.isEnabled === 'boolean' ? input.isEnabled : undefined,
    updatedBy: String(guard.user.email || guard.user.id),
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json(result.playlist)
}
