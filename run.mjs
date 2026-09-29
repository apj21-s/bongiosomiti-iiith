#!/usr/bin/env node
/**
 * One command to run the site.
 *
 *   node run.mjs                  dev server on http://localhost:3000
 *   node run.mjs --fresh          wipe registration data first, then start
 *   node run.mjs --help           every option
 *
 * Plain Node with no shell tricks, so the same command works in PowerShell,
 * cmd and bash. It installs dependencies when they are missing, checks that
 * .env.local has what the site needs before Next starts (instead of a crash
 * on the first request), and optionally clears the databases.
 *
 * What --fresh clears is what visitors and staff create, and nothing else:
 *
 *   tickets, checkins, email_verifications, and every uploaded receipt in the
 *   `receipts` storage bucket - or, with --dummy, the local mock store.
 *
 * What it keeps is the site's setup: events, admin and manager accounts, map
 * locations and the homepage playlist. Wiping those would leave a site that
 * cannot take a booking, and manager passwords cannot be recovered.
 *
 * The Supabase project is shared by every deployment pointed at it - possibly
 * including the live site - so a flush shows what it is about to delete and
 * asks for the project's name to be typed back before touching anything.
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import readline from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
process.chdir(ROOT)

const HELP = `
Usage: node run.mjs [options]

  (no options)   Start the dev server at http://localhost:3000
  --prod         Build, then serve the production build
  --port <n>     Port to listen on (default 3000)
  --dummy        Use the local mock store (local_db.json) instead of Supabase.
                 Needs no .env.local.
  --fresh        Delete all registration data before starting:
                   Supabase: tickets, checkins, email_verifications and the
                             files in the 'receipts' storage bucket
                   --dummy:  local_db.json
                 Events, admin/manager accounts, map locations and the
                 playlist are kept. Asks for confirmation first.
  --yes          With --fresh, skip the confirmation (for scripts).
  --flush-only   With --fresh, clear the data and exit without starting.
  --help         Show this.

Examples:
  node run.mjs
  node run.mjs --fresh
  node run.mjs --dummy --fresh --port 4000
  node run.mjs --prod
`

// --------------------------------------------------------------------------
// Options

function parseArgs(argv) {
  const opts = { prod: false, port: 3000, dummy: false, fresh: false, yes: false, flushOnly: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') { console.log(HELP); process.exit(0) }
    else if (arg === '--prod') opts.prod = true
    else if (arg === '--dummy') opts.dummy = true
    else if (arg === '--fresh') opts.fresh = true
    else if (arg === '--yes' || arg === '-y') opts.yes = true
    else if (arg === '--flush-only') opts.flushOnly = true
    else if (arg === '--port' || arg.startsWith('--port=')) {
      const value = arg.includes('=') ? arg.split('=')[1] : argv[++i]
      const port = Number(value)
      if (!Number.isInteger(port) || port < 1 || port > 65535) fail(`--port needs a number from 1 to 65535, not "${value ?? ''}".`)
      opts.port = port
    } else fail(`Unknown option "${arg}". Run "node run.mjs --help" for the list.`)
  }
  if (opts.flushOnly && !opts.fresh) fail('--flush-only only means something together with --fresh.')
  return opts
}

function fail(message) {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

const step = (message) => console.log(`\n▸ ${message}`)

// --------------------------------------------------------------------------
// Environment

function checkNode() {
  const [major, minor] = process.versions.node.split('.').map(Number)
  if (major < 20 || (major === 20 && minor < 9)) {
    fail(`Node ${process.versions.node} is too old. Next 16 needs 20.9 or newer.`)
  }
}

function ensureDependencies() {
  if (existsSync(path.join(ROOT, 'node_modules', 'next', 'package.json'))) return
  step('Installing dependencies (node_modules is missing)…')
  // npm is npm.cmd on Windows, which only runs through a shell.
  const result = spawnSync('npm', ['install'], { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) fail('npm install failed. Fix the error above and run this again.')
}

/**
 * The environment Next will run with: .env.local over the process's own.
 *
 * Next reads .env.local itself as well, but the checks and the flush below
 * need the same values first, and anything set here (DUMMY_DB for --dummy)
 * has to win over the file - which it does, because Next never overrides a
 * variable that is already set.
 */
