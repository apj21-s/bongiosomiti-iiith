#!/usr/bin/env node
/**
 * Checks that mail actually works, because registration now depends on it.
 *
 *   node scripts/check-smtp.js                 connect and authenticate, every account
 *   node scripts/check-smtp.js you@example.com also send a real test message
 *
 * Since /api/verify-email mails a one-time code and refuses the registration
 * when it cannot send, broken SMTP means nobody can register at all. This is
 * the quickest way to tell a credential problem from a code problem, and it
 * does it without going through the site.
 *
 * It reads the accounts from utils/mail-transport.ts rather than from the
 * environment itself, so what it reports is what the site will actually use -
 * including the numbered accounts (SMTP_USER_2 and friends) that exist so the
 * day's free allowances add up.
 *
 * Nothing here prints a password.
 */

require('dotenv').config({ path: '.env.local' })
const nodemailer = require('nodemailer')

/** Provider-specific hints: they all refuse a bad credential with the same 535. */
function hintFor(account) {
  const stripped = account.pass.replace(/\s/g, '')
  if (/gmail\.com$/.test(account.host)) {
    // Gmail sends as the account that authenticated. A different From is
    // rewritten without a word unless it is confirmed under "Send mail as",
    // so replies would go somewhere nobody is reading.
    if (account.from.toLowerCase() !== account.user.toLowerCase()) {
      return (
        `this account authenticates as ${account.user} but is set to send as\n` +
        `    ${account.from}. Gmail rewrites a From that is not the signed-in account,\n` +
        '    unless that address is confirmed under Settings > Accounts > "Send mail as".\n' +
        '    Either confirm it there, or drop the FROM_EMAIL so it sends as itself.'
      )
    }
    if (!/^[a-z]{16}$/.test(stripped)) {
      return (
        'Gmail expects a 16-character App Password, all lowercase letters - not the\n' +
        `    account password. This one is ${stripped.length} character(s). Create one at\n` +
        '    myaccount.google.com/apppasswords (it appears only once 2-Step Verification\n' +
        '    is on). Accounts under Family Link supervision cannot create these at all;\n' +
        '    use a relay such as Brevo or Mailjet, or a different sender account.'
      )
    }
    return null
  }
  if (/brevo|sendinblue/.test(account.host)) {
    return 'Brevo: the user is the login on the SMTP & API page, not your sign-in email.'
  }
  if (/mailjet/.test(account.host)) {
    return 'Mailjet: the user is the API key and the password is the secret key.'
  }
  if (/sendgrid/.test(account.host)) {
    return 'SendGrid: the user is the literal string "apikey".'
  }
  return null
}

