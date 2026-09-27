'use client'

import React, { createContext, useContext, useRef, useState, useEffect, ReactNode } from 'react'

export type Track = {
  id: string
  title: string
  subtitle?: string
  src: string
  artwork?: string
}

type RepeatMode = 'off' | 'all' | 'one'

interface AudioContextType {
  tracks: Track[]
  currentTrackIndex: number
  isPlaying: boolean
  duration: number
  currentTime: number
  volume: number
  isMuted: boolean
  isShuffle: boolean
  repeatMode: RepeatMode
  
  playTrack: (index: number) => void
  togglePlayPause: () => void
  playNext: () => void
  playPrevious: () => void
  seekTo: (time: number) => void
  setVolumeLevel: (vol: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  toggleRepeat: () => void
  setPlaylist: (tracks: Track[]) => void
}

const AudioContext = createContext<AudioContextType | undefined>(undefined)

export function AudioProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<Track[]>([])
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isShuffle, setIsShuffle] = useState(false)
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off')
  const [shuffleOrder, setShuffleOrder] = useState<number[]>([])

  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && !audioRef.current) {
      audioRef.current = new Audio()
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration || 0)
    const onEnded = () => playNext()

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', onEnded)
    }
  }, [currentTrackIndex, tracks, isShuffle, repeatMode, shuffleOrder])

  // Sync volume and mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
      audioRef.current.muted = isMuted
    }
  }, [volume, isMuted])

  const playTrack = (index: number) => {
    if (!audioRef.current || !tracks[index]) return
    setCurrentTrackIndex(index)
    audioRef.current.src = tracks[index].src
    audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
  }

  const togglePlayPause = () => {
    if (!audioRef.current || tracks.length === 0) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      if (!audioRef.current.src && tracks[currentTrackIndex]) {
         audioRef.current.src = tracks[currentTrackIndex].src
      }
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    }
  }

  const playNext = () => {
    if (tracks.length === 0) return
    if (repeatMode === 'one' && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play()
      return
    }

    let nextIndex = currentTrackIndex + 1
    if (isShuffle && shuffleOrder.length > 0) {
       const orderIdx = shuffleOrder.indexOf(currentTrackIndex)
       nextIndex = shuffleOrder[(orderIdx + 1) % shuffleOrder.length]
    } else if (nextIndex >= tracks.length) {
       nextIndex = repeatMode === 'all' ? 0 : -1
    }

    if (nextIndex !== -1) {
      playTrack(nextIndex)
    } else {
      setIsPlaying(false)
    }
  }

  const playPrevious = () => {
    if (tracks.length === 0) return
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0
      return
    }
    
    let prevIndex = currentTrackIndex - 1
    if (isShuffle && shuffleOrder.length > 0) {
       const orderIdx = shuffleOrder.indexOf(currentTrackIndex)
       prevIndex = shuffleOrder[(orderIdx - 1 + shuffleOrder.length) % shuffleOrder.length]
    } else if (prevIndex < 0) {
       prevIndex = repeatMode === 'all' ? tracks.length - 1 : 0
    }
    
    playTrack(prevIndex)
  }

  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const setVolumeLevel = (vol: number) => {
    setVolume(vol)
    if (vol > 0) setIsMuted(false)
  }
  const toggleMute = () => setIsMuted(prev => !prev)

  const toggleShuffle = () => {
    setIsShuffle(prev => {
      const next = !prev
      if (next && tracks.length > 0) {
        const order = Array.from({length: tracks.length}, (_, i) => i)
        // Fisher-Yates
        for (let i = order.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [order[i], order[j]] = [order[j], order[i]]
        }
        setShuffleOrder(order)
      }
      return next
    })
  }

  const toggleRepeat = () => {
    setRepeatMode(prev => {
      if (prev === 'off') return 'all'
      if (prev === 'all') return 'one'
      return 'off'
    })
  }

  const setPlaylist = (newTracks: Track[]) => {
    setTracks(newTracks)
    if (newTracks.length > 0) {
       setCurrentTrackIndex(0)
    }
  }

  return (
    <AudioContext.Provider value={{
      tracks, currentTrackIndex, isPlaying, duration, currentTime, volume, isMuted, isShuffle, repeatMode,
      playTrack, togglePlayPause, playNext, playPrevious, seekTo, setVolumeLevel, toggleMute, toggleShuffle, toggleRepeat, setPlaylist
    }}>
      {children}
    </AudioContext.Provider>
  )
}

export function useAudio() {
  const context = useContext(AudioContext)
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider')
  }
  return context
}
