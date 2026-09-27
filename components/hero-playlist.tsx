'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import './hero-playlist.css'
import type { Playlist } from '@/utils/data/playlists'
import {
  noCustomPlaylist,
  readCustomPlaylistId,
  subscribeToCustomPlaylist,
  toCustomPlaylistId,
  writeCustomPlaylistId,
} from '@/utils/data/custom-playlist'
import { presetName } from '@/utils/data/preset-playlists'
import PlaylistContents, { type QueueItem } from './playlist-contents'

/**
 * Off, the whole playlist on a loop, or the one song on a loop - the three
 * states of the repeat button, in the order it cycles through them.
 */
export type RepeatMode = 'off' | 'all' | 'one'

function nextRepeat(mode: RepeatMode): RepeatMode {
  if (mode === 'off') return 'all'
  if (mode === 'all') return 'one'
  return 'off'
}

const REPEAT_LABEL: Record<RepeatMode, string> = {
  off: 'Repeat off',
  all: 'Repeating the playlist',
  one: 'Repeating this song',
}

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
  setLoop(loop: boolean): void
  getPlaylist(): string[] | null
  getPlaylistIndex(): number
  playVideoAt(index: number): void
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
  /** Cycles off -> whole playlist -> this song. */
  repeat: RepeatMode
  onRepeat: () => void
  onSeek: (seconds: number) => void
  /** The songs in what is loaded, for the contents panel. */
  queue: QueueItem[]
  queueIndex: number
  queueOpen: boolean
  onToggleQueue: () => void
  onPlayAt: (index: number) => void
  /** Set when the queue is a YouTube playlist, for the links out. */
  playlistId?: string
  /** Takes the video and the player to the whole screen, and back. */
  onFullscreen: () => void
  isFullscreen: boolean
  canFullscreen: boolean
  /** Opens the panel for pasting your own YouTube playlist link. */
  onCustomise: () => void
  /** Whether what is playing is the visitor's own playlist. */
  customActive?: boolean
  pickerOpen?: boolean
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
  repeat,
  onRepeat,
  onSeek,
  queue,
  queueIndex,
  queueOpen,
  onToggleQueue,
  onPlayAt,
  playlistId,
  onFullscreen,
  isFullscreen,
  canFullscreen,
  onCustomise,
  customActive = false,
  pickerOpen = false,
  children,
}: BarProps) {
  const seekMax = duration > 0 ? duration : 0
  const progress = seekMax > 0 ? (currentTime / seekMax) * 100 : 0

  return (
    <div
      className={`hero-playlist ${isPlaying ? 'is-playing' : ''}`}
      role="group"
      aria-label="Festival music player"
    >
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

        <button
          type="button"
          className={`hero-playlist__btn hero-playlist__btn--repeat ${repeat === 'off' ? '' : 'is-on'}`}
          onClick={onRepeat}
          aria-label={REPEAT_LABEL[repeat]}
          title={REPEAT_LABEL[repeat]}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 10.5A3.5 3.5 0 0 1 7.5 7H18" />
            <path d="m15.5 4.5 3 2.5-3 2.5" />
            <path d="M20 13.5a3.5 3.5 0 0 1-3.5 3.5H6" />
            <path d="m8.5 20.5-3-3.5 3-2.5" />
            {/* The 1 that turns "repeat" into "repeat this one". */}
            {repeat === 'one' && <path d="M10.8 11.1 12 10.4V14" />}
          </svg>
        </button>

        <button
          type="button"
          className={`hero-playlist__btn hero-playlist__btn--queue ${queueOpen ? 'is-on' : ''}`}
          onClick={onToggleQueue}
          aria-label="What is in this playlist"
          title="What is in this playlist"
          aria-expanded={queueOpen}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 7h11" />
            <path d="M4 12h11" />
            <path d="M4 17h7" />
            <path d="M17.5 14.2v5.6a.4.4 0 0 0 .62.33l4.2-2.8a.4.4 0 0 0 0-.66l-4.2-2.8a.4.4 0 0 0-.62.33Z" />
          </svg>
        </button>

        {canFullscreen && (
          <button
            type="button"
            className={`hero-playlist__btn hero-playlist__btn--full ${isFullscreen ? 'is-on' : ''}`}
            onClick={onFullscreen}
            aria-label={isFullscreen ? 'Leave fullscreen' : 'Play fullscreen'}
            title={isFullscreen ? 'Leave fullscreen' : 'Play fullscreen'}
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? (
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M9 4v5H4" />
                <path d="M15 4v5h5" />
                <path d="M9 20v-5H4" />
                <path d="M15 20v-5h5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M4 9V4h5" />
                <path d="M20 9V4h-5" />
                <path d="M4 15v5h5" />
                <path d="M20 15v5h-5" />
              </svg>
            )}
          </button>
        )}

        {/* Bringing your own music is not a hidden feature, so it gets a
            control in the bar rather than a gesture to discover. */}
        <button
          type="button"
          className={`hero-playlist__btn hero-playlist__btn--custom ${customActive ? 'is-on' : ''}`}
          onClick={onCustomise}
          aria-label="Use your own YouTube playlist"
          title="Use your own YouTube playlist"
          aria-expanded={pickerOpen}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 7h11" />
            <path d="M4 12h11" />
            <path d="M4 17h7" />
            <path d="M18 13v7" />
            <path d="M14.5 16.5h7" />
          </svg>
        </button>
      </div>

      {queueOpen && (
        <PlaylistContents
          items={queue}
          currentIndex={queueIndex}
          playlistId={playlistId}
          onPlayAt={onPlayAt}
          onClose={onToggleQueue}
        />
      )}

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
function AudioPlayer({
  playlist,
  onFullscreen,
  isFullscreen,
  canFullscreen,
  onCustomise,
  customActive,
  pickerOpen,
}: {
  playlist: Playlist
  onFullscreen: () => void
  isFullscreen: boolean
  canFullscreen: boolean
  onCustomise: () => void
  customActive: boolean
  pickerOpen: boolean
}) {
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
  const [repeat, setRepeat] = useState<RepeatMode>('off')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)

  // Hosted audio knows its own songs; there is nothing to look up.
  const queue = useMemo<QueueItem[]>(
    () => tracks.map((item) => ({ title: item.title, artist: item.artist })),
    [tracks]
  )

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
      repeat={repeat}
      onRepeat={() => setRepeat(nextRepeat)}
      onSeek={(value) => {
        setCurrentTime(value)
        if (audioRef.current) audioRef.current.currentTime = value
      }}
      queue={queue}
      queueIndex={index}
      queueOpen={queueOpen}
      onToggleQueue={() => setQueueOpen((open) => !open)}
      onPlayAt={(next) => goTo(next, true)}
      onFullscreen={onFullscreen}
      isFullscreen={isFullscreen}
      canFullscreen={canFullscreen}
      onCustomise={onCustomise}
      customActive={customActive}
      pickerOpen={pickerOpen}
    >
      {/* loop repeats the one track in the browser itself, seamlessly and
          without onEnded firing at all. */}
      <audio
        ref={audioRef}
        src={track.src}
        preload="none"
        loop={repeat === 'one'}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => {
          // Reaching the last track with repeat off is the end of the music.
          // Shuffle has no last track, so it carries on regardless.
          if (repeat === 'off' && !shuffle && index === tracks.length - 1) {
            setIsPlaying(false)
            return
          }
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
function YouTubePlayer({
  playlistId,
  name,
  onFullscreen,
  isFullscreen,
  canFullscreen,
  onCustomise,
  customActive,
  pickerOpen,
}: {
  playlistId: string
  name: string
  onFullscreen: () => void
  isFullscreen: boolean
  canFullscreen: boolean
  onCustomise: () => void
  customActive: boolean
  pickerOpen: boolean
}) {
  const mountId = useId().replace(/:/g, '')
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YouTubePlayerInstance | null>(null)

  const [ready, setReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('off')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [title, setTitle] = useState(name)
  const [artist, setArtist] = useState<string | undefined>(undefined)
  const [error, setError] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  // The video ids of what YouTube actually loaded, which is the only list of
  // the playlist's contents available without an API key.
  const [videoIds, setVideoIds] = useState<string[]>([])
  const [queueIndex, setQueueIndex] = useState(0)

  const queue = useMemo<QueueItem[]>(() => videoIds.map((videoId) => ({ videoId })), [videoIds])

  // Read inside the player's own callbacks, which are set up once per playlist
  // and would otherwise close over whatever repeat was when the player was
  // built.
  const repeatRef = useRef<RepeatMode>('off')
  useEffect(() => {
    repeatRef.current = repeat
    // Looping the playlist is YouTube's own; looping one song is not, and is
    // handled when the video ends.
    playerRef.current?.setLoop(repeat === 'all')
  }, [repeat])

  useEffect(() => {
    let cancelled = false

    const readMetadata = () => {
      const player = playerRef.current
      if (!player || cancelled) return
      const data = player.getVideoData()
      if (data?.title) setTitle(data.title)
      setArtist(data?.author || undefined)
      setDuration(player.getDuration() || 0)

      // The contents, re-read on every transition: the list is empty until
      // YouTube has loaded the playlist, and shuffle reorders it.
      const list = player.getPlaylist?.() || []
      setVideoIds((current) =>
        current.length === list.length && current.every((id, i) => id === list[i]) ? current : list
      )
      setQueueIndex(player.getPlaylistIndex?.() ?? 0)
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
              playerRef.current?.setLoop(repeatRef.current === 'all')
              // Show the real track and length straight away, rather than the
              // playlist name until the first state change arrives.
              readMetadata()
            },
            onStateChange: (event) => {
              if (cancelled) return
              if (event.data === YT.PlayerState.PLAYING) setIsPlaying(true)
              if (event.data === YT.PlayerState.PAUSED) setIsPlaying(false)
              if (event.data === YT.PlayerState.ENDED) {
                // Left alone, YouTube moves on to the next video in the
                // playlist, so repeating one song means putting it back.
                if (repeatRef.current === 'one') playerRef.current?.seekTo(0, true)
                else setIsPlaying(false)
              }

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
      repeat={repeat}
      onRepeat={() => setRepeat(nextRepeat)}
      onSeek={(value) => {
        setCurrentTime(value)
        playerRef.current?.seekTo(value, true)
      }}
      queue={queue}
      queueIndex={queueIndex}
      queueOpen={queueOpen}
      onToggleQueue={() => setQueueOpen((open) => !open)}
      onPlayAt={(next) => playerRef.current?.playVideoAt(next)}
      playlistId={playlistId}
      onFullscreen={onFullscreen}
      isFullscreen={isFullscreen}
      canFullscreen={canFullscreen}
      onCustomise={onCustomise}
      customActive={customActive}
      pickerOpen={pickerOpen}
    >
      {/* Kept visible on purpose: YouTube's terms require their player to be
          shown while it is playing, so it sits in the bar as a small tile. */}
      <div className="hero-playlist__yt" aria-label={`${name} on YouTube`}>
        <div ref={hostRef} id={`yt-${mountId}`} />
      </div>
    </PlayerBar>
  )
}

/**
 * The panel behind the playlist button: paste a link, press Play.
 *
 * The link is checked with the same parseYouTubePlaylistId the admin form and
 * the server-side setting use, so anything that is not a YouTube playlist -
 * a javascript: URL, a lookalike host, a video link - is refused here too, and
 * only the id it extracts is kept.
 */
function PlaylistPicker({
  current,
  offered,
  onChoose,
  onClose,
}: {
  current: string | null
  /** What the super admin put on the homepage, in their order. */
  offered: { id: string; name: string }[]
  onChoose: (id: string | null) => void
  onClose: () => void
}) {
  const fieldId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [link, setLink] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <form
      className="hero-playlist-picker"
      onSubmit={(e) => {
        e.preventDefault()
        const id = toCustomPlaylistId(link)
        if (!id) {
          setError('That does not look like a YouTube playlist link. It should look like youtube.com/playlist?list=PL...')
          return
        }
        onChoose(id)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <p className="hero-playlist-picker__label">Choose the music</p>

      <div className="hero-playlist-picker__presets">
        {offered.map((choice) => (
          <button
            key={choice.id}
            type="button"
            className={`hero-playlist-picker__preset ${current === choice.id ? 'is-on' : ''}`}
            aria-pressed={current === choice.id}
            onClick={() => onChoose(choice.id)}
          >
            {choice.name}
          </button>
        ))}
      </div>

      <label className="hero-playlist-picker__label" htmlFor={fieldId}>
        Or play your own YouTube playlist
      </label>

      <div className="hero-playlist-picker__row">
        <input
          id={fieldId}
          ref={inputRef}
          className="hero-playlist-picker__input"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://www.youtube.com/playlist?list=..."
          value={link}
          onChange={(e) => {
            setLink(e.currentTarget.value)
            setError(null)
          }}
        />
        <button type="submit" className="hero-playlist-picker__go">
          Play
        </button>
      </div>

      {error && (
        <p className="hero-playlist-picker__error" role="alert">
          {error}
        </p>
      )}

      <p className="hero-playlist-picker__hint">
        It has to be a public or unlisted playlist. Your choice is kept in this
        browser only and does not change what anyone else hears.
      </p>

      <div className="hero-playlist-picker__actions">
        <button type="button" className="hero-playlist-picker__link" onClick={onClose}>
          Close
        </button>
      </div>
    </form>
  )
}

/**
 * Whether this browser will put an element fullscreen at all - iOS Safari will
 * not - read as an external store, because the answer does not exist while
 * this renders on the server and a button that does nothing is worse than no
 * button.
 */
const subscribeToNothing = () => () => {}

/**
 * Whether this is a phone-sized screen, which is where the player starts out of
 * the way.
 *
 * The server cannot know, and answering wrongly for a moment would show the
 * player on a phone and then snatch it away, so the server's answer is "no idea"
 * and the dock is left without a state class until the browser has one. The
 * stylesheet reads that undecided state exactly the same way - open above the
 * breakpoint, shut below it - so the first paint is already right and nothing
 * moves when React catches up.
 */
const SMALL_SCREEN = '(max-width: 560px)'

function subscribeToScreen(onChange: () => void) {
  const query = window.matchMedia(SMALL_SCREEN)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const readScreen = () => (window.matchMedia(SMALL_SCREEN).matches ? 'small' : 'wide')
const screenUnknownOnTheServer = () => null
const readFullscreenSupport = () => typeof document !== 'undefined' && Boolean(document.fullscreenEnabled)
const noFullscreenOnTheServer = () => false

export default function HeroPlaylist({ playlists }: { playlists: Playlist[] }) {
  // The first is what plays; the rest are what the picker offers. Both come
  // from the super admin's list at /admin/playlist.
  const sitePlaylist = playlists[0]

  const offered = useMemo(
    () => playlists
      .filter((playlist) => Boolean(playlist.youtubePlaylistId))
      .map((playlist) => ({ id: playlist.youtubePlaylistId as string, name: playlist.name })),
    [playlists]
  )

  // Read as an external store, because that is what localStorage is: nothing
  // on the server, so the server snapshot is empty and the real value arrives
  // after hydration, without a setState in an effect to cascade a render.
  const customId = useSyncExternalStore(subscribeToCustomPlaylist, readCustomPlaylistId, noCustomPlaylist)
  const [picking, setPicking] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const dockRef = useRef<HTMLDivElement>(null)

  const screen = useSyncExternalStore(subscribeToScreen, readScreen, screenUnknownOnTheServer)

  // null until somebody says otherwise, at which point their choice holds for
  // the visit whatever the screen does.
  const [choice, setChoice] = useState<boolean | null>(null)
  const shown = choice ?? (screen === null ? null : screen === 'wide')
  const dockState = shown === null ? '' : shown ? 'is-open' : 'is-shut'

  const canFullscreen = useSyncExternalStore(
    subscribeToNothing,
    readFullscreenSupport,
    noFullscreenOnTheServer
  )

  // What goes fullscreen is the video and the player together, not the bar on
  // its own, so the element asked for is the one the page wraps them both in.
  const fullscreenHost = () => dockRef.current?.closest('.events-scene__hero') as HTMLElement | null

  useEffect(() => {
    const onChange = () => {
      const host = fullscreenHost()
      const on = Boolean(host && document.fullscreenElement === host)
      setIsFullscreen(on)
      // That element is rendered by the page rather than by this component, and
      // nothing re-renders it, so its class is set directly.
      host?.classList.toggle('is-fullscreen', on)
    }

    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
      return
    }

    const host = fullscreenHost() || dockRef.current
    host?.requestFullscreen?.().catch(() => {})
  }

  // Whatever was chosen here wins. What is configured at /admin/playlist is
  // only what plays before anyone chooses - a starting point, not a home to
  // come back to, so there is no control for returning to it.
  const playlist: Playlist | undefined = customId
    ? {
        id: 'custom',
        // Named if it is one of the offered ones, and otherwise a link the
        // visitor pasted themselves.
        name: offered.find((choice) => choice.id === customId)?.name
          || presetName(customId)
          || 'Your playlist',
        youtubePlaylistId: customId,
        tracks: [],
      }
    : sitePlaylist

  const togglePicker = () => setPicking((open) => !open)

  const picker = picking ? (
    <PlaylistPicker
      current={customId}
      offered={offered}
      onClose={() => setPicking(false)}
      onChoose={(id) => {
        // The write notifies the store, which re-renders this with the new id.
        writeCustomPlaylistId(id)
        setPicking(false)
      }}
    />
  ) : null

  // Nothing configured and nothing chosen. The button is then the whole
  // player, rather than there being no way in at all - which is what used to
  // happen, because the homepage did not render this component without a
  // playlist to hand it.
  if (!playlist) {
    return (
      <div className={`hero-playlist-dock ${dockState}`} ref={dockRef}>
        {picker}
        <button
          type="button"
          className="hero-playlist hero-playlist--empty"
          onClick={togglePicker}
          aria-expanded={picking}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 7h11" />
            <path d="M4 12h11" />
            <path d="M4 17h7" />
            <path d="M18 13v7" />
            <path d="M14.5 16.5h7" />
          </svg>
          Add a YouTube playlist
        </button>
      </div>
    )
  }

  return (
    <div className={`hero-playlist-dock ${dockState}`} ref={dockRef}>
      {/* Always rendered, so the stylesheet can hide the player before React
          has run rather than after. */}
      <button
        type="button"
        className="hero-playlist__toggle"
        onClick={() => setChoice(!(shown ?? true))}
        aria-expanded={shown ?? true}
        aria-label={shown === false ? 'Show the music player' : 'Hide the music player'}
        title={shown === false ? 'Show the music player' : 'Hide the music player'}
      >
        <svg className="hero-playlist__toggle-note" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9 18V6l10-2v12" />
          <circle cx="6.5" cy="18" r="2.5" />
          <circle cx="16.5" cy="16" r="2.5" />
        </svg>
        <svg className="hero-playlist__toggle-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m6 10 6 6 6-6" />
        </svg>
      </button>

      {picker}
      {playlist.youtubePlaylistId ? (
        // Keyed by the playlist, so switching to your own starts a fresh
        // player instead of showing the old track title until YouTube
        // catches up.
        <YouTubePlayer
          key={playlist.youtubePlaylistId}
          playlistId={playlist.youtubePlaylistId}
          name={playlist.name}
          onFullscreen={toggleFullscreen}
          isFullscreen={isFullscreen}
          canFullscreen={canFullscreen}
          onCustomise={togglePicker}
          customActive={Boolean(customId)}
          pickerOpen={picking}
        />
      ) : (
        <AudioPlayer
          playlist={playlist}
          onFullscreen={toggleFullscreen}
          isFullscreen={isFullscreen}
          canFullscreen={canFullscreen}
          onCustomise={togglePicker}
          customActive={false}
          pickerOpen={picking}
        />
      )}
    </div>
  )
}
