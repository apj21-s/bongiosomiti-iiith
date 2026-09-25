'use client'

import { useEffect, useRef } from 'react'

export default function PujaVideo() {
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    const video1El = hero.querySelector<HTMLVideoElement>('.events-scene__hero-video--1')
    const video2El = hero.querySelector<HTMLVideoElement>('.events-scene__hero-video--2')
    if (!video1El || !video2El) return
    const video1 = video1El
    const video2 = video2El

    ;[video1, video2].forEach((v) => {
      v.muted = true
      v.playsInline = true
      v.loop = false
      v.setAttribute('muted', '')
      v.setAttribute('playsinline', '')
      v.removeAttribute('loop')
    })

    let baseVideo = video1
    let topVideo = video2
    let isDissolving = false
    let isVisible = false
    let isLoaded = false
    const DISSOLVE_SEC = 0.4

    baseVideo.className = 'events-scene__hero-video events-scene__hero-video--1 is-hidden'
    topVideo.className = 'events-scene__hero-video events-scene__hero-video--2 is-hidden'

    function loadAndStartVideos() {
      if (isLoaded) return
      isLoaded = true
      ;[video1, video2].forEach((video) => {
        video.querySelectorAll('source').forEach((source) => {
          const src = (source as HTMLSourceElement).dataset.src
          if (src && !source.getAttribute('src')) source.src = src
        })
        video.load()
      })

      const onReady = () => {
        video1.removeEventListener('canplay', onReady)
        video1.removeEventListener('loadeddata', onReady)
        baseVideo.className = 'events-scene__hero-video events-scene__hero-video--1 is-base'
        topVideo.className = 'events-scene__hero-video events-scene__hero-video--2 is-hidden'
        if (isVisible) baseVideo.play().catch(() => {})
      }
      video1.addEventListener('canplay', onReady, { once: true })
      video1.addEventListener('loadeddata', onReady, { once: true })
      setTimeout(() => {
        if (baseVideo.classList.contains('is-hidden') && baseVideo.readyState >= 2) onReady()
      }, 300)
    }

    function triggerDissolve() {
      if (isDissolving || !isLoaded) return
      const dur = baseVideo.duration
      if (!dur || isNaN(dur) || dur <= 0) return
      const timeLeft = dur - baseVideo.currentTime
      if (timeLeft <= DISSOLVE_SEC && timeLeft > 0) {
        isDissolving = true
        topVideo.currentTime = 0
        topVideo.className = 'events-scene__hero-video is-hidden'
        void topVideo.offsetWidth
        topVideo.play().catch(() => {})
        topVideo.className = 'events-scene__hero-video is-top-fading-in'
        setTimeout(() => {
          baseVideo.pause()
          baseVideo.currentTime = 0
          baseVideo.className = 'events-scene__hero-video is-hidden'
          topVideo.className = 'events-scene__hero-video is-base'
          const oldBase = baseVideo
          baseVideo = topVideo
          topVideo = oldBase
          isDissolving = false
        }, Math.round(DISSOLVE_SEC * 1000) + 40)
      }
    }

    function onTimeUpdate(e: Event) {
      if (e.target === baseVideo && !isDissolving) triggerDissolve()
    }
    video1.addEventListener('timeupdate', onTimeUpdate)
    video2.addEventListener('timeupdate', onTimeUpdate)
    video1.addEventListener('ended', () => { if (baseVideo === video1 && !isDissolving) triggerDissolve() })
    video2.addEventListener('ended', () => { if (baseVideo === video2 && !isDissolving) triggerDissolve() })

    const preloadObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadAndStartVideos()
            obs.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '350px 0px' }
    )
    preloadObserver.observe(hero)

    const playbackObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting
          if (isVisible) {
            if (isLoaded && baseVideo.paused && baseVideo.readyState >= 2) baseVideo.play().catch(() => {})
          } else {
            if (isLoaded) {
              if (!baseVideo.paused) baseVideo.pause()
              if (!topVideo.paused) topVideo.pause()
            }
          }
        })
      },
      { threshold: 0.08 }
    )
    playbackObserver.observe(hero)

    return () => {
      preloadObserver.disconnect()
      playbackObserver.disconnect()
      video1.removeEventListener('timeupdate', onTimeUpdate)
      video2.removeEventListener('timeupdate', onTimeUpdate)
    }
  }, [])

  return (
    <div className="events-scene__hero" id="events-hero-player" ref={heroRef}>
      <img className="events-scene__hero-image events-scene__hero-poster" src="/assets/puja-poster.webp" alt="IIIT Bangiya Samiti Celebrations" />
      <video className="events-scene__hero-video events-scene__hero-video--1 is-hidden" preload="none" muted playsInline aria-label="IIIT Bangiya Samiti Celebrations">
        <source data-src="/assets/puja_final_boss.mp4" type="video/mp4" />
        <track kind="captions" src="/assets/captions.vtt" srcLang="en" label="English Captions" />
      </video>
      <video className="events-scene__hero-video events-scene__hero-video--2 is-hidden" preload="none" muted playsInline aria-hidden="true">
        <source data-src="/assets/puja_final_boss.mp4" type="video/mp4" />
        <track kind="captions" src="/assets/captions.vtt" srcLang="en" label="English Captions" />
      </video>
    </div>
  )
}
