import nodemailer from 'nodemailer'
import type Mail from 'nodemailer/lib/mailer'

/**
 * Sending across several SMTP accounts, so the day's free allowance is the sum
 * of them rather than the smallest one.
 *
 * Every free relay caps what you may send in a day - Brevo at 300, Mailjet at
 * 200 - and registration now leans on mail for one-time codes as well as for
 * passes, so one account's ceiling is the whole site's ceiling. Two accounts
 * configured here give two allowances, and a third would give three.
 *
 * Two behaviours, and it is worth keeping them apart:
 *
 *   Rotation spreads sends evenly, so neither account is exhausted while the
 *   other sits idle.
 *
 *   Failover is what actually saves a send. When an account refuses - out of
 *   quota, credentials revoked, provider having a bad afternoon - the message
 *   is offered to the next one before the caller is told it failed.
 *
 * The daily counters live in memory, which on a serverless deployment means
 * per instance and reset by any cold start. They are therefore a way of
 * spreading load, not a guarantee of staying under the cap; the guarantee is
 * failover, which reacts to the provider's own refusal however the counters
 * happen to be doing.
 *
 * The From address is the account's own, never a global one: a relay will
 * reject, or quietly spam-file, a sender it has not verified. Callers pass the
 * display name only.
 */

export type MailAccount = {
  /** For logs and the checker; never a password. */
  label: string
  host: string
  port: number
  user: string
  pass: string
  /** The verified sender for this account. */
  from: string
  dailyLimit: number
}

type AccountState = {
  sentToday: number
  day: string
  /** Set when the provider refuses in a way that will not improve today. */
  exhaustedUntilDay: string | null
  lastError: string | null
}

const DEFAULT_DAILY_LIMIT = 300

/**
 * Gmail's own allowance for a free account sending over SMTP, which is higher
 * than the free relays'. Workspace accounts get more; set SMTP_DAILY_LIMIT if
 * yours does.
 */
const GMAIL_DAILY_LIMIT = 500

/**
 * Gmail will not send as an address other than the one that authenticated,
 * unless that address has been added under "Send mail as" and confirmed. So a
 * shared FROM_EMAIL - right for a relay, where several accounts legitimately
 * send as one verified address - is wrong here: each Gmail account must write
 * as itself, or Gmail silently rewrites the From and the reply-to leads
 * somewhere nobody reads.
 */
export function isGmailHost(host: string): boolean {
  return /(^|\.)(gmail|googlemail)\.com$/i.test(host.trim())
}

function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/**
 * Reads the accounts.
 *
 * The first is the plain SMTP_USER/SMTP_PASS pair, so an installation that
 * never wants a second account carries on unchanged. Further accounts are
 * numbered - SMTP_USER_2, SMTP_PASS_2 and so on - and inherit the host, port
 * and limit of the first unless they give their own.
 */
export function readAccounts(env: NodeJS.ProcessEnv = process.env): MailAccount[] {
  const baseHost = env.SMTP_HOST || 'smtp.hostinger.com'
  const basePort = Number(env.SMTP_PORT) || 465
  // An explicit global wins; otherwise the ceiling depends on who is sending.
  const globalLimit = Number(env.SMTP_DAILY_LIMIT) || 0

  const accounts: MailAccount[] = []

  const add = (suffix: string) => {
    const user = env[`SMTP_USER${suffix}`]
    const pass = env[`SMTP_PASS${suffix}`]
    if (!user || !pass) return

    const host = env[`SMTP_HOST${suffix}`] || baseHost
    const gmail = isGmailHost(host)

    accounts.push({
      label: suffix ? `account${suffix}` : 'account1',
      host,
      port: Number(env[`SMTP_PORT${suffix}`]) || basePort,
      user,
      pass,
      // Its own sender first, then it depends on who is sending.
      //
      // On a relay the shared FROM_EMAIL is the setup people actually have:
      // one address verified on every account, so the festival writes from one
      // place whichever account carries the message. Without that fallback a
      // second account with no FROM_EMAIL_2 drops to its login - on Brevo an
      // @smtp-brevo.com address nobody owns - and every message it sends is
      // refused, which on the one-time code means registration quietly stops
      // working for half of all attempts.
      //
      // Gmail is the opposite: it will not send as anything but the account
      // that authenticated, so each Gmail account writes as itself and the
      // shared value is deliberately skipped. An explicit FROM_EMAIL_<n> still
      // wins, for an address confirmed under "Send mail as".
      from: env[`FROM_EMAIL${suffix}`] || (gmail ? user : env.FROM_EMAIL || user),
      dailyLimit:
        Number(env[`SMTP_DAILY_LIMIT${suffix}`]) ||
        globalLimit ||
        (gmail ? GMAIL_DAILY_LIMIT : DEFAULT_DAILY_LIMIT),
    })
  }

  add('')
  for (let n = 2; n <= 9; n += 1) add(`_${n}`)

  return accounts
}

/**
 * Whether this sender is the relay's own login rather than a real address.
 *
 * Relays hand out a machine address to authenticate with - Brevo's
 * @smtp-brevo.com, Mailjet's API key - which is not a mailbox and is not a
 * sender they will deliver for. Sending from one produces a refusal, or worse
 * a silent spam-filing, and for the one-time code that is a registration
 * nobody can complete.
 */
export function looksLikeProviderLogin(address: string): boolean {
  return /@(smtp-)?(brevo|sendinblue|mailjet|sendgrid|mailgun)\b/i.test(address) || !address.includes('@')
}

