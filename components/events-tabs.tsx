'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

export type EventTabItem = {
  id: string
  slug: string
  name: string
  event_date: string
  description?: string
  image_url?: string
  price: number
  status: string
  tag?: string
}

function cardImage(event: EventTabItem) {
  if (event.image_url) return event.image_url
  return event.slug === 'mahalaya' ? '/assets/mahalaya-bhoj.webp' : '/assets/saraswati-puja.webp'
}

function cardDescription(event: EventTabItem) {
  return event.description
    ?.replace(
      'Shared tables, smoke, brass, and a warm autumn gathering built around authentic Bengali food, adda, and ritual warmth.',
      'Bengali food • Adda • Celebration'
    )
    .replace(
      'A serene campus procession with fresh yellow flowers, alpona, morning anjali, recitation, music, and student gathering.',
      'Yellow blooms • Anjali • Music • Culture'
    )
}

export default function EventsTabs({ events }: { events: EventTabItem[] }) {
  const [active, setActive] = useState(0)

  const pillRef = useRef<HTMLSpanElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const hasRendered = useRef(false)

  // Writes the active tab's measured geometry onto the pill. When `animate` is
  // false the transition is suspended and a reflow forced, so the pill snaps
  // into place instead of sliding in from wherever it was.
  const movePill = useCallback((index: number, animate: boolean) => {
    const pill = pillRef.current
    const tab = tabRefs.current[index]
    if (!pill || !tab) return

    if (!animate) {
      const previous = pill.style.transition
      pill.style.transition = 'none'
      pill.style.transform = `translateX(${tab.offsetLeft}px)`
      pill.style.width = `${tab.offsetWidth}px`
      void pill.offsetHeight // force reflow before the transition comes back
      pill.style.transition = previous
      return
    }

    pill.style.transform = `translateX(${tab.offsetLeft}px)`
    pill.style.width = `${tab.offsetWidth}px`
  }, [])

  // First paint snaps, every later change slides.
  useEffect(() => {
    movePill(active, hasRendered.current)
    hasRendered.current = true
  }, [active, movePill])

  useEffect(() => {
    const reposition = () => movePill(active, false)

    window.addEventListener('resize', reposition)
    // The Bengali/serif webfonts load after first paint and change the tab
    // widths when they swap in, so re-measure once they are ready.
    document.fonts?.ready.then(reposition).catch(() => {})

    return () => window.removeEventListener('resize', reposition)
  }, [active, movePill])

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const next = e.key === 'ArrowRight'
      ? (active + 1) % events.length
      : (active - 1 + events.length) % events.length
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  if (events.length === 0) return null

  const event = events[active]

  return (
    <div className="events-tabs">
      <div className="t-tabs" role="tablist" aria-label="Upcoming events">
        <span className="t-tabs-pill" aria-hidden="true" ref={pillRef}></span>
        {events.map((item, i) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`events-tab-${item.slug}`}
            aria-controls={`events-panel-${item.slug}`}
            aria-selected={i === active}
            tabIndex={i === active ? 0 : -1}
            className="t-tab"
            ref={(el) => {
              tabRefs.current[i] = el
            }}
            onClick={() => setActive(i)}
            onKeyDown={onKeyDown}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div
        className="events-tabs__panel"
        role="tabpanel"
        key={event.slug}
        id={`events-panel-${event.slug}`}
        aria-labelledby={`events-tab-${event.slug}`}
      >
        <Link
          className="events-scene__card"
          href={`/events/${event.slug}`}
          aria-label={`Register for ${event.name}`}
        >
          <div className="events-scene__card-media">
            <img
              className="events-scene__card-image"
              src={cardImage(event)}
              alt={event.name}
              width={event.slug === 'mahalaya' ? 1264 : 544}
              height={event.slug === 'mahalaya' ? 848 : 880}
              loading="lazy"
              decoding="async"
              style={{ objectPosition: event.slug === 'mahalaya' ? 'center 36%' : 'center 20%' }}
            />
            <span className="events-scene__card-badge">
              {event.price === 0 ? 'Campus Celebration' : 'Registration Opens Soon!'}
            </span>
          </div>
          <div className="events-scene__card-body">
            <div className="events-scene__card-meta">
              <span className="events-scene__card-date">
                {new Date(event.event_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
              </span>
              <span className="events-scene__card-tag">{event.tag}</span>
            </div>
            <h3 className="events-scene__card-title">{event.name}</h3>
            <p className="events-scene__card-desc">{cardDescription(event)}</p>
            <div className="events-scene__card-footer">
              <span className="events-scene__card-invitation">
                {event.price === 0
                  ? '✨ Join the celebration • Free Entry'
                  : `• ⚡ Registration opens soon • `}
              </span>
              <span className="events-scene__card-btn">
                <span>{event.status === 'OPEN' ? 'REGISTER NOW' : 'COMING SOON'}</span>
                <span className="events-scene__card-arrow">&rarr;</span>
              </span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
