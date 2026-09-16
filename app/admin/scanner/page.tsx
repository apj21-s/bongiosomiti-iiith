'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

export default function ScannerPage() {
  const [token, setToken] = useState('')
  const [manualToken, setManualToken] = useState('')
  const [gate, setGate] = useState('Gate 1')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scannerError, setScannerError] = useState('')
  
  const scannerRef = useRef<any>(null)
  const isProcessingRef = useRef(false)
  const autoResumeTimer = useRef<any>(null)

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
    
    try {
      const res = await fetch('/api/scanner/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cleanToken, eventSlug: 'all' })
      })
      const data = await res.json()
      setResult({ ...data, isCheckinComplete: false })
    } catch (e: any) {
      setResult({ outcome: 'ERROR', message: e.message, isCheckinComplete: false })
    } finally {
      setLoading(false)
    }
  }

  async function handleCheckin() {
    const cleanToken = token.trim()
    if (!cleanToken) return
    
    setLoading(true)
    try {
      const res = await fetch('/api/scanner/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cleanToken, gate })
      })
      const data = await res.json()
      setResult({ ...data, isCheckinComplete: true })
    } catch (e: any) {
      setResult({ outcome: 'ERROR', message: e.message, isCheckinComplete: true })
    } finally {
      setLoading(false)
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

  let resultColor = 'var(--muted)'
  let resultBg = '#ffffff'
  if (result) {
    if (result.outcome === 'VALID' || result.outcome === 'SUCCESS') {
      resultColor = '#065f46' // dark green
      resultBg = '#d1fae5' // light green bg
    } else {
      resultColor = '#991b1b' // dark red
      resultBg = '#fee2e2' // light red bg
    }
  }

  return (
    <main className="scanner-app-layout">
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
                    placeholder="Enter pass code..." 
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
          <div className="scanner-result-popup" style={{ backgroundColor: resultBg, border: `2px solid ${resultColor}` }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: resultColor, fontSize: '1.8rem', margin: '0 0 8px' }}>
              {result.outcome === 'VALID' || result.outcome === 'SUCCESS' ? '✓ VALID PASS' : '✕ DENIED'}
            </h2>
            <h3 style={{ margin: '0 0 12px', fontSize: '1.4rem', color: '#111' }}>
              {result.participantName || result.outcome}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#333' }}>
              {result.isCheckinComplete ? '✓ Attendee successfully checked in!' : result.message}
            </p>
            
            {result.ticket && (
              <div className="scanner-meta-pills">
                <span className="pill">{result.ticket.event?.name || result.ticket.eventName}</span>
                <span className="pill">{result.ticket.college_id ? `ID: ${result.ticket.college_id}` : 'Guest'}</span>
                <span className="pill">{String(result.ticket.token).slice(0, 16)}</span>
                <span className="pill">{result.ticket.status}</span>
              </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
              {(result.outcome === 'VALID' || result.outcome === 'SUCCESS') && !result.isCheckinComplete && (
                <button className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1.1rem' }} onClick={handleCheckin}>
                  Confirm Check-in &rarr;
                </button>
              )}
              <button className="btn btn-secondary" style={{ width: '100%', padding: '14px' }} onClick={handleClear}>
                Continue Scanning
              </button>
            </div>
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
          padding: 24px;
          animation: fadeIn 0.2s ease-out forwards;
        }
        
        .scanner-result-popup {
          background: white;
          border-radius: 24px;
          padding: 32px 24px;
          width: 100%;
          max-width: 400px;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
          animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        
        .scanner-meta-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: center;
          margin-top: 16px;
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
      `}</style>
    </main>
  )
}
