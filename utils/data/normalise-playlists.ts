import { parseYouTubePlaylistId } from './youtube'

/**
 * Turning whatever is in playlists.json into playlists the player can use.
 *
 * Kept free of the JSON import so it stays a pure function that can be tested
 * on its own - importing a .json module is what makes the loader unloadable
 * outside the bundler.
 *
 * Several shapes are accepted, because the natural thing to do is paste a link:
 *
 *   "https://www.youtube.com/playlist?list=PL..."          a single link
 *   ["https://www.youtube.com/playlist?list=PL..."]        a list of links
 *   ["PL..."]                                              bare ids
 *   [{ "id": "utsav", "name": "Utsav", "youtube": "..." }] named
 *   [{ "id": "utsav", "name": "Utsav", "tracks": [...] }]  hosted audio
 *
 * Anything that is not a YouTube playlist, or a track without a title and src,
 * is dropped rather than rendered as a broken control.
 */

export type PlaylistTrack = {
  id: string
  title: string
  artist?: string
  artwork?: string
  src: string
}

export type Playlist = {
  id: string
  name: string
  /** YouTube playlist id, already extracted from whatever link was given. */
  youtubePlaylistId?: string
  tracks: PlaylistTrack[]
}

function isFilledString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

// Numbered, so unnamed playlists can still be told apart from one another.
function defaultName(index: number) {
  return `Playlist ${index + 1}`
}

function toTrack(value: unknown, index: number): PlaylistTrack | null {
  if (typeof value !== 'object' || value === null) return null

  const track = value as Record<string, unknown>
  if (!isFilledString(track.title) || !isFilledString(track.src)) return null

  return {
    id: isFilledString(track.id) ? track.id.trim() : `track-${index}`,
    title: track.title.trim(),
    artist: isFilledString(track.artist) ? track.artist.trim() : undefined,
    artwork: isFilledString(track.artwork) ? track.artwork.trim() : undefined,
    src: track.src.trim(),
  }
}

export function toPlaylist(value: unknown, index: number): Playlist | null {
  // Shorthand: a bare link or id, which is what you get by pasting the address
  // bar. This used to be dropped silently, so the player never appeared.
  if (typeof value === 'string') {
    const id = parseYouTubePlaylistId(value)
    if (!id) return null
    return { id: `playlist-${index}`, name: defaultName(index), youtubePlaylistId: id, tracks: [] }
  }

  if (typeof value !== 'object' || value === null) return null

  const playlist = value as Record<string, unknown>
  const rawTracks = Array.isArray(playlist.tracks) ? playlist.tracks : []
  const tracks = rawTracks
    .map((track, trackIndex) => toTrack(track, trackIndex))
    .filter((track): track is PlaylistTrack => track !== null)

  const youtubePlaylistId =
    parseYouTubePlaylistId(playlist.youtube) ??
    parseYouTubePlaylistId(playlist.youtubePlaylist) ??
    parseYouTubePlaylistId(playlist.youtubePlaylistId) ??
    undefined

  if (!youtubePlaylistId && tracks.length === 0) return null

  return {
    id: isFilledString(playlist.id) ? playlist.id.trim() : `playlist-${index}`,
    name: isFilledString(playlist.name) ? playlist.name.trim() : defaultName(index),
    youtubePlaylistId,
    tracks,
  }
}

export function normalisePlaylists(raw: unknown): Playlist[] {
  // A single link, unwrapped.
  if (typeof raw === 'string') {
    const single = toPlaylist(raw, 0)
    return single ? [single] : []
  }

  if (!Array.isArray(raw)) return []

  // The id identifies a playlist, so a repeated id keeps only the first.
  const seen = new Set<string>()
  return raw
    .map((playlist, index) => toPlaylist(playlist, index))
    .filter((playlist): playlist is Playlist => {
      if (!playlist || seen.has(playlist.id)) return false
      seen.add(playlist.id)
      return true
    })
}
