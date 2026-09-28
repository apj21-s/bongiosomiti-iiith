#!/usr/bin/env node
/**
 * Checks that mail actually works, because registration now depends on it.
 *
 *   node scripts/check-smtp.js                 connect and authenticate only
 *   node scripts/check-smtp.js you@example.com send a real test message there
 *
 * Since /api/verify-email mails a one-time code and refuses the registration
 * when it cannot send, broken SMTP means nobody can register at all. This is
 * the quickest way to tell a credential problem from a code problem, and it
 * does it without going through the site.
 *
 * Nothing here prints a password. It reports only whether each value is set.
 */

require('dotenv').config({ path: '.env.local' })
const nodemailer = require('nodemailer')

const host = process.env.SMTP_HOST || 'smtp.hostinger.com'
const port = Number(process.env.SMTP_PORT) || 465
const user = process.env.SMTP_USER
const pass = process.env.SMTP_PASS
const from = process.env.FROM_EMAIL || user

function state(name, value, note) {
  const mark = value ? 'set' : 'MISSING'
  console.log(`  ${name.padEnd(12)} ${mark}${note ? `  (${note})` : ''}`)
}

async function main() {
  console.log('\nMail settings')
  state('SMTP_HOST', host, host)
  state('SMTP_PORT', String(port), port === 465 ? 'implicit TLS' : 'STARTTLS')
  state('SMTP_USER', user)
  state('SMTP_PASS', pass, pass ? `${pass.length} characters` : undefined)
  state('FROM_EMAIL', from, from === user ? 'defaults to SMTP_USER' : undefined)

  if (!user || !pass) {
    console.error(
      '\nSMTP_USER and SMTP_PASS are required. Until they are set, /api/verify-email\n' +
      'returns 503 and no one can register.\n'
    )
    process.exitCode = 1
    return
  }

  // A password that was truncated at an unquoted '#' is the failure this
  // project has already hit once, so it is worth naming rather than leaving
  // as a puzzling authentication error.
  if (/[#$]/.test(pass)) {
    console.warn(
      "\nNote: the password contains '#' or '$'. In .env.local it must be wrapped in\n" +
      "single quotes, or dotenv will truncate it at the '#' and expand the '$'."
    )
  }

  // Each provider rejects a wrong credential with the same generic 535, so the
  // useful hint is what that provider expects in the first place.
  const stripped = pass.replace(/\s/g, '')
  if (/gmail\.com$/.test(host)) {
    if (!/^[a-z]{16}$/.test(stripped)) {
      console.warn(
        '\nGmail expects a 16-character App Password, all lowercase letters - not the\n' +
        `account password. This one is ${stripped.length} character(s). Create one at\n` +
        'myaccount.google.com/apppasswords (it appears only once 2-Step Verification\n' +
        'is on). Accounts under Family Link supervision cannot create these at all;\n' +
        'use a relay such as Brevo or Mailjet, or a different sender account.'
      )
    }
  } else if (/brevo|sendinblue/.test(host)) {
    console.log('\n  Brevo: SMTP_USER is the login shown on the SMTP & API page, not your')
    console.log('  sign-in email, and SMTP_PASS is the SMTP key. Port 587.')
  } else if (/mailjet/.test(host)) {
    console.log('\n  Mailjet: SMTP_USER is the API key and SMTP_PASS the secret key. Port 587.')
  } else if (/sendgrid/.test(host)) {
    console.log('\n  SendGrid: SMTP_USER is the literal string "apikey". Port 587.')
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port !== 587,
    auth: { user, pass },
  })

  console.log('\nConnecting…')
  try {
    await transporter.verify()
    console.log('  Connected and authenticated.')
  } catch (e) {
    console.error(`  Failed: ${e && e.message ? e.message : e}`)
    console.error(
      '\n  Common causes: wrong password, the mailbox does not exist at this host,\n' +
      '  or the port is wrong (465 for implicit TLS, 587 for STARTTLS).\n'
    )
    process.exitCode = 1
    return
  }

  const to = process.argv[2]
  if (!to) {
    console.log('\nPass an address to send a real test message:')
    console.log('  node scripts/check-smtp.js you@example.com\n')
    return
  }

  console.log(`\nSending a test message to ${to}…`)
  try {
    const info = await transporter.sendMail({
      from: `"Utsav Pass" <${from}>`,
      to,
      subject: 'Bangiya Samiti - mail delivery test',
      text:
        'If you are reading this, registration email works: verification codes ' +
        'will reach people, and passes will go out after approval.',
    })
    console.log(`  Accepted for delivery. id=${info.messageId}`)
    if (info.rejected && info.rejected.length) {
      console.log(`  Rejected: ${info.rejected.join(', ')}`)
    }
    console.log('\n  Check the inbox, and the spam folder - a code that lands in spam')
    console.log('  is a registration that quietly fails.\n')
  } catch (e) {
    console.error(`  Send failed: ${e && e.message ? e.message : e}\n`)
    process.exitCode = 1
  }
}

main()
