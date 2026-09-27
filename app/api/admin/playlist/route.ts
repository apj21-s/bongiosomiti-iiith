import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { requireAdmin } from '@/utils/auth/require-admin'
import { setSitePlaylist } from '@/utils/data/site-playlist'
import { PRESET_PLAYLISTS } from '@/utils/data/preset-playlists'
import {
  addEntry,
  makeFirst,
  playlistUrlFor,
  readLibrary,
  removeEntry,
  renameEntry,
  toFileShape,
  type LibraryEntry,
  type LibraryResult,
} from '@/utils/data/playlist-library'

/**
 * The playlists the homepage offers, curated by the super admin.
 *
 * They live in public/data/playlists.json, which the site already reads, and
 * the first one is what the player starts on. The single-row site_playlist
 * table is kept in step with that first entry, because a deployment reads it in
 * preference to the file - the two disagreeing is how the events data drifted,
 * and the same trap is here.
 *
 * The file write is the one that fails on Vercel, whose filesystem is
 * read-only. When it does, the response says so rather than reporting a save
 * that did not happen.
 */

const REQUIRED_TIER = 3
const FILE = path.join(process.cwd(), 'public', 'data', 'playlists.json')

function load(): { entries: LibraryEntry[]; seeded: boolean } {
  let raw: unknown = []
  try {
    raw = JSON.parse(fs.readFileSync(FILE, 'utf8'))
  } catch {
    raw = []
  }

  const entries = readLibrary(raw)

  // Nothing curated yet: show what the homepage is actually playing, which is
  // the shipped set, so the first thing this page does is not ask for a link.
  if (entries.length === 0) {
    return { entries: PRESET_PLAYLISTS.map((p) => ({ id: p.id, name: p.name })), seeded: true }
  }

  return { entries, seeded: false }
}

async function persist(entries: LibraryEntry[]) {
  const warnings: string[] = []

  try {
    fs.writeFileSync(FILE, JSON.stringify(toFileShape(entries), null, 2) + '\n')
  } catch (e) {
    warnings.push(
      `The playlists file could not be written (${e instanceof Error ? e.message : 'unknown'}). ` +
      'On a read-only deployment this is expected: edit public/data/playlists.json in the repository instead.'
    )
  }

  // The first entry is what plays; the row exists so a deployment reading it
  // does not contradict the file.
  const first = entries[0]
  const result = await setSitePlaylist({
    link: first ? `https://www.youtube.com/playlist?list=${first.id}` : '',
    name: first ? first.name : 'Playlist',
    isEnabled: true,
  })

  if (!result.ok) warnings.push(`The site_playlist row was not updated: ${result.error}`)

  return warnings
}

function present(entries: LibraryEntry[], seeded: boolean, warnings: string[] = []) {
  return NextResponse.json({
    entries: entries.map((entry, i) => ({
      ...entry,
      url: playlistUrlFor(entry.id),
      isDefault: i === 0,
    })),
    seeded,
    warnings,
  })
}

export async function GET() {
  const guard = await requireAdmin(REQUIRED_TIER)
  if (!guard.ok) return guard.response

  const { entries, seeded } = load()
  return present(entries, seeded)
}

async function apply(request: Request, change: (entries: LibraryEntry[], input: Record<string, unknown>) => LibraryResult) {
  const guard = await requireAdmin(REQUIRED_TIER)
  if (!guard.ok) return guard.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { entries } = load()
  const result = change(entries, (body ?? {}) as Record<string, unknown>)

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  const warnings = await persist(result.entries)
  return present(result.entries, false, warnings)
}

/** Add one. */
export async function POST(request: Request) {
  return apply(request, (entries, input) => addEntry(entries, input.link, input.name))
}

/** Remove one, or rename it, or move it to the front. */
export async function PATCH(request: Request) {
  return apply(request, (entries, input) => {
    if (input.action === 'makeDefault') return makeFirst(entries, input.id)
    if (input.action === 'rename') return renameEntry(entries, input.id, input.name)
    return { ok: false, error: 'Unknown action' }
  })
}

export async function DELETE(request: Request) {
  return apply(request, (entries, input) => removeEntry(entries, input.id))
}
