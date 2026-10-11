'use client'

/**
 * What is happening while a payment receipt is stored and read.
 *
 * The reader runs on the visitor's own phone and, the first time, has to
 * download several megabytes before it can read a word. A single "Reading…
 * 0%" line sat still through all of that and looked broken, so this names
 * each stage as it happens, with one bar for the whole job.
 *
 * It covers the registration card only - absolutely positioned inside
 * `.reg-shell` - so the rest of the page stays as it was.
 */

export type ReceiptScanStep = 'saving' | 'preparing' | 'reading' | 'finding' | 'done'

export type ReceiptScan = {
  step: ReceiptScanStep
  /** 0..1 within the current step, where the step can say. */
  progress: number
  /** Set on 'done': what the receipt gave us. */
  found?: { utr: boolean; upi: boolean }
}

const STEPS: { id: Exclude<ReceiptScanStep, 'done'>; label: string; hint?: string }[] = [
  { id: 'saving', label: 'Saving your receipt securely' },
  { id: 'preparing', label: 'Preparing the reader', hint: 'Runs on your phone - the first time takes a few seconds' },
  { id: 'reading', label: 'Reading the text on your receipt' },
  { id: 'finding', label: 'Finding the 12-digit UTR and the UPI ID you paid' },
]

// Share of the one bar each step fills. Reading is the slow one.
const SPAN: Record<Exclude<ReceiptScanStep, 'done'>, [number, number]> = {
  saving: [0, 0.2],
  preparing: [0.2, 0.45],
  reading: [0.45, 0.95],
  finding: [0.95, 1],
}

function overall(scan: ReceiptScan): number {
  if (scan.step === 'done') return 1
  const [from, to] = SPAN[scan.step]
  return from + (to - from) * Math.min(1, Math.max(0, scan.progress))
}

export default function ReceiptScanOverlay({ scan }: { scan: ReceiptScan | null }) {
  if (!scan) return null

  const current = scan.step === 'done' ? STEPS.length : STEPS.findIndex((s) => s.id === scan.step)
  const percent = Math.round(overall(scan) * 100)

  return (
    <div className="reg-scan-overlay" role="status" aria-live="polite" aria-busy={scan.step !== 'done'}>
      <div className="reg-scan-panel">
        <p className="reg-scan-title">
          {scan.step === 'done' ? 'Receipt checked' : 'Checking your receipt'}
        </p>

        <div className="reg-scan-bar" aria-hidden="true">
          <div className="reg-scan-bar-fill" style={{ width: `${percent}%` }} />
        </div>
        <p className="reg-scan-percent">{percent}%</p>

        <ol className="reg-scan-steps">
          {STEPS.map((step, i) => {
            const state = i < current ? 'done' : i === current ? 'active' : 'todo'
            return (
              <li key={step.id} className={`reg-scan-step is-${state}`}>
                <span className="reg-scan-dot" aria-hidden="true">
                  {state === 'done' ? '✓' : state === 'active' ? <span className="reg-scan-spinner" /> : i + 1}
                </span>
                <span className="reg-scan-text">
                  {step.label}
                  {state === 'active' && step.id === 'reading' && ` - ${Math.round(scan.progress * 100)}%`}
                  {state === 'active' && step.hint && <small>{step.hint}</small>}
                </span>
              </li>
            )
          })}
        </ol>

        {scan.step === 'done' && scan.found && (
          <p className="reg-scan-summary">
            <span className={scan.found.utr ? 'is-ok' : 'is-missing'}>
              {scan.found.utr ? '✓ UTR found' : '✕ UTR not found - type it in'}
            </span>
            <span className={scan.found.upi ? 'is-ok' : 'is-missing'}>
              {scan.found.upi ? '✓ UPI ID matched' : '✕ UPI ID not matched - pick it'}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
