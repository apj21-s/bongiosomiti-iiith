'use client'

import { useEffect } from 'react'

/**
 * Replicates the original site.js IntersectionObserver-based scroll-reveal system.
 * Watches all elements with `.scroll-reveal` or `[data-reveal]` and adds
 * `is-revealed`, `is-visible`, `in-view` classes when they enter the viewport.
 *
 * Mount this component once in the layout or page to activate scroll reveals.
 */

const SELECTOR = '.scroll-reveal, [data-reveal]'
const REVEALED_CLASSES = ['is-revealed', 'is-visible', 'in-view']

export default function ScrollReveal() {
  useEffect(() => {
    const reveal = (el: Element) => el.classList.add(...REVEALED_CLASSES)
    const isRevealed = (el: Element) => el.classList.contains('is-revealed')

    // Respect user's motion preference
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    ) {
      document.querySelectorAll(SELECTOR).forEach(reveal)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -25px 0px' }
    )

    // Re-queried on every pass rather than snapshotted once. This component
    // lives in the layout, above {children}, so its effect can run before the
    // page body has streamed in - in which case the first scan legitimately
    // finds nothing. Bailing out at that point used to leave the whole page
    // stuck at opacity 0 with no observer left to recover it.
    const observeAll = () => {
      document.querySelectorAll(SELECTOR).forEach((el) => {
        if (!isRevealed(el)) observer.observe(el)
      })
    }

    observeAll()

    // Picks up content that mounts later: streamed page bodies, and the subtree
    // app/template.tsx remounts on every navigation.
    const mutationObs = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return
          if (node.matches?.(SELECTOR) && !isRevealed(node)) observer.observe(node)
          node.querySelectorAll?.(SELECTOR).forEach((child) => {
            if (!isRevealed(child)) observer.observe(child)
          })
        })
      })
    })

    mutationObs.observe(document.body, { childList: true, subtree: true })

    // Safety net for anything already sitting in the viewport. An
    // IntersectionObserver only delivers callbacks while the page is being
    // rendered, so a tab that loads in the background - or any hitch in
    // delivery - could otherwise leave above-the-fold content invisible until
    // the visitor scrolls. Content below the fold is left to the observer.
    const sweepVisible = () => {
      document.querySelectorAll(SELECTOR).forEach((el) => {
        if (isRevealed(el)) return
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) return
        if (rect.top < window.innerHeight && rect.bottom > 0) reveal(el)
      })
    }

    const sweepTimers = [
      window.setTimeout(sweepVisible, 300),
      window.setTimeout(sweepVisible, 1200),
    ]
    window.addEventListener('load', sweepVisible)

    return () => {
      observer.disconnect()
      mutationObs.disconnect()
      sweepTimers.forEach((id) => window.clearTimeout(id))
      window.removeEventListener('load', sweepVisible)
    }
  }, [])

  return null
}
