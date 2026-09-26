'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import './hero-playlist.css'
import type { Playlist } from '@/utils/data/playlists'

/**
 * Music player overlaid on the events video on the homepage.
 *
 * Two sources, one set of controls:
 *   - a YouTube playlist, played through YouTube's embedded player
 *   - audio files hosted by the site, played through a plain <audio> element
 *
 * The events video itself is untouched and stays muted; the music sits on top
 * of it. Nothing loads until the visitor presses play, and playback never
 * starts on its own, because browsers block autoplaying audio.
 */

type YouTubePlayerInstance = {
  playVideo(): void
  pauseVideo(): void
  nextVideo(): void
  previousVideo(): void
  setShuffle(shuffle: boolean): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getVideoData(): { title?: string; author?: string }
  destroy(): void
}

type YouTubeNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      host?: string
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: () => void
        onStateChange?: (event: { data: number }) => void
        onError?: () => void
      }
    }
  ) => YouTubePlayerInstance
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number }
}

declare global {
  interface Window {
    YT?: YouTubeNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

const YT_API_SRC = 'https://www.youtube.com/iframe_api'

/**
 * Loads YouTube's IFrame API once per page and resolves when it is usable.
 * The API calls a single global callback, so concurrent callers queue on one
 * shared promise rather than trampling each other's handler.
 */
let youTubeApi: Promise<YouTubeNamespace> | null = null
function loadYouTubeApi(): Promise<YouTubeNamespace> {
  if (youTubeApi) return youTubeApi

  youTubeApi = new Promise<YouTubeNamespace>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT)
      return
    }

    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT?.Player) resolve(window.YT)
      else reject(new Error('YouTube IFrame API loaded without a Player'))
    }

    if (!document.querySelector(`script[src="${YT_API_SRC}"]`)) {
      const script = document.createElement('script')
      script.src = YT_API_SRC
      script.async = true
      script.onerror = () => reject(new Error('Could not load the YouTube IFrame API'))
      document.head.appendChild(script)
    }
  })

  return youTubeApi
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  return `${minutes}:${String(total % 60).padStart(2, '0')}`
}

type BarProps = {
  title: string
  artist?: string
  isPlaying: boolean
  shuffle: boolean
  currentTime: number
  duration: number
  disabled?: boolean
  onToggle: () => void
  onNext: () => void
  onPrevious: () => void
  onShuffle: () => void
  onSeek: (seconds: number) => void
  children?: React.ReactNode
}

/** The visible control bar. Shared by both engines so they look identical. */
function PlayerBar({
  title,
  artist,
  isPlaying,
  shuffle,
  currentTime,
  duration,
  disabled = false,
  onToggle,
  onNext,
  onPrevious,
  onShuffle,
  onSeek,
  children,
}: BarProps) {
  const seekMax = duration > 0 ? duration : 0
  const progress = seekMax > 0 ? (currentTime / seekMax) * 100 : 0

  return (
    <div className="hero-playlist" role="group" aria-label="Festival music player">
      {children}

      <div className="hero-playlist__controls">
        <button type="button" className="hero-playlist__btn" onClick={onPrevious} aria-label="Previous track">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M7 6v12" />
            <path d="M18 6.5v11a.6.6 0 0 1-.94.5l-8-5.5a.6.6 0 0 1 0-1l8-5.5a.6.6 0 0 1 .94.5Z" />
          </svg>
        </button>

        <button
          type="button"
          className="hero-playlist__btn hero-playlist__btn--play"
          onClick={onToggle}
          disabled={disabled}
          aria-label={isPlaying ? 'Pause music' : 'Play music'}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M9 5v14" />
              <path d="M15 5v14" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M8 5.5v13a.6.6 0 0 0 .93.5l10-6.5a.6.6 0 0 0 0-1l-10-6.5a.6.6 0 0 0-.93.5Z" />
            </svg>
          )}
        </button>

        <button type="button" className="hero-playlist__btn" onClick={onNext} aria-label="Next track">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M17 6v12" />
            <path d="M6 6.5v11a.6.6 0 0 0 .94.5l8-5.5a.6.6 0 0 0 0-1l-8-5.5a.6.6 0 0 0-.94.5Z" />
          </svg>
        </button>

        <button
          type="button"
          className={`hero-playlist__btn hero-playlist__btn--shuffle ${shuffle ? 'is-on' : ''}`}
          onClick={onShuffle}
          aria-label="Shuffle"
          aria-pressed={shuffle}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M3 7h3.5l3 5m0 0 3 5H17" />
            <path d="M3 17h3.5l3-5" />
            <path d="M13.5 7H17" />
            <path d="m15 5 2.5 2L15 9" />
            <path d="m15 15 2.5 2L15 19" />
          </svg>
        </button>
      </div>

      <div className="hero-playlist__body">
        <div className="hero-playlist__meta">
          <span className="hero-playlist__title" title={title}>{title}</span>
          {artist && <span className="hero-playlist__artist" title={artist}>{artist}</span>}
        </div>

        <div className="hero-playlist__scrub">
          <input
            className="hero-playlist__range"
            type="range"
            min={0}
            max={seekMax || 1}
            step="any"
            value={Math.min(currentTime, seekMax || 1)}
            disabled={seekMax === 0}
            aria-label="Seek"
            style={{ ['--hero-playlist-progress' as string]: `${progress}%` }}
            onChange={(e) => onSeek(Number(e.currentTarget.value))}
          />
          <span className="hero-playlist__time">
            {formatTime(currentTime)} / {formatTime(seekMax)}
          </span>
        </div>
      </div>
    </div>
  )
}

