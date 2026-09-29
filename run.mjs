#!/usr/bin/env node
/**
 * One command to run the site.
 *
 *   node run.mjs                  dev server on http://localhost:3000
 *   node run.mjs --fresh          wipe registration data first, then start
 *   node run.mjs --stop           stop the site, start nothing
 *   node run.mjs --help           every option
 *
 * Plain Node with no shell tricks, so the same command works in PowerShell,
 * cmd and bash. It installs dependencies when they are missing, checks that
 * .env.local has what the site needs before Next starts (instead of a crash
 * on the first request), and optionally clears the databases.
 *
 * Every launch is a restart: a copy of the site already running from this
 * folder is stopped first - whether this runner started it, or `npm run dev`
 * in another terminal, or the other side of a Windows/WSL machine. Nothing is
 * stopped on a guess: each process is checked to be this site's before it is
 * touched, and a port held by some unrelated program is reported, not killed.
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
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import net from 'node:net'
import path from 'node:path'
import readline from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
process.chdir(ROOT)

const HELP = `
Usage: node run.mjs [options]

Starting always restarts: a copy of the site already running from this folder
(started by this runner, npm run dev, or from the other side of Windows/WSL)
is stopped first.

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
  --stop         Stop the running site and exit without starting it again.
  --help         Show this.

Examples:
  node run.mjs
  node run.mjs --fresh
  node run.mjs --dummy --fresh --port 4000
  node run.mjs --prod
  node run.mjs --stop
`

// --------------------------------------------------------------------------
// Options

function parseArgs(argv) {
  const opts = { prod: false, port: 3000, dummy: false, fresh: false, yes: false, flushOnly: false, stop: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') { console.log(HELP); process.exit(0) }
    else if (arg === '--prod') opts.prod = true
    else if (arg === '--dummy') opts.dummy = true
    else if (arg === '--fresh') opts.fresh = true
    else if (arg === '--yes' || arg === '-y') opts.yes = true
    else if (arg === '--flush-only') opts.flushOnly = true
    else if (arg === '--stop') opts.stop = true
    else if (arg === '--port' || arg.startsWith('--port=')) {
      const value = arg.includes('=') ? arg.split('=')[1] : argv[++i]
      const port = Number(value)
      if (!Number.isInteger(port) || port < 1 || port > 65535) fail(`--port needs a number from 1 to 65535, not "${value ?? ''}".`)
      opts.port = port
    } else fail(`Unknown option "${arg}". Run "node run.mjs --help" for the list.`)
  }
  if (opts.flushOnly && !opts.fresh) fail('--flush-only only means something together with --fresh.')
  if (opts.stop && (opts.fresh || opts.prod)) fail('--stop only stops; run it on its own.')
  return opts
}

function fail(message) {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

const step = (message) => console.log(`\n▸ ${message}`)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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
// Stopping a copy that is already running

// This runner's own record of its launch. `next start` leaves no trace of its
// own, so this is the only way to find a production launch again.
const PID_FILE = path.join(ROOT, '.run.pid')
// Where `next dev` records itself - pid, port, url - however it was started.
// Next refuses to start a second dev server in the folder while it is held.
const NEXT_DEV_LOCK = path.join(ROOT, '.next', 'dev', 'lock')

/** 'windows', 'wsl', or the platform name elsewhere. */
function whereAmI() {
  if (process.platform === 'win32') return 'windows'
  if (process.platform === 'linux') {
    try {
      if (/microsoft/i.test(readFileSync('/proc/version', 'utf8'))) return 'wsl'
    } catch { /* not WSL */ }
  }
  return process.platform
}
const HERE = whereAmI()

/**
 * The other half of a Windows machine with WSL. The repository sits on the
 * same disk for both, so a launch from one can hold the port the other wants,
 * and each can reach the other through interop (wsl.exe / taskkill.exe).
 */
