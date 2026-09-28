'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
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

type Lang = 'en' | 'bn'

/** Where a post lives. Bengali sits beside English as `<slug>.bn.md`. */
function postPath(slug: string, lang: Lang): string {
  return `/assets/blogs/${slug}${lang === 'bn' ? '.bn' : ''}.md`
}

/**
 * What to head the dialog with.
 *
 * A post's own frontmatter title wins. Without one, the story the trigger
 * belongs to may borrow the trigger's label - that is what was clicked - but
 * a story paged to may not: every untitled story would then be headed "Read
 * our story", so moving between them looks like nothing loaded at all. Those
 * get their slug, tidied into words.
 */
function headingFor(shown: string, ownSlug: string, label: string, title?: string): string {
  if (title) return title
  if (shown === ownSlug) return label
  return shown.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

export default function BlogPostModal({
  slug,
  slugs,
  label,
  className = '',
  children,
}: {
  slug: string
  /**
   * The whole series, in reading order, when there is more than one story.
   * `slug` is the one the trigger opens; the arrows walk this list. Left out,
   * or with a single entry, there is nothing to page through and no arrows.
   */
  slugs?: string[]
  /** What a screen reader says the trigger does. */
  label: string
  className?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [post, setPost] = useState<Post | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle')

  /**
   * Slugs found in public/assets/blogs/index.json, when there is one.
   *
   * Without this, paging needed the whole series listed as a prop, which meant
   * a new story was two edits in two places and silently had no arrows if the
   * second was forgotten. A manifest keeps it to one: drop the Markdown in and
   * add its slug to the list. An explicit `slugs` prop still wins, and with no
   * manifest at all this falls back to the single story it was given.
   */
  const [discovered, setDiscovered] = useState<string[] | null>(null)

  const series = useMemo(() => {
    const source = (slugs && slugs.length > 0) ? slugs : (discovered ?? [slug])
    const all = source.filter(isPostSlug)
    return all.length > 0 ? all : [slug]
  }, [slugs, discovered, slug])

  const [index, setIndex] = useState(() => Math.max(0, series.indexOf(slug)))
  const [lang, setLang] = useState<Lang>('en')
  /** Whether a Bengali file exists for the story being shown. Probed on open. */
  const [hasBengali, setHasBengali] = useState(false)

  const current = series[index] ?? slug

  // A prop, so this is known while rendering rather than discovered later.
  const usableSlug = isPostSlug(current)

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
  /**
   * Loads one story in one language, and works out whether the other language
   * exists so the toggle can be hidden when it does not.
   *
   * Called from a click, never from an effect: it happens because somebody
   * asked for it, not because state changed.
   */
  const load = useCallback(async (which: string, want: Lang) => {
    if (!isPostSlug(which)) { setState('failed'); return }

    setState('loading')

    const other: Lang = want === 'en' ? 'bn' : 'en'

    const fetchText = async (l: Lang) => {
      try {
        const res = await fetch(postPath(which, l))
        return res.ok ? await res.text() : null
      } catch {
        return null
      }
    }

    // A story need not exist in both languages. Paging always asks for English
    // first, so a piece published only as <slug>.bn.md used to 404 and report
    // itself as broken; it is simply a story with one language, and the one
    // that exists is what gets shown.
    let showing = want
    let text = await fetchText(want)
    if (text === null) {
      text = await fetchText(other)
      showing = other
    }

    if (text === null) {
      setPost(null)
      setState('failed')
      return
    }

    setPost(parsePost(text))
    setLang(showing)
    setState('idle')

    // The toggle is offered only when there really is another language to go
    // to - checked against what is actually on screen, not what was asked for.
    try {
      const alternate = await fetch(postPath(which, showing === 'en' ? 'bn' : 'en'), { method: 'HEAD' })
      setHasBengali(alternate.ok)
    } catch {
      setHasBengali(false)
    }
  }, [])

  const openPost = useCallback(async () => {
    setOpen(true)

    // The list is looked up once, beside the story itself. A missing or broken
    // manifest is not an error - it just means this is the only story.
    if (!slugs && discovered === null) {
      try {
        const res = await fetch('/assets/blogs/index.json')
        const list = res.ok ? await res.json() : null
        const found = Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []
        setDiscovered(found)
        // The manifest sets the reading order, which need not put this story
        // first. Point the index at the story actually on screen, or Next
        // would walk away from somewhere the reader never was.
        if (found.length > 0) setIndex(Math.max(0, found.indexOf(slug)))
      } catch {
        setDiscovered([])
      }
    }

    if (post) return
    await load(current, lang)
  }, [post, load, current, lang, slugs, discovered, slug])

  const goTo = useCallback(async (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= series.length) return
    setIndex(nextIndex)
    // A new story is a new question of which languages exist, so start from
    // English rather than carrying a choice that may not be available here.
    await load(series[nextIndex], 'en')
  }, [series, load])

  // Escape closes it, and the page behind does not scroll while it is up.
  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); return }
      // The arrows walk the series, which is what they are for in a reader.
      if (e.key === 'ArrowRight' && index < series.length - 1) { void goTo(index + 1) }
      if (e.key === 'ArrowLeft' && index > 0) { void goTo(index - 1) }
    }
    document.addEventListener('keydown', onKey)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, close, index, series.length, goTo])

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
              <h2 id={titleId}>{headingFor(current, slug, label, post?.meta.title)}</h2>
              {post?.meta.subtitle && <p className="blog-dialog__subtitle">{post.meta.subtitle}</p>}
              {(post?.meta.date || post?.meta.author) && (
                <p className="blog-dialog__byline">
                  {[post?.meta.author, post?.meta.date].filter(Boolean).join(' · ')}
                </p>
              )}
              {hasBengali && (
                <button
                  type="button"
                  className="blog-dialog__lang"
                  onClick={() => void load(current, lang === 'en' ? 'bn' : 'en')}
                  aria-label={lang === 'en' ? 'Read this story in Bengali' : 'Read this story in English'}
                >
                  {lang === 'en' ? 'বাংলায় পড়ুন' : 'Read in English'}
                </button>
              )}
            </header>

            <div className="blog-dialog__body">
              {state === 'loading' && <p className="blog-dialog__note">Fetching the story…</p>}
              {(state === 'failed' || !usableSlug) && (
                <p className="blog-dialog__note">
                  This story could not be loaded. It lives at
                  {' '}<code>public{postPath(current, lang)}</code>.
                </p>
              )}
              {state === 'idle' && post && post.blocks.map(renderBlock)}
            </div>

            {series.length > 1 && (
              <nav className="blog-dialog__pager" aria-label="More stories">
                <button
                  type="button"
                  className="blog-dialog__page"
                  onClick={() => void goTo(index - 1)}
                  disabled={index === 0}
                  aria-label="Previous story"
                >
                  ← Previous
                </button>
                <span className="blog-dialog__count">{index + 1} of {series.length}</span>
                <button
                  type="button"
                  className="blog-dialog__page"
                  onClick={() => void goTo(index + 1)}
                  disabled={index === series.length - 1}
                  aria-label="Next story"
                >
                  Next →
                </button>
              </nav>
            )}
          </div>
        </div>
      )}
    </>
  )
}
