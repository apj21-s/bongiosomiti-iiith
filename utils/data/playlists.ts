import playlistsJson from '../../public/data/playlists.json'

/**
 * Music for the player overlaid on the homepage events video.
 *
 * The song list lives in `public/data/playlists.json` and is imported at build
 * time, the same way the Durga Puja page imports its dataset. It is read as a
 * module rather than with fs at request time, because reading files at runtime
 * is what broke the events data on Vercel.
 *
 * Add songs by dropping audio files into `public/assets/music/` and listing
 * them here:
 *
 *   [
 *     {
 *       "id": "utsav",
 *       "name": "Utsav",
 *       "tracks": [
 *         { "id": "agomoni", "title": "Agomoni", "artist": "Traditional",
 *           "src": "/assets/music/agomoni.mp3" }
 *       ]
 *     }
 *   ]
 *
 * `src` may be a path under `public/` or an absolute https URL, so the audio
 * can move to Supabase Storage later without touching this code. A track needs
 * a title and a src; anything incomplete is dropped rather than rendered as a
 * broken control, and a playlist with no usable tracks is dropped with it. When
 * nothing survives, the homepage renders no player at all.
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

  if (tracks.length === 0) return null

  return {
    id: isFilledString(playlist.id) ? playlist.id.trim() : `playlist-${index}`,
    name: isFilledString(playlist.name) ? playlist.name.trim() : 'Playlist',
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
