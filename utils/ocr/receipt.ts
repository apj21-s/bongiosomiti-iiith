/**
 * Pulling the transaction id and the receiver's UPI id out of the text an OCR
 * pass returns for a payment receipt.
 *
 * Kept free of imports so it stays pure and directly testable: the OCR engine
 * hands it a string, and everything here is plain pattern matching. Whatever it
 * cannot find with confidence is returned as null, and the registration form
 * asks the visitor to type it instead of guessing.
 */

export type ReceiptDetails = {
  transactionId: string | null
  receiverUpi: string | null
  /** Every UPI id seen, in reading order, for when the receiver is ambiguous. */
  upiCandidates: string[]
}

// handle@provider. Deliberately not anchored, so it can be found mid-line.
const UPI_PATTERN = /\b([a-zA-Z0-9._-]{2,64})@([a-zA-Z][a-zA-Z0-9.]{1,32})\b/g

// Domains that mean this is an email address rather than a UPI handle.
const EMAIL_TLDS = /\.(com|in|org|net|co|edu|gov|io|info|me)$/i

// The labels receipts put in front of the reference number, across apps.
const LABELLED_ID =
  /(?:\bUTR\b|\bRRN\b|UPI\s*(?:transaction|txn|ref(?:erence)?)\s*(?:id|no\.?|number)?|transaction\s*(?:id|no\.?|number)|txn\s*(?:id|no\.?|number)|order\s*id|ref(?:erence)?\s*(?:id|no\.?|number))\s*[:#\-–]?\s*([A-Za-z0-9]{6,32})/i

// A bare 12-digit UPI reference, the usual shape when nothing is labelled.
const BARE_UTR = /\b(\d{12})\b/

const RECEIVER_HINT = /\b(?:to|paid\s*to|payee|receiver|recipient|beneficiary|credited\s*to)\b/i

/**
 * The labels a receipt puts next to the payer's own handle.
 *
 * This matters more than the receiver hint. Every UPI app prints both parties,
 * and most print the payer first - "From: someone@okhdfcbank", then the payee
 * below. Taking the first id on the receipt therefore files the *sender's*
 * handle as the receiver, which routes the payment to no manager at all and
 * reads, to anyone checking, as money that never arrived.
 */
const SENDER_HINT =
  /\b(?:from|paid\s*by|payer|sender|debited\s*(?:from|to)?|debit(?:ed)?\s*a\/c|your\s*(?:upi\s*)?(?:id|account)|sent\s*by)\b/i

function looksLikeEmail(handle: string, provider: string): boolean {
  if (EMAIL_TLDS.test(provider)) return true
  // gmail/yahoo style providers are never UPI handles
  return /^(gmail|yahoo|outlook|hotmail|icloud|proton|protonmail)\b/i.test(provider)
}

function normalise(text: string): string {
  // OCR frequently returns full-width or stray spacing around separators.
  return text
    .replace(/ /g, ' ')
    .replace(/[|]/g, ' ')
    .replace(/[ \t]+/g, ' ')
}

export function extractUpiIds(text: string): string[] {
  const found: string[] = []
  const seen = new Set<string>()

  for (const match of normalise(text).matchAll(UPI_PATTERN)) {
    const [, handle, provider] = match
    if (looksLikeEmail(handle, provider)) continue

    const id = `${handle}@${provider}`.toLowerCase()
    if (seen.has(id)) continue
    seen.add(id)
    found.push(id)
  }

  return found
}

export function extractTransactionId(text: string): string | null {
  const cleaned = normalise(text)

  const labelled = cleaned.match(LABELLED_ID)
  if (labelled) {
    const value = labelled[1].trim()
    // A label followed by a single word that is plainly not an id (e.g. a
    // status word) is worse than returning nothing.
    if (!/^(?:success|failed|pending|completed|paid)$/i.test(value)) return value
  }

  const bare = cleaned.match(BARE_UTR)
  return bare ? bare[1] : null
}

/**
 * Picks the receiver from the UPI ids on the receipt. When several appear, the
 * one nearest a "to"/"paid to"/"payee" style label wins, because receipts list
 * the payer's own handle too.
 */
export function pickReceiverUpi(
  text: string,
  candidates: string[],
  /**
   * The ids this festival actually collects at. When the receipt names one of
   * them, that settles it outright - no label on the page is better evidence
   * than "this is an id we take money at".
   */
  allowed: readonly string[] = []
): string | null {
  if (candidates.length === 0) return null

  const lines = normalise(text).split(/\r?\n/)

  // Which ids sit on a line that names the payer. These are the sender's, and
  // are never the answer however the rest of the receipt reads.
  const senderIds = new Set<string>()
  for (const line of lines) {
    if (SENDER_HINT.test(line) && !RECEIVER_HINT.test(line)) {
      for (const id of extractUpiIds(line)) senderIds.add(id)
    }
  }

  const notSender = candidates.filter((id) => !senderIds.has(id))

  // 1. An id the festival collects at. Decisive when exactly one matches.
  const allowedSet = new Set(allowed.map((id) => id.trim().toLowerCase()))
  if (allowedSet.size > 0) {
    const matches = notSender.filter((id) => allowedSet.has(id))
    if (matches.length === 1) return matches[0]
    if (matches.length > 1) {
      for (const line of lines) {
        if (!RECEIVER_HINT.test(line)) continue
        const here = extractUpiIds(line).find((id) => matches.includes(id))
        if (here) return here
      }
      return null
    }
    // Nothing on the receipt is an id we collect at. Saying nothing is right:
    // the gate downstream would refuse it anyway, and a guess here would only
    // put the wrong handle in front of the visitor to confirm.
    return null
  }

  // 2. No list to check against - fall back to reading the labels.
  for (const line of lines) {
    if (!RECEIVER_HINT.test(line) || SENDER_HINT.test(line)) continue
    const onThisLine = extractUpiIds(line).filter((id) => !senderIds.has(id))
    if (onThisLine.length > 0) return onThisLine[0]
  }

  // 3. One handle left once the payer's is discounted: that is the payee.
  if (notSender.length === 1) return notSender[0]

  // Otherwise unknown. The form falls back to the id the visitor chose to pay,
  // and failing that asks them to type it - both better than naming the sender.
  return null
}

export function extractReceiptDetails(
  text: string,
  allowed: readonly string[] = []
): ReceiptDetails {
  if (typeof text !== 'string' || text.trim() === '') {
    return { transactionId: null, receiverUpi: null, upiCandidates: [] }
  }

  const upiCandidates = extractUpiIds(text)

  return {
    transactionId: extractTransactionId(text),
    receiverUpi: pickReceiverUpi(text, upiCandidates, allowed),
    upiCandidates,
  }
}

/**
 * Matching a UPI id that OCR probably got slightly wrong.
 *
 * Exact comparison is the right first answer, but a receipt is a photograph of
 * a screen and the reader confuses the same handful of shapes every time: 0
 * and O, 1 and l and I, 5 and S, 8 and B, rn read as m. One such slip in a
 * twelve character handle used to mean the payee "was not an id this festival
 * collects at", and the visitor was told their correct payment was made to the
 * wrong place.
 *
 * So a candidate is also accepted when it is one of ours after those
 * confusions are folded away, or within a small edit distance of it. The match
 * returned is always the *known* id, never the OCR's spelling - a value from
 * the festival's own list is what gets filed, so a near miss cannot introduce
 * a handle nobody collects at.
 */

/** Folds the shapes OCR routinely swaps into one representative each. */
function foldConfusables(value: string): string {
  return value
    .toLowerCase()
    .replace(/rn/g, 'm')
    .replace(/[0o]/g, '0')
    .replace(/[1li|]/g, '1')
    .replace(/[5s]/g, '5')
    .replace(/[8b]/g, '8')
    .replace(/[2z]/g, '2')
    .replace(/[9g]/g, '9')
    .replace(/[^a-z0-9@.]/g, '')
}

/** Levenshtein, capped: anything past the cap is "too far" and stops early. */
function editDistance(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
      if (row[j] < best) best = row[j]
    }
    if (best > cap) return cap + 1
    prev = row
  }
  return prev[b.length]
}

