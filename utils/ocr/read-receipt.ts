import { extractReceiptDetails, type ReceiptDetails } from './receipt'

/**
 * Reads a payment receipt in the browser.
 *
 * Tesseract runs entirely on the visitor's device, so the receipt image is
 * never sent anywhere to be read - which matters, since these are screenshots
 * of someone's bank app. The engine is a few megabytes, so it is imported
 * dynamically and only once a receipt has actually been chosen; the
 * registration form never pays for it otherwise.
 *
 * Anything the pass cannot find comes back as null and the form asks the
 * visitor to type it, rather than guessing at a payment reference.
 */

export type ReceiptReadResult = ReceiptDetails & {
  /** Raw OCR text, kept for debugging a bad read. */
  text: string
  ok: boolean
}

const EMPTY: ReceiptReadResult = {
  ok: false,
  text: '',
  transactionId: null,
  receiverUpi: null,
  upiCandidates: [],
}

export async function readReceipt(
  file: File,
  onProgress?: (fraction: number) => void
): Promise<ReceiptReadResult> {
  if (!file || !file.type.startsWith('image/')) return EMPTY

  try {
    const { createWorker } = await import('tesseract.js')

    const worker = await createWorker('eng', 1, {
      logger: (message: { status?: string; progress?: number }) => {
        if (message.status === 'recognizing text' && typeof message.progress === 'number') {
          onProgress?.(message.progress)
        }
      },
    })

    try {
      const { data } = await worker.recognize(file)
      const text = data?.text ?? ''
      return { ok: true, text, ...extractReceiptDetails(text) }
    } finally {
      await worker.terminate()
    }
  } catch {
    // A failed read is not a failed registration: the form falls back to
    // asking for the details.
    return EMPTY
  }
}