async function main() {
  const { readAccounts, totalDailyLimit, looksLikeProviderLogin } =
    await import('../utils/mail-transport.ts')
  const accounts = readAccounts()

  if (accounts.length === 0) {
    console.error(
      '\nNo SMTP account is configured.\n\n' +
      'Set SMTP_USER and SMTP_PASS in .env.local. Until then /api/verify-email\n' +
      'returns 503 and no one can register. See .env.example for provider settings.\n'
    )
    process.exitCode = 1
    return
  }

  console.log(`\n${accounts.length} account(s) configured, ${totalDailyLimit()} messages/day in total`)

  let anyWorks = false
  const working = []
  const senderProblems = []

  for (const account of accounts) {
    console.log(`\n${account.label}`)
    console.log(`  host   ${account.host}:${account.port}  (${account.port === 587 ? 'STARTTLS' : 'implicit TLS'})`)
    console.log(`  user   ${account.user}`)
    console.log(`  from   ${account.from}${account.from === account.user ? '  (fell back to the login)' : ''}`)
    console.log(`  limit  ${account.dailyLimit}/day`)

    // The single most common way a multi-account setup half-works: account 1
    // has a verified sender, account 2 was never given one, and every message
    // it carries is refused. Worth failing the check over, not just noting.
    if (looksLikeProviderLogin(account.from)) {
      senderProblems.push(account.label)
      console.error(
        `  note   this sender is the relay's own login, not a real address. Mail from it\n` +
        `         will be refused or filed as spam. Set FROM_EMAIL to a sender verified\n` +
        `         with the provider - one FROM_EMAIL is shared by every account, so the\n` +
        `         same verified address covers them all.`
      )
    }

    // A password truncated at an unquoted '#' is a failure this project has
    // already hit once, so it is worth naming rather than leaving as a
    // puzzling authentication error.
    if (/[#$]/.test(account.pass)) {
      console.warn("  note   contains '#' or '$' - wrap it in single quotes in .env.local")
    }
    const hint = hintFor(account)
    if (hint) console.warn(`  note   ${hint}`)

    const transporter = nodemailer.createTransport({
      host: account.host,
      port: account.port,
      secure: account.port !== 587,
      auth: { user: account.user, pass: account.pass },
    })

    try {
      await transporter.verify()
      console.log('  ->     connected and authenticated')
      anyWorks = true
      working.push({ account, transporter })
    } catch (e) {
      const message = e && e.message ? e.message : String(e)
      console.error(`  ->     FAILED: ${message}`)
      // Worth naming, because it reads like a credential problem and is not:
      // the password is fine, the machine simply is not on the allowlist.
      if (/unauthorized ip|525 5\.7\.1/i.test(message)) {
        console.error(
          '         This is Brevo\'s IP allowlist, not a bad password. Either add this\n' +
          '         machine\'s address under Brevo > SMTP & API > Authorized IPs, or turn\n' +
          '         the restriction off there. A deployment sends from changing addresses,\n' +
          '         so leaving it on will break production even once it works locally.'
        )
      }
    }
  }

  if (!anyWorks) {
    console.error(
      '\nNo account could authenticate, so nothing can be sent and nobody can register.\n' +
      'Common causes: wrong password, the mailbox does not exist at this host, or the\n' +
      'port is wrong (465 for implicit TLS, 587 for STARTTLS).\n'
    )
    process.exitCode = 1
    return
  }

  if (senderProblems.length) {
    console.error(
      `
${senderProblems.length} account(s) would send from the relay's own login, so their mail
` +
      'will not arrive. Set FROM_EMAIL to a verified sender before relying on this.'
    )
    process.exitCode = 1
  }

  if (working.length < accounts.length) {
    console.warn(
      `\n${accounts.length - working.length} of ${accounts.length} account(s) failed. Sending still works - the pool ` +
      'moves\na refused message to the next account - but the daily allowance is only what\nthe working accounts add up to.'
    )
  }

  const to = process.argv[2]
  if (!to) {
    console.log('\nPass an address to send a real test message from each working account:')
    console.log('  node scripts/check-smtp.js you@example.com\n')
    return
  }

  // One per account, so a From that a relay has not verified shows up here
  // rather than as silent spam-filing in production.
  for (const { account, transporter } of working) {
    console.log(`\nSending from ${account.label} (${account.from}) to ${to}…`)
    try {
      const info = await transporter.sendMail({
        from: `"Utsav Pass" <${account.from}>`,
        to,
        subject: `Bangiya Samiti - mail delivery test (${account.label})`,
        text:
          `Sent through ${account.label} (${account.host}).\n\n` +
          'If you are reading this, registration email works: verification codes ' +
          'will reach people, and passes will go out after approval.',
      })
      console.log(`  Accepted for delivery. id=${info.messageId}`)
      if (info.rejected && info.rejected.length) {
        console.log(`  Rejected: ${info.rejected.join(', ')}`)
      }
    } catch (e) {
      console.error(`  Send failed: ${e && e.message ? e.message : e}`)
      process.exitCode = 1
    }
  }

  console.log('\nCheck the inbox, and the spam folder - a code that lands in spam is a')
  console.log('registration that quietly fails.\n')
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
