'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type Photo = {
  src: string
  alt: string
  title: string
  date: string
  pos: string
}

const DEFAULT_PHOTOS: Photo[] = [
  { src: '/assets/photo_1.webp', alt: 'সরস্বতী পূজা', title: 'সরস্বতী পূজা', date: '১৪ অক্টোবর ২০২৬', pos: 'center 32%' },
  { src: '/assets/photo_2026-08-11_21-42-50.webp', alt: 'হাতের আলপনা', title: 'হাতের আলপনা', date: '১৮ অক্টোবর ২০২৬', pos: 'center 28%' },
  { src: '/assets/photo_2026-08-11_21-42-48.webp', alt: 'সরস্বতী প্রাঙ্গণ', title: 'সরস্বতী প্রাঙ্গণ', date: '২১ জানুয়ারি ২০২৭', pos: 'center 42%' },
  { src: '/assets/p10.webp', alt: 'ভোগ বিতরণ', title: 'ভোগ ও প্রসাদ বিতরণ', date: '০৬ ফেব্রুয়ারি ২০২৭', pos: 'center 36%' },
  { src: '/assets/photo_2026-08-11_22-55-53.webp', alt: 'পূজার প্রস্তুতি', title: 'পূজার প্রস্তুতি ও সাজসজ্জা', date: '১২ অক্টোবর ২০২৬', pos: 'center 30%' },
  { src: '/assets/photo_2026-08-11_22-56-00.webp', alt: 'সন্ধ্যা আরতি', title: 'সন্ধ্যা আরতি ও প্রার্থনা', date: '১৩ অক্টোবর ২০২৬', pos: 'center 38%' },
  { src: '/assets/photo_2026-08-11_21-42-44.webp', alt: 'মণ্ডপ পরিক্রমা', title: 'মণ্ডপ পরিক্রমা ও উৎসব', date: '১৯ অক্টোবর ২০২৬', pos: 'center 34%' },
  { src: '/assets/p7.webp', alt: 'ধুনুচি নাচ', title: 'ধুনুচি নাচ ও ঢাকের বোল', date: '০৪ ফেব্রুয়ারি ২০২৭', pos: 'center 36%' },
  { src: '/assets/p8.webp', alt: 'সাংস্কৃতিক সন্ধ্যা', title: 'সাংস্কৃতিক সন্ধ্যা ও সংগীত', date: '০৫ ফেব্রুয়ারি ২০২৭', pos: 'center 36%' },
  { src: '/assets/p9.webp', alt: 'প্রদীপ প্রজ্জ্বলন', title: 'প্রদীপ প্রজ্জ্বলন ও পুষ্পাঞ্জলি', date: '০৫ ফেব্রুয়ারি ২০২৭', pos: 'center 36%' },
  { src: '/assets/p11.webp', alt: 'ক্যাম্পাস আড্ডা', title: 'ক্যাম্পাস আড্ডা ও আনন্দ', date: '০৬ ফেব্রুয়ারি ২০২৭', pos: 'center 36%' },
  { src: '/assets/p12.webp', alt: 'সন্ধ্যা মিলন', title: 'সন্ধ্যা মিলন ও প্রসাদ সেবা', date: '০৬ ফেব্রুয়ারি ২০২৭', pos: 'center 36%' },
  { src: '/assets/p13.webp', alt: 'আনন্দ উৎসব', title: 'আনন্দ উৎসব ও স্মৃতি', date: '০৭ ফেব্রুয়ারি ২০২৭', pos: 'center 36%' },
  { src: '/assets/p14.webp', alt: 'শুভ বিজয়া', title: 'শুভ বিজয়া সম্মিলনী', date: '০৭ ফেব্রুয়ারি ২০২৭', pos: 'center 36%' },
]

const VISIBLE = 4

function toBn(n: number) {
  return String(n).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)])
}

