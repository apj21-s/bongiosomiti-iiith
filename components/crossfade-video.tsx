'use client'

import { useEffect, useRef, useState } from 'react'

export default function CrossfadeVideo() {
  const video1Ref = useRef<HTMLVideoElement>(null)
  const video2Ref = useRef<HTMLVideoElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [activeVideo, setActiveVideo] = useState<1 | 2>(1)
  const [isDissolving, setIsDissolving] = useState(false)
  
  useEffect(() => {
    const video1 = video1Ref.current
    const video2 = video2Ref.current
    if (!video1 || !video2) return

    const DISSOLVE_SEC = 0.4

    // Ensure muted, playsInline
    video1.muted = true
    video2.muted = true
    video1.playsInline = true
    video2.playsInline = true
    
    // Intersection Observer to trigger load
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !isLoaded) {
          setIsLoaded(true)
          const onReady = () => {
            video1.play().catch(() => {})
          }
          video1.addEventListener("canplay", onReady, { once: true })
          
          if (!video1.src) video1.src = "/assets/Animate_Bengali_Puja_courtyard_opt_small.mp4"
          if (!video2.src) video2.src = "/assets/Animate_Bengali_Puja_courtyard_opt_small.mp4"
          
          video1.load()
          video2.load()
        }
      })
    }, { rootMargin: "200px" })

    observer.observe(video1)
    
    return () => observer.disconnect()
  }, [isLoaded])
  
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget
    if (isDissolving) return
    
    const dur = video.duration
    if (!dur || isNaN(dur) || dur <= 0) return
    
    const timeLeft = dur - video.currentTime
    if (timeLeft <= 0.4 && timeLeft > 0) {
      setIsDissolving(true)
      
      const nextVideo = activeVideo === 1 ? video2Ref.current : video1Ref.current
      if (!nextVideo) return
      
      nextVideo.currentTime = 0
      nextVideo.play().catch(() => {})
      
      setActiveVideo(activeVideo === 1 ? 2 : 1)
      
      setTimeout(() => {
        video.pause()
        video.currentTime = 0
        setIsDissolving(false)
      }, 440)
    }
  }

  return (
    <>
      <video
        ref={video1Ref}
        className={`events-scene__hero-video events-scene__hero-video--1 ${
          activeVideo === 1
            ? 'is-base'
            : isDissolving ? 'is-hidden' : 'is-hidden'
        } ${isDissolving && activeVideo === 1 ? 'is-top-fading-in' : ''}`}
        preload="none"
        muted
        playsInline
        onTimeUpdate={handleTimeUpdate}
      />
      <video
        ref={video2Ref}
        className={`events-scene__hero-video events-scene__hero-video--2 ${
          activeVideo === 2
            ? 'is-base'
            : isDissolving ? 'is-hidden' : 'is-hidden'
        } ${isDissolving && activeVideo === 2 ? 'is-top-fading-in' : ''}`}
        preload="none"
        muted
        playsInline
        onTimeUpdate={handleTimeUpdate}
      />
    </>
  )
}
