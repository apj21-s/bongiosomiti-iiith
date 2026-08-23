'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

export default function ScannerPage() {
  const [token, setToken] = useState('')
  const [gate, setGate] = useState('Gate 1')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const tokenInputRef = useRef<HTMLInputElement>(null)
  
  const scannerRef = useRef<any>(null)

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error)
      }
    }
  }, [])

  async function startScanner() {
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("reader")
      }

      setIsScanning(true)
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          if (scannerRef.current) {
             scannerRef.current.pause(true)
          }
          setToken(decodedText)
          handleVerify(decodedText)
        },
        (errorMessage: string) => {
          // ignore background scanning errors
        }
      )
    } catch (err) {
      console.error('Error starting scanner', err)
      alert('Camera access failed. Please use manual token input.')
      setIsScanning(false)
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
      setResult(data)
    } catch (e: any) {
      setResult({ outcome: 'ERROR', message: e.message })
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
      setResult(data)
    } catch (e: any) {
      setResult({ outcome: 'ERROR', message: e.message })
    } finally {
      setLoading(false)
    }
  }
  
  function handleClear() {
    setToken('')
    setResult(null)
    if (scannerRef.current && isScanning) {
       scannerRef.current.resume()
    }
    if (tokenInputRef.current) {
      tokenInputRef.current.focus()
    }
  }

  let resultColor = 'var(--muted)'
  let resultBorder = 'var(--border)'
  if (result) {
    if (result.outcome === 'VALID' || result.outcome === 'SUCCESS') {
      resultColor = '#10b981' // green
      resultBorder = '#10b981'
    } else {
      resultColor = '#ef4444' // red
      resultBorder = '#ef4444'
    }
  }

  return (
    <main className="panel container" data-scanner-page data-event-slug="all" style={{maxWidth: '1300px', margin: '2rem auto', padding: '0', }}>
      <div className="panel-head" style={{padding: '24px 28px', }}>
        <div>
          <p className="section-label">Gate Security &amp; Admissions</p>
          <h1 style={{fontSize: '2rem', margin: '4px 0 6px', }}>Live Gate Scanner</h1>
          <p>Validate QR passes via device camera, manual token entry, or quick preset test tokens.</p>
        </div>
        <Link className="btn btn-secondary" href="/admin/check-ins">View Check-in History &rarr;</Link>
      </div>

      <div className="screen-grid scanner-grid" style={{padding: '24px 28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px', }}>
        
        <div className="art-panel scanner-stage">
          <div className="frame-tag">Live Camera Optical Scanner</div>
          <div className="scene-scanner scanner-shell">
            <div className="scanner-card">
              <div className="scanner-brand">
                <strong>BANGIYA.SAMITI GATE SCANNER</strong>
                <span>IIIT Hyderabad Bangiya Samiti &bull; Realtime Verification</span>
              </div>
              <div className="scan-area" style={{position: 'relative', background: '#1a1614', borderRadius: '18px', overflow: 'hidden', minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', }}>
                <div id="reader" style={{ width: '100%', height: '100%', display: isScanning ? 'block' : 'none' }}></div>
                {!isScanning && <div style={{ color: '#fff', position: 'absolute' }}>Camera off</div>}
              </div>
              <div className="scanner-status" style={{marginTop: '12px', padding: '12px', background: 'rgba(255,255,255,0.7)', borderRadius: '12px', textAlign: 'center', }}>
                <strong className="scanner-status__title" style={{display: 'block', color: 'var(--brand)', fontSize: '1rem', }}>
                  {isScanning ? 'SCANNING' : 'READY'}
                </strong>
                <span className="scanner-status__body" style={{fontSize: '0.85rem', color: 'var(--muted)', }}>
                  {isScanning ? 'Point camera at QR code' : 'Press start to request camera access or use manual input.'}
                </span>
              </div>
            </div>
            <div className="scanner-controls" style={{display: 'flex', gap: '8px', marginTop: '14px', }}>
              <button type="button" className="btn btn-primary scanner-start" style={{flex: '1', }} onClick={startScanner} disabled={isScanning}>📷 Start Camera</button>
              <button type="button" className="btn btn-secondary scanner-stop" onClick={stopScanner} disabled={!isScanning}>Stop</button>
              <button type="button" className="btn btn-secondary scanner-reset" onClick={handleClear}>Clear</button>
            </div>
          </div>
        </div>

        
        <div className="scanner-detail" style={{padding: '0', }}>
          <div className="panel" style={{marginTop: '0', background: 'rgba(255,255,255,0.8)', borderRadius: '22px', border: '1px solid var(--border)', }}>
            <div className="panel-head" style={{padding: '18px 22px', }}>
              <div>
                <p className="section-label">Manual / Preset Verification</p>
                <h2 style={{fontSize: '1.35rem', margin: '2px 0', }}>Pass Lookup &amp; Gate Entry</h2>
              </div>
            </div>

            <div className="section" style={{padding: '18px 22px', }}>
              <div className="field-grid" style={{gridTemplateColumns: '2fr 1fr', gap: '12px', }}>
                <div className="field">
                  <label htmlFor="scanner-token">Pass Token</label>
                  <input ref={tokenInputRef} id="scanner-token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste or type token (e.g. MBH-DEMO-001)" />
                </div>
                <div className="field">
                  <label htmlFor="scanner-gate">Gate Number</label>
                  <input id="scanner-gate" value={gate} onChange={(e) => setGate(e.target.value)} placeholder="Gate 1" />
                </div>
              </div>

              <div className="row-actions" style={{display: 'flex', gap: '10px', marginTop: '14px', }}>
                <button className="btn btn-secondary scanner-lookup" type="button" style={{flex: '1', }} onClick={() => handleVerify()} disabled={loading || !token}>Verify Pass</button>
                <button className="btn btn-primary scanner-checkin" type="button" style={{flex: '1.4', }} onClick={handleCheckin} disabled={loading || !token}>✓ Check In Attendee</button>
              </div>

              
              <div className="result-card scanner-detailCard" style={{marginTop: '18px', padding: '18px', borderRadius: '18px', border: `2px solid ${resultBorder}`, background: '#fff', transition: 'all 0.25s ease', }}>
                <h3 className="result-title scanner-resultName" style={{margin: '0 0 6px', fontSize: '1.25rem', color: resultColor }}>
                  {result ? (result.participantName || result.outcome) : 'Participant'}
                </h3>
                <p className="result-copy scanner-message" style={{margin: '0 0 14px', color: 'var(--muted)', fontSize: '0.95rem', }}>
                  {result ? result.message : 'Enter or scan a pass token above to inspect validity.'}
                </p>
                {result && result.ticket && (
                  <div className="meta-row" style={{display: 'flex', gap: '8px', flexWrap: 'wrap', }}>
                    <span className="pill scanner-resultPill">{result.ticket.event?.name || result.ticket.eventName}</span>
                    <span className="pill scanner-resultPill">{result.ticket.college_id ? `ID: ${result.ticket.college_id}` : 'Guest'}</span>
                    <span className="pill scanner-resultPill">{String(result.ticket.token).slice(0, 16)}</span>
                    <span className="pill scanner-resultPill">{result.ticket.status}</span>
                    <span className="pill scanner-resultPill">{result.ticket.venue || result.ticket.event?.venue}</span>
                    <span className="pill scanner-resultPill">{gate}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
