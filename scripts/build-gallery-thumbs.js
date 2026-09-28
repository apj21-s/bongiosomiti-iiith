#!/usr/bin/env node
/**
 * Builds the filmstrip thumbnails under public/gallery/thumbs/.
 *
 *   node scripts/build-gallery-thumbs.js          build what is missing
 *   node scripts/build-gallery-thumbs.js --force  rebuild everything
 *
 * Run it after adding photos to public/gallery/. The lightbox strip draws its
 * pictures at 68x50, so pointing it at the full images means downloading the
 * entire album - several megabytes - to show one photo. These copies are a
 * few kilobytes each and the whole strip costs less than one full image.
 *
 * Nothing here is a source of truth: the gallery is public/gallery/gallery.csv
 * and these are derived from it. Deleting the folder only costs a rebuild,
 * and utils/data/gallery.ts falls back to the full image for anything missing.
 */

const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

// The CSV reader is TypeScript and imports a sibling without a file
// extension, which Next resolves and bare node does not.
const { register } = require('node:module')
const { pathToFileURL } = require('node:url')
register('./ts-resolver.mjs', pathToFileURL(__filename))

const ROOT = process.cwd()
const GALLERY = path.join(ROOT, 'public', 'gallery')
const THUMBS = path.join(GALLERY, 'thumbs')
const CSV = path.join(GALLERY, 'gallery.csv')

// 68x50 on screen, doubled for high-density displays and rounded up.
const WIDTH = 160
const FORCE = process.argv.includes('--force')

async function rowsFromCsv() {
  // The shared reader, not a split on commas: a title like "Bhog, Prasad and
  // Adda" is one quoted cell, and splitting it would hand back the wrong
  // column entirely.
  const { parseCsv } = await import('../utils/data/team.ts')
  const rows = parseCsv(fs.readFileSync(CSV, 'utf8'))
  if (rows.length > 0 && !('image' in rows[0])) {
    throw new Error('gallery.csv has no "image" column')
  }
  return rows.map((r) => r.image).filter(Boolean)
}

async function main() {
  const images = await rowsFromCsv()
  let built = 0
  let skipped = 0
  let missing = 0
  let bytes = 0

  for (const image of images) {
    if (!image.startsWith('/gallery/')) {
      // An absolute URL, hosted elsewhere. Nothing to build.
      continue
    }

    const relative = image.slice('/gallery/'.length).split('/').map(decodeURIComponent)
    const source = path.join(GALLERY, ...relative)
    const target = path.join(THUMBS, ...relative)

    if (!fs.existsSync(source)) {
      console.warn(`  missing  ${image}`)
      missing += 1
      continue
    }

    if (!FORCE && fs.existsSync(target) && fs.statSync(target).mtimeMs >= fs.statSync(source).mtimeMs) {
      skipped += 1
      bytes += fs.statSync(target).size
      continue
    }

    fs.mkdirSync(path.dirname(target), { recursive: true })

    // Read into memory first: libvips otherwise keeps a handle on the file,
    // which on Windows blocks anything that later moves or replaces it.
    await sharp(fs.readFileSync(source))
      .resize({ width: WIDTH, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toFile(target)

    bytes += fs.statSync(target).size
    built += 1
  }

  console.log(
    `${built} built, ${skipped} already current${missing ? `, ${missing} missing` : ''} - ` +
      `${(bytes / 1024).toFixed(0)} KB for the whole strip`
  )
  if (missing > 0) process.exitCode = 1
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
})
