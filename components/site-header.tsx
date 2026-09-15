'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

function TypewriterBrand() {
  const chars = ["ব", "ঙ্গী", "য়", ".", "S", "A", "M", "I", "T", "I"]
  const [index, setIndex] = useState(chars.length)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    let timeout: NodeJS.Timeout
    
    if (!isDeleting && index < chars.length) {
      timeout = setTimeout(() => {
        setIndex(prev => prev + 1)
      }, 150)
    } else if (!isDeleting && index === chars.length) {
      timeout = setTimeout(() => {
        setIsDeleting(true)
      }, 3000)
    } else if (isDeleting && index > 0) {
      timeout = setTimeout(() => {
        setIndex(prev => prev - 1)
      }, 100)
    } else if (isDeleting && index === 0) {
      timeout = setTimeout(() => {
        setIsDeleting(false)
      }, 1000)
    }

    return () => clearTimeout(timeout)
  }, [index, isDeleting, chars.length])

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Invisible layer to rigidly lock the maximum width */}
      <span style={{ visibility: 'hidden' }}>
        {chars.join('')}
        <span style={{ borderRight: '2px solid transparent', marginLeft: '2px' }}></span>
      </span>
      
      {/* Visible animated typing layer overlay */}
      <span style={{ position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap' }}>
        {chars.slice(0, index).join('')}
        <span style={{ borderRight: '2px solid currentColor', marginLeft: '2px', animation: 'blink 1s step-end infinite' }}></span>
      </span>
      
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </span>
  )
}

interface SiteHeaderProps {
  variant?: 'public' | 'admin'
}

export default function SiteHeader({ variant = 'public' }: SiteHeaderProps) {
  const pathname = usePathname()
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    let lastScrollY = window.scrollY

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        // Scrolling down past threshold
        setIsVisible(false)
      } else {
        // Scrolling up
        setIsVisible(true)
      }
      lastScrollY = currentScrollY
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY < 60) {
        setIsVisible(true)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('mousemove', handleMouseMove, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  if (variant === 'admin') {
    return (
      <header className={`home-strip ${isVisible ? '' : 'is-hidden'}`}>
        <div className="home-strip__inner">
          <Link className="home-strip__brand" href="/">
            <img src="/assets/logo.png" alt="বঙ্গীয়.SAMITI Emblem" className="brand-emblem" />
            <span>বঙ্গীয়.SAMITI &bull; ADMIN</span>
          </Link>
          <nav className="home-strip__nav" aria-label="Admin Navigation">
            <Link className="home-strip__link" href="/">WEBSITE</Link>
            <Link className="home-strip__link" href="/admin">DASHBOARD</Link>
            <Link className="home-strip__link" href="/admin/events">EVENTS</Link>
            <Link className="home-strip__link" href="/admin/registrations">REGISTRATIONS</Link>
            <Link className="home-strip__link" href="/admin/payments">PAYMENTS</Link>
            <Link className="home-strip__link" href="/admin/scanner">SCANNER</Link>
            <Link className="home-strip__link" href="/admin/check-ins">CHECK-INS</Link>
          </nav>
          <Link className="home-strip__action" href="/admin/login">SIGN OUT</Link>
        </div>
      </header>
    )
  }

  return (
    <header className={`home-strip ${isVisible ? '' : 'is-hidden'}`}>
      <div className="home-strip__inner">
        <Link className="home-strip__brand" href="/">
          {pathname !== '/' && (
            <img src="/assets/logo.png" alt="বঙ্গীয়.SAMITI Emblem" className="brand-emblem" />
          )}
          <TypewriterBrand />
        </Link>
        <nav className="home-strip__nav" aria-label="Primary">
          <Link className="home-strip__link" href="/#home" aria-current="page">HOME</Link>
          <Link className="home-strip__link" href="/#events">EVENTS</Link>
          <Link className="home-strip__link" href="/#story">STORY</Link>
          <Link className="home-strip__link" href="/pass">PAYMENT STATUS</Link>
        </nav>
        <Link className="home-strip__action" href="/events/mahalaya#registration-form-container">REGISTER</Link>
      </div>
    </header>
  )
}