export type UpiMatch = { id: string; exact: boolean } | null

/**
 * The known id a candidate most likely refers to, or null.
 *
 * `allowed` is the list of ids the festival collects at. The tolerance scales
 * with length so a short handle cannot match on a coincidence: at most one
 * edit per eight characters, never more than two.
 */
export function matchKnownUpi(candidate: string, allowed: readonly string[]): UpiMatch {
  const wanted = (candidate || '').trim().toLowerCase()
  if (!wanted) return null

  const known = allowed.map((id) => id.trim().toLowerCase()).filter(Boolean)
  if (known.length === 0) return null

  const exact = known.find((id) => id === wanted)
  if (exact) return { id: exact, exact: true }

  // The provider half is short and rarely misread; requiring it to agree once
  // folded keeps "name@okicici" from matching "name@okaxis".
  const foldedWanted = foldConfusables(wanted)
  const sameShape = known.find((id) => foldConfusables(id) === foldedWanted)
  if (sameShape) return { id: sameShape, exact: false }

  let best: { id: string; d: number } | null = null
  for (const id of known) {
    const cap = Math.min(2, Math.max(1, Math.floor(id.length / 8)))
    const d = editDistance(foldConfusables(id), foldedWanted, cap)
    if (d <= cap && (!best || d < best.d)) best = { id, d }
  }
  return best ? { id: best.id, exact: false } : null
}

