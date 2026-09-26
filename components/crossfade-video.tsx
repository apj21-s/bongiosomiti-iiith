'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

// Unlock time: October 10, 2026 at 4:29 AM IST (UTC+5:30)
// IST = UTC + 5h30m, so 4:29 AM IST = 10 Oct 2026 22:59:00 UTC (previous day)
const UNLOCK_TIME = new Date('2026-10-09T23:00:00Z') // 4:30 AM IST Oct 10

function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number
    hours: number
    minutes: number
    seconds: number
    isUnlocked: boolean
  } | null>(null) // null until mounted to avoid hydration mismatch

  useEffect(() => {
    const calc = () => {
      const diff = targetDate.getTime() - Date.now()
      if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, isUnlocked: true }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      return { days, hours, minutes, seconds, isUnlocked: false }
    }
    setTimeLeft(calc())
    const id = setInterval(() => setTimeLeft(calc()), 1000)
    return () => clearInterval(id)
  }, [targetDate])

  return timeLeft
}

// Animated single number digit that slides in/out
function AnimatedNumber({ value }: { value: string }) {
  return (
    <span style={{ position: 'relative', display: 'inline-grid', minWidth: '1.1ch', placeItems: 'center' }}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: 10, opacity: 0, filter: 'blur(4px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: -10, opacity: 0, filter: 'blur(4px)' }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          style={{ display: 'block' }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

function MicCountdown({ days, hours, minutes, seconds }: { days: number; hours: number; minutes: number; seconds: number }) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const units = days > 0
    ? [{ label: 'days', val: pad(days) }, { label: 'hrs', val: pad(hours) }, { label: 'min', val: pad(minutes) }, { label: 'sec', val: pad(seconds) }]
    : [{ label: 'hrs', val: pad(hours) }, { label: 'min', val: pad(minutes) }, { label: 'sec', val: pad(seconds) }]

  return (
    <div className="mic-countdown-block">
      {units.map((u, i) => (
        <>
          <div key={u.label} className="mic-cd-unit">
            <span className="mic-cd-num">
              {u.val.split('').map((ch, ci) => (
                <AnimatedNumber key={ci} value={ch} />
              ))}
            </span>
            <span className="mic-cd-label">{u.label}</span>
          </div>
          {i < units.length - 1 && <span key={`sep-${i}`} className="mic-cd-sep">:</span>}
        </>
      ))}
    </div>
  )
}

export default function CrossfadeVideo() {
  const video1Ref = useRef<HTMLVideoElement>(null)
  const video2Ref = useRef<HTMLVideoElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [activeVideo, setActiveVideo] = useState<1 | 2>(1)
  const [fadingInVideo, setFadingInVideo] = useState<1 | 2 | null>(null)
  const [isMicOn, setIsMicOn] = useState(false)
  const [hasClicked, setHasClicked] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const countdown = useCountdown(UNLOCK_TIME)
  
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

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <>
      <style>{`
        .chonga-mic-container {
          position: absolute;
          top: -4.5%;
          left: 41.5%;
          width: 13%;
          z-index: 10;
          transform-origin: bottom center;
          transition: transform 0.2s ease;
        }
        .chonga-mic-container.is-unlocked {
          cursor: pointer;
        }
        .chonga-mic-container.is-locked {
          cursor: not-allowed;
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
          .chonga-mic-container.is-unlocked:hover {
            transform: scale(1.05) rotate(-5deg);
          }
        }
        .chonga-mic-container.is-on {
          transform: scale(1.05) rotate(-5deg);
        }
        
        /* Lock overlay */
        .mic-lock-icon {
          position: absolute;
          top: 52%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 18%;
          height: auto;
          z-index: 3;
          pointer-events: none;
          opacity: 0.9;
        }
        
        /* Locked mic image */
        .chonga-mic-img {
          width: 100%;
          height: auto;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4));
          transition: filter 0.4s ease;
        }
        .chonga-mic-container.is-locked .chonga-mic-img {
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4)) grayscale(1) brightness(0.75);
        }
        
        /* Countdown display */
        .mic-countdown-block {
          position: absolute;
          top: -45px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 4px;
          pointer-events: none;
          white-space: nowrap;
        }
        .mic-cd-unit {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: rgba(10, 5, 0, 0.55);
          border: 1px solid rgba(255, 220, 160, 0.2);
          border-radius: 8px;
          padding: 5px 7px 4px;
          backdrop-filter: blur(6px);
          min-width: 34px;
          gap: 3px;
          overflow: hidden;
        }
        .mic-cd-num {
          font-family: 'Courier New', monospace;
          font-size: 14px;
          font-weight: 700;
          color: #ffe6c2;
          letter-spacing: 2px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .mic-cd-label {
          /* 6px was not readable on anything. */
          font-size: 9px;
          font-weight: 600;
          color: rgba(255, 220, 160, 0.5);
          text-transform: uppercase;
          letter-spacing: 1.5px;
          line-height: 1;
        }
        .mic-cd-sep {
          font-family: 'Courier New', monospace;
          font-size: 14px;
          font-weight: 700;
          color: rgba(255, 200, 120, 0.45);
          line-height: 1;
          align-self: center;
          margin-bottom: 8px;
        }
        @media (max-width: 480px) {
          .mic-countdown-block {
            top: -16px;
            transform: translateX(-50%) scale(0.5);
            transform-origin: bottom center;
          }
        }
        
        /* Shimmer tooltip (post-unlock) */
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
        
        /* Sound waves */
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

        @media (prefers-reduced-motion: reduce) {
          .mic-tooltip::before { animation: none !important; }
          .lock-pulse { animation: none !important; }
        }
      `}</style>
      
      <div 
        className={`chonga-mic-container ${isMicOn ? 'is-on' : ''} ${countdown?.isUnlocked ? 'is-unlocked' : 'is-locked'}`} 
        onClick={() => {
          if (!countdown?.isUnlocked) return
          setIsMicOn(prev => !prev)
          setHasClicked(true)
        }}
        aria-label={countdown?.isUnlocked ? 'Toggle Mahalaya Audio' : 'Mahalaya audio locked until October 10'}
      >
        {/* Animated countdown (shown while locked) */}
        {countdown !== null && !countdown.isUnlocked && (
          <MicCountdown
            days={countdown.days}
            hours={countdown.hours}
            minutes={countdown.minutes}
            seconds={countdown.seconds}
          />
        )}

        {/* Shimmer tooltip (shown after unlock, before first click) */}
        {countdown?.isUnlocked && (
          <div className={`mic-tooltip ${hasClicked ? 'is-hidden' : ''}`} data-text="CLICK TO PLAY MAHALAYA">
            CLICK TO PLAY MAHALAYA
          </div>
        )}

        <img src="/assets/mic.png" alt="Chonga Mic" className="chonga-mic-img" />

        {/* Lock icon — centered on pole */}
        {countdown !== null && !countdown.isUnlocked && (
          <svg
            className="mic-lock-icon"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
              <path d="M16.4964 9V6.5C16.4964 4.01472 14.4817 2 11.9964 2C9.51112 2 7.4964 4.01472 7.4964 6.5V9" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.4958 9H10.4964C8.16158 9 6.99417 9 6.11049 9.47237C5.41275 9.84535 4.84128 10.4169 4.46837 11.1146C3.99608 11.9984 3.99619 13.1658 3.99641 15.5006C3.99662 17.835 3.99673 19.0023 4.46907 19.8858C4.84203 20.5835 5.41347 21.1548 6.11115 21.5277C6.99475 22 8.16197 22 10.4964 22H13.4958C15.8304 22 16.9978 22 17.8814 21.5277C18.5791 21.1548 19.1506 20.5833 19.5235 19.8856C19.9958 19.0019 19.9958 17.8346 19.9958 15.5C19.9958 13.1654 19.9958 11.9981 19.5235 11.1144C19.1506 10.4167 18.5791 9.84525 17.8814 9.47231C16.9978 9 15.8304 9 13.4958 9Z" fill="#e03030" stroke="rgba(255,255,255,0.85)" strokeWidth="1"/>
              <circle cx="11.9964" cy="15.5" r="2" fill="white" stroke="none"/>
          </svg>
        )}

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
