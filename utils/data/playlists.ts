import playlistsJson from '../../public/data/playlists.json'
import { parseYouTubePlaylistId } from './youtube'

/**
 * Music for the player overlaid on the homepage events video.
 *
 * The list lives in `public/data/playlists.json` and is imported at build time,
 * the same way the Durga Puja page imports its dataset. It is read as a module
 * rather than with fs at request time, because reading files at runtime is what
 * broke the events data on Vercel.
 *
 * A playlist is driven by one of two sources.
 *
 * 1. A YouTube playlist - paste the link:
 *
 *      [
 *        {
 *          "id": "utsav",
 *          "name": "Utsav",
 *          "youtube": "https://www.youtube.com/playlist?list=PLxxxxxxxx"
 *        }
 *      ]
 *
 *    A watch URL carrying a `list` parameter works too, as does a bare
 *    playlist id. Playback runs through YouTube's own embedded player, which
 *    stays visible in the bar because YouTube's terms require it.
 *
 * 2. Audio files you host - drop them in `public/assets/music/`:
 *
 *      [
 *        {
 *          "id": "utsav",
 *          "name": "Utsav",
 *          "tracks": [
 *            { "id": "agomoni", "title": "Agomoni", "artist": "Traditional",
 *              "src": "/assets/music/agomoni.mp3" }
 *          ]
 *        }
 *      ]
 *
 *    A track's `src` may be a path under `public/` or an absolute https URL, so
 *    the audio can move to Supabase Storage later without touching this code.
 *
 * If a playlist has both, the YouTube link wins. Tracks missing a title or src
 * are dropped rather than rendered as broken controls, and a playlist with no
 * usable source is dropped with them. When nothing survives, the homepage
 * renders no player at all.
 */

export type PlaylistTrack = {
  id: string
  title: string
  artist?: string
  src: string
}

export type Playlist = {
  id: string
  name: string
  /** YouTube playlist id, already extracted from whatever link was pasted. */
  youtubePlaylistId?: string
  tracks: PlaylistTrack[]
}

function isFilledString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function toTrack(value: unknown, index: number): PlaylistTrack | null {
  if (typeof value !== 'object' || value === null) return null

  const track = value as Record<string, unknown>
  if (!isFilledString(track.title) || !isFilledString(track.src)) return null

  return {
    id: isFilledString(track.id) ? track.id.trim() : `track-${index}`,
    title: track.title.trim(),
    artist: isFilledString(track.artist) ? track.artist.trim() : undefined,
    src: track.src.trim(),
  }
}

function toPlaylist(value: unknown, index: number): Playlist | null {
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
    name: isFilledString(playlist.name) ? playlist.name.trim() : 'Playlist',
    youtubePlaylistId,
    tracks,
  }
}

export function getPlaylists(): Playlist[] {
  // Typed as unknown on purpose: an empty playlists.json would otherwise be
  // inferred as never[], and the validation below is what defines the shape.
  const raw: unknown = playlistsJson
  if (!Array.isArray(raw)) return []

  return raw
    .map((playlist, index) => toPlaylist(playlist, index))
    .filter((playlist): playlist is Playlist => playlist !== null)
}
