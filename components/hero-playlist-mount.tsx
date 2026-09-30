'use client'

import { usePathname } from 'next/navigation'
import type { Playlist } from '@/utils/data/playlists'
import HeroPlaylist from './hero-playlist'

/**
 * The player belongs to the public site. It is mounted in the root layout so
 * that it keeps playing across navigation - which also put it on every /admin
 * screen, where it floated over the sidebar footer and covered the sign-out
 * button and the tier badge.
 *
 * Deciding here rather than inside HeroPlaylist means none of the player's
 * hooks run on an admin page: no scroll listener, no stored-playlist read, no
 * iframe, and no class left on <html> by a screen that never wanted it.
 */
export default function HeroPlaylistMount({ playlists }: { playlists: Playlist[] }) {
  const pathname = usePathname()

  if (pathname === '/admin' || pathname?.startsWith('/admin/')) return null

  return <HeroPlaylist playlists={playlists} />
}
