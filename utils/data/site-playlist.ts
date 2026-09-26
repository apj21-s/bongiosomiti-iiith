import { createServiceRoleClient } from '@/utils/supabase/server'
import { parseYouTubePlaylistId } from './youtube'
import { getPlaylists, type Playlist } from './playlists'

/**
 * The homepage playlist, as configured from the admin UI.
 *
 * Stored in Supabase rather than in public/data/playlists.json, because the
 * filesystem is read-only on Vercel - writing the JSON file is exactly why
 * admin edits to events.json do not survive a deploy.
 *
 * Only the extracted playlist id is ever stored. A pasted URL is reduced to
 * its id on the way in and the id is validated again on the way out, so a row
 * edited directly in the database still cannot put a scheme, a host or markup
 * onto the page. The id is handed to YouTube's own player API as a parameter;
 * the app never builds an iframe URL out of user input.
 */

export type SitePlaylist = {
  youtubePlaylistId: string | null
  name: string
  isEnabled: boolean
  updatedAt?: string | null
  updatedBy?: string | null
}

const EMPTY: SitePlaylist = { youtubePlaylistId: null, name: 'Playlist', isEnabled: true }

// Belt and braces: the same shape the database CHECK constraint enforces.
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/

function sanitiseName(value: unknown): string {
  if (typeof value !== 'string') return 'Playlist'
  // Only ever rendered as text, but kept short and free of control characters.
  const cleaned = value.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 80)
  return cleaned || 'Playlist'
}

export async function getSitePlaylistSetting(): Promise<SitePlaylist> {
  try {
    const supabase = await createServiceRoleClient()
    const { data, error } = await supabase
      .from('site_playlist')
      .select('youtube_playlist_id, name, is_enabled, updated_at, updated_by')
      .maybeSingle()

    if (error || !data) return EMPTY

    const row = data as {
      youtube_playlist_id: string | null
      name: string | null
      is_enabled: boolean
      updated_at: string | null
      updated_by: string | null
    }

    // Validated on read, not just on write.
    const id = typeof row.youtube_playlist_id === 'string' && SAFE_ID.test(row.youtube_playlist_id)
      ? row.youtube_playlist_id
      : null

    return {
      youtubePlaylistId: id,
      name: sanitiseName(row.name),
      isEnabled: row.is_enabled !== false,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    }
  } catch {
    // The table may not exist yet; fall back rather than break the homepage.
    return EMPTY
  }
}

export async function setSitePlaylist(input: {
  link: string
  name?: string
  isEnabled?: boolean
  updatedBy?: string
}): Promise<{ ok: true; playlist: SitePlaylist } | { ok: false; error: string }> {
  const trimmed = input.link.trim()

  // Clearing the playlist is allowed; anything else must resolve to an id.
  let id: string | null = null
  if (trimmed !== '') {
    id = parseYouTubePlaylistId(trimmed)
    if (!id || !SAFE_ID.test(id)) {
      return { ok: false, error: 'Enter a YouTube playlist link, for example https://www.youtube.com/playlist?list=PL...' }
    }
  }

  const name = sanitiseName(input.name)

  try {
    const supabase = await createServiceRoleClient()
    const { error } = await supabase
      .from('site_playlist')
      .upsert({
        id: true,
        youtube_playlist_id: id,
        name,
        is_enabled: input.isEnabled !== false,
        updated_at: new Date().toISOString(),
        updated_by: input.updatedBy || null,
      })

    if (error) {
      return { ok: false, error: error.message.includes('site_playlist') ? 'Run supabase/site-playlist.sql first' : error.message }
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not save the playlist' }
  }

  return { ok: true, playlist: { youtubePlaylistId: id, name, isEnabled: input.isEnabled !== false } }
}

/**
 * What the homepage renders: the configured playlist when there is one, and
 * otherwise whatever public/data/playlists.json holds, so a developer can
 * still ship hosted audio files.
 */
export async function getHomepagePlaylists(): Promise<Playlist[]> {
  const setting = await getSitePlaylistSetting()

  if (setting.isEnabled && setting.youtubePlaylistId) {
    return [{
      id: 'site',
      name: setting.name,
      youtubePlaylistId: setting.youtubePlaylistId,
      tracks: [],
    }]
  }

  if (!setting.isEnabled) return []

  return getPlaylists()
}
