'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { isPostSlug, parsePost, type Block, type Inline, type Post } from '@/utils/markdown'
import './blog-post-modal.css'

/**
 * A blog post in a dialog, opened by whatever it is wrapped around.
 *
 * The post is a Markdown file under public/assets/blogs. To change what this
 * shows, edit our-story.md; to add another, drop in a new .md and point a
 * `slug` at it. Nothing else needs touching - the file is fetched at open time,
 * so a post can be rewritten without a rebuild.
 *
 * The Markdown is turned into React elements by utils/markdown, never into
 * HTML, so a post cannot inject markup into the page.
 */

function renderInlines(inlines: Inline[], keyPrefix: string) {
  return inlines.map((inline, i) => {
    const key = `${keyPrefix}-${i}`
    switch (inline.type) {
      case 'strong':
        return <strong key={key}>{inline.value}</strong>
      case 'em':
        return <em key={key}>{inline.value}</em>
      case 'code':
        return <code key={key}>{inline.value}</code>
      case 'link':
        return (
          <a key={key} href={inline.href} target="_blank" rel="noopener noreferrer">
            {inline.value}
          </a>
        )
      default:
        return <span key={key}>{inline.value}</span>
    }
  })
}

function renderBlock(block: Block, i: number) {
  const key = `b-${i}`
  switch (block.type) {
    case 'heading': {
      const Tag = (`h${block.level}`) as 'h2' | 'h3' | 'h4'
      return <Tag key={key}>{renderInlines(block.inlines, key)}</Tag>
    }
    case 'list':
      return (
        <ul key={key}>
          {block.items.map((item, j) => (
            <li key={`${key}-${j}`}>{renderInlines(item, `${key}-${j}`)}</li>
          ))}
        </ul>
      )
    case 'quote':
      return <blockquote key={key}>{renderInlines(block.inlines, key)}</blockquote>
    case 'rule':
      return <hr key={key} />
    default:
      return <p key={key}>{renderInlines(block.inlines, key)}</p>
  }
}

export default function BlogPostModal({
  slug,
  label,
  className = '',
  children,
}: {
  slug: string
  /** What a screen reader says the trigger does. */
  label: string
  className?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [post, setPost] = useState<Post | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle')

  // A prop, so this is known while rendering rather than discovered later.
  const usableSlug = isPostSlug(slug)

  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  const close = useCallback(() => {
    setOpen(false)
    // Back to what was clicked, rather than the top of the document.
    triggerRef.current?.focus()
  }, [])

  // Fetched when it is opened, and only once - the file does not change
  // mid-visit. Done in the handler rather than an effect, because it happens
  // because somebody clicked, not because state changed.
  const openPost = useCallback(async () => {
    setOpen(true)
    if (post || !usableSlug) return

    setState('loading')
    try {
      const res = await fetch(`/assets/blogs/${slug}.md`)
      if (!res.ok) throw new Error(String(res.status))
      setPost(parsePost(await res.text()))
      setState('idle')
    } catch {
      setState('failed')
    }
  }, [post, slug, usableSlug])

  // Escape closes it, and the page behind does not scroll while it is up.
  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, close])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`blog-trigger ${className}`}
        onClick={openPost}
        aria-haspopup="dialog"
        aria-label={label}
      >
        {children}
        <span className="blog-trigger__cue" aria-hidden="true">Read the story →</span>
      </button>

      {open && (
        <div className="blog-overlay" role="presentation" onClick={close}>
          <div
            ref={dialogRef}
            className="blog-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            // The backdrop closes; a click on the post itself must not.
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="blog-dialog__close" onClick={close} aria-label="Close the story">
              ×
            </button>

            <header className="blog-dialog__head">
              <h2 id={titleId}>{post?.meta.title || label}</h2>
              {post?.meta.subtitle && <p className="blog-dialog__subtitle">{post.meta.subtitle}</p>}
              {(post?.meta.date || post?.meta.author) && (
                <p className="blog-dialog__byline">
                  {[post?.meta.author, post?.meta.date].filter(Boolean).join(' · ')}
                </p>
              )}
            </header>

            <div className="blog-dialog__body">
              {state === 'loading' && <p className="blog-dialog__note">Fetching the story…</p>}
              {(state === 'failed' || !usableSlug) && (
                <p className="blog-dialog__note">
                  This story could not be loaded. It lives at
                  {' '}<code>public/assets/blogs/{slug}.md</code>.
                </p>
              )}
              {state === 'idle' && post && post.blocks.map(renderBlock)}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
