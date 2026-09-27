/**
 * What a paid registration has to carry before it may be submitted.
 *
 * One module, enforced twice: the form calls it to decide whether the submit
 * button does anything, and the register route calls it again on the way in.
 * Client-side validation is a courtesy to the visitor and nothing more - a
 * request can always be made by hand - so the same rules have to hold on the
 * server, and they hold here so the two cannot drift apart.
 *
 * Free events carry none of this: there is no payment, so there is no receipt,
 * no transaction id and nobody the money went to.
 */

/** Transaction references are 6 to 32 of digits, letters, dashes or slashes. */
const UTR = /^[A-Za-z0-9/-]{6,32}$/

/** name@bank, the shape NPCI actually issues. */
const UPI = /^[a-z0-9.\-_]{2,64}@[a-z]{2,32}$/

/** What the receipt route hands back: a random name inside the bucket. */
const RECEIPT_PATH = /^receipts\/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|heic|pdf)$/

export function normaliseUpi(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function normaliseUtr(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, '').toUpperCase() : ''
}

export function isValidUtr(value: unknown): boolean {
  return UTR.test(normaliseUtr(value))
}

export function isValidUpi(value: unknown): boolean {
  return UPI.test(normaliseUpi(value))
}

export function isReceiptPath(value: unknown): boolean {
  return typeof value === 'string' && RECEIPT_PATH.test(value)
}

/**
 * Whether the money went somewhere this festival actually collects at.
 *
 * There is one UPI id per manager and a handful of managers, so the receiver
 * read off a receipt can be checked against the whole list rather than trusted.
 * A receipt naming anything else is either the wrong receipt or the payer's own
 * handle picked up by mistake, and in both cases it must not be filed as
 * somebody's takings.
 */
export function isAllowedReceiver(value: unknown, allowed: readonly string[]): boolean {
  const upi = normaliseUpi(value)
  if (!upi) return false
  return allowed.some((candidate) => normaliseUpi(candidate) === upi)
}

export type ReceiptGateInput = {
  isFree: boolean
  utr?: unknown
  receiverUpi?: unknown
  receiptPath?: unknown
  allowedUpiIds: readonly string[]
}

export type ReceiptGateResult = { ok: true } | { ok: false; field: 'utr' | 'receiverUpi' | 'receipt'; error: string }

export function checkReceiptDetails(input: ReceiptGateInput): ReceiptGateResult {
  if (input.isFree) return { ok: true }

  if (!isValidUtr(input.utr)) {
    return {
      ok: false,
      field: 'utr',
      error: 'The transaction ID is missing. It is on your payment receipt, 6 to 32 characters long.',
    }
  }

  if (!isValidUpi(input.receiverUpi)) {
    return {
      ok: false,
      field: 'receiverUpi',
      error: 'The UPI ID you paid to is missing. It looks like name@bank.',
    }
  }

  if (!isAllowedReceiver(input.receiverUpi, input.allowedUpiIds)) {
    return {
      ok: false,
      field: 'receiverUpi',
      error: 'That UPI ID is not one this festival collects at. Check the receipt shows the ID you were given.',
    }
  }

  if (!isReceiptPath(input.receiptPath)) {
    return { ok: false, field: 'receipt', error: 'Upload the payment receipt.' }
  }

  return { ok: true }
}
