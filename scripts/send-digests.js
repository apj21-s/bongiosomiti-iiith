#!/usr/bin/env node
/**
 * Sends each manager their digest.
 *
 *   node scripts/send-digests.js --dry    show who would be written to
 *   node scripts/send-digests.js          send them
 *
 * Meant for a schedule - a daily cron, or Vercel's scheduler pointed at a
 * route that calls the same code. Run by hand it is equally happy; a manager
 * with nothing new is skipped either way, so running it twice in a morning
 * does not produce two rounds of mail.
 *
 * What counts as "nothing new" lives in utils/digest.ts, next to the counting
 * it depends on, so the rule can be tested without a database or a mailbox.
 */

require('dotenv').config({ path: '.env.local' })

// utils/email.ts imports a sibling without a file extension, which Next
// resolves and bare node does not. Registered before any dynamic import.
const { register } = require('node:module')
const { pathToFileURL } = require('node:url')
register('./ts-resolver.mjs', pathToFileURL(__filename))

const DRY = process.argv.includes('--dry')

function env(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set. Digests need the Supabase connection from .env.local.`)
  }
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
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`)
  return res.status === 204 ? null : res.json()
}

async function main() {
  const { countForDigest, worthSending, digestSubject } = await import('../utils/digest.ts')
  const { sendManagerDigestEmail } = await import('../utils/email.ts')

  let managers
  try {
    managers = await db('manager_profiles?select=id,username,name,email,upi_id,is_active,digest_sent_at&is_active=eq.true')
  } catch (e) {
    if (/email|digest_sent_at/.test(String(e))) {
      console.error('Run supabase/manager-email.sql first - manager_profiles has no email column yet.')
      process.exitCode = 1
      return
    }
    throw e
  }

  if (managers.length === 0) {
    console.log('No active managers. Nothing to do.')
    return
  }

  let sent = 0, skipped = 0, failed = 0

  for (const m of managers) {
    const upi = (m.upi_id || '').toLowerCase()

    // Everything routed here: paid to their id and not reassigned away, or
    // explicitly assigned to them. The same rule the payments list applies.
    const filter = [
      `assigned_manager_id.eq.${m.id}`,
      `and(assigned_manager_id.is.null,allocation_flagged_at.is.null,receiver_upi.ilike.${upi})`,
    ].join(',')

    const tickets = await db(
      `tickets?select=payment_status,assigned_manager_id,assigned_at&or=(${encodeURIComponent(filter)})`
    )

    const since = m.digest_sent_at ? new Date(m.digest_sent_at) : null
    const counts = countForDigest(tickets, m.id, since)

    const who = m.name || m.username
    if (!worthSending(counts)) {
      console.log(`  skip   ${who} — nothing routed here`)
      skipped += 1
      continue
    }
    if (!m.email) {
      console.log(`  skip   ${who} — no email address on the profile`)
      skipped += 1
      continue
    }

    const subject = digestSubject(counts)
    if (DRY) {
      console.log(`  would  ${who} <${m.email}> — ${subject} (total ${counts.total}, pending ${counts.pending}, new ${counts.reallocated})`)
      continue
    }

    const result = await sendManagerDigestEmail(m.email, who, m.upi_id, counts, subject)
    if (result.ok) {
      await db(`manager_profiles?id=eq.${m.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ digest_sent_at: new Date().toISOString() }),
      })
      console.log(`  sent   ${who} <${m.email}> — ${subject}`)
      sent += 1
    } else {
      console.error(`  FAILED ${who} <${m.email}> — ${result.reason}`)
      failed += 1
    }
  }

  console.log(`\n${DRY ? 'Dry run. ' : ''}${sent} sent, ${skipped} skipped, ${failed} failed.`)
  if (failed > 0) process.exitCode = 1
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
})
