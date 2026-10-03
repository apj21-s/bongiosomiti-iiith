'use client'

import { useEffect, useRef } from 'react'

/**
 * Announced on window once the hero video is downloaded in full and playing.
 * The site's loading screen waits for it - see utsav-loader.tsx.
 */
export const HERO_VIDEO_READY = 'hero-video-ready'

const MP4 = '/assets/apu-durga-loop.mp4'
const WEBM = '/assets/apu-durga-loop.webm'

/**
 * The moving painting at the foot of the hero: Apu and Durga in the kash
 * flowers, watching the train go by.
 *
 * The file is a 2.4-second loop cut from the uploaded Apu_Durga.mp4 so that its
 * last frame runs straight into its first - the smoke and the grass carry on
 * rather than jumping back - and it has no sound track, because it is scenery.
 * H.264 where the browser plays it, which is every mainstream one; the VP9 copy
 * is for the builds that ship without it.
 *
 * It is never off. The whole file is downloaded before it starts and played
 * from memory, so a loop cannot stall on the network; the loading screen stays
 * up until it is playing; and if the browser pauses it - a tab coming back
 * into view, the system interrupting - it is started again. Until then the
 * poster, its own first frame, is what shows, so there is never a blank.
 *
 * Started from here rather than with autoPlay: React does not put the muted
 * attribute into the markup, and a browser will not start a video it thinks
 * has sound.
 */
export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let stopped = false
    let objectUrl: string | null = null
    const download = new AbortController()

    const announce = () => {
      if (video.dataset.ready) return
      video.dataset.ready = 'true'
      window.dispatchEvent(new Event(HERO_VIDEO_READY))
    }

    const keepPlaying = () => {
      if (stopped || document.hidden) return
      video.muted = true
      video.play().catch(() => {
        // Refused (a power saver, say): the poster stays on screen.
      })
    }

    const start = async () => {
      const file = video.canPlayType('video/mp4; codecs="avc1.640028"') ? MP4 : WEBM

      try {
        const response = await fetch(file, { signal: download.signal })
        if (!response.ok) throw new Error(`${response.status}`)
        const blob = await response.blob()
        if (stopped) return
        objectUrl = URL.createObjectURL(blob)
        video.src = objectUrl
      } catch {
        if (stopped) return
        // Could not hold it in memory; stream it instead.
        video.src = file
      }

      video.muted = true
      try {
        await video.play()
      } catch {
        // It will not start here, so there is nothing to wait for: the poster
        // shows instead, and the page should not sit behind the loader.
        announce()
        return
      }

      // The first time the clock moves, frames are reaching the screen.
      video.addEventListener('timeupdate', announce, { once: true })
    }

    video.addEventListener('pause', keepPlaying)
    document.addEventListener('visibilitychange', keepPlaying)
    start()

    return () => {
      stopped = true
      download.abort()
      video.removeEventListener('pause', keepPlaying)
      video.removeEventListener('timeupdate', announce)
      document.removeEventListener('visibilitychange', keepPlaying)
      video.pause()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [])

  return (
    <video
      ref={videoRef}
      className="home-hero__image home-hero__image--landscape"
      data-hero-video=""
      poster="/assets/apu-durga-poster.webp"
      width={1920}
      height={1080}
      muted
      loop
      playsInline
      preload="none"
      disablePictureInPicture
      aria-hidden="true"
    />
  )
}
