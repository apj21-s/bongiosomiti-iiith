import playlistsJson from '../../public/data/playlists.json'
import { normalisePlaylists } from './normalise-playlists'

export type { Playlist, PlaylistTrack } from './normalise-playlists'
export { parseYouTubePlaylistId } from './youtube'

/**
 * Music for the player overlaid on the homepage events video.
 *
 * The list lives in `public/data/playlists.json` and is imported at build time,
 * the same way the Durga Puja page imports its dataset. It is read as a module
 * rather than with fs at request time, because reading files at runtime is what
 * broke the events data on Vercel.
 *
 * The accepted shapes, and the validation, are in `./normalise-playlists`. The
 * simplest is to paste the playlist link:
 *
 *   ["https://www.youtube.com/playlist?list=PLxxxxxxxx"]
 *
 * For audio you host, drop the files in `public/assets/music/` and name them:
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
 * A track's `src` may be a path under `public/` or an absolute https URL, so
 * the audio can move to Supabase Storage later without touching this code.
 *
 * This file is the fallback. What the homepage actually plays is set from
 * /admin/playlist and stored in Supabase - see `./site-playlist`.
 */

export function getPlaylists() {
  return normalisePlaylists(playlistsJson as unknown)
}
