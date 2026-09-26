'use client'

import { useEffect, useRef } from 'react'
import { REST, bandsFor, beatsPerSecondFor, easeLevel, targetLevel } from '@/utils/visualiser'

/**
 * The bars beside the song title, and the wide strip that fills the screen
 * around the video in fullscreen.
 *
 * It is not a spectrum analyser, and cannot be one: the music plays inside
 * YouTube's iframe, which is a different origin, so this page cannot read a
 * single sample of its audio. What it does instead is follow the song in the
 * ways that are actually observable from here.
 *
 *   - It is driven by the playback clock, not by wall time. The bars move only
 *     while the song moves, they hold where it pauses, and a seek carries them
 *     to a different part of the pattern.
 *   - Its shape is seeded from the song's own title, so two songs do not get
 *     the same dance, and the same song looks the same each time it plays.
 *   - A beat runs through every band at a tempo taken from that seed, with the
 *     low bands slow and broad and the high bands quick and small, which is how
 *     a real spectrum behaves.
 *   - Levels rise fast and fall slowly, the way a meter does, rather than
 *     sliding symmetrically in and out.
 *
 * Levels are written straight onto the elements from one rAF loop. React does
 * not re-render sixty times a second for a decoration.
 */

type Props = {
  /** Whether the song is playing; the bars settle when it is not. */
  playing: boolean
  /** Seconds into the song, so the pattern tracks seeks and stalls. */
  position: number
  /** Changes per song. The motion is derived from it. */
  seed: string
  bars?: number
  className?: string
}

export default function Equaliser({ playing, position, seed, bars = 5, className = '' }: Props) {
  const rootRef = useRef<HTMLSpanElement>(null)

  // The clock, kept in refs so the animation loop is not restarted four times
  // a second as the position is polled.
  const positionRef = useRef(position)
  const stampRef = useRef(0)
  const playingRef = useRef(playing)

  useEffect(() => {
    positionRef.current = position
    stampRef.current = performance.now()
  }, [position])

  useEffect(() => {
    playingRef.current = playing
  }, [playing])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const items = Array.from(root.children) as HTMLElement[]
    if (items.length === 0) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Fixed heights, no loop: an equaliser that is still an equaliser to look
    // at, for anyone who has asked not to be moved at.
    if (reduced) {
      const still = bandsFor(seed || 'bangiya', items.length)
      items.forEach((item, i) => {
        item.style.transform = `scaleY(${targetLevel(still[i], 0, 0).toFixed(3)})`
      })
      return
    }

    const song = seed || 'bangiya'
    const beatsPerSecond = beatsPerSecondFor(song)
    const shape = bandsFor(song, items.length)

    const levels = items.map(() => REST)
    let frame = 0

    const tick = () => {
      const now = performance.now()
      // Interpolated between position updates while playing, frozen otherwise.
      const clock = playingRef.current
        ? positionRef.current + (now - stampRef.current) / 1000
        : positionRef.current

      for (let i = 0; i < items.length; i += 1) {
        const target = playingRef.current ? targetLevel(shape[i], clock, beatsPerSecond) : REST
        levels[i] = easeLevel(levels[i], target)
        items[i].style.transform = `scaleY(${levels[i].toFixed(3)})`
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [bars, seed])

  return (
    <span className={`hero-playlist__eq ${playing ? 'is-playing' : ''} ${className}`} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  )
}
