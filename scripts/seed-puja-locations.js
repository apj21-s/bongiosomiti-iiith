#!/usr/bin/env node
/**
 * Brings the map pins from the old JSON into the puja_locations table.
 *
 *   node scripts/seed-puja-locations.js --dry   show what would be inserted
 *   node scripts/seed-puja-locations.js         insert them
 *
 * Run once, after supabase/puja-locations.sql. Safe to run again: the unique
 * index on (name, lat, lng) means a second run inserts nothing rather than
 * doubling every pin.
 *
 * The source file is the one the map used to import directly. Once this has
 * run the table is the source of truth and the JSON moves to others/ - see
 * others/README.md.
 */

require('dotenv').config({ path: '.env.local' })

const { register } = require('node:module')
const { pathToFileURL } = require('node:url')
register('./ts-resolver.mjs', pathToFileURL(__filename))

const fs = require('fs')
const path = require('path')

const DRY = process.argv.includes('--dry')

// The JSON lives in public/data until this has been run, and in others/
// afterwards. Look in both so a re-run after the move still works.
const CANDIDATES = [
  path.join(process.cwd(), 'public', 'data', 'pujas-raw-65-finalversion-1.json'),
  path.join(process.cwd(), 'others', 'pujas-raw-65-finalversion-1.json'),
]

function env(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set. Seeding needs the Supabase connection from .env.local.`)
  return value
}

const BASE = env('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '')
const KEY = env('SUPABASE_SERVICE_ROLE_KEY')

async function db(pathAndQuery, init) {
  const res = await fetch(`${BASE}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(init && init.headers),
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

async function main() {
  const { readLocationInput, toDatabaseRow } = await import('../utils/data/puja-locations.ts')

  const source = CANDIDATES.find((p) => fs.existsSync(p))
  if (!source) {
    console.error('Could not find pujas-raw-65-finalversion-1.json in public/data or others/.')
    process.exitCode = 1
    return
  }

  const raw = JSON.parse(fs.readFileSync(source, 'utf8'))
  console.log(`${raw.length} pins in ${path.relative(process.cwd(), source)}\n`)

  const rows = []
  let rejected = 0

  raw.forEach((puja, i) => {
    // The JSON calls them puja/venue; the table calls them name/address.
    const input = readLocationInput({
      name: puja.puja,
      address: puja.venue,
      lat: puja.lat,
      lng: puja.lng,
      status: puja.status,
      sortOrder: i,
    })

    if (!input.ok) {
      console.warn(`  skip  ${puja.puja || '(no name)'} - ${input.errors.join(' ')}`)
      rejected += 1
      return
    }

    rows.push(toDatabaseRow(input.value, 'seed-puja-locations'))
  })

  if (DRY) {
    for (const r of rows) console.log(`  would  ${r.name} - ${r.address} (${r.lat}, ${r.lng})`)
    console.log(`\nDry run. ${rows.length} would be inserted, ${rejected} rejected.`)
    return
  }

  if (rows.length === 0) {
    console.log('Nothing to insert.')
    return
  }

  let existing
  try {
    existing = await db('puja_locations?select=name,lat,lng')
  } catch (e) {
    if (/does not exist|schema cache/i.test(String(e))) {
      console.error('Run supabase/puja-locations.sql first - puja_locations does not exist yet.')
      process.exitCode = 1
      return
    }
    throw e
  }

  // The unique index is on expressions - lower(name) and rounded coordinates -
  // and PostgREST's on_conflict only understands plain column names, so the
  // duplicate check happens here. Same key the index uses, so the database
  // still has the final say if two runs race.
  const key = (name, lat, lng) =>
    `${String(name).toLowerCase()}|${Number(lat).toFixed(6)}|${Number(lng).toFixed(6)}`

  const already = new Set(existing.map((r) => key(r.name, r.lat, r.lng)))
  const fresh = rows.filter((r) => !already.has(key(r.name, r.lat, r.lng)))

  if (existing.length > 0) {
    console.log(`puja_locations already has ${existing.length} row(s). Inserting only what is missing.`)
  }

  if (fresh.length === 0) {
    console.log(`\nNothing new. ${rows.length} already there, ${rejected} rejected.`)
    return
  }

  const inserted = await db('puja_locations', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(fresh),
  })

  console.log(`\n${inserted.length} inserted, ${rows.length - fresh.length} already there, ${rejected} rejected.`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
})
