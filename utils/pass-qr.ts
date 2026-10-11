import QRCode from 'qrcode'
import { PNG } from 'pngjs'
import { FOOD_COLORS, foodKind, type FoodKind } from './food-kind'

/**
 * The PNG of a pass's QR, with the plate it admits to drawn into it.
 *
 * A Veg pass is green with the veg mark (a dot in a square) in the middle, a
 * Non-Veg pass brown with the triangle - so the holder, a volunteer or the
 * food counter can tell them apart without a scanner, and the shapes still
 * differ when the pass is printed in black and white. The QR is built at
 * error-correction level H, which survives losing ~30% of the code; the mark
 * covers about 4%, and decodes as reliably as the plain QR it replaces.
 *
 * Two things about where and how the mark sits are load-bearing - both were
 * found by decoding these images with jsQR and ZXing (what the gate scanner
 * runs), not guessed:
 * - The code is pinned to version 5 (37x37). Tokens are ~15 characters,
 *   which would otherwise give a 25x25 code where the mark eats most of what
 *   level H can repair. Version 6 read worse (smaller modules at the same
 *   print size), and from version 7 up an alignment pattern sits dead
 *   centre, right under the mark.
 * - A square ring around a big dot is, to a decoder, a finder pattern (the
 *   1:1:3:1:1 eye in each corner), and a fourth "eye" in the middle breaks
 *   the read. The ring here is thinner and the dot smaller than that ratio.
 *
 * The image is drawn straight from the module grid with pngjs (which `qrcode`
 * itself uses), so there is no image-processing library to install or run.
 */

// What the mail has always used for a pass with no plate on it.
const PLAIN_DARK = '#281208'
// Target width of the image in pixels; email shows it at 200px, so this keeps
// it crisp on high-density screens.
const TARGET_PX = 360
// Quiet zone around the code, in modules (the spec asks for 4).
const MARGIN = 4
// The mark's side as a share of the code's width.
const MARK_SHARE = 0.2
// The smallest version this draws; see above.
const MIN_VERSION = 5
// Each edge pixel of the mark is sampled SS x SS times so curves aren't jagged.
const SS = 4

type RGB = [number, number, number]

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const WHITE: RGB = [255, 255, 255]

function inRoundedRect(x: number, y: number, x0: number, y0: number, x1: number, y1: number, r: number) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const dx = Math.max(x0 + r - x, 0, x - (x1 - r))
  const dy = Math.max(y0 + r - y, 0, y - (y1 - r))
  return dx * dx + dy * dy <= r * r
}

function inTriangle(x: number, y: number) {
  // (50,26) (74,70) (26,70): the same points as foodMarkSvg().
  const side = (ax: number, ay: number, bx: number, by: number) => (bx - ax) * (y - ay) - (by - ay) * (x - ax)
  const a = side(50, 26, 74, 70)
  const b = side(74, 70, 26, 70)
  const c = side(26, 70, 50, 26)
  return (a >= 0 && b >= 0 && c >= 0) || (a <= 0 && b <= 0 && c <= 0)
}

/**
 * Whether a point of the mark, on the 100x100 box `foodMarkSvg()` uses, is
 * coloured: the inner shape, or the tile's border ring.
 */
function markInk(kind: FoodKind, x: number, y: number): boolean {
  const shape = kind === 'veg'
    ? (x - 50) ** 2 + (y - 50) ** 2 <= 18 * 18
    : inTriangle(x, y)
  if (shape) return true
  if (inRoundedRect(x, y, 8, 8, 92, 92, 6)) return false
  return inRoundedRect(x, y, 0, 0, 100, 100, 14)
}

export function passQrPng(token: string, foodPref?: string | null): Buffer {
  const kind = foodKind(foodPref)
  let qr: QRCode.QRCode
  try {
    qr = QRCode.create(token, { errorCorrectionLevel: 'H', version: MIN_VERSION })
  } catch {
    // Too long for version 5 - not a token this app issues, but still a pass.
    qr = QRCode.create(token, { errorCorrectionLevel: 'H' })
  }
  const n = qr.modules.size
  const dark = qr.modules.data

  const scale = Math.max(4, Math.round(TARGET_PX / (n + 2 * MARGIN)))
  const side = (n + 2 * MARGIN) * scale
  const png = new PNG({ width: side, height: side })
  const px = png.data

  const put = (x: number, y: number, [r, g, b]: RGB) => {
    const i = (y * side + x) * 4
    px[i] = r
    px[i + 1] = g
    px[i + 2] = b
    px[i + 3] = 255
  }

  // The mark's box, in pixels, centred on the code. Modules it touches are
  // cleared whole, so no half-module slivers are left around it. (Clearing a
  // further ring for breathing room cost more reads than it was worth.)
  const codePx = n * scale
  const markPx = kind ? Math.round(codePx * MARK_SHARE) : 0
  const m0 = Math.round((side - markPx) / 2)
  const m1 = m0 + markPx
  const clearFrom = Math.floor((m0 - MARGIN * scale) / scale)
  const clearTo = Math.floor((m1 - 1 - MARGIN * scale) / scale)
  const cleared = (r: number, c: number) =>
    kind !== null && r >= clearFrom && r <= clearTo && c >= clearFrom && c <= clearTo

  const ink = hexToRgb(kind ? FOOD_COLORS[kind].qr : PLAIN_DARK)
  for (let y = 0; y < side; y++) {
    const r = Math.floor(y / scale) - MARGIN
    for (let x = 0; x < side; x++) {
      const c = Math.floor(x / scale) - MARGIN
      const on = r >= 0 && r < n && c >= 0 && c < n && dark[r * n + c] === 1 && !cleared(r, c)
      put(x, y, on ? ink : WHITE)
    }
  }

  if (kind) {
    const mark = hexToRgb(FOOD_COLORS[kind].mark)
    const unit = 100 / markPx
    for (let y = m0; y < m1; y++) {
      for (let x = m0; x < m1; x++) {
        let hits = 0
        for (let sy = 0; sy < SS; sy++) {
          for (let sx = 0; sx < SS; sx++) {
            const ux = (x - m0 + (sx + 0.5) / SS) * unit
            const uy = (y - m0 + (sy + 0.5) / SS) * unit
            if (markInk(kind, ux, uy)) hits++
          }
        }
        const a = hits / (SS * SS)
        put(x, y, [0, 1, 2].map(i => Math.round(mark[i] * a + 255 * (1 - a))) as RGB)
      }
    }
  }

  return PNG.sync.write(png)
}
