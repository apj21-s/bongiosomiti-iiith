import { NextResponse, type NextRequest } from 'next/server'
import { checkVideos, MAX_IDS } from '@/utils/data/youtube-playable'

/**
 * GET /api/youtube/playable?ids=<video id>,<video id>,...
 *
 * Which of the songs will not play on this site, and the titles of the ones
 * that will, so the player can leave the first out and the song list can name
 * the rest. See utils/data/youtube-playable for how that is worked out.
 *
 * Public, like the player. It only ever asks YouTube about ids that are the
 * shape of a video id, at most MAX_IDS of them. A complete answer is cached at
 * the edge for a day - the same playlist asks with the same ids, so most visits
 * never reach YouTube. One where some song got no clear answer is kept for five
 * minutes only: long enough that a block on this server is not asked about
 * hundreds of songs on every visit, short enough to recover soon after.
 */
export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get('ids') || '').split(',').slice(0, MAX_IDS)
  const { refused, titles, complete } = await checkVideos(ids)

  return NextResponse.json(
    { refused, titles },
    {
      headers: {
        'Cache-Control': complete
          ? 'public, s-maxage=86400, stale-while-revalidate=604800'
          : 'public, s-maxage=300',
      },
    }
  )
}