/** Plays audio files hosted by the site. */
function AudioPlayer({ playlist }: { playlist: Playlist }) {
  const tracks = playlist.tracks

  const audioRef = useRef<HTMLAudioElement>(null)
  // Where shuffle has already been, so "previous" retraces the actual path.
  const historyRef = useRef<number[]>([])
  // Whether a track change should resume playing, read inside effects without
  // making them depend on isPlaying.
  const resumeRef = useRef(false)

  const [index, setIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)

  const track = tracks[index]

  const pickNextIndex = useCallback(() => {
    if (tracks.length <= 1) return index
    if (!shuffle) return (index + 1) % tracks.length

    let candidate = index
    while (candidate === index) candidate = Math.floor(Math.random() * tracks.length)
    return candidate
  }, [index, shuffle, tracks.length])

  const goTo = useCallback((nextIndex: number, resume: boolean) => {
    resumeRef.current = resume
    setFailed(false)
    setCurrentTime(0)
    setDuration(0)
    setIndex(nextIndex)
  }, [])

  const next = useCallback(() => {
    historyRef.current.push(index)
    goTo(pickNextIndex(), isPlaying)
  }, [goTo, index, isPlaying, pickNextIndex])

  const previous = useCallback(() => {
    const audio = audioRef.current

    // Standard player behaviour: a few seconds in, "previous" restarts the
    // current track before it steps back a song.
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      setCurrentTime(0)
      return
    }

    if (tracks.length <= 1) {
      if (audio) {
        audio.currentTime = 0
        setCurrentTime(0)
      }
      return
    }

    const previousIndex = shuffle ? historyRef.current.pop() : (index - 1 + tracks.length) % tracks.length
    goTo(previousIndex ?? (index - 1 + tracks.length) % tracks.length, isPlaying)
  }, [goTo, index, isPlaying, shuffle, tracks.length])

  const toggle = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
      return
    }

    try {
      await audio.play()
      setIsPlaying(true)
      setFailed(false)
    } catch {
      // Blocked or undecodable: leave the control paused rather than
      // pretending the song is running.
      setIsPlaying(false)
    }
  }, [isPlaying])

  // Resume across a track change, once the new source is attached.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !resumeRef.current) return

    resumeRef.current = false
    audio.play().then(() => setIsPlaying(true), () => setIsPlaying(false))
  }, [index])

  if (!track) return null

  return (
    <PlayerBar
      title={failed ? 'Track unavailable' : track.title}
      artist={failed ? undefined : track.artist}
      isPlaying={isPlaying}
      shuffle={shuffle}
      currentTime={currentTime}
      duration={duration}
      onToggle={toggle}
      onNext={next}
      onPrevious={previous}
      onShuffle={() => setShuffle((on) => !on)}
      onSeek={(value) => {
        setCurrentTime(value)
        if (audioRef.current) audioRef.current.currentTime = value
      }}
    >
      <audio
        ref={audioRef}
        src={track.src}
        preload="none"
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => {
          historyRef.current.push(index)
          goTo(pickNextIndex(), true)
        }}
        onError={() => {
          setFailed(true)
          setIsPlaying(false)
        }}
      />
    </PlayerBar>
  )
}

