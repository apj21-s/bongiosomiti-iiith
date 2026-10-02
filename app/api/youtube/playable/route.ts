import { NextResponse, type NextRequest } from 'next/server'
import { findRefusedVideos, MAX_IDS } from '@/utils/data/youtube-playable'

/**
 * GET /api/youtube/playable?ids=<video id>,<video id>,...
 *
 * Which of the songs YouTube will not play on this site, so the player can
 * leave them out of the list and never stop on one. See
 * utils/data/youtube-playable for how that is worked out.
 *
 * Public, like the player. It only ever asks YouTube about ids that are the
 * shape of a video id, at most MAX_IDS of them, and the answer is cached at the
 * edge for a day: the same playlist asks with the same ids, so most visits are
 * answered without reaching YouTube at all.
 */
export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get('ids') || '').split(',').slice(0, MAX_IDS)
  const refused = await findRefusedVideos(ids)

  return NextResponse.json(
    { refused },
    { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } }
  )
}
