/**
 * Just enough Markdown for the blog posts under public/assets/blogs.
 *
 * Deliberately not a full parser and deliberately not HTML. It returns a list
 * of blocks which the component renders as React elements, so nothing here can
 * inject markup - no dangerouslySetInnerHTML anywhere in the path. The posts
 * are written by whoever holds the repository, but a renderer that cannot
 * produce HTML cannot be turned into one by a careless edit either.
 *
 * Supported: --- frontmatter, # to ### headings, paragraphs, - lists,
 * > quotes, --- rules, **bold**, *italic*, `code` and [links](url).
 *
 * No imports, so it can be exercised on its own.
 */

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'em'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; value: string; href: string }

export type Block =
  | { type: 'heading'; level: 2 | 3 | 4; inlines: Inline[] }
  | { type: 'paragraph'; inlines: Inline[] }
  | { type: 'list'; items: Inline[][] }
  | { type: 'quote'; inlines: Inline[] }
  | { type: 'rule' }

export type Post = {
  meta: Record<string, string>
  blocks: Block[]
}

/**
 * Only links that go somewhere safe.
 *
 * http and https for the web, mailto for the address in the footer. Anything
 * else - javascript:, data:, vbscript: - becomes plain text instead, so a link
 * in a post cannot run anything.
 */
function safeHref(raw: string): string | null {
  const href = raw.trim()
  if (/^(https?:|mailto:)/i.test(href)) return href
  // A same-site path is fine; a protocol-relative one is not, since it leaves.
  if (/^\/(?!\/)/.test(href)) return href
  if (/^#[\w-]+$/.test(href)) return href
  return null
}

function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  // One pass, longest markers first so ** is not read as two *.
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g

  let last = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push({ type: 'text', value: text.slice(last, match.index) })

    if (match[1] !== undefined) {
      const href = safeHref(match[2])
      if (href) out.push({ type: 'link', value: match[1], href })
      else out.push({ type: 'text', value: match[1] })
    } else if (match[3] !== undefined) {
      out.push({ type: 'strong', value: match[3] })
    } else if (match[4] !== undefined) {
      out.push({ type: 'em', value: match[4] })
    } else if (match[5] !== undefined) {
      out.push({ type: 'code', value: match[5] })
    }

    last = pattern.lastIndex
  }

  if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
  return out.length > 0 ? out : [{ type: 'text', value: text }]
}

function parseFrontmatter(source: string): { meta: Record<string, string>; body: string } {
  const meta: Record<string, string> = {}

  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source)
  if (!match) return { meta, body: source }

  for (const line of match[1].split(/\r?\n/)) {
    const at = line.indexOf(':')
    if (at < 1) continue
    const key = line.slice(0, at).trim()
    // Values are rendered as text, never as markup; the cap is so a runaway
    // file cannot push a megabyte into a heading.
    const value = line.slice(at + 1).trim().replace(/^["']|["']$/g, '').slice(0, 300)
    if (key) meta[key] = value
  }

  return { meta, body: source.slice(match[0].length) }
}

export function parsePost(source: string): Post {
  const { meta, body } = parseFrontmatter(String(source || ''))
  const blocks: Block[] = []

  // Blank-line separated, which is how the posts are written.
  for (const chunk of body.split(/\r?\n\s*\r?\n/)) {
    const lines = chunk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) continue

    if (lines.every((l) => /^(-{3,}|\*{3,}|_{3,})$/.test(l))) {
      blocks.push({ type: 'rule' })
      continue
    }

    if (lines.every((l) => l.startsWith('>'))) {
      blocks.push({ type: 'quote', inlines: parseInline(lines.map((l) => l.replace(/^>\s?/, '')).join(' ')) })
      continue
    }

    if (lines.every((l) => /^[-*]\s+/.test(l))) {
      blocks.push({ type: 'list', items: lines.map((l) => parseInline(l.replace(/^[-*]\s+/, ''))) })
      continue
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(lines[0])
    if (heading) {
      // The post's own title is the dialog's heading, so the body starts at h2
      // and a '#' in the text does not produce a second h1 on the page.
      const level = Math.min(4, Math.max(2, heading[1].length + 1)) as 2 | 3 | 4
      blocks.push({ type: 'heading', level, inlines: parseInline(heading[2]) })

      const rest = lines.slice(1)
      if (rest.length > 0) blocks.push({ type: 'paragraph', inlines: parseInline(rest.join(' ')) })
      continue
    }

    blocks.push({ type: 'paragraph', inlines: parseInline(lines.join(' ')) })
  }

  return { meta, blocks }
}

/** Post slugs are filenames, so they are held to a filename's shape. */
export function isPostSlug(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value)
}
