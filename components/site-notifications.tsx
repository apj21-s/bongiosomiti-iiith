'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * The site's own way of saying something, in place of the browser's.
 *
 * alert(), confirm() and prompt() were doing this work across the admin
 * screens. They freeze the page, they are drawn by the browser rather than by
 * this site, they cannot be styled, and on a phone they arrive as a system
 * sheet naming localhost. They also stop everything: a background poll, an
 * animation, any other click - which is why an automated session that trips
 * one goes unresponsive until somebody dismisses it by hand.
 *
 * The API here is deliberately the same shape, so a call site changes by one
 * line and keeps reading the way it did:
 *
 *   alert(e.message)            -> notifyError(e.message)
 *   if (!confirm(q)) return     -> if (!(await confirmAction({ message: q }))) return
 *   const r = prompt(q)         -> const r = await promptFor({ message: q })
 *
 * The two dialog calls return promises, so `await` replaces the blocking the
 * browser used to do - nothing else about the surrounding code moves.
 */

type Tone = 'success' | 'error' | 'info'

type Toast = { id: number; tone: Tone; text: string }

type DialogRequest = {
  kind: 'confirm' | 'prompt'
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'normal' | 'danger'
  placeholder?: string
  defaultValue?: string
  resolve: (value: unknown) => void
}

/*
  A module-level channel rather than a context.

  These are called from event handlers deep in components that do not take a
  provider, and adding one to each would be a larger change than the calls
  themselves. The host below subscribes on mount; anything raised before it
  mounts is queued rather than lost.
*/
type Listener = {
  toast: (t: Omit<Toast, 'id'>) => void
  dialog: (d: DialogRequest) => void
}

let listener: Listener | null = null
const pending: (() => void)[] = []

function send(run: (l: Listener) => void) {
  if (listener) run(listener)
  else pending.push(() => listener && run(listener))
}

/** A passing message. Returns immediately. */
export function notify(text: string, tone: Tone = 'info') {
  send((l) => l.toast({ tone, text }))
}

export function notifySuccess(text: string) { notify(text, 'success') }
export function notifyError(text: unknown) {
  notify(text instanceof Error ? text.message : String(text ?? 'Something went wrong'), 'error')
}

/** Asks. Resolves true if the person went ahead. */
export function confirmAction(options: {
  message: string
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'normal' | 'danger'
}): Promise<boolean> {
  return new Promise((resolve) => {
    send((l) => l.dialog({ kind: 'confirm', ...options, resolve: resolve as (v: unknown) => void }))
  })
}

/** Asks for a line of text. Resolves null if they backed out. */
export function promptFor(options: {
  message: string
  title?: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
}): Promise<string | null> {
  return new Promise((resolve) => {
    send((l) => l.dialog({ kind: 'prompt', ...options, resolve: resolve as (v: unknown) => void }))
  })
}

/**
 * Mounted once, near the root. Draws whatever the functions above raise.
 */
export default function SiteNotifications() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [dialog, setDialog] = useState<DialogRequest | null>(null)
  /**
   * Whether this has mounted in a browser.
   *
   * The portal cannot be drawn during hydration. Guarding on
   * `typeof document === 'undefined'` looks like it does the job, but it
   * answers differently on the two renders that have to agree: the server has
   * no document and renders nothing, while the client's very first render -
   * the one React matches against the server's HTML - does have one and
   * renders the portal. React then finds a <div class="site-toasts"> where
   * the server put <main>, and throws the tree away.
   *
   * A state flag set in an effect is false on both of those renders, so they
   * match, and the portal appears on the commit after.
   */
  const [mounted, setMounted] = useState(false)
  const [value, setValue] = useState('')
  const nextId = useRef(1)
  const inputRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  const dismiss = useCallback((id: number) => {
    setToasts((all) => all.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    // Effects do not run on the server and run after the first client render,
    // which is exactly when the portal becomes safe to draw.
    setMounted(true)

    listener = {
      toast: (t) => {
        const id = nextId.current++
        setToasts((all) => [...all, { ...t, id }])
        // Errors stay longer: they are usually the longer sentence, and the
        // one somebody needs to read twice.
        setTimeout(() => dismiss(id), t.tone === 'error' ? 7000 : 4500)
      },
      dialog: (d) => {
        setValue(d.defaultValue || '')
        setDialog(d)
      },
    }
    // Anything raised before this mounted.
    while (pending.length > 0) pending.shift()!()
    return () => { listener = null }
  }, [dismiss])

  const close = useCallback((result: unknown) => {
    setDialog((d) => { d?.resolve(result); return null })
    setValue('')
  }, [])

  // Escape backs out, Enter goes ahead. A dialog that traps the keyboard but
  // answers neither key is worse than the browser's.
  useEffect(() => {
    if (!dialog) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(dialog.kind === 'prompt' ? null : false) }
      if (e.key === 'Enter' && dialog.kind === 'confirm') { e.preventDefault(); close(true) }
    }
    document.addEventListener('keydown', onKey)
    const focus = setTimeout(() => {
      if (dialog.kind === 'prompt') inputRef.current?.focus()
      else confirmRef.current?.focus()
    }, 40)
    return () => { document.removeEventListener('keydown', onKey); clearTimeout(focus) }
  }, [dialog, close])

  if (!mounted) return null

  return createPortal(
    <>
      <div className="site-toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`site-toast site-toast--${t.tone}`} role="status">
            <span className="site-toast__icon" aria-hidden="true">
              {t.tone === 'success' ? '✓' : t.tone === 'error' ? '!' : 'i'}
            </span>
            <span className="site-toast__text">{t.text}</span>
            <button type="button" className="site-toast__close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              ×
            </button>
          </div>
        ))}
      </div>

      {dialog && (
        <div className="site-dialog-layer" role="presentation"
          onClick={() => close(dialog.kind === 'prompt' ? null : false)}>
          <div
            className="site-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={dialog.title || 'Confirm'}
            onClick={(e) => e.stopPropagation()}
          >
            {dialog.title && <h2 className="site-dialog__title">{dialog.title}</h2>}
            <p className="site-dialog__message">{dialog.message}</p>

            {dialog.kind === 'prompt' && (
              <input
                ref={inputRef}
                className="site-dialog__input"
                value={value}
                placeholder={dialog.placeholder || ''}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); close(value) } }}
              />
            )}

            <div className="site-dialog__actions">
              <button type="button" className="site-dialog__btn"
                onClick={() => close(dialog.kind === 'prompt' ? null : false)}>
                {dialog.cancelLabel || 'Cancel'}
              </button>
              <button
                ref={confirmRef}
                type="button"
                className={`site-dialog__btn site-dialog__btn--go ${dialog.tone === 'danger' ? 'is-danger' : ''}`}
                onClick={() => close(dialog.kind === 'prompt' ? value : true)}
              >
                {dialog.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  )
}
