/**
 * Video ids, and the links built from them, for the playlist contents panel.
 *
 * The ids come out of YouTube's player API rather than from a person, but they
 * are treated the same way as anything else that arrives from outside: checked
 * against a shape before a URL is built, and the URL assembled from the checked
 * id rather than from any string the response happened to carry. The panel
 * links to youtube.com and nowhere else, whatever comes back.
 *
 * Titles are read through YouTube's oEmbed endpoint, which needs no API key and
 * answers cross-origin. They are rendered as text by React, so escaping is not
 * the concern; length and control characters are.
 */

// YouTube's video ids are eleven characters, but the length has changed before
// and a wrong guess here would hide real songs, so the range is generous.
const VIDEO_ID = /^[A-Za-z0-9_-]{8,24}$/
const PLAYLIST_ID = /^[A-Za-z0-9_-]{1,64}$/

export function isVideoId(value: unknown): value is string {
  return typeof value === 'string' && VIDEO_ID.test(value)
}

/**
 * The watch link for one song, inside its playlist when we know it. Returns
 * null rather than a half-built URL if either id fails its check.
 */
export function watchUrl(videoId: string, playlistId?: string | null): string | null {
  if (!isVideoId(videoId)) return null

  const url = new URL('https://www.youtube.com/watch')
  url.searchParams.set('v', videoId)
  if (playlistId && PLAYLIST_ID.test(playlistId)) url.searchParams.set('list', playlistId)

  return url.toString()
}

/** The playlist's own page, for the "and more" link at the end of the list. */
export function playlistUrl(playlistId: string): string | null {
  if (!PLAYLIST_ID.test(playlistId)) return null

  const url = new URL('https://www.youtube.com/playlist')
  url.searchParams.set('list', playlistId)
  return url.toString()
}

export function sanitiseTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null

  // Control characters out, and long enough for a song title with its artist
  // and not much more.
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140)
  return cleaned || null
}

export type VideoDetails = {
  id: string
  title: string
  author?: string
}

/**
 * One song's title, from oEmbed. Resolves to null for anything private,
 * deleted, blocked, or simply slow - the panel shows the id's row either way.
 */
export async function fetchVideoDetails(videoId: string, signal?: AbortSignal): Promise<VideoDetails | null> {
  const watch = watchUrl(videoId)
  if (!watch) return null

  const endpoint = new URL('https://www.youtube.com/oembed')
  endpoint.searchParams.set('format', 'json')
  endpoint.searchParams.set('url', watch)

  try {
    const response = await fetch(endpoint.toString(), { signal })
    if (!response.ok) return null

    const data = (await response.json()) as { title?: unknown; author_name?: unknown }
    const title = sanitiseTitle(data.title)
    if (!title) return null

    return { id: videoId, title, author: sanitiseTitle(data.author_name) || undefined }
  } catch {
    return null
  }
}

/**
 * Titles for a list of ids, a few at a time.
 *
 * One request per song, so a long playlist is capped and the rest is left to
 * the "see the rest on YouTube" link: a hundred requests the moment a panel
 * opens is not a reasonable thing to do to somebody's connection.
 */
export async function fetchVideoDetailsFor(
  ids: string[],
  onResolved: (details: VideoDetails) => void,
  signal?: AbortSignal,
  concurrency = 6
): Promise<void> {
  const queue = ids.filter(isVideoId)
  let cursor = 0

  const worker = async () => {
    while (cursor < queue.length) {
      if (signal?.aborted) return
      const id = queue[cursor]
      cursor += 1

      const details = await fetchVideoDetails(id, signal)
      if (details && !signal?.aborted) onResolved(details)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker))
}

/**
 * The songs, out of these, that YouTube will not play on this site - asked of
 * /api/youtube/playable, which checks them server-side. An empty list when the
 * check cannot be made: the player still skips a refused song when it gets to
 * one, so a failed check costs a skip, not the music.
 */
export async function fetchRefusedVideos(ids: string[], signal?: AbortSignal): Promise<string[]> {
  // YouTube embeds the first 200 songs of a playlist, and the route checks no more.
  const asked = new Set(ids.filter(isVideoId).slice(0, 200))
  if (asked.size === 0) return []

  try {
    const query = new URLSearchParams({ ids: [...asked].join(',') })
    const response = await fetch(`/api/youtube/playable?${query}`, { signal })
    if (!response.ok) return []

    const data = (await response.json()) as { refused?: unknown }
    if (!Array.isArray(data.refused)) return []
    // Only ever ids that were asked about, whatever the answer carried.
    return data.refused.filter((id): id is string => typeof id === 'string' && asked.has(id))
  } catch {
    return []
  }
}
