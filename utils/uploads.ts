import path from 'path'

// SVG is deliberately absent: it can carry script, and these files are served
// from the site's own origin.
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'])
const ALLOWED_MIME_PREFIX = 'image/'

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export type SafeUpload = { ok: true; filename: string } | { ok: false; error: string }

// Produces a filename that cannot escape the upload directory and cannot be an
// executable or markup type, or explains why the file was rejected.
export function safeUploadFilename(file: File): SafeUpload {
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'File is larger than the 5MB limit' }
  }

  if (file.type && !file.type.startsWith(ALLOWED_MIME_PREFIX)) {
    return { ok: false, error: 'Only image files can be uploaded' }
  }

  // path.basename strips any directory components before the extension is read,
  // so "../../x.png" cannot reach outside the upload directory.
  const base = path.basename(file.name || '')
  const extension = path.extname(base).toLowerCase()

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return { ok: false, error: 'Unsupported image type' }
  }

  const stem = path
    .basename(base, path.extname(base))
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^[._]+/, '')
    .slice(0, 80)

  return { ok: true, filename: `${Date.now()}_${stem || 'upload'}${extension}` }
}