/** Plays a YouTube playlist through YouTube's own embedded player. */
function YouTubePlayer({ playlistId, name }: { playlistId: string; name: string }) {
  const mountId = useId().replace(/:/g, '')
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YouTubePlayerInstance | null>(null)

  const [ready, setReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [title, setTitle] = useState(name)
  const [artist, setArtist] = useState<string | undefined>(undefined)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    const readMetadata = () => {
      const player = playerRef.current
      if (!player || cancelled) return
      const data = player.getVideoData()
      if (data?.title) setTitle(data.title)
      setArtist(data?.author || undefined)
      setDuration(player.getDuration() || 0)
    }

    loadYouTubeApi().then(
      (YT) => {
        if (cancelled || !hostRef.current) return

        playerRef.current = new YT.Player(hostRef.current, {
          playerVars: {
            listType: 'playlist',
            list: playlistId,
            // No autoplay: the visitor presses play.
            autoplay: 0,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
          },
          events: {
            onReady: () => {
              if (cancelled) return
              setReady(true)
              // Show the real track and length straight away, rather than the
              // playlist name until the first state change arrives.
              readMetadata()
            },
            onStateChange: (event) => {
              if (cancelled) return
              if (event.data === YT.PlayerState.PLAYING) setIsPlaying(true)
              if (event.data === YT.PlayerState.PAUSED) setIsPlaying(false)
              if (event.data === YT.PlayerState.ENDED) setIsPlaying(false)

              // A playlist advances on its own, so the title and length are
              // re-read on every transition rather than only when we ask.
              readMetadata()
            },
            onError: () => {
              if (!cancelled) setError(true)
            },
          },
        })
      },
      () => {
        if (!cancelled) setError(true)
      }
    )

    return () => {
      cancelled = true
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [playlistId])

  // YouTube has no timeupdate event, so position is polled while playing.
  useEffect(() => {
    if (!isPlaying) return

    const id = window.setInterval(() => {
      const player = playerRef.current
      if (!player) return
      setCurrentTime(player.getCurrentTime() || 0)
      const total = player.getDuration() || 0
      if (total > 0) setDuration(total)
    }, 250)

    return () => window.clearInterval(id)
  }, [isPlaying])

  return (
    <PlayerBar
      title={error ? 'Playlist unavailable' : title}
      artist={error ? undefined : artist}
      isPlaying={isPlaying}
      shuffle={shuffle}
      currentTime={currentTime}
      duration={duration}
      disabled={!ready && !error}
      onToggle={() => {
        const player = playerRef.current
        if (!player) return
        if (isPlaying) player.pauseVideo()
        else player.playVideo()
      }}
      onNext={() => playerRef.current?.nextVideo()}
      onPrevious={() => {
        const player = playerRef.current
        if (!player) return
        // Match the audio engine: restart the song first, step back after.
        if (player.getCurrentTime() > 3) player.seekTo(0, true)
        else player.previousVideo()
      }}
      onShuffle={() => {
        setShuffle((on) => {
          playerRef.current?.setShuffle(!on)
          return !on
        })
      }}
      onSeek={(value) => {
        setCurrentTime(value)
        playerRef.current?.seekTo(value, true)
      }}
    >
      {/* Kept visible on purpose: YouTube's terms require their player to be
          shown while it is playing, so it sits in the bar as a small tile. */}
      <div className="hero-playlist__yt" aria-label={`${name} on YouTube`}>
        <div ref={hostRef} id={`yt-${mountId}`} />
      </div>
    </PlayerBar>
  )
}

export default function HeroPlaylist({ playlists }: { playlists: Playlist[] }) {
  // One playlist drives the hero. Extra playlists stay in the data file for a
  // future selector rather than being silently concatenated.
  const playlist = playlists[0]
  if (!playlist) return null

  if (playlist.youtubePlaylistId) {
    return <YouTubePlayer playlistId={playlist.youtubePlaylistId} name={playlist.name} />
  }

  return <AudioPlayer playlist={playlist} />
}
