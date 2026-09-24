'use client'

import { useEffect, useRef, useState } from 'react'

export default function CrossfadeVideo() {
  const video1Ref = useRef<HTMLVideoElement>(null)
  const video2Ref = useRef<HTMLVideoElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [activeVideo, setActiveVideo] = useState<1 | 2>(1)
  const [fadingInVideo, setFadingInVideo] = useState<1 | 2 | null>(null)
  
  const isTransitioningRef = useRef(false)
  
  useEffect(() => {
    const video1 = video1Ref.current
    const video2 = video2Ref.current
    if (!video1 || !video2) return

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
        }
      })
    }, { rootMargin: "200px" })

    observer.observe(video1)
    
    return () => observer.disconnect()
  }, [isLoaded])

  // Call load() and play() only AFTER isLoaded is true and the DOM has updated
  useEffect(() => {
    if (!isLoaded) return
    const video1 = video1Ref.current
    const video2 = video2Ref.current
    if (!video1 || !video2) return

    const onReady = () => {
      video1.play().catch(() => {})
    }
    video1.addEventListener("canplay", onReady, { once: true })
    
    video1.load()
    video2.load()
  }, [isLoaded])
  
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget
    if (isTransitioningRef.current) return
    
    const dur = video.duration
    if (!dur || isNaN(dur) || dur <= 0) return
    
    const FADE_DURATION = 1.0 // 1.0 seconds crossfade for seamless loop
    const timeLeft = dur - video.currentTime
    
    // Begin crossfade BEFORE the video ends
    if (timeLeft <= FADE_DURATION && timeLeft > 0) {
      isTransitioningRef.current = true
      
      const nextVideoId = activeVideo === 1 ? 2 : 1
      const nextVideo = nextVideoId === 1 ? video1Ref.current : video2Ref.current
      if (!nextVideo) return
      
      // Prepare and play the next video underneath/on top
      nextVideo.currentTime = 0
      nextVideo.play().catch(() => {})
      
      setFadingInVideo(nextVideoId)
      
      // Wait for the fade to complete before cleaning up the old video
      setTimeout(() => {
        setActiveVideo(nextVideoId)
        setFadingInVideo(null)
        video.pause()
        video.currentTime = 0
        isTransitioningRef.current = false
      }, FADE_DURATION * 1000)
    }
  }

  // Calculate inline styles based on crossfade state
  const getStyleForVideo = (videoId: 1 | 2) => {
    const isFadingIn = fadingInVideo === videoId
    const isActive = activeVideo === videoId
    
    let opacity = 0
    let zIndex = 0
    
    if (isFadingIn) {
      opacity = 1
      zIndex = 2
    } else if (isActive) {
      opacity = 1
      zIndex = 1
    } else {
      opacity = 0
      zIndex = 0
    }
    
    return {
      opacity,
      zIndex,
      transition: isFadingIn ? 'opacity 1s linear' : 'none'
    }
  }

  return (
    <>
      <video
        ref={video1Ref}
        className="events-scene__hero-video"
        style={getStyleForVideo(1)}
        preload="none"
        muted
        playsInline
        onTimeUpdate={handleTimeUpdate}
        aria-label="Bengali Puja Courtyard Celebration"
      >
        {isLoaded && (
          <>
            <source src="/assets/Animate_Bengali_Puja_courtyard_opt.webm" type="video/webm" />
            <source src="/assets/Animate_Bengali_Puja_courtyard_opt_small.mp4" type="video/mp4" />
            <track kind="captions" src="/assets/captions.vtt" srcLang="en" label="English Captions" />
          </>
        )}
      </video>
      <video
        ref={video2Ref}
        className="events-scene__hero-video"
        style={getStyleForVideo(2)}
        preload="none"
        muted
        playsInline
        onTimeUpdate={handleTimeUpdate}
        aria-hidden="true"
      >
        {isLoaded && (
          <>
            <source src="/assets/Animate_Bengali_Puja_courtyard_opt.webm" type="video/webm" />
            <source src="/assets/Animate_Bengali_Puja_courtyard_opt_small.mp4" type="video/mp4" />
            <track kind="captions" src="/assets/captions.vtt" srcLang="en" label="English Captions" />
          </>
        )}
      </video>
    </>
  )
}

