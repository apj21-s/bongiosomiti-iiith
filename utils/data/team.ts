import fs from 'fs'
import path from 'path'

/**
 * The people running the festival, read from public/data/team.csv.
 *
 * A CSV because the list changes every year and is maintained by whoever is
 * organising, not by whoever last touched the code: adding a member is a row,
 * and removing one is deleting a row. Nothing here needs a deploy to edit
 * beyond the file itself.
 *
 * Read on the server at request time, so an edited file shows up on reload.
 */

export type TeamMember = {
  name: string
  course: string
  whatsapp: string
  photo: string
  role?: string
}

/**
 * What a row cannot do without: somebody to ask for, and a way to reach them.
 *
 * Course and photo used to be required too, which meant a row missing either
 * was dropped from the page without a word - and the people here are points of
 * contact, not a prospectus. A missing photo falls back to the placeholder
 * below; a missing course simply is not shown.
 */
const REQUIRED = ['name', 'whatsapp'] as const

/** Stands in until somebody's own picture is dropped into public/assets/team. */
const NO_PHOTO = '/assets/team/placeholder.svg'

/**
 * A small CSV reader: quoted fields, escaped quotes, commas inside quotes.
 *
 * Deliberately not a dependency. The file is written by hand by people who may
 * well put a comma in a course name, and that is the whole of the complexity
 * worth handling.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1 } else quoted = false
      } else field += ch
      continue
    }

    if (ch === '"') { quoted = true; continue }
    if (ch === ',') { row.push(field); field = ''; continue }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
      field = ''
      continue
    }
    field += ch
  }
  row.push(field)
  if (row.some((c) => c.trim() !== '')) rows.push(row)

  if (rows.length < 2) return []

  const header = rows[0].map((h) => h.trim().toLowerCase())
  return rows.slice(1).map((cells) => {
    const record: Record<string, string> = {}
    header.forEach((key, i) => { record[key] = (cells[i] ?? '').trim() })
    return record
  })
}

/**
 * One value, quoted if it needs to be.
 *
 * The counterpart to the reader above. Writing a bare comma into a cell is
 * how "Bhog, Prasad and Adda" silently becomes two columns and shunts every
 * later column one place left, which shows up as a gallery row with the wrong
 * year rather than as an error. Quotes are doubled, per RFC 4180.
 *
 * Leading or trailing spaces are quoted too, since the reader trims and would
 * otherwise lose them.
 */
export function toCsvValue(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  if (!/[",\r\n]/.test(s) && s === s.trim()) return s
  return `"${s.replace(/"/g, '""')}"`
}

/** A whole file: a header row followed by one row per record. */
export function toCsv(header: readonly string[], rows: readonly unknown[][]): string {
  const lines = [header.map(toCsvValue).join(',')]
  for (const row of rows) lines.push(row.map(toCsvValue).join(','))
  return lines.join('\n') + '\n'
}

/** A phone number reduced to what wa.me accepts: digits, no punctuation. */
export function whatsappLink(number: string): string | null {
  const digits = (number || '').replace(/\D/g, '')
  if (digits.length < 8) return null
  // Bare ten-digit numbers are Indian here; anything longer already carries a
  // country code.
  return `https://wa.me/${digits.length === 10 ? '91' + digits : digits}`
}

export function getTeam(): TeamMember[] {
  let text: string
  try {
    text = fs.readFileSync(path.join(process.cwd(), 'public', 'data', 'team.csv'), 'utf8')
  } catch {
    // No file, no section. An absent team list is not an error.
    return []
  }

  return parseCsv(text)
    .filter((row) => REQUIRED.every((key) => row[key]))
    .map((row) => ({
      name: row.name,
      course: row.course,
      whatsapp: row.whatsapp,
      photo: row.photo || NO_PHOTO,
      role: row.role || undefined,
    }))
}
