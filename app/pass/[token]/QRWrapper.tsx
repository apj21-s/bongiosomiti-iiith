'use client'

import { QRCodeSVG } from 'qrcode.react'
import { FOOD_COLORS, foodKind, foodMarkSvg } from '@/utils/food-kind'

const SIZE = 140

// Same look as the emailed pass (utils/pass-qr.ts): the plate's colour and
// its veg / non-veg mark in the middle, so the two can't be confused unscanned.
export default function QRWrapper({ text, foodPref }: { text: string; foodPref?: string | null }) {
  const kind = foodKind(foodPref)
  const markPx = Math.round(SIZE * 0.2)
  return (
    <div className="pass-world__qr" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <QRCodeSVG
        value={text}
        size={SIZE}
        level="H"
        minVersion={5}
        bgColor="#ffffff"
        fgColor={kind ? FOOD_COLORS[kind].qr : '#000000'}
        imageSettings={kind ? {
          src: `data:image/svg+xml;utf8,${encodeURIComponent(foodMarkSvg(kind))}`,
          width: markPx,
          height: markPx,
          excavate: true,
        } : undefined}
      />
    </div>
  )
}
