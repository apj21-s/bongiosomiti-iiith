import fs from 'fs'
import path from 'path'
import { parseCsv } from './team'

/**
 * The gallery, read from public/gallery/gallery.csv.
 *
 * Adding a photo is two steps and neither is code: drop the file in
 * public/gallery/, add a row. The row order is the display order, so moving a
 * picture up the page means moving its line up the file.
 *
 * The shape returned is the one the album component already consumes, so the
 * lightbox - large title, event and year beneath it, counter top right,
 * filmstrip below - is untouched. Only where the list comes from has changed.
 */

export type GalleryPhoto = {
  src: string
  alt: string
  title: string
  /** "event • year", composed here so the CSV can keep them apart. */
  date: string
  /** object-position for the crop, since faces are rarely centred. */
  pos: string
  /**
   * The filmstrip copy, under public/gallery/thumbs/.
   *
   * Derived from the image path rather than being a CSV column: it is a
   * built artefact, not something anyone edits, and adding a column for it
   * would be one more thing to keep in step by hand. Falls back to the full
   * image when no thumbnail has been built, so a newly added photo still
   * shows before the script is run.
   */
  thumb: string
}

const CSV = path.join(process.cwd(), 'public', 'gallery', 'gallery.csv')
const THUMB_DIR = path.join(process.cwd(), 'public', 'gallery', 'thumbs')

/** The separator between event and year, as the current gallery draws it. */
const DOT = '•'

export function getGallery(): GalleryPhoto[] {
  let text: string
  try {
    text = fs.readFileSync(CSV, 'utf8')
  } catch {
    // No CSV, no override: the caller falls back to whatever it used before.
    return []
  }

  return parseCsv(text)
    .filter((row) => row.title && row.image)
    .map((row) => {
      const event = row.event || ''
      const year = row.year || ''
      return {
        src: row.image,
        alt: row.alt || row.title,
        title: row.title,
        date: [event, year].filter(Boolean).join(` ${DOT} `),
        pos: row.focus || 'center 36%',
        thumb: thumbFor(row.image),
      }
    })
}

/**
 * The thumbnail beside a gallery image, or the image itself if none exists.
 *
 * /gallery/Mahalaya%202025/x.webp -> /gallery/thumbs/Mahalaya%202025/x.webp
 * An absolute URL has no local thumbnail and is returned unchanged.
 */
function thumbFor(image: string): string {
  const PREFIX = '/gallery/'
  if (!image.startsWith(PREFIX)) return image

  const rest = image.slice(PREFIX.length)
  const onDisk = path.join(THUMB_DIR, ...rest.split('/').map(decodeURIComponent))

  try {
    return fs.existsSync(onDisk) ? `${PREFIX}thumbs/${rest}` : image
  } catch {
    return image
  }
}
