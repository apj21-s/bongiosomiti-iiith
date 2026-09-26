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
export function pickReceiverUpi(text: string, candidates: string[]): string | null {
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]

  const lines = normalise(text).split(/\r?\n/)
  for (const line of lines) {
    if (!RECEIVER_HINT.test(line)) continue
    const onThisLine = extractUpiIds(line)
    if (onThisLine.length > 0) return onThisLine[0]
  }

  // No hint anywhere: the first is the best guess, and the form still lets the
  // visitor correct it.
  return candidates[0]
}

export function extractReceiptDetails(text: string): ReceiptDetails {
  if (typeof text !== 'string' || text.trim() === '') {
    return { transactionId: null, receiverUpi: null, upiCandidates: [] }
  }

  const upiCandidates = extractUpiIds(text)

  return {
    transactionId: extractTransactionId(text),
    receiverUpi: pickReceiverUpi(text, upiCandidates),
    upiCandidates,
  }
}
