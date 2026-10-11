'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { foodKind, mealSection, playFeedback, unlockAudio, type FeedbackKind } from '@/utils/scanner-feedback'

// How long a successful check-in stays on screen before the camera resumes.
const AUTO_RESUME_MS = 2500

type Band = 'ok' | 'warn' | 'deny'

type ScanTicket = {
  token?: string
  participant_name?: string | null
  food_pref?: string | null
  college_id?: string | null
  redeemed_gate?: string | null
  eventName?: string
  event?: { name?: string } | null
}

type ScanResult = {
  outcome: string
  message?: string
  ticket?: ScanTicket | null
}

function bandFor(outcome?: string): Band {
  if (outcome === 'SUCCESS') return 'ok'
  if (outcome === 'ALREADY_USED' || outcome === 'PAYMENT_PENDING') return 'warn'
  return 'deny'
}

const BAND_TITLE: Record<string, string> = {
  SUCCESS: '✓ CHECKED IN',
  ALREADY_USED: '⚠ ALREADY USED',
  PAYMENT_PENDING: '⚠ PAYMENT PENDING',
}

function feedbackFor(result: ScanResult): FeedbackKind {
  const band = bandFor(result?.outcome)
  if (band !== 'ok') return band
  return foodKind(result?.ticket?.food_pref) || 'ok'
}

