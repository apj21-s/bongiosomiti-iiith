import { isVideoId, sanitiseTitle, watchUrl, type VideoDetails } from './youtube-video'

/**
 * Which songs in a playlist can be played on this site, and what they are
 * called, asked before the player or the song list gets to them.
 *
 * The rule is the one the song list needs: a song is shown, and played, only
 * if YouTube's oEmbed endpoint answers for it with a title. That is the same
 * request the list used to make from the browser for each row, and the songs
 * it fails for - the ones that showed as "Track 7" - are the ones the embedded
 * player will not play here: their owner has turned off playing them on other
 * sites, or they are private or gone. This used to look for a 401 or a 404
 * only, and songs still reached the list as "Track" rows, so now it is the
 * title that decides, not a particular status.
 *
 * Asked from the server, where every answer is readable and one check serves
 * every visitor; the titles come back with it, so the list needs no requests
 * of its own.
 *
 * Not everything is caught this way: a song blocked by a rights holder rather
 * than by its uploader still answers with a title. The player finds those when
 * it reaches them and drops them then.
 */

/** YouTube embeds the first 200 songs of a playlist, so that is all there is to check. */
export const MAX_IDS = 200

const DAY = 60 * 60 * 24

/**
 * What YouTube said about one song. `unknown` is an answer that says nothing
 * about the song itself - rate limited, a server error, a timeout - after a
 * second try.
 */
export type VideoCheck =
  | { status: 'playable'; details: VideoDetails }
  | { status: 'refused' }
  | { status: 'unknown' }

// Worth asking again: these are about YouTube's state, not the song's.
const TRY_AGAIN = new Set([408, 429])

async function askOnce(videoId: string, fetcher: typeof fetch): Promise<VideoCheck> {
  const watch = watchUrl(videoId)
  if (!watch) return { status: 'refused' }

  const endpoint = new URL('https://www.youtube.com/oembed')
  endpoint.searchParams.set('format', 'json')
  endpoint.searchParams.set('url', watch)

  try {
    const response = await fetcher(endpoint.toString(), {
      // Next caches a 200 for a day; nothing else is cached here.
      next: { revalidate: DAY },
      signal: AbortSignal.timeout(5000),
    })

    if (response.ok) {
      const data = (await response.json()) as { title?: unknown; author_name?: unknown }
      const title = sanitiseTitle(data.title)
      // Without a title it would be a "Track 7" row, which is what this is for.
      if (!title) return { status: 'refused' }
      return { status: 'playable', details: { id: videoId, title, author: sanitiseTitle(data.author_name) || undefined } }
    }

    if (response.status >= 500 || TRY_AGAIN.has(response.status)) return { status: 'unknown' }
    return { status: 'refused' }
  } catch {
    return { status: 'unknown' }
  }
}

/** One song, asked twice if the first answer says nothing about the song. */
export async function checkVideo(videoId: string, fetcher: typeof fetch = fetch): Promise<VideoCheck> {
  const first = await askOnce(videoId, fetcher)
  if (first.status !== 'unknown') return first
  await new Promise((resolve) => setTimeout(resolve, 300))
  return askOnce(videoId, fetcher)
}

export type PlaylistCheck = {
  /** Songs not to show or play, in the order asked. */
  refused: string[]
  /** Titles of the songs that will play. */
  titles: Record<string, { title: string; author?: string }>
  /** Whether every song got an answer about itself, so the result can be kept. */
  complete: boolean
}

/**
 * Every song given, a few at a time. Ids that are not the shape of a video id
 * are dropped rather than sent anywhere. A song with no clear answer is left
 * out too - there is no title to show for it - but the result is then marked
 * incomplete, so it is asked again rather than remembered.
 */
export async function checkVideos(
  ids: string[],
  fetcher: typeof fetch = fetch,
  concurrency = 8
): Promise<PlaylistCheck> {
  const queue = Array.from(new Set(ids.filter(isVideoId))).slice(0, MAX_IDS)
  const answers = new Map<string, VideoCheck>()
  let cursor = 0

  const worker = async () => {
    while (cursor < queue.length) {
      const id = queue[cursor]
      cursor += 1
      answers.set(id, await checkVideo(id, fetcher))
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker))

  const titles: PlaylistCheck['titles'] = {}
  const refused: string[] = []
  let complete = true

  // In the order asked, so the answer for one playlist is always the same.
  for (const id of queue) {
    const answer = answers.get(id)
    if (answer?.status === 'playable') {
      titles[id] = { title: answer.details.title, ...(answer.details.author ? { author: answer.details.author } : {}) }
    } else {
      refused.push(id)
      if (answer?.status !== 'refused') complete = false
    }
  }

  return { refused, titles, complete }
}
