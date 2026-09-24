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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    let lastScrollY = window.scrollY

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        setIsVisible(false)
        setIsMobileMenuOpen(false) // Close menu on scroll down
      } else {
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
  
  // Close menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

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
        {/* Desktop Nav */}
        <nav className="home-strip__nav" aria-label="Primary">
          <Link className="home-strip__link" href="/#home" aria-current={pathname === '/' ? "page" : undefined}>HOME</Link>
          {pathname !== '/' && <Link className="home-strip__link" href="/#events">EVENTS</Link>}
          {pathname !== '/' && <Link className="home-strip__link" href="/#story">STORY</Link>}
        </nav>
        
        {/* Mobile Nav Morph Container */}
        <div className="home-strip__mobile-nav">
          <div className="t-morph" data-open={isMobileMenuOpen}>
            <div className="t-morph-menu">
              <Link className="home-strip__link" href="/#home" aria-current={pathname === '/' ? "page" : undefined}>HOME</Link>
              {pathname !== '/' && <Link className="home-strip__link" href="/#events">EVENTS</Link>}
              {pathname !== '/' && <Link className="home-strip__link" href="/#story">STORY</Link>}
            </div>
            
            <button 
              className="t-morph-plus home-strip__hamburger" 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={isMobileMenuOpen}
            >
              <span style={{ transform: isMobileMenuOpen ? 'rotate(45deg) translate(2px, 2px)' : 'rotate(0)' }} />
              <span style={{ opacity: isMobileMenuOpen ? '0' : '1' }} />
              <span style={{ transform: isMobileMenuOpen ? 'rotate(-45deg) translate(2px, -2px)' : 'rotate(0)' }} />
            </button>
          </div>
        </div>

        <Link className="home-strip__action" href="/events/mahalaya#registration-form-container">REGISTER</Link>
      </div>
    </header>
  )
}