const OTHER_SIDE = HERE === 'windows' ? 'wsl' : HERE === 'wsl' ? 'windows' : null
const sideName = (where) => (where === 'windows' ? 'Windows' : where === 'wsl' ? 'WSL' : where)

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

// Pids come out of files on disk, so they are checked before going anywhere
// near a command line.
const validPid = (pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid

/** Runs a command and returns its result, or null when it could not be run at all. */
function tool(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, timeout: 20000 })
  return result.error ? null : result
}

/**
 * A process's command line and parent: an object when it is running, null when
 * it is not, undefined when there was no way to ask (no ps, no interop).
 */
function processInfo(pid, where) {
  if (where === 'windows') {
    const script =
      // Single quotes only: this passes through Node's (or WSL's) quoting of
      // the command line on its way in, and double quotes are what gets mangled.
      `$p = Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}'; ` +
      'if ($p) { @{ ppid = $p.ParentProcessId; cmd = $p.CommandLine } | ConvertTo-Json -Compress }'
    const result = tool('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script])
    if (!result) return undefined
    if (result.status !== 0 || !result.stdout.trim()) return null
    try {
      const found = JSON.parse(result.stdout)
      return { ppid: Number(found.ppid), cmd: String(found.cmd || '') }
    } catch {
      return null
    }
  }

  const args = ['-o', 'stat=,ppid=,command=', '-p', String(pid)]
  const result = where === HERE ? tool('ps', args) : tool('wsl.exe', ['-e', 'ps', ...args])
  if (!result) return undefined
  const match = result.status === 0 && result.stdout.trim().match(/^(\S+)\s+(\d+)\s+(.*)$/)
  // A zombie has exited; it is only waiting for its parent to notice.
  if (!match || match[1].startsWith('Z')) return null
  return { ppid: Number(match[2]), cmd: match[3] }
}

/** Every process under this one, on this machine (POSIX only). */
function descendantsOf(pid) {
  const result = tool('ps', ['-A', '-o', 'pid=,ppid='])
  if (!result || result.status !== 0) return []
  const children = new Map()
  for (const line of result.stdout.split('\n')) {
    const [child, parent] = line.trim().split(/\s+/).map(Number)
    if (!child) continue
    if (!children.has(parent)) children.set(parent, [])
    children.get(parent).push(child)
  }
  const found = []
  const queue = [pid]
  while (queue.length) {
    for (const child of children.get(queue.shift()) || []) {
      found.push(child)
      queue.push(child)
    }
  }
  return found
}

async function allGone(pids, where, ms) {
  const until = Date.now() + ms
  do {
    if (pids.every((pid) => !processInfo(pid, where))) return true
    await sleep(300)
  } while (Date.now() < until)
  return false
}

/**
 * Stops a process and everything it started.
 *
 * On Windows, taskkill /T takes the whole tree at once. Elsewhere it is asked
 * to stop with SIGTERM first - the runner passes that on to Next, which shuts
 * its server down cleanly - and only what is still there ten seconds later is
 * killed outright.
 */
async function stopTree(pid, where) {
  if (where === 'windows') {
    tool('taskkill.exe', ['/PID', String(pid), '/T', '/F'])
    return allGone([pid], where, 10000)
  }
  if (where !== HERE) {
    // WSL, from Windows: its children are not visible from here, but the
    // runner and `next dev` both take theirs down on SIGTERM.
    tool('wsl.exe', ['-e', 'kill', '-TERM', String(pid)])
    if (await allGone([pid], where, 10000)) return true
    tool('wsl.exe', ['-e', 'kill', '-KILL', String(pid)])
    return allGone([pid], where, 5000)
  }
  const tree = [pid, ...descendantsOf(pid)]
  try { process.kill(pid, 'SIGTERM') } catch { /* already gone */ }
  if (await allGone(tree, where, 10000)) return true
  for (const each of tree) {
    try { process.kill(each, 'SIGKILL') } catch { /* already gone */ }
  }
  return allGone(tree, where, 5000)
}

/**
 * Stops whatever copy of the site is running from this folder. Returns whether
 * anything was stopped.
 */
async function stopExistingLaunches() {
  let stopped = false
  const sides = [HERE, OTHER_SIDE].filter(Boolean)

  // 1. The last launch by this runner. Checked to still be run.mjs before it
  //    is touched: after a reboot the same pid can belong to anything.
  const record = readJson(PID_FILE)
  if (record && validPid(record.pid) && sides.includes(record.where)) {
    const info = processInfo(record.pid, record.where)
    if (info === undefined) {
      console.warn(`! A launch from ${sideName(record.where)} (pid ${record.pid}) is on record, but there is no way to check it from here.`)
    } else if (info && /run\.mjs/.test(info.cmd)) {
      const from = record.where === HERE ? '' : ` in ${sideName(record.where)}`
      console.log(`  Stopping the ${record.mode === 'prod' ? 'production' : 'dev'} server on port ${record.port} (run.mjs, pid ${record.pid}${from})…`)
      if (!(await stopTree(record.pid, record.where))) fail(`Could not stop pid ${record.pid}${from}. Stop it by hand and run this again.`)
      stopped = true
    }
  }
  rmSync(PID_FILE, { force: true })

  // 2. `next dev` started any other way. The pid Next records is its server
  //    worker; the `next dev` above it would start a new worker, so that is
  //    the one stopped when it is there.
  const lock = readJson(NEXT_DEV_LOCK)
  if (lock && validPid(lock.pid)) {
    for (const where of sides) {
      const info = processInfo(lock.pid, where)
      if (!info || !/next/i.test(info.cmd)) continue
      const parent = validPid(info.ppid) ? processInfo(info.ppid, where) : null
      const target = parent && /next/i.test(parent.cmd) ? info.ppid : lock.pid
      const from = where === HERE ? '' : ` in ${sideName(where)}`
      console.log(`  Stopping the dev server at ${lock.appUrl || `port ${lock.port}`} (next dev, pid ${target}${from})…`)
      if (!(await stopTree(target, where))) fail(`Could not stop pid ${target}${from}. Stop it by hand and run this again.`)
      stopped = true
      break
    }
  }

  return stopped
}

/** Whether a server could listen on the port right now. */
function portIsFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer()
    probe.once('error', () => resolve(false))
    probe.once('listening', () => probe.close(() => resolve(true)))
    probe.listen(port)
  })
}

