#!/usr/bin/env node
/**
 * Makes the events table agree with public/data/events.json, or reports where
 * it does not.
 *
 *   node scripts/sync-events.js --check    say what differs, change nothing
 *   node scripts/sync-events.js            push the file into the table
 *   node scripts/sync-events.js --force    push even from a deployment that
 *                                          does not own the rows
 *
 * Every deployment pointed at this Supabase project shares one events table,
 * while events.json is per branch. Writing is therefore refused unless
 * EVENTS_DB_WRITES=true says these rows belong to this environment - a dev
 * branch reconciling would otherwise reach into the live site's row. --check
 * works anywhere, and is the point on a branch that does not own them.
 *
 * The file is the truth: every page and API route reads it. The row exists so
 * tickets.event_id has something to point at and the admin counts have
 * something to count. Rows with no file entry are reported and left alone -
 * people hold passes against them.
 *
 * Reads the connection from .env.local and talks to PostgREST over HTTPS,
 * because the Postgres port is blocked on some networks.
 */

const fs = require('fs')
const path = require('path')

const MIRRORED_FIELDS = [
  'id', 'slug', 'name', 'event_date', 'venue', 'capacity',
  'price', 'category', 'description', 'image_url', 'status',
]

function loadEnv() {
  const file = path.join(process.cwd(), '.env.local')
  const env = {}
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#') || !t.includes('=')) continue
      const i = t.indexOf('=')
      env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^"|"$/g, '')
    }
  }
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
  }
}

async function rest(base, key, path, init = {}) {
  const res = await fetch(base.replace(/\/$/, '') + path, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : null
}

function toRow(event) {
  const row = {}
  for (const field of MIRRORED_FIELDS) {
    if (event[field] !== undefined) row[field] = event[field]
  }
  return row
}

function drift(event, row) {
  const out = []
  for (const field of MIRRORED_FIELDS) {
    if (event[field] === undefined) continue
    const a = event[field]
    const b = row[field] === undefined ? null : row[field]
    if (String(a) !== String(b)) out.push({ field, file: a, database: b })
  }
  return out
}

async function main() {
  const check = process.argv.includes('--check')
  const force = process.argv.includes('--force')
  const { url, key } = loadEnv()

  const owns = process.env.EVENTS_DB_WRITES === 'true'
  if (!check && !owns && !force) {
    console.error('This environment does not own the shared events rows.')
    console.error('EVENTS_DB_WRITES is not "true", so reconciling would write into')
    console.error('whatever else points at this Supabase project.')
    console.error('Run with --check to see the differences, or --force if you are certain.')
    process.exitCode = 2
    return
  }

  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
    process.exitCode = 2
    return
  }

  const events = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'public', 'data', 'events.json'), 'utf8')
  )
  const rows = await rest(url, key, '/rest/v1/events?select=*')
  const bySlug = new Map(rows.map((r) => [r.slug, r]))

  let differences = 0

  for (const event of events) {
    const row = bySlug.get(event.slug)

    if (!row) {
      differences += 1
      console.log(`${event.slug}: not in the database`)
      if (!check) {
        await rest(url, key, '/rest/v1/events', {
          method: 'POST',
          body: JSON.stringify(toRow(event)),
          headers: { Prefer: 'return=minimal' },
        })
        console.log(`  inserted`)
      }
      continue
    }

    const fields = drift(event, row)
    if (fields.length === 0) continue

    differences += 1
    console.log(`${event.slug}: ${fields.length} field(s) differ`)
    for (const f of fields) {
      console.log(`  ${f.field}: file ${JSON.stringify(f.file)} / database ${JSON.stringify(f.database)}`)
    }

    if (!check) {
      await rest(url, key, `/rest/v1/events?id=eq.${encodeURIComponent(event.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(toRow(event)),
        headers: { Prefer: 'return=minimal' },
      })
      console.log(`  updated from the file`)
    }
  }

  const fileSlugs = new Set(events.map((e) => e.slug))
  for (const row of rows) {
    if (!fileSlugs.has(row.slug)) {
      console.log(`${row.slug}: in the database only - left alone, tickets may point at it`)
    }
  }

  if (differences === 0) {
    console.log('events.json and the events table agree.')
  } else if (check) {
    console.log(`\n${differences} event(s) out of sync. Run without --check to reconcile.`)
    process.exitCode = 1
  } else {
    console.log(`\n${differences} event(s) reconciled.`)
  }
}

main().catch((e) => {
  console.error('sync failed:', e.message)
  process.exitCode = 2
})