async function loadEnv(opts) {
  const env = { ...process.env }
  const file = path.join(ROOT, '.env.local')
  if (existsSync(file)) {
    const { parse } = (await import('dotenv')).default
    for (const [key, value] of Object.entries(parse(readFileSync(file)))) {
      if (env[key] === undefined) env[key] = value
    }
  }

  if (opts.dummy) env.DUMMY_DB = 'True'
  const dummy = env.DUMMY_DB === 'True'

  if (dummy) {
    // The middleware builds a Supabase client before it looks at DUMMY_DB, and
    // throws without a URL and key. Nothing reaches this address. The service
    // key is deliberately not faked: sessions are signed with it when
    // SESSION_SECRET is absent, and a made-up value here would be a published
    // signing key.
    env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://127.0.0.1:54321'
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'dummy-anon-key'
  } else {
    const missing = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !env[k])
    if (missing.length) {
      fail(
        `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not set.\n` +
        '  Copy .env.example to .env.local and fill in the Supabase values,\n' +
        '  or run with --dummy to use the local mock store instead.'
      )
    }
  }

  // utils/auth/session.ts signs with SESSION_SECRET, else the service-role
  // key, else - outside production only - a built-in development secret.
  if (opts.prod && !env.SESSION_SECRET && !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('! Neither SESSION_SECRET nor SUPABASE_SERVICE_ROLE_KEY is set, so a production build refuses admin sign-in.')
  }
  if (!env.TIER3_EMAIL || !env.TIER3_PASSWORD) {
    console.warn('! TIER3_EMAIL / TIER3_PASSWORD are not set, so nobody can sign in as super admin.')
  }

  return { env, dummy }
}

// --------------------------------------------------------------------------
// --fresh

// Deleted in this order: checkins point at tickets.
const TABLES = ['checkins', 'tickets', 'email_verifications']
const BUCKET = 'receipts'

function flushDummy() {
  const file = path.join(ROOT, 'local_db.json')
  if (existsSync(file)) {
    rmSync(file)
    console.log('  Deleted local_db.json. The mock store starts again from its seed data on the next request.')
  } else {
    console.log('  local_db.json does not exist; the mock store is already fresh.')
  }
}

const isMissingTable = (error) => /does not exist|could not find the table|PGRST205|42P01/i.test(`${error?.code} ${error?.message}`)
const isMissingBucket = (error) => /bucket/i.test(error?.message || '') && /not found|does not exist/i.test(error?.message || '')

/** Rows in the table, or null when this database does not have it. */
async function countRows(supabase, table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) {
    if (isMissingTable(error)) return null
    throw new Error(`Could not read ${table}: ${error.message}`)
  }
  // A count-only request to a table that does not exist gets a bodiless 404,
  // which the client reports as no error and no count. An existing table,
  // even an empty one, always comes back with a count.
  return count ?? null
}

/** Every object name at the top of the bucket - where /api/receipts puts them. */
async function listReceipts(supabase) {
  const names = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: 1000, offset })
    if (error) {
      if (isMissingBucket(error)) return null
      throw new Error(`Could not list the ${BUCKET} bucket: ${error.message}`)
    }
    // Folders come back with a null id; receipts are never put in one.
    const files = (data || []).filter((o) => o.id)
    names.push(...files.map((o) => o.name))
    if ((data || []).length < 1000) return names
  }
}