const transports = new Map<string, nodemailer.Transporter>()
const states = new Map<string, AccountState>()
const warnedAboutSender = new Set<string>()
let cursor = 0

function transportFor(account: MailAccount): nodemailer.Transporter {
  const key = `${account.host}:${account.port}:${account.user}`
  let existing = transports.get(key)
  if (!existing) {
    existing = nodemailer.createTransport({
      host: account.host,
      port: account.port,
      // Only 465 is implicit TLS. Everything else - 587, and 2525, which is
      // the fallback when a campus network blocks 587 - negotiates STARTTLS.
      // Testing for "not 587" instead would hand 2525 an implicit-TLS socket
      // and hang until it timed out.
      secure: account.port === 465,
      // Nodemailer waits about two minutes to connect and ten for a reply.
      // In a pool that is the wrong end of the trade: one unreachable account
      // would hold up the message that the next account could have sent
      // immediately. Fail fast and move on.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      auth: { user: account.user, pass: account.pass },
    })
    transports.set(key, existing)
  }
  return existing
}

function stateFor(account: MailAccount): AccountState {
  const today = utcDay()
  let state = states.get(account.user)
  if (!state || state.day !== today) {
    state = { sentToday: 0, day: today, exhaustedUntilDay: null, lastError: state?.lastError ?? null }
    states.set(account.user, state)
  }
  return state
}

function hasRoom(account: MailAccount): boolean {
  const state = stateFor(account)
  if (state.exhaustedUntilDay === state.day) return false
  return state.sentToday < account.dailyLimit
}

/**
 * Whether a refusal means "not today" rather than "not this message".
 *
 * A quota refusal must take the account out of rotation, or every later send
 * pays the same round trip to be told the same thing. A rejected recipient
 * must not: that is one bad address, and the account is fine.
 */
function looksLikeQuota(message: string): boolean {
  return /quota|limit|exceed|too many|rate|450|451|452|550 5\.4\.5/i.test(message)
}

export type SendResult =
  | { ok: true; account: string; messageId?: string }
  | { ok: false; reason: 'no-accounts' | 'all-failed'; errors: string[] }

/**
 * Sends through the first account with room, falling back through the rest.
 *
 * `fromName` is the display name; the address is whichever account sends, so a
 * relay always sees a sender it has verified.
 */
export async function sendMail(
  message: Omit<Mail.Options, 'from'> & { fromName?: string }
): Promise<SendResult> {
  const accounts = readAccounts()
  if (accounts.length === 0) {
    return { ok: false, reason: 'no-accounts', errors: ['No SMTP account is configured'] }
  }

  const { fromName, ...rest } = message
  const errors: string[] = []

  // Start where the last send left off, so consecutive messages alternate
  // rather than always loading the first account.
  const start = cursor % accounts.length
  cursor = (cursor + 1) % accounts.length

  const order = accounts.map((_, i) => accounts[(start + i) % accounts.length])
  // Accounts with room first, then the rest: a counter that is wrong after a
  // cold start should cost a retry, not a lost message.
  const queue = [...order.filter(hasRoom), ...order.filter((a) => !hasRoom(a))]

  for (const account of queue) {
    const state = stateFor(account)

    // Said once per account, not once per message: a log line on every send
    // would bury it, and this is a configuration problem, not an event.
    if (looksLikeProviderLogin(account.from) && !warnedAboutSender.has(account.label)) {
      warnedAboutSender.add(account.label)
      console.error(
        `[mail] ${account.label} is sending from ${account.from}, which is the relay's own ` +
        'login rather than a verified sender. Mail from it will be refused or filed as spam. ' +
        `Set FROM_EMAIL (shared by every account) or FROM_EMAIL for this one specifically.`
      )
    }

    try {
      const info = await transportFor(account).sendMail({
        ...rest,
        from: fromName ? `"${fromName}" <${account.from}>` : account.from,
        // Mail people cannot reply to is treated with suspicion by filters and
        // is useless to the person who needs to ask a question. The sending
        // account is a machine mailbox nobody reads, so replies are pointed at
        // whatever address the festival actually watches.
        replyTo: rest.replyTo || process.env.REPLY_TO_EMAIL || undefined,
      })
      state.sentToday += 1
      state.lastError = null
      return { ok: true, account: account.label, messageId: (info as { messageId?: string }).messageId }
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e)
      state.lastError = text
      if (looksLikeQuota(text)) state.exhaustedUntilDay = state.day
      errors.push(`${account.label}: ${text}`)
    }
  }

  return { ok: false, reason: 'all-failed', errors }
}

/** True when at least one account is configured. */
export function mailIsConfigured(): boolean {
  return readAccounts().length > 0
}

/** For scripts/check-smtp.js and logs. Carries no passwords. */
export function describeAccounts(): Array<{
  label: string
  host: string
  port: number
  user: string
  from: string
  dailyLimit: number
  sentToday: number
  exhausted: boolean
  lastError: string | null
  senderIsProviderLogin: boolean
}> {
  return readAccounts().map((account) => {
    const state = stateFor(account)
    return {
      label: account.label,
      host: account.host,
      port: account.port,
      user: account.user,
      from: account.from,
      dailyLimit: account.dailyLimit,
      sentToday: state.sentToday,
      exhausted: state.exhaustedUntilDay === state.day,
      lastError: state.lastError,
      senderIsProviderLogin: looksLikeProviderLogin(account.from),
    }
  })
}

/** The day's combined allowance, which is the point of configuring more than one. */
export function totalDailyLimit(): number {
  return readAccounts().reduce((sum, a) => sum + a.dailyLimit, 0)
}
