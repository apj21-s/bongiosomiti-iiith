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
import { PRESET_PLAYLISTS, presetName } from '@/utils/data/preset-playlists'
import { type QueueItem } from './playlist-contents'
import buttonConfig from './radio-buttons.json'

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
 * One button cycles three modes, so the tooltip says where you are and what
 * the next press gives you - otherwise you have to click through all three to
 * find out which is which.
 */
const REPEAT_TIP: Record<RepeatMode, string> = {
  off: 'Repeat is off — click to repeat the whole playlist',
  all: 'Repeating the whole playlist — click to repeat just this song',
  one: 'Repeating this song — click to turn repeat off',
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
  cuePlaylist(playlist: string[], index?: number, startSeconds?: number): void
  loadPlaylist(playlist: string[], index?: number, startSeconds?: number): void
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
        onError?: (event: { data: number }) => void
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
  artwork?: string
  category?: string
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
  volume: number
  onVolume: (val: number) => void
  muted: boolean
  onMute: () => void
  children?: React.ReactNode
}

/** Complete reconstruction of the volume rocker control. */
function VolumeControl({ volume, onVolume, muted, onMute }: { volume: number; onVolume: (v: number) => void; muted: boolean; onMute: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null)

  const updateVolume = (clientY: number) => {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    // 14px thumb means we inset the usable track by ~7px top and bottom
    const padding = 7 
    const usableHeight = rect.height - padding * 2
    const y = Math.max(0, Math.min(clientY - rect.top - padding, usableHeight))
    const percentage = usableHeight > 0 ? 1 - (y / usableHeight) : 1
    onVolume(percentage)
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    updateVolume(e.clientY)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      updateVolume(e.clientY)
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let newVol = volume
    if (e.key === 'ArrowUp') newVol = Math.min(volume + 0.05, 1)
    else if (e.key === 'ArrowDown') newVol = Math.max(volume - 0.05, 0)
    else if (e.key === 'Home') newVol = 0
    else if (e.key === 'End') newVol = 1
    
    if (newVol !== volume) {
      e.preventDefault()
      e.stopPropagation()
      onVolume(newVol)
    }
  }

  return (
    <>
      <div
        ref={trackRef}
        className="vp-volume-rocker"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp} 
        onClick={(e) => e.stopPropagation()}
        role="slider"
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(volume * 100)}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        data-tip="Volume — drag the knob, or use the arrow keys"
        data-tip-pos="left"
        style={{ touchAction: 'none' }}
      >
        <div
          className="vp-volume-fill"
          style={{ height: `${volume * 100}%` }}
          aria-hidden="true"
        />
        <div
          className="vp-volume-thumb"
          style={{ top: `${(1 - volume) * 100}%` }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="vp-vol-thumb-icon">
            <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            {volume === 0 ? (
              <g></g>
            ) : volume <= 0.5 ? (
              <path d="M15.54 8.46a5 5 0 010 7.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            ) : (
              <>
                <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </>
            )}
          </svg>
        </div>
      </div>

      <button
        type="button"
        className={`vp-mute-btn ${muted || volume === 0 ? 'is-muted' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          onMute()
        }}
        aria-label={muted || volume === 0 ? 'Unmute audio' : 'Mute audio'}
        aria-pressed={muted || volume === 0}
        data-tip={muted || volume === 0 ? 'Unmute' : 'Mute'}
        data-tip-pos="left"
      >
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor"/>
          {(muted || volume === 0) ? (
            <>
              <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </>
          ) : volume <= 0.5 ? (
            <path d="M15.54 8.46a5 5 0 010 7.07" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          ) : (
            <>
              <path d="M15.54 8.46a5 5 0 010 7.07" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M19.07 4.93a10 10 0 010 14.14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </>
          )}
        </svg>
      </button>
    </>
  )
}

/** The visible control bar. Shared by both engines so they look identical. */
function PlayerBar({
  title,
  artist,
  artwork,
  category,
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
  volume,
  onVolume,
  muted,
  onMute,
  children,
}: BarProps) {
  const seekMax = duration > 0 ? duration : 0
  const progress = seekMax > 0 ? (currentTime / seekMax) * 100 : 0

  const titleWrapRef = useRef<HTMLDivElement>(null)
  const titleTextRef = useRef<HTMLSpanElement>(null)
  const [isTitleOverflowing, setIsTitleOverflowing] = useState(false)

  useEffect(() => {
    if (titleWrapRef.current && titleTextRef.current) {
      setIsTitleOverflowing(titleTextRef.current.scrollWidth > titleWrapRef.current.clientWidth)
    }
  }, [title])

  const handleProgressPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const track = e.currentTarget;
    const rect = track.getBoundingClientRect();
    
    const updateProgress = (clientX: number) => {
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percentage = x / rect.width;
      onSeek(percentage * seekMax);
    };
    
    updateProgress(e.clientX);
    
    const onPointerMove = (e: PointerEvent) => {
      updateProgress(e.clientX);
    };
    
    const onPointerUp = () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };
    
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  };



  return (
    <div
      className={`hero-playlist-vintage ${isPlaying ? 'is-playing' : ''} ${shuffle ? 'is-shuffle' : ''} ${repeat !== 'off' ? `is-repeat-${repeat}` : ''}`}
      role="group"
      aria-label="Vintage Festival Music Player"
    >
      {/* Base artwork layer */}
      <div className="vp-base-layer" aria-hidden="true">
        <img
          src="/assets/music player.png"
          alt=""
          className="vp-base-image"
        />
      </div>

      {/* Hidden video host for YouTube terms compliance */}
      <div className="vp-hidden-video" aria-hidden="true">{children}</div>

      {/* ── ALBUM ART ─────────────────────────────────────────────── */}
      <div className="vp-album-art-frame" aria-hidden="true">
        {artwork ? (
          <img src={artwork} alt="Album Art" className="vp-album-art-img" />
        ) : (
          <div className="vp-album-art-fallback">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="14" stroke="#7b1a13" strokeWidth="2" fill="none"/>
              <circle cx="20" cy="20" r="4" fill="#7b1a13"/>
              <circle cx="20" cy="20" r="8" stroke="#7b1a13" strokeWidth="1" fill="none" strokeDasharray="3 2"/>
              <path d="M26 14 L28 10 L32 12" stroke="#7b1a13" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="28" y1="10" x2="28" y2="18" stroke="#7b1a13" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        )}
      </div>

      {/* ── TRACK INFO ────────────────────────────────────────────── */}
      <div className="vp-track-info-block" aria-live="polite">
        <div className={`vp-title-scroll-wrap ${isTitleOverflowing ? 'is-marquee' : ''}`} ref={titleWrapRef}>
          <span className="vp-track-title" title={title} ref={titleTextRef}>{title}</span>
        </div>
        <span className="vp-track-meta">
          {[artist, category].filter(Boolean).join(' • ') || 'মহালয়ার গান • পূজার সুর'}
        </span>
      </div>

      {/* ── PROGRESS BAR ─────────────────────────────────────────── */}
      <div
        className="vp-progress-zone"
        onPointerDown={handleProgressPointerDown}
        role="slider"
        aria-label="Seek track"
        aria-valuemin={0}
        aria-valuemax={seekMax || 100}
        aria-valuenow={Math.floor(currentTime)}
        data-tip="Click or drag to scrub — arrow keys jump 5 seconds"
        data-tip-pos="top"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') onSeek(Math.min(currentTime + 5, seekMax))
          if (e.key === 'ArrowLeft') onSeek(Math.max(currentTime - 5, 0))
        }}
      >
        <div className="vp-progress-track">
          <div className="vp-progress-fill" style={{ width: `${progress}%` }} />
          <div className="vp-progress-thumb" style={{ left: `${progress}%` }} />
        </div>
      </div>

      {/* ── TIME DISPLAYS ─────────────────────────────────────────── */}
      <div className="vp-time-left" aria-label={`Current time: ${formatTime(currentTime)}`}>
        {formatTime(currentTime)}
      </div>
      <div className="vp-time-right" aria-label={`Duration: ${formatTime(seekMax)}`}>
        {formatTime(seekMax)}
      </div>

      {/* ── FIVE CONTROL BUTTONS ──────────────────────────────────── */}
      <div className="vp-ctrls" role="group" aria-label="Playback controls">

      {/* Button 1: Shuffle */}
      <div className="vp-ctrl-frame" style={{ left: `${buttonConfig.shuffle.left}%`, width: `${buttonConfig.shuffle.width}%`, height: `${buttonConfig.shuffle.height}%`, top: `${buttonConfig.shuffle.top}%` }}>
        <button
          type="button"
          className={`vp-ctrl-btn ${shuffle ? 'is-active' : ''}`}
          onClick={onShuffle}
          aria-label={shuffle ? 'Shuffle on – click to turn off' : 'Shuffle off – click to turn on'}
          data-tip={shuffle ? 'Shuffle is on — click to play in playlist order' : 'Shuffle — play the playlist in random order'}
          data-tip-pos="bottom"
          aria-pressed={shuffle}
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M16 3h5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4 20L21 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M21 16v5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M15 15l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M4 4l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          {shuffle && <span className="vp-ctrl-active-dot" aria-hidden="true" />}
        </button>
      </div>

      {/* Button 2: Previous */}
      <div className="vp-ctrl-frame" style={{ left: `${buttonConfig.prev.left}%`, width: `${buttonConfig.prev.width}%`, height: `${buttonConfig.prev.height}%`, top: `${buttonConfig.prev.top}%` }}>
        <button
          type="button"
          className="vp-ctrl-btn"
          onClick={onPrevious}
          disabled={disabled}
          aria-label="Previous track"
          data-tip="Previous song"
          data-tip-pos="bottom"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <polygon points="19,5 10,12 19,19" fill="currentColor"/>
            <rect x="5" y="5" width="3" height="14" rx="1" fill="currentColor"/>
          </svg>
        </button>
      </div>

      {/* Button 3: Play / Pause */}
      <div className="vp-ctrl-frame" style={{ left: `${buttonConfig.play.left}%`, width: `${buttonConfig.play.width}%`, height: `${buttonConfig.play.height}%`, top: `${buttonConfig.play.top}%` }}>
        <button
          type="button"
          className="vp-ctrl-btn"
          onClick={onToggle}
          disabled={disabled}
          aria-label={isPlaying ? 'Pause music' : 'Play music'}
          data-tip={isPlaying ? 'Pause' : 'Play'}
          data-tip-pos="bottom"
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="5" y="4" width="4" height="16" rx="1.5" fill="currentColor"/>
              <rect x="15" y="4" width="4" height="16" rx="1.5" fill="currentColor"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <polygon points="7,4 20,12 7,20" fill="currentColor"/>
            </svg>
          )}
        </button>
      </div>

      {/* Button 4: Next */}
      <div className="vp-ctrl-frame" style={{ left: `${buttonConfig.next.left}%`, width: `${buttonConfig.next.width}%`, height: `${buttonConfig.next.height}%`, top: `${buttonConfig.next.top}%` }}>
        <button
          type="button"
          className="vp-ctrl-btn"
          onClick={onNext}
          disabled={disabled}
          aria-label="Next track"
          data-tip="Next song"
          data-tip-pos="bottom"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <polygon points="5,5 14,12 5,19" fill="currentColor"/>
            <rect x="16" y="5" width="3" height="14" rx="1" fill="currentColor"/>
          </svg>
        </button>
      </div>

      {/* Button 5: Repeat */}
      <div className="vp-ctrl-frame" style={{ left: `${buttonConfig.repeat.left}%`, width: `${buttonConfig.repeat.width}%`, height: `${buttonConfig.repeat.height}%`, top: `${buttonConfig.repeat.top}%` }}>
        <button
          type="button"
          className={`vp-ctrl-btn vp-repeat-btn is-repeat-${repeat} ${repeat !== 'off' ? 'is-active' : ''}`}
          onClick={onRepeat}
          aria-label={REPEAT_LABEL[repeat]}
          aria-pressed={repeat !== 'off'}
          data-tip={REPEAT_TIP[repeat]}
          data-tip-pos="bottom"
        >
          {/* Three states, three glyphs, the way YouTube Music tells them apart:
              off is the bare loop struck through, all is the lit loop, and one
              is the lit loop with a 1 inside it. Colour alone was not enough to
              read off from all at this size. */}
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M17 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3 11V9a4 4 0 014-4h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M7 22l-4-4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M21 13v2a4 4 0 01-4 4H3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            {repeat === 'one' && (
              <text
                x="12"
                y="12"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="11"
                fontWeight="700"
                fill="currentColor"
                stroke="none"
              >
                1
              </text>
            )}
            {repeat === 'off' && (
              <path d="M4 20L20 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            )}
          </svg>
          {repeat !== 'off' && <span className="vp-ctrl-active-dot" aria-hidden="true" />}
        </button>
      </div>
      </div>

      {/* ── VOLUME ROCKER AND MUTE ──────────────────────────────────────── */}
      <VolumeControl volume={volume} onVolume={onVolume} muted={muted} onMute={onMute} />

      {/* ── HIDDEN VINTAGE SWITCHES (SLOTTED PANEL) ───────────────── */}
      <button
        type="button"
        className="vp-hidden-switch"
        onClick={onToggleQueue}
        aria-label="Toggle Queue"
        aria-expanded={queueOpen}
        data-tip="What's in this playlist — click any song to jump to it"
        data-tip-pos="left"
        style={{
          left: `${buttonConfig.switchTop.left}%`,
          top: `${buttonConfig.switchTop.top}%`,
          width: `${buttonConfig.switchTop.width}%`,
          height: `${buttonConfig.switchTop.height}%`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'absolute',
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke={buttonConfig.switchTop.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{
          filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.7)) drop-shadow(0px 0px 1px rgba(255,255,255,0.2))',
          width: `clamp(8px, 2.5cqi, ${buttonConfig.switchTop.iconSize ?? 20}px)`,
          height: `clamp(8px, 2.5cqi, ${buttonConfig.switchTop.iconSize ?? 20}px)`,
          display: 'block',
          flexShrink: 0,
          transform: `translate(${(buttonConfig.switchTop as any).iconOffsetX ?? 0}%, ${(buttonConfig.switchTop as any).iconOffsetY ?? 0}%)`,
        }}>
          <path d="M2 5H14" />
          <path d="M2 12H9" />
          <path d="M2 19H9" />
          <path d="M18 16V5C18 5 19 8.5 22 8.5M18 16C18 17.6569 16.6569 19 15 19C13.3431 19 12 17.6569 12 16C12 14.3431 13.3431 13 15 13C16.6569 13 18 14.3431 18 16Z" />
        </svg>
      </button>
      <button
        type="button"
        className="vp-hidden-switch"
        onClick={onCustomise}
        aria-label="Customise Playlist"
        aria-expanded={pickerOpen}
        data-tip="Change the playlist — pick one, or paste your own YouTube link"
        data-tip-pos="left"
        style={{
          left: `${buttonConfig.switchBottom.left}%`,
          top: `${buttonConfig.switchBottom.top}%`,
          width: `${buttonConfig.switchBottom.width}%`,
          height: `${buttonConfig.switchBottom.height}%`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'absolute',
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke={buttonConfig.switchBottom.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{
          filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.7)) drop-shadow(0px 0px 1px rgba(255,255,255,0.2))',
          width: `clamp(8px, 2.5cqi, ${buttonConfig.switchBottom.iconSize ?? 20}px)`,
          height: `clamp(8px, 2.5cqi, ${buttonConfig.switchBottom.iconSize ?? 20}px)`,
          display: 'block',
          flexShrink: 0,
          transform: `translate(${(buttonConfig.switchBottom as any).iconOffsetX ?? 0}%, ${(buttonConfig.switchBottom as any).iconOffsetY ?? 0}%)`,
        }}>
          <path d="M7 9.5C7 10.8807 5.88071 12 4.5 12C3.11929 12 2 10.8807 2 9.5C2 8.11929 3.11929 7 4.5 7C5.88071 7 7 8.11929 7 9.5ZM7 9.5V2C7.33333 2.5 7.6 4.6 10 5" />
          <circle cx="10.5" cy="19.5" r="2.5" />
          <circle cx="20" cy="18" r="2" />
          <path d="M13 19.5L13 11C13 10.09 13 9.63502 13.2466 9.35248C13.4932 9.06993 13.9938 9.00163 14.9949 8.86504C18.0085 8.45385 20.2013 7.19797 21.3696 6.42937C21.6498 6.24509 21.7898 6.15295 21.8949 6.20961C22 6.26627 22 6.43179 22 6.76283V17.9259" />
          <path d="M13 13C17.8 13 21 10.6667 22 10" />
        </svg>
      </button>

      {/* Fullscreen is not here. It belongs to the video, in the corner of the
          video, and lives in components/crossfade-video.tsx - this dock is a
          fixed overlay rendered from the layout, so it is not inside the hero
          the way the brass panel's placement implied. */}

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
  queueOpen,
  onToggleQueue,
  onPlayingChange,
}: {
  playlist: Playlist
  onFullscreen: () => void
  isFullscreen: boolean
  canFullscreen: boolean
  onCustomise: () => void
  customActive: boolean
  pickerOpen: boolean
  queueOpen: boolean
  onToggleQueue: () => void
  onPlayingChange?: (playing: boolean) => void
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

  useEffect(() => {
    onPlayingChange?.(isPlaying)
  }, [isPlaying, onPlayingChange])
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('off')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)
  // queueOpen is the parent's - see the pane state in HeroPlaylist.
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)

  // Sync volume to audio element when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
      audioRef.current.muted = muted
    }
  }, [volume, muted])

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
    <>
      {queueOpen && (
        <PlaylistContents
          queue={queue}
          queueIndex={index}
          onPlayAt={(i) => goTo(i, true)}
          onClose={onToggleQueue}
        />
      )}
      <PlayerBar
        title={failed ? 'Track unavailable' : track.title}
        artist={failed ? undefined : track.artist}
        artwork={track.artwork}
        category={playlist.name}
        isPlaying={isPlaying}
        shuffle={shuffle}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        onVolume={setVolume}
        muted={muted}
        onMute={() => setMuted(m => !m)}
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
        onToggleQueue={onToggleQueue}
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
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume)
          setMuted(e.currentTarget.muted)
        }}
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
    </>
  )
}

/**
 * The errors YouTube reports about one song rather than the whole playlist:
 * 100 is a video that has gone or been made private, 101 and 150 one whose
 * owner does not let it play on other sites. The rest of the playlist can
 * still play.
 */
const SONG_ERRORS = new Set([100, 101, 150])

/**
 * The nearest song to `from`, in the direction given, that is not refused. It
 * wraps round only when the playlist is on repeat, as YouTube's own next and
 * previous do, and is -1 when there is nothing left that way.
 */
function nextPlayable(list: string[], from: number, step: 1 | -1, wrap: boolean, refused: Set<string>) {
  for (let offset = 1; offset < list.length; offset++) {
    let index = from + step * offset
    if (wrap) index = (index + list.length) % list.length
    else if (index < 0 || index >= list.length) return -1
    if (!refused.has(list[index])) return index
  }
  return -1
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
  queueOpen,
  onToggleQueue,
  onPlayingChange,
}: {
  playlistId: string
  name: string
  onFullscreen: () => void
  isFullscreen: boolean
  canFullscreen: boolean
  onCustomise: () => void
  customActive: boolean
  pickerOpen: boolean
  queueOpen: boolean
  onToggleQueue: () => void
  onPlayingChange?: (playing: boolean) => void
}) {
  const mountId = useId().replace(/:/g, '')
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YouTubePlayerInstance | null>(null)

  const [ready, setReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  
  useEffect(() => {
    onPlayingChange?.(isPlaying)
  }, [isPlaying, onPlayingChange])

  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('off')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [title, setTitle] = useState(name)
  const [artist, setArtist] = useState<string | undefined>(undefined)
  const [error, setError] = useState(false)
  // queueOpen is the parent's - see the pane state in HeroPlaylist.
  // The video ids of what YouTube actually loaded, which is the only list of
  // the playlist's contents available without an API key. Songs YouTube will
  // not play here have already been taken out of what it loaded, so this is
  // only ever the songs that will play.
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

  // The same, for turning shuffle back on after the playlist is reloaded
  // without a refused song - loading a playlist turns YouTube's shuffle off.
  const shuffleRef = useRef(false)
  useEffect(() => {
    shuffleRef.current = shuffle
  }, [shuffle])

  // Whether the visitor wants music, which isPlaying cannot say: a song
  // YouTube refuses never starts, so nothing ever reports it as playing.
  const wantsPlayRef = useRef(false)
  // Which way they were going, so a refused song is stepped past rather than
  // bounced off - stepping back onto one lands on the song before it.
  const stepRef = useRef<1 | -1>(1)

  useEffect(() => {
    let cancelled = false
    // The playlist as YouTube first handed it over, in its owner's order.
    let original: string[] = []
    // The songs YouTube will not play here, found by asking ahead or by
    // trying one.
    const refused = new Set<string>()
    const checking = new AbortController()

    /**
     * Hands the player the playlist without its refused songs, carrying on
     * from `carryOn`: playing if `play`, and otherwise cued for when play is
     * pressed, because music never starts on its own.
     *
     * Everything that moves through the playlist - YouTube's own move to the
     * next song, shuffle, repeat, the buttons and the list - then only ever
     * sees songs that will play. The playlist on YouTube is untouched; this is
     * only what the player on this page was given.
     */
    const dropRefused = (carryOn: string | null, play: boolean, startSeconds = 0) => {
      const player = playerRef.current
      if (!player) return

      const kept = original.filter((id) => !refused.has(id))
      if (kept.length === 0) {
        // Every song in it is refused.
        setError(true)
        return
      }

      const index = carryOn ? Math.max(0, kept.indexOf(carryOn)) : 0
      if (play) {
        player.loadPlaylist(kept, index, startSeconds)
      } else {
        player.cuePlaylist(kept, index, startSeconds)
        wantsPlayRef.current = false
        setIsPlaying(false)
      }
      // In the owner's order above, so turning shuffle off later still puts
      // it back; turned on again here because the load turned it off.
      if (shuffleRef.current) player.setShuffle(true)
    }

    // Asks once, as soon as YouTube has handed over the playlist, which of its
    // songs will not play here, so they are gone before anybody presses play.
    const checkAhead = () => {
      fetchRefusedVideos(original, checking.signal).then((ids) => {
        const player = playerRef.current
        if (cancelled || !player || ids.length === 0) return
        // Every song refused is far more likely the check going wrong than a
        // playlist with nothing in it that plays. Left to the player, which
        // finds out song by song and says so if it is true.
        if (original.every((id) => ids.includes(id))) return
        ids.forEach((id) => refused.add(id))

        const list = player.getPlaylist?.() || []
        if (!list.some((id) => refused.has(id))) return

        const index = player.getPlaylistIndex?.() ?? -1
        const current = list[index]

        // Loading one of them now: YouTube is about to refuse it, and the
        // error handler drops the rest along with it.
        if (current && refused.has(current) && wantsPlayRef.current) return

        if (current && !refused.has(current)) {
          // Stays on the song it is on, at the point it has reached.
          dropRefused(current, wantsPlayRef.current, player.getCurrentTime() || 0)
          return
        }

        const next = index >= 0 ? nextPlayable(list, index, 1, repeatRef.current === 'all', refused) : -1
        dropRefused(next >= 0 ? list[next] : null, false)
      })
    }

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

      if (original.length === 0 && list.length > 0) {
        original = list.slice()
        checkAhead()
      }
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
              if (event.data === YT.PlayerState.PLAYING) {
                setIsPlaying(true)
                wantsPlayRef.current = true
              }
              if (event.data === YT.PlayerState.PAUSED) {
                setIsPlaying(false)
                wantsPlayRef.current = false
              }
              if (event.data === YT.PlayerState.ENDED) {
                // Left alone, YouTube moves on to the next video in the
                // playlist, so repeating one song means putting it back.
                if (repeatRef.current === 'one') playerRef.current?.seekTo(0, true)
                else setIsPlaying(false)
                // Moving on by itself is forward, whichever way the visitor
                // last stepped. Not reset on PLAYING: pressing previous twice
                // quickly can bring the first song's PLAYING after the second
                // press, which would turn a step back into a step forward.
                stepRef.current = 1
              }

              // A playlist advances on its own, so the title and length are
              // re-read on every transition rather than only when we ask.
              readMetadata()
            },
            onError: (event) => {
              if (cancelled) return
              const player = playerRef.current
              readMetadata()
              const list = player?.getPlaylist?.() || []
              const index = player?.getPlaylistIndex?.() ?? -1

              // Only a refused song can be left out. Anything else, or no
              // playlist loaded to carry on with, means the playlist itself
              // cannot be played here.
              if (!player || !SONG_ERRORS.has(event.data) || index < 0 || index >= list.length) {
                setError(true)
                return
              }

              // YouTube stops on a song it will not play rather than moving
              // on, which used to leave the whole playlist marked unavailable
              // because one song in it was. The song is dropped instead, and
              // the playlist carries on the way the visitor was going.
              refused.add(list[index])
              const loop = repeatRef.current === 'all'
              let next = nextPlayable(list, index, stepRef.current, loop, refused)
              // Nothing to step back to: carry on from where they were.
              if (next < 0 && stepRef.current < 0) next = nextPlayable(list, index, 1, loop, refused)

              // Nothing after it means the playlist has run out, as when its
              // last song ends: it is cued again from the top.
              dropRefused(next >= 0 ? list[next] : null, wantsPlayRef.current && next >= 0)
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
      checking.abort()
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

  // Sync volume to YouTube player when it changes
  useEffect(() => {
    const player = playerRef.current as any
    if (player && player.setVolume) {
      player.setVolume(volume * 100)
      if (muted) player.mute()
      else player.unMute()
    }
  }, [volume, muted, ready])

  const currentVideoId = videoIds[queueIndex]
  const artwork = currentVideoId ? `https://img.youtube.com/vi/${currentVideoId}/mqdefault.jpg` : undefined

  // Every control that moves to a song goes through here, so that if YouTube
  // refuses it, the error handler knows music was asked for and which way the
  // visitor was going.
  const changeSong = (step: 1 | -1, change: (player: YouTubePlayerInstance) => void) => {
    const player = playerRef.current
    if (!player) return
    wantsPlayRef.current = true
    stepRef.current = step
    change(player)
  }

  const playAt = (index: number) => changeSong(1, (player) => player.playVideoAt(index))

  return (
    <>
      {queueOpen && (
        <PlaylistContents
          queue={queue}
          queueIndex={queueIndex}
          onPlayAt={playAt}
          onClose={onToggleQueue}
        />
      )}
      <PlayerBar
        title={error ? 'Playlist unavailable' : title}
        artist={error ? undefined : artist}
        artwork={artwork}
        category={name}
        isPlaying={isPlaying}
        shuffle={shuffle}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        onVolume={setVolume}
        muted={muted}
        onMute={() => setMuted(m => !m)}
        disabled={!ready && !error}
        onToggle={() => {
          const player = playerRef.current
          if (!player) return
          if (isPlaying) player.pauseVideo()
          else changeSong(1, (current) => current.playVideo())
        }}
        onNext={() => changeSong(1, (player) => player.nextVideo())}
        onPrevious={() => {
          const player = playerRef.current
          if (!player) return
          // Match the audio engine: restart the song first, step back after.
          if (player.getCurrentTime() > 3) player.seekTo(0, true)
          else changeSong(-1, (current) => current.previousVideo())
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
      onToggleQueue={onToggleQueue}
      onPlayAt={playAt}
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
    </>
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
          placeholder="Enter Playlist URL"
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

import {
  fetchRefusedVideos,
  fetchVideoDetailsFor,
  isVideoId,
  type VideoDetails,
} from '@/utils/data/youtube-video'

const MAX_ROWS = 60

/**
 * The modal showing the current queue (tracks in the playlist).
 */
function PlaylistContents({
  queue,
  queueIndex,
  onPlayAt,
  onClose,
}: {
  queue: QueueItem[]
  queueIndex: number
  onPlayAt: (index: number) => void
  onClose: () => void
}) {
  const [details, setDetails] = useState<Record<string, VideoDetails>>({})

  useEffect(() => {
    const ids = queue
      .slice(0, MAX_ROWS)
      .map((item) => item.videoId)
      .filter(isVideoId)

    if (ids.length === 0) return

    const controller = new AbortController()

    fetchVideoDetailsFor(
      ids,
      (found) => {
        setDetails((current) => (current[found.id] ? current : { ...current, [found.id]: found }))
      },
      controller.signal
    )

    return () => controller.abort()
  }, [queue])

  const rows = queue.slice(0, MAX_ROWS)

  return (
    <div className="hero-playlist-picker vp-queue-modal">
      <div className="vp-queue-header">
        <span className="hero-playlist-picker__label">In this playlist</span>
        <span className="vp-queue-count">{queue.length}</span>
        <button type="button" className="hero-playlist-picker__link" onClick={onClose}>Close</button>
      </div>
      
      {rows.length === 0 ? (
        <p style={{ padding: '20px', textAlign: 'center', opacity: 0.8, color: '#3c2c1e' }}>
          Waiting for the playlist. If it does not appear, press play once.
        </p>
      ) : (
        <ol className="vp-queue-list">
          {rows.map((item, i) => {
            const found = item.videoId ? details[item.videoId] : undefined
            const label = item.title || found?.title || `Track ${i + 1}`
            const by = item.artist || found?.author

            return (
              <li key={`${item.videoId || 'track'}-${i}`} className={`vp-queue-item ${i === queueIndex ? 'is-playing' : ''}`}>
                <button type="button" className="vp-queue-btn" onClick={() => onPlayAt(i)}>
                  <span className="vp-queue-num">{i + 1}</span>
                  <svg className="vp-queue-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 3l14 9-14 9V3z" fill="currentColor"/>
                  </svg>
                  <span className="vp-queue-title">{label}</span>
                  {by && <span className="vp-queue-artist">{by}</span>}
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </div>
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
  /**
   * Which of the two panels is showing.
   *
   * They used to be separate booleans in separate components - the picker
   * here, the queue inside whichever player was mounted - so both could be
   * open together, stacked on each other over the same corner of the radio.
   * One value cannot hold two panels open, so the exclusion is structural
   * rather than something each toggle has to remember to enforce.
   */
  const [pane, setPane] = useState<'none' | 'picker' | 'queue'>('none')
  const picking = pane === 'picker'

  const setPicking = (open: boolean) => setPane(open ? 'picker' : 'none')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const dockRef = useRef<HTMLDivElement>(null)

  const screen = useSyncExternalStore(subscribeToScreen, readScreen, screenUnknownOnTheServer)

  const [choice, setChoice] = useState<boolean | null>(null)
  // Closed until asked for. The player used to open itself the moment the
  // screen size was known, which put a radio across the middle of the page
  // before anyone had asked to hear anything. The small tile at the bottom
  // left is the resting state; clicking it brings the full player up.
  const shown = choice ?? (screen === null ? null : false)
  const dockState = shown === null ? '' : shown ? 'is-open' : 'is-shut'

  const [isAnyPlaying, setIsAnyPlaying] = useState(false)
  const [hasScrolled, setHasScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setHasScrolled(window.scrollY > 500)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!shown) return

    let startY = window.scrollY
    let isActive = false

    const timer = setTimeout(() => {
      isActive = true
      startY = window.scrollY // Reset baseline after they finish opening it
    }, 500)

    const onScroll = () => {
      if (isActive && Math.abs(window.scrollY - startY) > 200) {
        setChoice(false)
      }
    }
    
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
    }
  }, [shown])

  useEffect(() => {
    const onToggle = () => setChoice(!shown)
    // Leaving fullscreen takes the player down with the video: the screen's
    // own minimise button means "put all of this away", while a click anywhere
    // else only closes the player and leaves the video full screen.
    const onClose = () => setChoice(false)
    window.addEventListener('toggle-vintage-player', onToggle)
    window.addEventListener('close-vintage-player', onClose)
    return () => {
      window.removeEventListener('toggle-vintage-player', onToggle)
      window.removeEventListener('close-vintage-player', onClose)
    }
  }, [shown])

  // Lets anything outside this component know the full player is up - the tile
  // drawn over the video hides itself on it, so the two sizes are never both
  // on screen at once.
  useEffect(() => {
    document.documentElement.classList.toggle('is-player-open', shown === true)
    return () => document.documentElement.classList.remove('is-player-open')
  }, [shown])

  useEffect(() => {
    if (shown) {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setChoice(false)
      }
      window.addEventListener('keydown', onKey)
      return () => {
        window.removeEventListener('keydown', onKey)
      }
    }
  }, [shown])

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

  const togglePicker = () => setPane((open) => (open === 'picker' ? 'none' : 'picker'))
  const toggleQueue = () => setPane((open) => (open === 'queue' ? 'none' : 'queue'))

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
  /**
   * The minimised player: always there, always the bottom left, and only
   * hidden while the full player is up - the two are the same thing in two
   * sizes, so showing both at once says there are two players.
   *
   * It used to wait for a 500px scroll and for something to already be
   * playing, which meant the only way to start the music was to open the full
   * player first, and there was nothing to click if you had not scrolled.
   */
  const showLauncher = shown === false

  // Nothing configured and nothing chosen. The button is then the whole
  // player, rather than there being no way in at all - which is what used to
  // happen, because the homepage did not render this component without a
  // playlist to hand it.
  if (!playlist) {
    return (
      <>
        {showLauncher && (
          <button
            type="button"
            className="vintage-launcher"
            onClick={() => {
              setChoice(!shown);
              if (!shown) setPicking(true);
            }}
            aria-label="Add a YouTube playlist"
            data-tip="Add a YouTube playlist to play here"
            data-tip-pos="top"
          >
            <img src="/assets/music%20thumbnail.png" alt="Pujor Gaan" />
            <span className="vintage-launcher-label">Add Music</span>
          </button>
        )}

        <div className={`hero-playlist-dock ${dockState}`} ref={dockRef}>
          <div className="vp-modal-content">
            {picker}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {showLauncher && (
        <button
          type="button"
          className="vintage-launcher"
          onClick={() => setChoice(!shown)}
          aria-label={shown ? "Close Music Player" : "Open Music Player"}
          data-tip={shown ? 'Hide the music player' : 'Show the music player'}
          data-tip-pos="top"
        >
          <img src="/assets/music%20thumbnail.png" alt="Pujor Gaan" />
          <span className="vintage-launcher-label">Pujor Gaan</span>
        </button>
      )}

      <div className={`hero-playlist-dock ${dockState}`} ref={dockRef}>
        {/* Click outside to close */}
        {shown && (
          <div
            className="vp-dock-backdrop"
            onClick={() => setChoice(false)}
            aria-hidden="true"
          />
        )}
        <div className="vp-modal-content">
          {picker}
          {playlist.youtubePlaylistId ? (
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
              queueOpen={pane === 'queue'}
              onToggleQueue={toggleQueue}
              onPlayingChange={setIsAnyPlaying}
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
              queueOpen={pane === 'queue'}
              onToggleQueue={toggleQueue}
              onPlayingChange={setIsAnyPlaying}
            />
          )}
        </div>
      </div>
    </>
  )
}
