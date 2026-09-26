'use client'

import { useEffect, useRef, useState } from 'react'

export default function CrossfadeVideo() {
  const video1Ref = useRef<HTMLVideoElement>(null)
  const video2Ref = useRef<HTMLVideoElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [activeVideo, setActiveVideo] = useState<1 | 2>(1)
  const [fadingInVideo, setFadingInVideo] = useState<1 | 2 | null>(null)
  const [isMicOn, setIsMicOn] = useState(false)
  const [hasClicked, setHasClicked] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  
  const isTransitioningRef = useRef(false)
  
  useEffect(() => {
    if (audioRef.current) {
      if (isMicOn) {
        audioRef.current.play().catch(() => {})
      } else {
        audioRef.current.pause()
      }
    }
  }, [isMicOn])
  
  useEffect(() => {
    const video1 = video1Ref.current
    const video2 = video2Ref.current
    if (!video1 || !video2) return

    // Ensure playsInline
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
      <style>{`
        .chonga-mic-container {
          position: absolute;
          top: -4.5%;
          left: 41.5%;
          width: 13%;
          z-index: 10;
          cursor: pointer;
          transform-origin: bottom center;
          transition: transform 0.2s ease;
        }
        @media (max-width: 1024px) {
          .chonga-mic-container {
            top: 5%;
            left: 38%;
            width: 15%;
          }
        }
        @media (max-width: 768px) {
          .chonga-mic-container {
            top: 15%;
            left: 32%;
            width: 18%;
          }
        }
        @media (max-width: 480px) {
          .chonga-mic-container {
            top: -18%;
            left: 35%;
            width: 28%;
          }
          .mic-tooltip {
            top: -16px;
            font-size: 10px;
            letter-spacing: 0.2px;
            transform: translateX(-50%) scale(0.45);
            transform-origin: bottom center;
          }
        }
        @media (hover: hover) {
          .chonga-mic-container:hover {
            transform: scale(1.05) rotate(-5deg);
          }
        }
        .chonga-mic-container.is-on {
          transform: scale(1.05) rotate(-5deg);
        }
        .chonga-mic-img {
          width: 100%;
          height: auto;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4));
        }
        .sound-waves {
          position: absolute;
          top: 35%;
          right: -30%;
          width: 50%;
          height: 50%;
          pointer-events: none;
          opacity: 0;
        }
        .sound-waves.is-on {
          opacity: 1;
        }
        .wave {
          position: absolute;
          border: 3px solid #fff;
          border-radius: 50%;
          border-left-color: transparent;
          border-top-color: transparent;
          border-bottom-color: transparent;
          top: 50%;
          left: 0;
          transform: translateY(-50%) rotate(-20deg);
          animation: wave-emit 1.5s infinite linear;
          opacity: 0;
        }
        .sound-waves.is-left .wave {
          left: auto;
          right: 0;
          transform: translateY(-50%) rotate(-20deg) scaleX(-1);
          animation: wave-emit-left 1.5s infinite linear;
        }
        
        .wave:nth-child(1) { width: 100%; height: 100%; animation-delay: 0s; }
        .wave:nth-child(2) { width: 150%; height: 150%; animation-delay: 0.5s; }
        .wave:nth-child(3) { width: 200%; height: 200%; animation-delay: 1.0s; }
        
        @keyframes wave-emit {
          0% { opacity: 0; transform: translateY(-50%) rotate(-20deg) scale(0.5); }
          20% { opacity: 0.8; }
          100% { opacity: 0; transform: translateY(-50%) rotate(-20deg) scale(1.5); }
        }
        @keyframes wave-emit-left {
          0% { opacity: 0; transform: translateY(-50%) rotate(-20deg) scaleX(-1) scale(0.5); }
          20% { opacity: 0.8; }
          100% { opacity: 0; transform: translateY(-50%) rotate(-20deg) scaleX(-1) scale(1.5); }
        }
        
        .mic-tooltip {
          position: absolute;
          top: -24px;
          left: 50%;
          transform: translateX(-50%);
          
          --shimmer-dur: 2000ms;
          --shimmer-base: rgba(255, 230, 194, 0.7);
          --shimmer-highlight: #ffffff;
          --shimmer-band: 400%;
          --shimmer-ease: linear;
          
          color: var(--shimmer-base);
          display: inline-block;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          text-shadow: 0 2px 4px rgba(0,0,0,0.8);
          white-space: nowrap;
          pointer-events: none;
          opacity: 0.95;
          transition: opacity 0.5s ease;
        }
        .mic-tooltip::before {
          content: attr(data-text);
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: linear-gradient(
            90deg,
            transparent          0%,
            transparent         40%,
            var(--shimmer-highlight) 50%,
            transparent         60%,
            transparent        100%
          );
          background-size: var(--shimmer-band) 100%;
          background-repeat: no-repeat;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          text-shadow: none;
          animation: t-shimmer var(--shimmer-dur) var(--shimmer-ease) infinite;
        }
        
        .mic-tooltip.is-hidden {
          opacity: 0;
        }
        
        @keyframes t-shimmer {
          0%   { background-position: 100% 0; }
          100% { background-position: 0% 0; }
        }
      `}</style>
      
      <div 
        className={`chonga-mic-container ${isMicOn ? 'is-on' : ''}`} 
        onClick={() => {
          setIsMicOn(prev => !prev)
          setHasClicked(true)
        }}
        aria-label="Toggle Event Audio"
      >
        <div className={`mic-tooltip ${hasClicked ? 'is-hidden' : ''}`} data-text="CLICK TO PLAY MAHALAYA">CLICK TO PLAY MAHALAYA</div>
        <img src="/assets/mic.png" alt="Chonga Mic" className="chonga-mic-img" />
        <div className={`sound-waves ${isMicOn ? 'is-on' : ''}`}>
          <div className="wave"></div>
          <div className="wave"></div>
          <div className="wave"></div>
        </div>
        <div className={`sound-waves is-left ${isMicOn ? 'is-on' : ''}`} style={{ left: '-30%', right: 'auto' }}>
          <div className="wave"></div>
          <div className="wave"></div>
          <div className="wave"></div>
        </div>
      </div>

      <audio ref={audioRef} src="/assets/mahalaya_audio.mp3" loop preload="none" />

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
            <source src="/assets/puja_final_boss.mp4" type="video/mp4" />
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
            <source src="/assets/puja_final_boss.mp4" type="video/mp4" />
            <track kind="captions" src="/assets/captions.vtt" srcLang="en" label="English Captions" />
          </>
        )}
      </video>
    </>
  )
}

