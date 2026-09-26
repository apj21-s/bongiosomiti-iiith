'use client'

import { useEffect, useState } from 'react'
import {
  fetchVideoDetailsFor,
  isVideoId,
  playlistUrl,
  watchUrl,
  type VideoDetails,
} from '@/utils/data/youtube-video'

/**
 * What is in the playlist, with a link to each song.
 *
 * The song list comes from the player itself - YouTube's API hands back the
 * video ids of whatever it loaded - so no API key and no server round trip are
 * involved. Titles come from YouTube's oEmbed endpoint, one request per song,
 * which is why only the first of a long playlist are looked up and the rest is
 * left to the link at the bottom.
 *
 * Every row does two things, because both are worth having: the title opens the
 * song on YouTube, and the button beside it plays that song here without
 * leaving the page.
 */

export type QueueItem = {
  /** Set when the queue came from YouTube. */
  videoId?: string
  /** Known up front for hosted audio, looked up for YouTube. */
  title?: string
  artist?: string
}

/** One request per song, so a long playlist is not a hundred of them at once. */
const MAX_ROWS = 60

export default function PlaylistContents({
  items,
  currentIndex,
  playlistId,
  onPlayAt,
  onClose,
}: {
  items: QueueItem[]
  currentIndex: number
  playlistId?: string
  onPlayAt: (index: number) => void
  onClose: () => void
}) {
  const [details, setDetails] = useState<Record<string, VideoDetails>>({})

  useEffect(() => {
    const ids = items
      .slice(0, MAX_ROWS)
      .map((item) => item.videoId)
      .filter(isVideoId)

    if (ids.length === 0) return

    const controller = new AbortController()

    // Resolved one at a time rather than in one batch, so the list fills in as
    // the answers arrive instead of sitting empty until the last one lands.
    fetchVideoDetailsFor(
      ids,
      (found) => {
        setDetails((current) => (current[found.id] ? current : { ...current, [found.id]: found }))
      },
      controller.signal
    )

    return () => controller.abort()
  }, [items])

  const rows = items.slice(0, MAX_ROWS)
  const remaining = items.length - rows.length
  const listUrl = playlistId ? playlistUrl(playlistId) : null

  return (
    <div className="hero-playlist-queue" role="group" aria-label="Playlist contents">
      <div className="hero-playlist-queue__head">
        <p className="hero-playlist-queue__heading">
          In this playlist
          {items.length > 0 && <span className="hero-playlist-queue__count">{items.length}</span>}
        </p>
        <button type="button" className="hero-playlist-picker__link" onClick={onClose}>
          Close
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="hero-playlist-queue__empty">
          Waiting for the playlist. If it does not appear, press play once - YouTube
          only hands over the songs after it has loaded them.
        </p>
      ) : (
        <ol className="hero-playlist-queue__list">
          {rows.map((item, index) => {
            const found = item.videoId ? details[item.videoId] : undefined
            const label = item.title || found?.title || `Track ${index + 1}`
            const by = item.artist || found?.author
            const href = item.videoId ? watchUrl(item.videoId, playlistId) : null
            const isCurrent = index === currentIndex

            return (
              <li
                key={`${item.videoId || 'track'}-${index}`}
                className={`hero-playlist-queue__row ${isCurrent ? 'is-current' : ''}`}
              >
                <button
                  type="button"
                  className="hero-playlist-queue__play"
                  onClick={() => onPlayAt(index)}
                  aria-label={`Play ${label}`}
                  aria-current={isCurrent || undefined}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M8 5.5v13a.6.6 0 0 0 .93.5l10-6.5a.6.6 0 0 0 0-1l-10-6.5a.6.6 0 0 0-.93.5Z" />
                  </svg>
                </button>

                {href ? (
                  <a
                    className="hero-playlist-queue__name"
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={by ? `${label} - ${by}` : label}
                  >
                    <span className="hero-playlist-queue__song">{label}</span>
                    {by && <span className="hero-playlist-queue__by">{by}</span>}
                  </a>
                ) : (
                  <span className="hero-playlist-queue__name" title={label}>
                    <span className="hero-playlist-queue__song">{label}</span>
                    {by && <span className="hero-playlist-queue__by">{by}</span>}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {remaining > 0 && listUrl && (
        <a
          className="hero-playlist-queue__more"
          href={listUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          and {remaining} more on YouTube
        </a>
      )}
    </div>
  )
}