export default function PhotoAlbum() {
  const [photos, setPhotos] = useState<Photo[]>(DEFAULT_PHOTOS)
  const [active, setActive] = useState<number | null>(null)
  const [changing, setChanging] = useState(false)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [touchEndX, setTouchEndX] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/data/album.json?t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) setPhotos(data)
      })
      .catch(console.error)
  }, [])

  const total = photos.length
  const moreCount = total > VISIBLE ? total - VISIBLE : 0

  function openLightbox(index: number) {
    setChanging(true)
    setActive(index)
    setTimeout(() => setChanging(false), 90)
  }

  function close() {
    setActive(null)
  }

  function goPrev() {
    if (active === null) return
    if (active > 0) openLightbox(active - 1)
  }

  function goNext() {
    if (active === null) return
    if (active < total - 1) openLightbox(active + 1)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEndX(null)
    setTouchStartX(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStartX || !touchEndX) return
    const distance = touchStartX - touchEndX
    const isLeftSwipe = distance > 50
    const isRightSwipe = distance < -50

    if (isLeftSwipe) goNext()
    else if (isRightSwipe) goPrev()
  }

  useEffect(() => {
    if (active === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [active])

  return (
    <>
      <div className="photo-album__header">
        <span className="photo-album__albumIcon" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </span>
        <span className="photo-album__albumLabel">আমাদের ছবির অ্যালবাম</span>
        <span className="photo-album__count">{toBn(total)}টি স্মৃতি</span>
      </div>

      <div className="photo-album" aria-label="আমাদের গল্প photo album" role="group">
        <div className="photo-album__grid">
          <button type="button" className="photo-album__card photo-album__card--hero scroll-reveal scroll-reveal--delay-1" onClick={() => openLightbox(0)} aria-label={photos[0].title}>
            <img className="photo-album__img" src={photos[0].src} alt={photos[0].alt} loading="lazy" decoding="async" style={{ objectPosition: photos[0].pos }} />
            <div className="photo-album__scrim"></div>
            <div className="photo-album__label" aria-hidden="true">
              <span className="photo-album__label-title">{photos[0].title}</span>
              <span className="photo-album__label-date">{photos[0].date}</span>
            </div>
          </button>

          {photos.slice(1, 4).map((photo, i) => {
            const idx = i + 1
            const isLast = idx === Math.min(3, total - 1)
            const showMore = isLast && moreCount > 0
            return (
              <button
                type="button"
                className={`photo-album__card photo-album__card--thumb scroll-reveal scroll-reveal--delay-${(i % 3) + 2}`}
                key={photo.src}
                onClick={() => openLightbox(showMore ? VISIBLE - 1 : idx)}
                aria-label={photo.title + (showMore ? ` and ${moreCount} more` : '')}
              >
                <img className="photo-album__img" src={photo.src} alt={photo.alt} loading="lazy" decoding="async" style={{ objectPosition: photo.pos }} />
                <div className="photo-album__scrim"></div>
                {showMore ? (
                  <div className="photo-album__more-overlay" aria-hidden="true">
                    <span className="photo-album__more-badge">+{toBn(moreCount + 1)}</span>
                    <span className="photo-album__more-sub">সকল {toBn(total)}টি স্মৃতি দেখুন</span>
                  </div>
                ) : (
                  <div className="photo-album__label" aria-hidden="true">
                    <span className="photo-album__label-title">{photo.title}</span>
                    <span className="photo-album__label-date">{photo.date}</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {active !== null && typeof document !== 'undefined' && createPortal(
        <div className="story-lightbox is-open" role="dialog" aria-modal="true" aria-label="Photo album viewer">
          <div className="story-lightbox__container" role="document">
            {/* Top Smart Bar */}
            <header className="story-lightbox__topbar">
              <div className="story-lightbox__info">
                <span className="story-lightbox__album-name">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  আমাদের ছবির অ্যালবাম
                </span>
                <h3 className="story-lightbox__title">{photos[active].title}</h3>
                <span className="story-lightbox__date">{photos[active].date}</span>
              </div>

              <div className="story-lightbox__actions">
                <span className="story-lightbox__counter">{toBn(active + 1)} / {toBn(total)}</span>

                <button
                  type="button"
                  className="story-lightbox__action-btn story-lightbox__fullscreen"
                  aria-label="Toggle fullscreen"
                  title="Fullscreen (F)"
                  onClick={() => {
                    if (!document.fullscreenElement) {
                      document.documentElement.requestFullscreen().catch(() => {})
                    } else {
                      document.exitFullscreen()
                    }
                  }}
                >
                  <svg className="icon-expand" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                  </svg>
                </button>

                <button type="button" className="story-lightbox__action-btn story-lightbox__close" onClick={close} aria-label="Close photo viewer" title="Close (Esc)">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </header>

            {/* Central Media Viewport */}
            <div className="story-lightbox__viewport"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <button type="button" className="story-lightbox__nav story-lightbox__prev" onClick={goPrev} disabled={active <= 0} aria-label="Previous photo" title="Previous photo (←)">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <div className="story-lightbox__media" onClick={(e) => e.stopPropagation()}>
                <img className={`story-lightbox__image ${changing ? 'is-changing' : ''}`} src={photos[active].src} alt={photos[active].alt} />
              </div>

              <button type="button" className="story-lightbox__nav story-lightbox__next" onClick={goNext} disabled={active >= total - 1} aria-label="Next photo" title="Next photo (→)">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {/* Google Photos Smart Filmstrip Preview Bar */}
            <footer className="story-lightbox__filmstrip-bar" aria-label="Photo thumbnails scrubber">
              <div className="story-lightbox__filmstrip" role="tablist" aria-label="All album photos">
                {photos.map((photo, index) => (
                  <button
                    key={index}
                    type="button"
                    role="tab"
                    aria-selected={active === index}
                    className={`story-lightbox__thumb ${active === index ? 'is-active' : ''}`}
                    onClick={() => openLightbox(index)}
                  >
                    <img src={photo.src} alt={photo.title} loading="lazy" />
                  </button>
                ))}
              </div>
            </footer>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
