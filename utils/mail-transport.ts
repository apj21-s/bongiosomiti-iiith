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
  const baseLimit = Number(env.SMTP_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT

  const accounts: MailAccount[] = []

  const add = (suffix: string) => {
    const user = env[`SMTP_USER${suffix}`]
    const pass = env[`SMTP_PASS${suffix}`]
    if (!user || !pass) return

    accounts.push({
      label: suffix ? `account${suffix}` : 'account1',
      host: env[`SMTP_HOST${suffix}`] || baseHost,
      port: Number(env[`SMTP_PORT${suffix}`]) || basePort,
      user,
      pass,
      from: env[`FROM_EMAIL${suffix}`] || user,
      dailyLimit: Number(env[`SMTP_DAILY_LIMIT${suffix}`]) || baseLimit,
    })
  }

  add('')
  for (let n = 2; n <= 9; n += 1) add(`_${n}`)

  return accounts
}

const transports = new Map<string, nodemailer.Transporter>()
const states = new Map<string, AccountState>()
let cursor = 0

function transportFor(account: MailAccount): nodemailer.Transporter {
  const key = `${account.host}:${account.port}:${account.user}`
  let existing = transports.get(key)
  if (!existing) {
    existing = nodemailer.createTransport({
      host: account.host,
      port: account.port,
      // 587 is STARTTLS; everything else (465) is implicit TLS.
      secure: account.port !== 587,
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
    try {
      const info = await transportFor(account).sendMail({
        ...rest,
        from: fromName ? `"${fromName}" <${account.from}>` : account.from,
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
    }
  })
}

/** The day's combined allowance, which is the point of configuring more than one. */
export function totalDailyLimit(): number {
  return readAccounts().reduce((sum, a) => sum + a.dailyLimit, 0)
}
