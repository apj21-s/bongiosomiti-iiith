import { parseYouTubePlaylistId } from './youtube'

/**
 * The visitor's own playlist, chosen from the button on the player.
 *
 * It lives in this browser and nowhere else. Nothing is sent to the server, so
 * one visitor's choice cannot change what anybody else hears, and the site-wide
 * playlist stays the super admin's to set from /admin/playlist. A visitor who
 * has not chosen anything hears whatever is configured there.
 *
 * Only the extracted playlist id is stored, never the pasted URL, and it is
 * validated again on the way out: localStorage is writable by anything running
 * on the page, so what comes back is treated as untrusted input rather than as
 * something we wrote. The id is only ever handed to YouTube's player API as a
 * parameter - no URL is built from it - which is the same rule the server-side
 * setting follows in `./site-playlist`.
 */

const STORAGE_KEY = 'bangiya.hero-playlist'

// The same shape the database CHECK constraint enforces on the site setting.
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/

/** Reduces a pasted link to a playlist id, or null if it is not one. */
export function toCustomPlaylistId(link: string): string | null {
  const id = parseYouTubePlaylistId(link)
  return id && SAFE_ID.test(id) ? id : null
}

// Fired at ourselves, because the storage event does not reach the tab that
// did the writing.
const CHANGED_EVENT = 'bangiya:hero-playlist'

// What is playing when storage cannot be written - a private window, or site
// data blocked. The choice then lasts for the visit instead of being lost.
let inMemory: string | null = null

export function readCustomPlaylistId(): string | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored !== null) return SAFE_ID.test(stored) ? stored : null
  } catch {
    // Private windows and blocked site data both throw on access.
  }
  return inMemory
}

export function writeCustomPlaylistId(id: string | null) {
  inMemory = id && SAFE_ID.test(id) ? id : null

  try {
    if (inMemory) window.localStorage.setItem(STORAGE_KEY, inMemory)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Not being able to remember the choice is not worth breaking playback for.
  }

  window.dispatchEvent(new Event(CHANGED_EVENT))
}

/**
 * Subscription for useSyncExternalStore, which is how the player reads this
 * without a setState in an effect: the value is client-only, so the server
 * snapshot is null and the real one is read after hydration.
 */
export function subscribeToCustomPlaylist(onChange: () => void) {
  window.addEventListener(CHANGED_EVENT, onChange)
  // The same site open in another tab.
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGED_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

export function noCustomPlaylist(): null {
  return null
}