/** The first candidate that resolves to a known id, with what it resolved to. */
export function findKnownUpi(
  candidates: readonly string[],
  allowed: readonly string[]
): UpiMatch {
  for (const candidate of candidates) {
    const hit = matchKnownUpi(candidate, allowed)
    if (hit?.exact) return hit
  }
  for (const candidate of candidates) {
    const hit = matchKnownUpi(candidate, allowed)
    if (hit) return hit
  }
  return null
}

/* ── MASKED PAYEE HANDLES ─────────────────────────────────────────────────
   Several apps print the payee partly hidden - ba****@okicici, b•••ya@okaxis,
   XXXXXX4321. The visible characters and their positions are still enough to
   pick one id out of a short list, so the pattern is matched against the ids
   the festival collects at rather than thrown away.

   A match counts only when exactly one known id fits. Two candidates fitting
   the same mask means the receipt does not say which, and a guess at that
   point is worse than an empty field. */

/** Everything outside a mask run is matched literally. */
function escapeLiteral(text: string): string {
  let out = ''
  for (const ch of text) out += /[a-z0-9]/i.test(ch) ? ch : '\\' + ch
  return out
}

/**
 * A mask run stands for an unknown number of hidden characters.
 *
 * Deliberately not one wildcard per mask character. Apps do not pad the mask
 * to the length of what they are hiding - "ba***@okicici" is a perfectly
 * ordinary way to write a seven character handle - so counting the asterisks
 * and demanding the lengths agree rejects most real masked receipts. What is
 * reliable is the characters that *are* shown and the order they appear in.
 */
function maskToPattern(local: string): string | null {
  const MASK = /(\*+|•+|#+|[xX]{2,}|\.{3,}|_{2,})/g
  if (!MASK.test(local)) return null
  MASK.lastIndex = 0

  let pattern = ''
  let last = 0
  for (const m of local.matchAll(MASK)) {
    pattern += escapeLiteral(local.slice(last, m.index))
    pattern += '.+'
    last = (m.index ?? 0) + m[0].length
  }
  pattern += escapeLiteral(local.slice(last))
  return pattern
}

/**
 * The one known id a partly hidden handle can refer to, or null when the mask
 * fits none of them or more than one.
 */
export function matchMaskedUpi(candidate: string, allowed: readonly string[]): string | null {
  const value = (candidate || '').trim().toLowerCase()
  const at = value.indexOf('@')
  if (at < 1) return null

  const pattern = maskToPattern(value.slice(0, at))
  if (!pattern) return null

  const provider = value.slice(at + 1)
  let re: RegExp
  try {
    re = new RegExp(`^${pattern}$`)
  } catch {
    return null
  }

  const fits = allowed
    .map((id) => id.trim().toLowerCase())
    .filter((id) => {
      const a = id.indexOf('@')
      return a > 0 && id.slice(a + 1) === provider && re.test(id.slice(0, a))
    })

  return fits.length === 1 ? fits[0] : null
}

export type ReceiverResolution = {
  /** An id from `allowed`, never the reader's spelling of one. */
  id: string | null
  /** exact: read cleanly. high: recovered from a misread or a mask. */
  confidence: 'exact' | 'high' | 'none'
}

/**
 * Which id on this receipt the festival was paid at.
 *
 * Exact reading first, then a misread recovered character by character, then a
 * masked handle resolved against the list. Anything ambiguous returns none,
 * because the caller uses this to decide whether to fill a field in for
 * somebody - and a field filled with a plausible guess is harder to notice
 * than one left empty.
 */
/**
 * The payee the form should show once a receipt has been read.
 *
 * `kept` is what the dropdown holds already - preselected from the payment
 * screen, or chosen by the visitor - as an id we collect at, or '' for none.
 * The receipt overrules it only when it is sure: an exact reading of a
 * different id. A recovered misread or a masked handle ("sa*****@ybl") is not
 * enough, because receipts print the payer's own handle too, often masked, and
 * that matched a collector and moved a correct preselection onto the wrong
 * one. Those weaker readings may only fill a dropdown that is still empty.
 */
export function settleReceiver(
  kept: string,
  read: ReceiverResolution
): { id: string; fromReceipt: boolean } {
  if (read.id && read.confidence === 'exact' && read.id !== kept) return { id: read.id, fromReceipt: true }
  if (!kept && read.id) return { id: read.id, fromReceipt: true }
  return { id: kept, fromReceipt: false }
}

export function resolveReceiverUpi(
  candidates: readonly string[],
  allowed: readonly string[]
): ReceiverResolution {
  if (allowed.length === 0) return { id: null, confidence: 'none' }

  const exact = findKnownUpi(candidates, allowed)
  if (exact?.exact) return { id: exact.id, confidence: 'exact' }
  if (exact) return { id: exact.id, confidence: 'high' }

  const masked = candidates
    .map((c) => matchMaskedUpi(c, allowed))
    .filter((id): id is string => Boolean(id))

  const unique = Array.from(new Set(masked))
  if (unique.length === 1) return { id: unique[0], confidence: 'high' }

  return { id: null, confidence: 'none' }
}