async function waitForPort(port, ms) {
  const until = Date.now() + ms
  do {
    if (await portIsFree(port)) return true
    await sleep(300)
  } while (Date.now() < until)
  return false
}

/** Leaves a note of this launch for the next one to find. */
function recordLaunch(opts) {
  const record = { pid: process.pid, where: HERE, port: opts.port, mode: opts.prod ? 'prod' : 'dev', startedAt: new Date().toISOString() }
  writeFileSync(PID_FILE, JSON.stringify(record, null, 2) + '\n')
  process.on('exit', () => {
    // Only this launch's own note: a newer one may have replaced it already.
    if (readJson(PID_FILE)?.pid === process.pid) rmSync(PID_FILE, { force: true })
  })
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

  if (opts.stop) {
    step('Stopping the site…')
    console.log(await stopExistingLaunches() ? '\n✓ Stopped.\n' : '  Nothing from this folder was running.\n')
    return
  }

  ensureDependencies()
  // The new launch is checked before the old one is stopped, so a broken
  // .env.local cannot take down a server that was working.
  const { env, dummy } = await loadEnv(opts)

  if (!opts.flushOnly) {
    step('Stopping any copy of the site that is already running…')
    const stopped = await stopExistingLaunches()
    if (!stopped) console.log('  None found.')
    if (!(await waitForPort(opts.port, stopped ? 15000 : 0))) {
      fail(
        `Port ${opts.port} is in use by a program that is not a launch of this site from this folder,\n` +
        '  so it was left alone. Stop it, or start on another port with --port <n>.'
      )
    }
  }

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
  recordLaunch(opts)

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