export default function ScannerPage() {
  const [token, setToken] = useState('')
  const [manualToken, setManualToken] = useState('')
  const [gate, setGate] = useState('Gate 1')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scannerError, setScannerError] = useState('')
  const [soundOn, setSoundOn] = useState(false)

  const scannerRef = useRef<any>(null)
  const isProcessingRef = useRef(false)
  const autoResumeTimer = useRef<any>(null)
  // The camera callback is bound once when the scanner starts, so it reads
  // the gate through a ref rather than the value from that first render.
  const gateRef = useRef(gate)

  useEffect(() => {
    gateRef.current = gate
  }, [gate])

  function enableSound() {
    if (soundOn) return
    unlockAudio().then(setSoundOn)
  }

  useEffect(() => {
    // Attempt to auto-start on mount
    const timer = setTimeout(() => {
      startScanner()
    }, 500)
    
    return () => {
      clearTimeout(timer)
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error)
      }
      if (autoResumeTimer.current) clearTimeout(autoResumeTimer.current)
    }
  }, [])

  async function startScanner() {
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("reader")
      }

      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop().catch(() => {})
      }

      setScannerError('')
      setIsScanning(true)
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          if (isProcessingRef.current) return
          isProcessingRef.current = true
          
          if (scannerRef.current && scannerRef.current.getState() === 2) { // 2 = SCANNING
             scannerRef.current.pause(true)
          }
          
          setToken(decodedText)
          await handleVerify(decodedText)
        },
        (errorMessage: string) => {
          // ignore background scanning errors
        }
      )
    } catch (err: any) {
      console.error('Error starting scanner', err)
      setIsScanning(false)
      if (err?.message?.includes('supported') || err?.name === 'NotSupportedError' || typeof err === 'string' && err.includes('supported')) {
        setScannerError('Camera not supported over HTTP. Please use HTTPS or enter code manually.')
      } else {
        setScannerError(err?.message || String(err))
      }
    }
  }

  async function stopScanner() {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(console.error)
      scannerRef.current.clear()
      setIsScanning(false)
    }
  }

  async function handleVerify(tokenToVerify = token) {
    const cleanToken = tokenToVerify.trim()
    if (!cleanToken) return
    
    setToken(cleanToken)
    setLoading(true)
    setResult(null)
    if (autoResumeTimer.current) clearTimeout(autoResumeTimer.current)

    let next: ScanResult
    try {
      const res = await fetch('/api/scanner/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cleanToken, eventSlug: 'all' })
      })
      const lookup = await res.json()
      next = lookup.outcome ? lookup : { outcome: 'ERROR', message: lookup.error || 'Lookup failed' }

      // A valid pass is checked in on the same scan - the gate shouldn't
      // need a second tap per person.
      if (next.outcome === 'VALID') {
        const res2 = await fetch('/api/scanner/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: cleanToken, gate: gateRef.current })
        })
        const checkin = await res2.json()
        next = {
          outcome: checkin.outcome || 'ERROR',
          message: checkin.message || checkin.error || 'Check-in failed',
          // Failed check-ins come back without the ticket; the lookup's copy
          // still says who it is and which plate.
          ticket: checkin.ticket || lookup.ticket,
        }
      }
    } catch (e) {
      next = { outcome: 'ERROR', message: e instanceof Error ? e.message : String(e) }
    }

    setResult(next)
    setLoading(false)
    playFeedback(feedbackFor(next))
    // Problems stay up until dismissed; a clean check-in moves the line on.
    if (next.outcome === 'SUCCESS') {
      autoResumeTimer.current = setTimeout(handleClear, AUTO_RESUME_MS)
    }
  }

  function handleClear() {
    setToken('')
    setResult(null)
    isProcessingRef.current = false
    if (autoResumeTimer.current) clearTimeout(autoResumeTimer.current)
    
    if (scannerRef.current && scannerRef.current.getState() === 3) { // 3 = PAUSED
       scannerRef.current.resume()
    } else if (scannerRef.current && scannerRef.current.getState() !== 2) {
       startScanner()
    }
  }

  const band = bandFor(result?.outcome)
  const ticket = result?.ticket
  const food = foodKind(ticket?.food_pref)
  const meal = mealSection(ticket?.food_pref)

  return (
    <main className="scanner-app-layout" onPointerDown={enableSound}>
      <div className="scanner-app-header">
        <a className="btn-back" href="/admin">
          &larr; Exit
        </a>
        <div className="scanner-app-title">Gate Scanner</div>
        <select value={gate} onChange={(e) => setGate(e.target.value)} className="gate-select">
          <option value="Gate 1">Gate 1</option>
          <option value="Gate 2">Gate 2</option>
        </select>
      </div>

      <div className="scanner-app-body">
        {!soundOn && (
          <button type="button" className="sound-chip" onClick={enableSound}>
            🔊 Tap to enable sound
          </button>
        )}
        <div className="scan-area-full">
          <div id="reader" style={{ width: '100%', height: '100%', display: isScanning ? 'block' : 'none' }}></div>
          {!isScanning && (
            <div className="camera-off-state" style={{ width: '100%', maxWidth: '300px' }}>
              <div style={{ marginBottom: '16px', color: '#ff6b6b' }}>{scannerError || 'Camera is paused or unavailable'}</div>
              <button type="button" className="btn btn-primary" style={{ width: '100%', marginBottom: '24px' }} onClick={startScanner}>
                Retry Camera
              </button>
              
              <div style={{ borderTop: '1px solid #333', paddingTop: '24px', textAlign: 'left' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#ccc' }}>Manual Entry</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="Enter Pass Code" 
                    value={manualToken}
                    onChange={e => setManualToken(e.target.value)}
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #444', background: '#222', color: 'white' }}
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => {
                      if (manualToken) handleVerify(manualToken);
                    }}
                  >
                    Verify
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="scanner-loading-overlay">
          <div className="spinner"></div>
          <p style={{ marginTop: '16px', color: 'white', fontWeight: 'bold' }}>Processing...</p>
        </div>
      )}

      {result && !loading && (
        <div className="scanner-result-overlay" onClick={handleClear}>
          <div className={`scanner-result-popup is-${band}`} onClick={(e) => e.stopPropagation()}>
            <div className={`outcome-band ${band}`}>
              {BAND_TITLE[result.outcome] || '✕ DENIED'}
            </div>

            <div className="result-body">
              <h3 className="result-name">
                {ticket?.participant_name || (band === 'deny' ? 'Pass not accepted' : 'Unnamed pass')}
              </h3>

              {/* The plate this QR admits to, as the biggest thing on screen -
                  a wrong plate is the mistake a busy gate actually makes. */}
              {food && (
                <div className={`food-badge ${food}${band === 'ok' ? '' : ' is-dimmed'}`}>
                  <span className={`food-symbol ${food}`} aria-hidden="true"><span /></span>
                  <span className="food-label">{food === 'veg' ? 'VEG' : 'NON-VEG'}</span>
                  {meal && <span className="food-meal">{meal}</span>}
                </div>
              )}
              {!food && ticket?.food_pref && (
                <p className="food-unknown">🍽 {ticket.food_pref}</p>
              )}

              <p className="result-message">
                {band === 'ok' ? `Checked in at ${ticket?.redeemed_gate || gate}` : result.message}
              </p>

              {ticket && (
                <div className="scanner-meta-pills">
                  <span className="pill">{ticket.event?.name || ticket.eventName}</span>
                  <span className="pill">{ticket.college_id ? `ID: ${ticket.college_id}` : 'Guest'}</span>
                  <span className="pill">{String(ticket.token).slice(0, 16)}</span>
                </div>
              )}

              <button className="btn btn-secondary" style={{ width: '100%', padding: '14px', marginTop: '20px' }} onClick={handleClear}>
                {band === 'ok' ? 'Next scan' : 'Continue Scanning'}
              </button>
            </div>

            {band === 'ok' && (
              <div className="resume-bar" style={{ animationDuration: `${AUTO_RESUME_MS}ms` }} />
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        body, html {
          overflow: hidden !important;
          height: 100dvh !important;
          width: 100vw !important;
        }
        #__next, .home-strip {
          /* Ensure header doesn't push us off screen */
        }
        
        .scanner-app-layout {
          display: flex;
          flex-direction: column;
          height: calc(100dvh - 48px); /* Account for navbar */
          background: #000;
          position: relative;
        }
        
        .scanner-app-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: rgba(20, 20, 20, 0.9);
          color: white;
          z-index: 10;
        }
        
        .scanner-app-title {
          font-weight: bold;
          font-size: 1.1rem;
          letter-spacing: 0.05em;
        }
        
        .btn-back {
          color: white;
          text-decoration: none;
          font-weight: 500;
          background: rgba(255,255,255,0.1);
          padding: 6px 12px;
          border-radius: 6px;
        }
        
        .gate-select {
          background: rgba(255,255,255,0.1);
          color: white;
          border: 1px solid rgba(255,255,255,0.3);
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.9rem;
        }
        
        .scanner-app-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
          background: #111;
        }
        
        .scan-area-full {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        #reader {
          width: 100% !important;
          height: 100% !important;
        }
        
        #reader video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
        
        .camera-off-state {
          color: white;
          text-align: center;
          padding: 24px;
        }
        
        .scanner-result-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px;
          animation: fadeIn 0.2s ease-out forwards;
        }

        .scanner-result-popup {
          position: relative;
          background: white;
          border-radius: 24px;
          border: 4px solid transparent;
          overflow: hidden;
          width: 100%;
          max-width: 440px;
          max-height: 100%;
          overflow-y: auto;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
          animation: scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .scanner-result-popup.is-ok { border-color: #16a34a; }
        .scanner-result-popup.is-warn { border-color: #d97706; background: #fffbeb; }
        .scanner-result-popup.is-deny { border-color: #dc2626; background: #fef2f2; }

        .outcome-band {
          padding: 14px 16px;
          font-size: 1.5rem;
          font-weight: 900;
          letter-spacing: 0.04em;
          color: white;
        }
        .outcome-band.ok { background: #16a34a; }
        .outcome-band.warn { background: #d97706; }
        .outcome-band.deny { background: #dc2626; }

        .result-body {
          padding: 18px 18px 22px;
        }

        .result-name {
          margin: 0 0 14px;
          font-size: 1.5rem;
          font-weight: 800;
          color: #111;
          overflow-wrap: anywhere;
        }

        .food-badge {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-height: min(34dvh, 280px);
          padding: 20px 12px;
          border-radius: 18px;
          color: white;
        }
        .food-badge.veg { background: #15803d; }
        .food-badge.nonveg { background: #7c2d12; }
        .food-badge.is-dimmed { opacity: 0.45; }

        .food-label {
          font-size: clamp(2.6rem, 15vw, 4rem);
          font-weight: 900;
          line-height: 1;
          letter-spacing: 0.03em;
        }
        .food-meal {
          font-size: 1.1rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          opacity: 0.9;
        }

        /* The FSSAI mark printed on Indian food packs: a dot for veg, a
           triangle for non-veg, so the badge reads even without colour. */
        .food-symbol {
          width: 60px;
          height: 60px;
          display: grid;
          place-items: center;
          background: white;
          border: 5px solid;
          border-radius: 8px;
        }
        .food-symbol.veg { border-color: #15803d; }
        .food-symbol.veg span {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: #15803d;
        }
        .food-symbol.nonveg { border-color: #7c2d12; }
        .food-symbol.nonveg span {
          width: 0;
          height: 0;
          border-left: 15px solid transparent;
          border-right: 15px solid transparent;
          border-bottom: 26px solid #7c2d12;
        }

        .food-unknown {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 700;
          color: #111;
        }

        .result-message {
          margin: 14px 0 0;
          font-size: 1.05rem;
          color: #333;
        }

        .resume-bar {
          position: absolute;
          left: 0;
          bottom: 0;
          height: 5px;
          width: 100%;
          background: #16a34a;
          transform-origin: left;
          animation-name: drain;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }

        .sound-chip {
          position: absolute;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 20;
          background: rgba(0,0,0,0.75);
          color: white;
          border: 1px solid rgba(255,255,255,0.35);
          border-radius: 999px;
          padding: 8px 16px;
          font-size: 0.9rem;
          font-weight: 600;
          white-space: nowrap;
        }

        .scanner-meta-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: center;
          margin-top: 14px;
        }
        
        .scanner-loading-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(6px);
          z-index: 200;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        
        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes scaleUp {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        @keyframes drain {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .scanner-result-overlay,
          .scanner-result-popup {
            animation: none;
          }
          .resume-bar {
            display: none;
          }
        }
      `}</style>
    </main>
  )
}
