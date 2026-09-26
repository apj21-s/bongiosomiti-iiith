'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import './hero-playlist.css'
import type { Playlist } from '@/utils/data/playlists'

/**
 * Music player overlaid on the events video on the homepage.
 *
 * The video itself is untouched and stays muted; this is a separate <audio>
 * element sitting on top of it. Nothing is downloaded until the visitor presses
 * play (preload="none"), and playback never starts on its own - browsers block
 * autoplaying audio, and it would be rude besides.
 */

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  return `${minutes}:${String(total % 60).padStart(2, '0')}`
}

export default function HeroPlaylist({ playlists }: { playlists: Playlist[] }) {
  // One playlist drives the hero. Extra playlists stay in the data file for a
  // future selector rather than being silently concatenated.
  const tracks = playlists[0]?.tracks ?? []

  const audioRef = useRef<HTMLAudioElement>(null)
  // Where shuffle has already been, so "previous" retraces the actual path
  // instead of jumping somewhere new.
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
    while (candidate === index) {
      candidate = Math.floor(Math.random() * tracks.length)
    }
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

    const previousIndex = shuffle
      ? historyRef.current.pop()
      : (index - 1 + tracks.length) % tracks.length

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
      // Blocked or undecodable: leave the control in its paused state rather
      // than pretending the song is running.
      setIsPlaying(false)
    }
  }, [isPlaying])

  // Resume across a track change, once the new source is attached.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !resumeRef.current) return

    resumeRef.current = false
    audio.play().then(
      () => setIsPlaying(true),
      () => setIsPlaying(false)
    )
  }, [index])

  if (!track) return null

  const seekMax = duration > 0 ? duration : 0
  const progress = seekMax > 0 ? (currentTime / seekMax) * 100 : 0

  return (
    <div className="hero-playlist" role="group" aria-label="Festival music player">
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

      <div className="hero-playlist__controls">
        <button
          type="button"
          className="hero-playlist__btn"
          onClick={previous}
          aria-label="Previous track"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M7 6v12" />
            <path d="M18 6.5v11a.6.6 0 0 1-.94.5l-8-5.5a.6.6 0 0 1 0-1l8-5.5a.6.6 0 0 1 .94.5Z" />
          </svg>
        </button>

        <button
          type="button"
          className="hero-playlist__btn hero-playlist__btn--play"
          onClick={toggle}
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

        <button
          type="button"
          className="hero-playlist__btn"
          onClick={next}
          aria-label="Next track"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M17 6v12" />
            <path d="M6 6.5v11a.6.6 0 0 0 .94.5l8-5.5a.6.6 0 0 0 0-1l-8-5.5a.6.6 0 0 0-.94.5Z" />
          </svg>
        </button>

        <button
          type="button"
          className={`hero-playlist__btn hero-playlist__btn--shuffle ${shuffle ? 'is-on' : ''}`}
          onClick={() => setShuffle((on) => !on)}
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
          <span className="hero-playlist__title" title={track.title}>
            {failed ? 'Track unavailable' : track.title}
          </span>
          {track.artist && !failed && (
            <span className="hero-playlist__artist" title={track.artist}>
              {track.artist}
            </span>
          )}
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
            onChange={(e) => {
              const audio = audioRef.current
              const value = Number(e.currentTarget.value)
              setCurrentTime(value)
              if (audio) audio.currentTime = value
            }}
          />
          <span className="hero-playlist__time">
            {formatTime(currentTime)} / {formatTime(seekMax)}
          </span>
        </div>
      </div>
    </div>
  )
}
