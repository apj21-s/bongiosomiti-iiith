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

/**
 * Where a read has got to. `preparing` is the engine and its English data
 * loading - several megabytes the first time, cached after - and `reading` is
 * the recognition itself. Each runs 0..1.
 */
export type ReadProgress = { phase: 'preparing' | 'reading'; progress: number }

// Tesseract reports its start-up as four separate statuses, each 0..1. They
// are folded into one `preparing` figure so the visitor sees one bar move
// rather than four that each restart at zero.
const PREPARING_STEPS = [
  'loading tesseract core',
  'initializing tesseract',
  'loading language traineddata',
  'initializing api',
]

export async function readReceipt(
  file: File,
  onProgress?: (progress: ReadProgress) => void
): Promise<ReceiptReadResult> {
  if (!file || !file.type.startsWith('image/')) return EMPTY

  try {
    onProgress?.({ phase: 'preparing', progress: 0 })
    const { createWorker } = await import('tesseract.js')

    let preparedSoFar = 0
    const worker = await createWorker('eng', 1, {
      logger: (message: { status?: string; progress?: number }) => {
        const fraction = typeof message.progress === 'number' ? Math.min(1, Math.max(0, message.progress)) : 0
        if (message.status === 'recognizing text') {
          onProgress?.({ phase: 'reading', progress: fraction })
          return
        }
        const step = PREPARING_STEPS.indexOf(String(message.status))
        if (step === -1) return
        // Never backwards: a later status restarting at 0 is still further on.
        preparedSoFar = Math.max(preparedSoFar, (step + fraction) / PREPARING_STEPS.length)
        onProgress?.({ phase: 'preparing', progress: preparedSoFar })
      },
    })
    onProgress?.({ phase: 'reading', progress: 0 })

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
