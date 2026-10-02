import { isVideoId, watchUrl } from './youtube-video'

/**
 * Which songs in a playlist YouTube will not play on this site, asked before
 * the player gets to them.
 *
 * YouTube's oEmbed endpoint answers 401 or 404 for a video that cannot be
 * embedded - its owner has turned off playing it on other sites, or it is
 * private or gone - which are the songs the embedded player stops on with
 * "Video unavailable". It needs no API key. It is asked from the server because there the status is always readable;
 * in the browser an error answer can arrive without the headers that would let
 * the page see which error it was.
 *
 * Not everything is caught this way: a song blocked by a rights holder rather
 * than by its uploader still answers 200 here. The player finds those when it
 * reaches them and skips them then, so this is a head start, not the only
 * line of defence.
 */

/** YouTube embeds the first 200 songs of a playlist, so that is all there is to check. */
export const MAX_IDS = 200

// The answers that mean the embedded player will refuse the song. Anything
// else - a timeout, a 5xx, a rate limit - says nothing about the song, so it
// is left to play and the player decides. That includes 403, which is what a
// proxy or a block on the server's own address answers with: counting it would
// take every song off the site the day YouTube stops answering this server.
const REFUSED = new Set([401, 404])

// A playable song's answer is cached by Next for a day. Refusals are not,
// because Next only caches a 200, so the route's own Cache-Control is what
// keeps those from being asked again on every visit.
const DAY = 60 * 60 * 24

/** Whether YouTube says this video can be embedded: true, false, or null for no clear answer. */
export async function isEmbeddable(videoId: string, fetcher: typeof fetch = fetch): Promise<boolean | null> {
  const watch = watchUrl(videoId)
  if (!watch) return null

  const endpoint = new URL('https://www.youtube.com/oembed')
  endpoint.searchParams.set('format', 'json')
  endpoint.searchParams.set('url', watch)

  try {
    const response = await fetcher(endpoint.toString(), {
      next: { revalidate: DAY },
      signal: AbortSignal.timeout(5000),
    })
    if (response.ok) return true
    return REFUSED.has(response.status) ? false : null
  } catch {
    return null
  }
}

/**
 * The ids YouTube refuses, out of those given, a few at a time. Ids that are
 * not the shape of a video id are dropped rather than sent anywhere.
 */
export async function findRefusedVideos(
  ids: string[],
  fetcher: typeof fetch = fetch,
  concurrency = 8
): Promise<string[]> {
  const queue = Array.from(new Set(ids.filter(isVideoId))).slice(0, MAX_IDS)
  const refused = new Set<string>()
  let cursor = 0

  const worker = async () => {
    while (cursor < queue.length) {
      const id = queue[cursor]
      cursor += 1
      if ((await isEmbeddable(id, fetcher)) === false) refused.add(id)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker))

  // In the order asked, so the answer for one playlist is always the same.
  return queue.filter((id) => refused.has(id))
}