async function flushSupabase(env, opts) {
  const { createClient } = await import('@supabase/supabase-js')
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const supabase = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  // "abcd1234" out of https://abcd1234.supabase.co; the whole host otherwise.
  const host = new URL(url).hostname
  const project = host.endsWith('.supabase.co') ? host.split('.')[0] : host

  const counts = {}
  for (const table of TABLES) counts[table] = await countRows(supabase, table)
  const receipts = await listReceipts(supabase)

  console.log(`\n  Supabase project: ${project}`)
  for (const table of TABLES) {
    console.log(`    ${table.padEnd(20)} ${counts[table] === null ? 'table not found, skipped' : `${counts[table]} row(s)`}`)
  }
  console.log(`    ${(BUCKET + ' (storage)').padEnd(20)} ${receipts === null ? 'bucket not found, skipped' : `${receipts.length} file(s)`}`)
  console.log('  Kept: events, admin_profiles, manager_profiles, puja_locations, site_playlist.')

  const total = TABLES.reduce((n, t) => n + (counts[t] || 0), 0) + (receipts?.length || 0)
  if (total === 0) {
    console.log('\n  Nothing to delete.')
    return
  }

  if (!opts.yes) {
    if (!process.stdin.isTTY) fail('--fresh needs a confirmation, and there is no terminal to ask in. Add --yes to go ahead without one.')
    console.log(
      '\n  This project is shared by every deployment that points at it - if the live\n' +
      '  site uses it, its registrations go too. This cannot be undone.'
    )
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.on('SIGINT', () => { rl.close(); fail('Cancelled. Nothing was deleted.') })
    const answer = (await rl.question(`  Type "${project}" to delete all of the above: `)).trim()
    rl.close()
    if (answer !== project) fail('Did not match. Nothing was deleted.')
  }

  for (const table of TABLES) {
    if (counts[table] === null || counts[table] === 0) continue
    // PostgREST refuses a DELETE with no filter; every row has an id.
    const { error } = await supabase.from(table).delete().not('id', 'is', null)
    if (error) fail(`Could not clear ${table}: ${error.message}. Tables after it were left alone.`)
    console.log(`  Cleared ${table}.`)
  }

  if (receipts && receipts.length) {
    for (let i = 0; i < receipts.length; i += 1000) {
      const { error } = await supabase.storage.from(BUCKET).remove(receipts.slice(i, i + 1000))
      if (error) fail(`Could not delete receipts: ${error.message}`)
    }
    console.log(`  Deleted ${receipts.length} receipt file(s).`)
  }

  // Counted again rather than assumed: a policy or trigger that quietly kept
  // rows would otherwise be reported as a clean slate.
  const left = []
  for (const table of TABLES) {
    if (counts[table] === null) continue
    const n = await countRows(supabase, table)
    if (n) left.push(`${table}: ${n}`)
  }
  if (left.length) fail(`Some rows are still there (${left.join(', ')}).`)
  console.log('  Verified: every cleared table is empty.')
}

// --------------------------------------------------------------------------
// Start

const nextBin = () => createRequire(import.meta.url).resolve('next/dist/bin/next')

function runNext(args, env) {
  // Ctrl+C reaches Next directly through the shared terminal. This process
  // stays up until Next has shut down, then exits with its code.
  process.on('SIGINT', () => {})
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [nextBin(), ...args], { stdio: 'inherit', env })
    // A SIGTERM sent to this process alone is passed on.
    const stop = () => child.kill('SIGTERM')
    process.on('SIGTERM', stop)
    child.on('exit', (code, signal) => {
      process.off('SIGTERM', stop)
      resolve(signal ? 1 : (code ?? 0))
    })
  })
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  checkNode()
  ensureDependencies()
  const { env, dummy } = await loadEnv(opts)

  if (opts.fresh) {
    step(`Flushing registration data (${dummy ? 'local mock store' : 'Supabase'})…`)
    if (dummy) flushDummy()
    else await flushSupabase(env, opts)
    if (opts.flushOnly) {
      console.log('\n✓ Done. Not starting the site (--flush-only).\n')
      return
    }
  }

  const port = String(opts.port)
  env.NEXT_TELEMETRY_DISABLED ||= '1'

  if (opts.prod) {
    step('Building for production…')
    const built = await runNext(['build'], { ...env, NODE_ENV: 'production' })
    if (built !== 0) fail('The build failed. See the output above.')
    step(`Serving the production build at http://localhost:${port} (${dummy ? 'mock store' : 'Supabase'}). Ctrl+C to stop.`)
    process.exitCode = await runNext(['start', '-p', port], { ...env, NODE_ENV: 'production' })
  } else {
    step(`Starting the dev server at http://localhost:${port} (${dummy ? 'mock store' : 'Supabase'}). Ctrl+C to stop.`)
    process.exitCode = await runNext(['dev', '-p', port], env)
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
