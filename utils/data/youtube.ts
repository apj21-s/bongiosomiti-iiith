/**
 * Pulling a playlist id out of whatever YouTube link someone pastes.
 *
 * Kept free of imports so it stays a pure, directly testable function.
 */

/**
 * Accepts a playlist URL, a watch URL carrying a `list` parameter, or a bare
 * playlist id. Returns null for anything else - including links to other
 * hosts - so a typo or a pasted tracking link fails closed instead of
 * embedding something unexpected.
 */
export function parseYouTubePlaylistId(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const raw = value.trim()
  if (raw.length === 0) return null

  // A bare id: YouTube uses PL/OLAK5uy_/RD/UU/FL prefixes, all url-safe text.
  if (!raw.includes('/') && !raw.includes('?') && /^[A-Za-z0-9_-]{12,60}$/.test(raw)) {
    return raw
  }

  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(url.hostname)) return null

    const list = url.searchParams.get('list')
    if (typeof list !== 'string' || list.length === 0) return null

    return /^[A-Za-z0-9_-]+$/.test(list) ? list : null
  } catch {
    return null
  }
}
