'use client'

import { useEffect, useState } from 'react'

type Photo = {
  src: string
  alt: string
  title: string
  date: string
  pos: string
}

const PHOTOS: Photo[] = [
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
  const [active, setActive] = useState<number | null>(null)
  const [changing, setChanging] = useState(false)

  const total = PHOTOS.length
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

  useEffect(() => {
    if (active === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
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
          <button type="button" className="photo-album__hero" onClick={() => openLightbox(0)} aria-label={PHOTOS[0].title}>
            <img className="photo-album__img" src={PHOTOS[0].src} alt={PHOTOS[0].alt} loading="lazy" decoding="async" style={{ objectPosition: PHOTOS[0].pos }} />
            <div className="photo-album__label" aria-hidden="true">
              <span className="photo-album__label-title">{PHOTOS[0].title}</span>
              <span className="photo-album__label-date">{PHOTOS[0].date}</span>
            </div>
          </button>

          <div className="photo-album__thumb-row">
            {PHOTOS.slice(1, 4).map((photo, i) => {
              const idx = i + 1
              const isLast = idx === Math.min(3, total - 1)
              const showMore = isLast && moreCount > 0
              return (
                <button
                  type="button"
                  className={`photo-album__thumb scroll-reveal scroll-reveal--delay-${idx}`}
                  key={photo.src}
                  onClick={() => openLightbox(showMore ? VISIBLE - 1 : idx)}
                  aria-label={photo.title + (showMore ? ` and ${moreCount} more` : '')}
                >
                  <img className="photo-album__img" src={photo.src} alt={photo.alt} loading="lazy" decoding="async" style={{ objectPosition: photo.pos }} />
                  {showMore ? (
                    <div className="photo-album__more-overlay" aria-hidden="true">
                      <span className="photo-album__more-text">+{moreCount}</span>
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
      </div>

      {active !== null && (
        <div className="story-lightbox is-open" role="dialog" aria-modal="true" aria-label="Photo viewer">
          <button type="button" className="story-lightbox__close" onClick={close} aria-label="Close photo viewer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <button type="button" className="story-lightbox__prev" onClick={goPrev} disabled={active <= 0} aria-label="Previous photo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button type="button" className="story-lightbox__next" onClick={goNext} disabled={active >= total - 1} aria-label="Next photo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <div className="story-lightbox__panel" role="document" onClick={(e) => e.stopPropagation()}>
            <div className="story-lightbox__media">
              <img className={`story-lightbox__image ${changing ? 'is-changing' : ''}`} src={PHOTOS[active].src} alt={PHOTOS[active].alt} />
            </div>
            <div className="story-lightbox__copy">
              <p className="story-lightbox__title">{PHOTOS[active].title}</p>
              <div className="story-lightbox__meta">
                <span className="story-lightbox__date">{PHOTOS[active].date}</span>
                <span className="story-lightbox__counter">{active + 1} / {total}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
