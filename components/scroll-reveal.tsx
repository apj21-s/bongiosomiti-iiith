'use client'

import { useEffect } from 'react'

/**
 * Replicates the original site.js IntersectionObserver-based scroll-reveal system.
 * Watches all elements with `.scroll-reveal` or `[data-reveal]` and adds
 * `is-revealed`, `is-visible`, `in-view` classes when they enter the viewport.
 *
 * Mount this component once in the layout or page to activate scroll reveals.
 */
export default function ScrollReveal() {
  useEffect(() => {
    const reveals = document.querySelectorAll('.scroll-reveal, [data-reveal]')
    if (!reveals.length) return

    // Respect user's motion preference
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    ) {
      reveals.forEach((el) =>
        el.classList.add('is-revealed', 'is-visible', 'in-view')
      )
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed', 'is-visible', 'in-view')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -25px 0px' }
    )

    reveals.forEach((el) => observer.observe(el))

    // MutationObserver to pick up dynamically-added scroll-reveal elements
    const mutationObs = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (
              node.classList?.contains('scroll-reveal') ||
              node.hasAttribute?.('data-reveal')
            ) {
              observer.observe(node)
            }
            // Also check descendants
            node.querySelectorAll?.('.scroll-reveal, [data-reveal]').forEach(
              (child) => observer.observe(child)
            )
          }
        })
      })
    })

    mutationObs.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mutationObs.disconnect()
    }
  }, [])

  return null
}
