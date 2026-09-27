import { parseYouTubePlaylistId } from './youtube'

/**
 * The playlists the homepage offers, as the super admin curates them.
 *
 * Kept in public/data/playlists.json, which the site already reads. The first
 * entry is the one the player starts on - there is no separate "default" flag,
 * because a flag and an order can disagree and then something has to win.
 *
 * Only the extracted playlist id is ever stored, never a pasted URL, so nothing
 * that reaches the page can carry a scheme, a host or markup. The same id is
 * validated again when the file is read.
 */

export type LibraryEntry = {
  /** YouTube playlist id, as it appears after list= in the URL. */
  id: string
  /** What the picker calls it. */
  name: string
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/

/** Enough for a festival, few enough that the picker stays a row of chips. */
export const MAX_ENTRIES = 12

export function sanitiseName(value: unknown, fallback = 'Playlist'): string {
  if (typeof value !== 'string') return fallback
  // Rendered as text, never as markup; capped so a long paste cannot stretch
  // the picker off the screen.
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 48)
  return cleaned || fallback
}

/** Whatever is in the file, as a list this code can rely on. */
export function readLibrary(raw: unknown): LibraryEntry[] {
  if (!Array.isArray(raw)) return []

  const seen = new Set<string>()
  const entries: LibraryEntry[] = []

  for (const item of raw) {
    // A bare link or id, which is what pasting the address bar gives.
    const id = typeof item === 'string'
      ? parseYouTubePlaylistId(item)
      : parseYouTubePlaylistId((item as Record<string, unknown>)?.youtube)
        ?? parseYouTubePlaylistId((item as Record<string, unknown>)?.youtubePlaylist)
        ?? parseYouTubePlaylistId((item as Record<string, unknown>)?.youtubePlaylistId)

    if (!id || !SAFE_ID.test(id) || seen.has(id)) continue
    seen.add(id)

    const name = typeof item === 'string'
      ? `Playlist ${entries.length + 1}`
      : sanitiseName((item as Record<string, unknown>)?.name, `Playlist ${entries.length + 1}`)

    entries.push({ id, name })
  }

  return entries
}

export type LibraryResult = { ok: true; entries: LibraryEntry[] } | { ok: false; error: string }

export function addEntry(entries: LibraryEntry[], link: unknown, name?: unknown): LibraryResult {
  if (typeof link !== 'string' || link.trim() === '') {
    return { ok: false, error: 'Paste a YouTube playlist link.' }
  }

  if (link.length > 300) {
    return { ok: false, error: 'That link is too long to be a playlist URL.' }
  }

  const id = parseYouTubePlaylistId(link)
  if (!id || !SAFE_ID.test(id)) {
    return {
      ok: false,
      error: 'That is not a YouTube playlist link. It should look like youtube.com/playlist?list=PL...',
    }
  }

  if (entries.some((entry) => entry.id === id)) {
    return { ok: false, error: 'That playlist is already on the list.' }
  }

  if (entries.length >= MAX_ENTRIES) {
    return { ok: false, error: `The list holds ${MAX_ENTRIES} playlists. Remove one first.` }
  }

  return { ok: true, entries: [...entries, { id, name: sanitiseName(name, `Playlist ${entries.length + 1}`) }] }
}

export function removeEntry(entries: LibraryEntry[], id: unknown): LibraryResult {
  if (typeof id !== 'string' || !entries.some((entry) => entry.id === id)) {
    return { ok: false, error: 'That playlist is not on the list.' }
  }

  // Emptying it is allowed: the homepage falls back to the shipped playlists,
  // so the music does not simply stop.
  return { ok: true, entries: entries.filter((entry) => entry.id !== id) }
}

/** Moves one to the front, which is the one the player starts on. */
export function makeFirst(entries: LibraryEntry[], id: unknown): LibraryResult {
  if (typeof id !== 'string') return { ok: false, error: 'That playlist is not on the list.' }

  const found = entries.find((entry) => entry.id === id)
  if (!found) return { ok: false, error: 'That playlist is not on the list.' }

  return { ok: true, entries: [found, ...entries.filter((entry) => entry.id !== id)] }
}

export function renameEntry(entries: LibraryEntry[], id: unknown, name: unknown): LibraryResult {
  if (typeof id !== 'string' || !entries.some((entry) => entry.id === id)) {
    return { ok: false, error: 'That playlist is not on the list.' }
  }

  return {
    ok: true,
    entries: entries.map((entry) => (entry.id === id ? { ...entry, name: sanitiseName(name, entry.name) } : entry)),
  }
}

/** The shape written back to public/data/playlists.json. */
export function toFileShape(entries: LibraryEntry[]) {
  return entries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    youtube: `https://www.youtube.com/playlist?list=${entry.id}`,
  }))
}

/** The canonical URL for one, for the link out of the admin list. */
export function playlistUrlFor(id: string): string | null {
  return SAFE_ID.test(id) ? `https://www.youtube.com/playlist?list=${id}` : null
}
