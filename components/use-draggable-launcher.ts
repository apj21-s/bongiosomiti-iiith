'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, MouseEvent, PointerEvent } from 'react'

/**
 * The music launcher, movable.
 *
 * It sits in the bottom-right corner by default, which on some pages is
 * exactly where somebody is reading or tapping. So it can be dragged
 * anywhere, by mouse or finger, and stays where it was left - in this browser,
 * across pages and visits. Dropping it back near its corner puts it home.
 *
 * The position is kept as distances from the right and bottom edges, the same
 * terms the stylesheet uses for the default, so "no saved position" simply
 * means "the stylesheet's".
 */

type Offset = { right: number; bottom: number }

const STORAGE_KEY = 'bangiya.music-launcher-pos'
const CHANGED_EVENT = 'bangiya:music-launcher-pos'
// Kept clear of the screen edge, so it can always be grabbed again.
const EDGE = 8
// A press only becomes a drag past this many pixels, so a tap still opens it.
const DRAG_THRESHOLD = 6
// Dropped this close to the default corner, it goes back to the default.
const HOME = { right: 24, bottom: 24 }
const SNAP_HOME = 40

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function parse(raw: string | null): Offset | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    // Written by us, but read back as untrusted: anything on the page can
    // write localStorage.
    if (Number.isFinite(value?.right) && Number.isFinite(value?.bottom)) {
      return { right: Number(value.right), bottom: Number(value.bottom) }
    }
  } catch {}
  return null
}

function write(offset: Offset | null) {
  try {
    if (offset) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(offset))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private windows: it stays where it was put for this page, and no more.
  }
  window.dispatchEvent(new Event(CHANGED_EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(CHANGED_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(CHANGED_EVENT, onChange)
  }
}

/** The offset that keeps an element of this size fully on screen. */
function clampTo(offset: Offset, width: number, height: number): Offset {
  const maxRight = Math.max(EDGE, window.innerWidth - width - EDGE)
  const maxBottom = Math.max(EDGE, window.innerHeight - height - EDGE)
  return {
    right: Math.round(Math.min(maxRight, Math.max(EDGE, offset.right))),
    bottom: Math.round(Math.min(maxBottom, Math.max(EDGE, offset.bottom))),
  }
}

export function useDraggableLauncher() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null)
  const saved = useMemo(() => parse(raw), [raw])

  // Where it is while being dragged; null otherwise.
  const [live, setLive] = useState<Offset | null>(null)
  const node = useRef<HTMLButtonElement | null>(null)
  const press = useRef<{ x: number; y: number; from: Offset; id: number; moved: boolean } | null>(null)
  const swallowClick = useRef(false)

  // A rotated phone or a narrowed window can leave a saved spot off screen.
  useEffect(() => {
    const keepOnScreen = () => {
      const current = parse(readRaw())
      const el = node.current
      if (!current || !el) return
      const rect = el.getBoundingClientRect()
      const clamped = clampTo(current, rect.width, rect.height)
      if (clamped.right !== current.right || clamped.bottom !== current.bottom) write(clamped)
    }
    keepOnScreen()
    window.addEventListener('resize', keepOnScreen)
    return () => window.removeEventListener('resize', keepOnScreen)
  }, [])

  const ref = useCallback((el: HTMLButtonElement | null) => {
    node.current = el
  }, [])

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return
    const style = window.getComputedStyle(e.currentTarget)
    press.current = {
      x: e.clientX,
      y: e.clientY,
      from: { right: parseFloat(style.right) || HOME.right, bottom: parseFloat(style.bottom) || HOME.bottom },
      id: e.pointerId,
      moved: false,
    }
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const p = press.current
    if (!p || p.id !== e.pointerId) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    if (!p.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      p.moved = true
      // Captured only once it is really a drag, so a plain tap is a plain click.
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setLive(clampTo({ right: p.from.right - dx, bottom: p.from.bottom - dy }, rect.width, rect.height))
  }

  function onPointerEnd(e: PointerEvent<HTMLButtonElement>) {
    const p = press.current
    if (!p || p.id !== e.pointerId) return
    press.current = null
    if (!p.moved || !live) return

    // The click that follows a drag is the drop, not a request to open.
    swallowClick.current = true
    const nearHome = Math.hypot(live.right - HOME.right, live.bottom - HOME.bottom) < SNAP_HOME
    write(nearHome ? null : live)
    setLive(null)
  }

  function onClickCapture(e: MouseEvent<HTMLButtonElement>) {
    if (!swallowClick.current) return
    swallowClick.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  const offset = live ?? saved
  const style: CSSProperties | undefined = offset
    ? { right: `${offset.right}px`, bottom: `${offset.bottom}px` }
    : undefined

  return {
    dragging: live !== null,
    props: {
      ref,
      style,
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onClickCapture,
    },
  }
}
