'use client'

import { QRCodeSVG } from 'qrcode.react'

export default function QRWrapper({ text }: { text: string }) {
  return (
    <div className="pass-world__qr" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <QRCodeSVG 
        value={text} 
        size={140} 
        level="H"
        bgColor="#ffffff"
        fgColor="#000000"
      />
    </div>
  )
}
